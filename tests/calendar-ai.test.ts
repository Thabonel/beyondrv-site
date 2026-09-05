import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateToEventInput,
  etaDisagreement,
  extractionInstructions,
  orderDateFromCandidate,
  selectUnprocessedMessages,
  validateCandidates,
  type CalendarMessage,
  type ExtractionContext,
} from '../netlify/functions/calendar-ai-core.ts';

const context: ExtractionContext = {
  today: '2026-09-05',
  orders: [
    { id: 'o1', customerName: 'Tasmanian customer', customerEmail: 'tas@example.com', productSlug: 'advent-2450', productTitle: 'Advent 2450', status: 'in_transit' },
  ],
  products: [
    { slug: 'advent-2450', title: 'Advent 2450', containerEtaDate: '2026-09-20' },
  ],
};

const message: CalendarMessage = {
  threadId: 't1', messageId: 'm1', fromEmail: 'li@factory.cn', subject: 'Shipping update',
  bodyText: 'Container lands 18 Sep.', snippet: '', receivedAt: '2026-09-04T03:00:00.000Z',
};

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Container ETA: Advent 2450', kind: 'container_eta', date: '2026-09-18', startTime: '', endTime: '',
    allDay: true, confidence: 0.9, sourceExcerpt: 'lands 18 Sep', relatedOrderId: '', relatedProductSlug: 'advent-2450',
    relatedCustomerEmail: '', reasoning: 'supplier gave a date', ...overrides,
  };
}

test('a confident, well-formed candidate is accepted', () => {
  const { accepted, rejected } = validateCandidates({ candidates: [candidate()] }, context);
  assert.equal(accepted.length, 1);
  assert.deepEqual(rejected, []);
});

test('low confidence, far dates, and unknown links are dropped with a reason', () => {
  const { accepted, rejected } = validateCandidates({ candidates: [
    candidate({ confidence: 0.3 }),
    candidate({ date: '2027-12-01' }),
    candidate({ date: '2026-08-01' }),
    candidate({ relatedOrderId: 'nope' }),
    candidate({ relatedProductSlug: 'nope' }),
    candidate({ kind: 'party' }),
    candidate({ date: 'the 18th' }),
  ] }, context);
  assert.equal(accepted.length, 0);
  assert.deepEqual(rejected.map((item) => item.reason.split(' ')[0]), ['confidence', 'more', 'more', 'order', 'product', 'unknown', '"the']);
});

test('a candidate with no time becomes all-day even if the model said otherwise', () => {
  const { accepted } = validateCandidates({ candidates: [candidate({ allDay: false, startTime: '' })] }, context);
  assert.equal(accepted[0].allDay, true);
});

test('a candidate with a malformed time is rejected rather than placed at midnight', () => {
  const { rejected } = validateCandidates({ candidates: [candidate({ allDay: false, startTime: '2pm' })] }, context);
  assert.match(rejected[0].reason, /not a time/);
});

test('a candidate linked to an order inherits that order\'s product, so the clash rule can see it', () => {
  const { accepted } = validateCandidates({ candidates: [
    candidate({ kind: 'customer_visit', title: 'Tasmanian customer visiting', relatedOrderId: 'o1', relatedProductSlug: '' }),
  ] }, context);
  assert.equal(accepted[0].relatedProductSlug, 'advent-2450');
});

test('a supplier date that differs from the product ETA is reported, for the same product only', () => {
  assert.match(etaDisagreement(validateCandidates({ candidates: [candidate()] }, context).accepted[0], context), /2026-09-18.*2026-09-20/);
  assert.equal(etaDisagreement(validateCandidates({ candidates: [candidate({ date: '2026-09-20' })] }, context).accepted[0], context), '');
  assert.equal(etaDisagreement(validateCandidates({ candidates: [candidate({ kind: 'meeting' })] }, context).accepted[0], context), '');
});

test('a timed candidate becomes a timed event with the email attached', () => {
  const [accepted] = validateCandidates({ candidates: [
    candidate({ kind: 'meeting', title: 'Call with Li', allDay: false, startTime: '14:00', endTime: '14:30' }),
  ] }, context).accepted;
  const input = candidateToEventInput(accepted, message);
  assert.equal(input.start, '2026-09-18T14:00');
  assert.equal(input.end, '2026-09-18T14:30');
  assert.equal(input.source, 'ai');
  assert.deepEqual(input.links, { productSlug: 'advent-2450' });
  assert.equal((input.sourceEmail as { messageId: string }).messageId, 'm1');
});

test('an end time before the start is ignored and the default hour applies', () => {
  const [accepted] = validateCandidates({ candidates: [
    candidate({ kind: 'meeting', allDay: false, startTime: '14:00', endTime: '13:00' }),
  ] }, context).accepted;
  assert.equal(candidateToEventInput(accepted, message).end, '2026-09-18T15:00');
});

test('unprocessed messages come from the messages array, skip done ones, and respect the window', () => {
  const threads = [{
    id: 't1', threadId: 't1', subject: 'Shipping', fromEmail: 'li@factory.cn',
    calendarProcessedMessageIds: ['m1'],
    messages: [
      { messageId: 'm1', receivedAt: '2026-09-04T00:00:00.000Z', bodyText: 'done already' },
      { messageId: 'm2', receivedAt: '2026-09-04T01:00:00.000Z', bodyText: 'new' },
      { messageId: 'm3', receivedAt: '2026-08-01T00:00:00.000Z', bodyText: 'too old' },
    ],
  }, {
    // An older thread record with no messages array still gets read once.
    id: 't2', threadId: 't2', messageId: 'm4', subject: 'Visit', fromEmail: 'tas@example.com',
    receivedAt: '2026-09-03T00:00:00.000Z', bodyText: 'we fly up on the 10th',
  }];
  const selected = selectUnprocessedMessages(threads, '2026-09-05', 14, 40);
  assert.deepEqual(selected.map((item) => item.messageId), ['m2', 'm4']);
  assert.equal(selected[0].subject, 'Shipping', 'a message inherits the thread subject');
  assert.equal(selectUnprocessedMessages(threads, '2026-09-05', 14, 1).length, 1, 'the per-run cap holds');
});

test('the instructions carry today, business hours, and the orders the model may link to', () => {
  const text = extractionInstructions(context);
  assert.match(text, /2026-09-05/);
  assert.match(text, /08:00 to 17:00/);
  assert.match(text, /o1 \| Tasmanian customer/);
  assert.match(text, /advent-2450 \| Advent 2450 \| container ETA 2026-09-20/);
});

test('a handover that names its order becomes a date on that order, not a calendar event', () => {
  const [accepted] = validateCandidates({ candidates: [
    candidate({ kind: 'expected_handover', title: 'Handover: Tasmanian customer', relatedOrderId: 'o1', relatedProductSlug: '', allDay: false, startTime: '10:00' }),
  ] }, context).accepted;
  assert.deepEqual(orderDateFromCandidate(accepted), { kind: 'expected_handover', orderId: 'o1', date: '2026-09-18', time: '10:00' });
});

test('a visit with no order stays a calendar event for someone to place', () => {
  const [accepted] = validateCandidates({ candidates: [candidate({ kind: 'customer_visit', relatedProductSlug: '' })] }, context).accepted;
  assert.equal(orderDateFromCandidate(accepted), null);
  assert.equal(orderDateFromCandidate(validateCandidates({ candidates: [candidate({ kind: 'meeting', relatedOrderId: 'o1' })] }, context).accepted[0]), null,
    'a meeting about an order is still a meeting');
});
