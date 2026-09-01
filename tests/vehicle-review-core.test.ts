import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCorrections,
  buildPublishCommitMessage,
  draftKey,
  dropNoOpCorrections,
  mergeReviews,
  validateCorrectedPair,
  validateReviewEntry,
  validateReviewsFile,
} from '../netlify/functions/vehicle-review-core.ts';

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

test('a well formed file is accepted', () => {
  const result = validateReviewsFile({ reviews: [VALID] });

  assert.equal(result.valid, true);
  assert.equal(result.reviews?.length, 1);
});

test('every error in a file is collected, not just the first', () => {
  const result = validateReviewsFile({ reviews: [{ reviewer: 'a', reviewedAt: 'nope' }, { id: 'x' }] });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3, `expected several errors, got ${result.errors.length}`);
});

test('a file that is not an object is rejected without throwing', () => {
  assert.equal(validateReviewsFile(null).valid, false);
  assert.equal(validateReviewsFile([]).valid, false);
  assert.equal(validateReviewsFile({ reviews: 'no' }).valid, false);
});

test('a duplicated id in one file is rejected', () => {
  const result = validateReviewsFile({ reviews: [VALID, { ...VALID, reviewedAt: '2026-08-31' }] });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /duplicate/i);
});

// Re-reviewing a vehicle must update it, never add a second entry for it.
test('merging replaces an entry with the same id rather than duplicating it', () => {
  const existing = [{ id: 'a', reviewer: 'old', reviewedAt: '2026-08-01' }];
  const incoming = [{ id: 'a', reviewer: 'new', reviewedAt: '2026-08-30' }, { id: 'b', reviewer: 'new', reviewedAt: '2026-08-30' }];

  const merged = mergeReviews(existing, incoming);

  assert.equal(merged.length, 2);
  assert.equal(merged.find((entry) => entry.id === 'a')?.reviewer, 'new');
});

test('merging sorts by id so the committed file has a stable diff', () => {
  const merged = mergeReviews([], [{ id: 'b', reviewer: 'r', reviewedAt: '2026-08-30' }, { id: 'a', reviewer: 'r', reviewedAt: '2026-08-30' }]);

  assert.deepEqual(merged.map((entry) => entry.id), ['a', 'b']);
});

test('corrections overwrite the row and name the fields they changed', () => {
  const row = { gvmKg: 3200, kerbKg: 2200, trayLengthMm: null };

  const result = applyCorrections(row, { id: 'a', reviewer: 'r', reviewedAt: '2026-08-30', corrections: { gvmKg: 3350 } });

  assert.equal(result.row.gvmKg, 3350);
  assert.equal(result.row.kerbKg, 2200);
  assert.deepEqual(result.correctedFields, ['gvmKg']);
});

test('a row with no review entry is returned untouched', () => {
  const row = { gvmKg: 3200, kerbKg: 2200 };

  const result = applyCorrections(row, undefined);

  assert.deepEqual(result.row, row);
  assert.deepEqual(result.correctedFields, []);
});

test('a correction that pushes kerb mass to or above GVM is rejected', () => {
  const row = { gvmKg: 3350, kerbKg: 2300 };

  assert.notDeepEqual(validateCorrectedPair('ford-a', row, { kerbKg: 3350 }), []);
  assert.notDeepEqual(validateCorrectedPair('ford-a', row, { kerbKg: 3400 }), []);
  assert.deepEqual(validateCorrectedPair('ford-a', row, { kerbKg: 3349 }), []);
});

test('lowering GVM below an uncorrected kerb mass is rejected', () => {
  assert.notDeepEqual(validateCorrectedPair('ford-a', { gvmKg: 3350, kerbKg: 2300 }, { gvmKg: 2200 }), []);
});

test('a row with no corrections is judged on its own figures', () => {
  assert.deepEqual(validateCorrectedPair('ford-a', { gvmKg: 3350, kerbKg: 2300 }, undefined), []);
  assert.notDeepEqual(validateCorrectedPair('ford-a', { gvmKg: 2300, kerbKg: 3350 }, undefined), []);
});

test('draft keys are namespaced and encoded so an odd id cannot escape the store', () => {
  assert.equal(draftKey('ford-ranger-2023'), 'vehicle-review/ford-ranger-2023.json');
  assert.equal(draftKey('a/b'), 'vehicle-review/a%2Fb.json');
});

test('the commit message names the reviewer, the count and the make', () => {
  const message = buildPublishCommitMessage('j.smith', 24, 'Ford');

  assert.match(message, /24/);
  assert.match(message, /Ford/);
  assert.match(message, /j\.smith/);
});

test('the commit message is singular for one vehicle', () => {
  assert.match(buildPublishCommitMessage('j.smith', 1, 'Ford'), /1 Ford vehicle\b/);
});

// A reviewer who types over a figure and then puts the original back has not
// corrected anything. Recording it would tell customers a manufacturer figure
// is not the manufacturer's.
test('a correction equal to the published value is not a correction', () => {
  const row = { gvmKg: 3350, kerbKg: 2300 };

  const result = applyCorrections(row, { id: 'a', reviewer: 'r', reviewedAt: '2026-08-30', corrections: { gvmKg: 3350 } });

  assert.deepEqual(result.correctedFields, []);
  assert.equal(result.row.gvmKg, 3350);
});

test('a real change beside a restored value records only the real one', () => {
  const row = { gvmKg: 3350, kerbKg: 2300 };

  const result = applyCorrections(row, {
    id: 'a', reviewer: 'r', reviewedAt: '2026-08-30',
    corrections: { gvmKg: 3350, kerbKg: 2250 },
  });

  assert.deepEqual(result.correctedFields, ['kerbKg']);
  assert.equal(result.row.kerbKg, 2250);
});

test('filling a figure the manufacturer never published is a correction', () => {
  const row = { gvmKg: 3350, kerbKg: 2300, trayLengthMm: null };

  const result = applyCorrections(row, {
    id: 'a', reviewer: 'r', reviewedAt: '2026-08-30', corrections: { trayLengthMm: 1500 },
  });

  assert.deepEqual(result.correctedFields, ['trayLengthMm']);
});

test('no-op corrections are dropped before they are stored', () => {
  const row = { gvmKg: 3350, kerbKg: 2300, trayLengthMm: null, trayWidthMm: null };

  assert.deepEqual(dropNoOpCorrections(row, { gvmKg: 3350 }), {});
  assert.deepEqual(dropNoOpCorrections(row, { gvmKg: 3350, kerbKg: 2250 }), { kerbKg: 2250 });
  assert.deepEqual(dropNoOpCorrections(row, undefined), {});
});

// A MAN TGM is 13,000kg GVM with 6,211kg kerb, and an IVECO Eurocargo is
// 15,000kg. Ute bounds make those uncorrectable through the review screen.
test('a heavy chassis can be corrected to a real truck figure', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 12900, kerbKg: 6200 } }, 0, 'truck');

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.entry?.corrections, { gvmKg: 12900, kerbKg: 6200 });
});

test('a truck tray can be corrected past the ute limit', () => {
  // The 4.7m camper needs 4700mm, beyond the 4000mm ute cap.
  assert.deepEqual(validateReviewEntry({ ...VALID, corrections: { trayLengthMm: 4700 } }, 0, 'truck').errors, []);
});

test('a ute keeps its own bounds, so a truck figure is still refused there', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 12900 } }, 0, 'ute');

  assert.equal(result.entry, undefined);
  assert.match(result.errors[0], /gvmKg/);
});

test('the platform defaults to ute when none is given', () => {
  assert.equal(validateReviewEntry({ ...VALID, corrections: { gvmKg: 12900 } }, 0).entry, undefined);
});

test('a figure beyond even the truck bounds is refused', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 99000 } }, 0, 'truck');

  assert.equal(result.entry, undefined);
});

// A truck correction accepted on write must survive being read back. Without
// the platform on the entry, re-validation falls back to ute bounds and
// rejects a figure it just committed, breaking publishing and the build.
test('a committed truck correction survives revalidation', () => {
  const written = validateReviewEntry({ ...VALID, corrections: { gvmKg: 12900 } }, 0, 'truck');
  assert.ok(written.entry, written.errors.join(' '));

  const reread = validateReviewsFile({ reviews: [written.entry] });

  assert.equal(reread.valid, true, reread.errors.join(' '));
  assert.deepEqual(reread.reviews?.[0].corrections, { gvmKg: 12900 });
});

test('a truck entry records its platform so the bounds travel with it', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 12900 } }, 0, 'truck');

  assert.equal(result.entry?.platform, 'truck');
});

test('a ute entry does not carry a platform it does not need', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 3350 } }, 0, 'ute');

  assert.equal(result.entry?.platform, undefined);
});

test('a ute figure written into a file as a truck entry is still bounded', () => {
  const reread = validateReviewsFile({ reviews: [{ ...VALID, platform: 'truck', corrections: { gvmKg: 99000 } }] });

  assert.equal(reread.valid, false);
});
