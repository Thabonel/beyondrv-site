import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMinutes,
  buildCalendarEvents,
  calendarClashes,
  EVENT_KIND_META,
} from '../netlify/functions/calendar-events-core.ts';

test('an order contributes one event per date it actually holds', () => {
  const events = buildCalendarEvents({
    orders: [{
      id: 'o1',
      customerName: 'Tasmanian customer',
      productTitle: 'Advent 2450',
      status: 'in_transit',
      customerVisitDate: '2026-09-10',
      expectedHandoverDate: '2026-10-01',
      expectedArrivalDate: '2026-09-20',
      factoryOrderDate: '2026-06-01',
      nextActionDate: '2026-09-08',
    }],
  });
  assert.deepEqual(
    events.map((e) => e.kind),
    ['factory_order', 'next_action', 'customer_visit', 'expected_arrival', 'expected_handover'],
  );
});

test('dates the record does not hold produce nothing', () => {
  const events = buildCalendarEvents({ orders: [{ id: 'o1', customerName: 'A', status: 'enquiry' }] });
  assert.deepEqual(events, []);
});

test('a malformed date is skipped rather than rendered on a wrong day', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'A', customerVisitDate: 'next Tuesday' },
             { id: 'o2', customerName: 'B', customerVisitDate: '10/09/2026' },
             { id: 'o3', customerName: 'C', customerVisitDate: '2026-13-40' }],
  });
  assert.deepEqual(events, []);
});

test('a record with no id is skipped, because the event could not link back to it', () => {
  const events = buildCalendarEvents({ orders: [{ customerName: 'A', customerVisitDate: '2026-09-10' }] });
  assert.deepEqual(events, []);
});

test('enquiries use the lead follow-up date, whichever field holds it', () => {
  const events = buildCalendarEvents({
    enquiries: [
      { id: 'e1', name: 'Ann', leadStatus: { nextFollowUpDate: '2026-09-09', status: 'quoted' } },
      { id: 'e2', name: 'Ben', followUpDate: '2026-09-11' },
    ],
  });
  assert.deepEqual(events.map((e) => [e.recordId, e.date]), [['e1', '2026-09-09'], ['e2', '2026-09-11']]);
  assert.equal(events[0].detail, 'quoted');
});

test('only open tasks appear; a done task is not a plan', () => {
  const events = buildCalendarEvents({
    tasks: [
      { id: 't1', title: 'Call the shipping agent', dueDate: '2026-09-08', status: 'open' },
      { id: 't2', title: 'Already handled', dueDate: '2026-09-08', status: 'done' },
    ],
  });
  assert.deepEqual(events.map((e) => e.recordId), ['t1']);
});

test('a container ETA carries its own wording through to the calendar', () => {
  const [event] = buildCalendarEvents({
    products: [{ slug: 'advent-2450', title: 'Advent 2450', containerEtaDate: '2026-09-20', containerEtaText: 'Li says week 38' }],
  });
  assert.equal(event.kind, 'container_eta');
  assert.equal(event.title, 'Container ETA: Advent 2450');
  assert.equal(event.detail, 'Li says week 38');
});

test('events sort by date, and a commitment outranks other events on the same day', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-10', nextActionDate: '2026-09-10' }],
    tasks: [{ id: 't1', title: 'Something', dueDate: '2026-09-09', status: 'open' }],
  });
  assert.deepEqual(events.map((e) => e.kind), ['task', 'customer_visit', 'next_action']);
});

test('only visits and handovers are marked as commitments to a customer', () => {
  const commitments = Object.entries(EVENT_KIND_META)
    .filter(([, meta]) => meta.commitment).map(([kind]) => kind).sort();
  assert.deepEqual(commitments, ['customer_visit', 'expected_handover']);
});

test('every kind has a label and a colour, so nothing renders unlabelled', () => {
  for (const [kind, meta] of Object.entries(EVENT_KIND_META)) {
    assert.ok(meta.label.length > 0, `${kind} needs a label`);
    assert.match(meta.colour, /^#[0-9a-f]{6}$/i, `${kind} needs a colour`);
  }
});

test('event ids are unique per record and date type, so two dates on one order do not collide', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-10', expectedHandoverDate: '2026-09-10' }],
  });
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});

test('a container arriving after the customer does is reported as a clash', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'Tasmanian customer', productSlug: 'advent-2450', customerVisitDate: '2026-09-10' }],
    products: [{ slug: 'advent-2450', title: 'Advent 2450', containerEtaDate: '2026-09-20' }],
  });
  const clashes = calendarClashes(events);
  assert.equal(clashes.length, 1);
  assert.match(clashes[0], /2026-09-10/);
  assert.match(clashes[0], /2026-09-20/);
});

test('a late container for a DIFFERENT vehicle is not the customer\'s problem', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'A', productSlug: 'advent-2450', customerVisitDate: '2026-09-10' }],
    products: [{ slug: 'sunpatch-15xc', title: 'Sunpatch', containerEtaDate: '2026-09-20' }],
  });
  assert.deepEqual(calendarClashes(events), [],
    'matching on dates alone would fire every time any vehicle anywhere was late');
});

test('a late arrival on the customer own order is a clash even without a product link', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-10', expectedArrivalDate: '2026-09-18' }],
  });
  const clashes = calendarClashes(events);
  assert.equal(clashes.length, 1);
  assert.match(clashes[0], /expected arrival/);
});

test('a container arriving before the visit is not a clash', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-20' }],
    products: [{ slug: 's', title: 'T', containerEtaDate: '2026-09-10' }],
  });
  assert.deepEqual(calendarClashes(events), []);
});

test('empty sources produce an empty calendar rather than a crash', () => {
  assert.deepEqual(buildCalendarEvents({}), []);
  assert.deepEqual(calendarClashes([]), []);
});

test('a visit with a time is drawn at that time for an hour; without one it is all-day', () => {
  const [timed] = buildCalendarEvents({ orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-10', customerVisitTime: '10:00' }] });
  assert.deepEqual([timed.start, timed.end, timed.allDay], ['2026-09-10T10:00', '2026-09-10T11:00', false]);
  const [allDay] = buildCalendarEvents({ orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-10' }] });
  assert.deepEqual([allDay.start, allDay.end, allDay.allDay], ['2026-09-10', '2026-09-10', true]);
});

test('a malformed time falls back to all-day rather than a wrong hour', () => {
  const [event] = buildCalendarEvents({ orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-10', customerVisitTime: '10am' }] });
  assert.equal(event.allDay, true);
});

test('a task with a due time is timed; a handover with a time is timed', () => {
  const events = buildCalendarEvents({
    tasks: [{ id: 't1', title: 'Ring the agent', dueDate: '2026-09-08', dueTime: '09:30', status: 'open' }],
    orders: [{ id: 'o1', customerName: 'A', expectedHandoverDate: '2026-09-09', expectedHandoverTime: '16:00' }],
  });
  assert.deepEqual(events.map((e) => e.start), ['2026-09-08T09:30', '2026-09-09T16:00']);
});

test('every projected event says it came from a record', () => {
  const events = buildCalendarEvents({ orders: [{ id: 'o1', customerName: 'A', customerVisitDate: '2026-09-10' }] });
  assert.equal(events[0].source, 'record');
});

test('an hour added at the end of a day rolls into the next day', () => {
  assert.equal(addMinutes('2026-09-10T23:30', 60), '2026-09-11T00:30');
  assert.equal(addMinutes('2026-12-31T23:30', 60), '2027-01-01T00:30');
});

test('a container ETA read from an email says so in the clash', () => {
  const events = buildCalendarEvents({
    orders: [{ id: 'o1', customerName: 'A', productSlug: 'advent-2450', customerVisitDate: '2026-09-10' }],
  });
  events.push({
    id: 'calendar:c1', kind: 'container_eta', date: '2026-09-18', start: '2026-09-18', end: '2026-09-18', allDay: true,
    title: 'Container ETA: Advent 2450', detail: '', recordType: 'calendar', recordId: 'c1', isCommitment: false,
    source: 'ai', productSlug: 'advent-2450',
  });
  const clashes = calendarClashes(events);
  assert.equal(clashes.length, 1);
  assert.match(clashes[0], /according to an email/);
});
