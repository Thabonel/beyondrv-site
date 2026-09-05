import assert from 'node:assert/strict';
import test from 'node:test';
import { endForNewStart } from '../src/components/calendar/calendar-model.ts';

test('moving the start moves the end with it, keeping the length', () => {
  assert.equal(endForNewStart('08:00', '09:00', '10:00'), '11:00');
  assert.equal(endForNewStart('08:00', '08:30', '14:15'), '14:45');
  assert.equal(endForNewStart('14:00', '15:00', '09:00'), '10:00', 'moving earlier keeps the length too');
});

test('an unusable or missing end becomes an hour rather than staying wrong', () => {
  assert.equal(endForNewStart('08:00', '', '10:00'), '11:00');
  assert.equal(endForNewStart('08:00', '07:00', '10:00'), '11:00');
});

test('an event pushed past midnight stops at midnight rather than wrapping', () => {
  assert.equal(endForNewStart('08:00', '09:00', '23:30'), '23:59');
});

test('clearing the start leaves the end alone', () => {
  assert.equal(endForNewStart('08:00', '09:00', ''), '09:00');
});
