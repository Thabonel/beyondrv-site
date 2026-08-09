import assert from 'node:assert/strict';
import test from 'node:test';
import { idempotencyKey, normaliseIdempotencyKey } from '../netlify/functions/command-idempotency-core.ts';
import { buildSalesActivityEvent, salesActivityKey } from '../netlify/functions/sales-activity-core.ts';

test('idempotency keys are bounded and stored only as hashes', () => {
  const raw = ` enquiry-123:create-agreement:${'x'.repeat(400)} `;
  const normalised = normaliseIdempotencyKey(raw);
  assert.equal(normalised.length, 240);
  const key = idempotencyKey('Agreement:Create', normalised);
  assert.match(key, /^agreement:create\/[a-f0-9]{64}\.json$/);
  assert.equal(key.includes('enquiry-123'), false);
  assert.equal(idempotencyKey('Agreement:Create', normalised), key);
});

test('sales activity builder records actor and stable cross-record links', () => {
  const now = new Date('2026-08-09T08:30:00.000Z');
  const event = buildSalesActivityEvent({
    id: 'activity-test',
    commandId: 'command-test',
    activityType: 'agreement_created',
    summary: 'Agreement created from enquiry.',
    customerId: 'customer-1',
    opportunityId: 'opportunity-1',
    enquiryId: 'enquiry-1',
    agreementId: 'agreement-1',
    source: 'gm_ui',
    metadata: { totalCents: 14_000_000 },
  }, { id: 'gm', role: 'gm' }, now);

  assert.equal(event.actorUserId, 'gm');
  assert.equal(event.actorRole, 'gm');
  assert.equal(event.recordedAt, now.toISOString());
  assert.equal(event.enquiryId, 'enquiry-1');
  assert.equal(event.agreementId, 'agreement-1');
  assert.deepEqual(event.metadata, { totalCents: 14_000_000 });
  assert.equal(salesActivityKey(event.id), 'activity/activity-test.json');
});
