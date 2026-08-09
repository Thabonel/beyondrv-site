import assert from 'node:assert/strict';
import test from 'node:test';
import { applySalesOutcome } from '../netlify/functions/sales-outcome-core.ts';

test('no answer schedules a replacement follow-up two days later', () => {
  const result = applySalesOutcome(null, { outcome: 'no_answer' }, new Date('2026-08-10T08:00:00.000Z'));
  assert.equal(result.leadStatus.status, 'follow-up-scheduled');
  assert.equal(result.nextFollowUpDate, '2026-08-12');
});

test('a visit keeps the date as the next actionable follow-up', () => {
  const result = applySalesOutcome({ notes: 'Existing note' }, { outcome: 'visit_booked', followUpAt: '2026-08-15' }, new Date('2026-08-10T08:00:00.000Z'));
  assert.equal(result.leadStatus.appointmentAt, '2026-08-15');
  assert.equal(result.leadStatus.nextFollowUpDate, '2026-08-15');
});

test('a follow-up requires a date and keeps the existing lead context', () => {
  assert.throws(() => applySalesOutcome(null, { outcome: 'follow_up' }), /date/);
  const result = applySalesOutcome({ priority: 'hot', notes: 'Customer asked for a callback.' }, { outcome: 'follow_up', followUpAt: '2026-08-18' }, new Date('2026-08-10T08:00:00.000Z'));
  assert.equal(result.leadStatus.status, 'follow-up-scheduled');
  assert.equal(result.leadStatus.nextFollowUpDate, '2026-08-18');
  assert.equal(result.leadStatus.appointmentAt, '');
  assert.equal((result.leadStatus as Record<string, unknown>).priority, 'hot');
  assert.equal(result.leadStatus.notes, 'Customer asked for a callback.');
});

test('lost outcomes require a reason and clear the follow-up', () => {
  assert.throws(() => applySalesOutcome(null, { outcome: 'not_proceeding' }), /reason/);
  const result = applySalesOutcome(null, { outcome: 'not_proceeding', lossReason: 'timing-not-right' });
  assert.equal(result.leadStatus.status, 'lost');
  assert.equal(result.nextFollowUpDate, '');
});

test('agreement work clears stale appointment data without setting another follow-up', () => {
  const result = applySalesOutcome({ appointmentAt: '2026-08-15', nextFollowUpDate: '2026-08-15' }, { outcome: 'agreement_in_progress' }, new Date('2026-08-10T08:00:00.000Z'));
  assert.equal(result.leadStatus.status, 'quoted');
  assert.equal(result.leadStatus.appointmentAt, '');
  assert.equal(result.nextFollowUpDate, '');
});
