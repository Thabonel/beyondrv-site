import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReviewEntry } from '../netlify/functions/vehicle-review-core.ts';

const VALID = { id: 'ford-ranger-2023-xlt', reviewer: 'j.smith', reviewedAt: '2026-08-30' };

test('a review entry with no corrections is accepted', () => {
  const result = validateReviewEntry(VALID, 0);

  assert.deepEqual(result.errors, []);
  assert.equal(result.entry?.id, 'ford-ranger-2023-xlt');
  assert.equal(result.entry?.corrections, undefined);
});

test('a correction inside its range is accepted', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 3350 } }, 0);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.entry?.corrections, { gvmKg: 3350 });
});

// A slipped keystroke must not publish a 33,500 kg ute.
test('a correction outside its range is rejected at both boundaries', () => {
  const low = validateReviewEntry({ ...VALID, corrections: { gvmKg: 1499 } }, 0);
  const high = validateReviewEntry({ ...VALID, corrections: { gvmKg: 8001 } }, 0);

  assert.equal(low.entry, undefined);
  assert.equal(high.entry, undefined);
  assert.match(low.errors[0], /gvmKg/);
  assert.match(high.errors[0], /gvmKg/);
});

test('a correction exactly on its boundary is accepted', () => {
  assert.deepEqual(validateReviewEntry({ ...VALID, corrections: { gvmKg: 1500 } }, 0).errors, []);
  assert.deepEqual(validateReviewEntry({ ...VALID, corrections: { gvmKg: 8000 } }, 0).errors, []);
});

test('a non-integer correction is rejected', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 3350.5 } }, 0);

  assert.equal(result.entry, undefined);
  assert.match(result.errors[0], /whole number/);
});

test('an unknown correctable field is rejected rather than ignored', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { payloadKg: 900 } }, 0);

  assert.equal(result.entry, undefined);
  assert.match(result.errors[0], /payloadKg/);
});

test('a missing id is rejected', () => {
  const result = validateReviewEntry({ reviewer: 'j.smith', reviewedAt: '2026-08-30' }, 3);

  assert.equal(result.entry, undefined);
  assert.match(result.errors[0], /\[3\]\.id/);
});

test('a reviewedAt that is not a real date is rejected', () => {
  assert.notDeepEqual(validateReviewEntry({ ...VALID, reviewedAt: '2026-02-30' }, 0).errors, []);
  assert.notDeepEqual(validateReviewEntry({ ...VALID, reviewedAt: '30-08-2026' }, 0).errors, []);
});
