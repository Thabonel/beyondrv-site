import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTraySizeReport,
  removeTraySize,
  traySizeKey,
  validateTraySize,
  winningTraySize,
} from '../netlify/functions/tray-size-core.ts';

const T1 = '2026-08-21T01:00:00.000Z';
const T2 = '2026-08-21T02:00:00.000Z';
const T3 = '2026-08-21T03:00:00.000Z';

test('a plausible tray size is accepted', () => {
  assert.deepEqual(validateTraySize(2100, 1800), { ok: true, lengthMm: 2100, widthMm: 1800 });
});

test('a numeric string is accepted, because form values arrive as strings', () => {
  assert.deepEqual(validateTraySize('2100', '1800'), { ok: true, lengthMm: 2100, widthMm: 1800 });
});

test('a length outside the plausible range is rejected', () => {
  assert.equal(validateTraySize(18000, 1800).ok, false);
  assert.equal(validateTraySize(18, 1800).ok, false);
});

test('a width outside the plausible range is rejected', () => {
  assert.equal(validateTraySize(2100, 9000).ok, false);
  assert.equal(validateTraySize(2100, 90).ok, false);
});

test('a fractional measurement is rejected, because trays are recorded in whole millimetres', () => {
  assert.equal(validateTraySize(2100.5, 1800).ok, false);
});

test('something that is not a number at all is rejected', () => {
  assert.equal(validateTraySize('wide', 1800).ok, false);
  assert.equal(validateTraySize(null, 1800).ok, false);
});

test('a first report creates a bucket holding one report', () => {
  const record = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);

  assert.equal(record.variantId, 'ford-ranger-cc');
  assert.equal(record.totalReports, 1);
  assert.deepEqual(record.sizes, [
    { lengthMm: 2100, widthMm: 1800, reports: 1, firstReportedAt: T1, lastReportedAt: T1 },
  ]);
});

test('a repeat of the same size increments rather than duplicating', () => {
  const first = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);
  const second = addTraySizeReport(first, 'ford-ranger-cc', 2100, 1800, T2);

  assert.equal(second.sizes.length, 1);
  assert.equal(second.sizes[0].reports, 2);
  assert.equal(second.sizes[0].firstReportedAt, T1, 'the first sighting is preserved');
  assert.equal(second.sizes[0].lastReportedAt, T2);
  assert.equal(second.totalReports, 2);
});

test('a different size becomes its own bucket', () => {
  const first = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);
  const second = addTraySizeReport(first, 'ford-ranger-cc', 2400, 1800, T2);

  assert.equal(second.sizes.length, 2);
  assert.equal(second.totalReports, 2);
});

test('the most reported size wins', () => {
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2400, 1800, T1);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T2);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T3);

  assert.deepEqual(winningTraySize(record), { lengthMm: 2100, widthMm: 1800, reports: 2 });
});

test('equal counts break on the most recent report', () => {
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2400, 1800, T1);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T2);

  assert.deepEqual(winningTraySize(record), { lengthMm: 2100, widthMm: 1800, reports: 1 });
});

test('a variant nobody has reported has no winning size', () => {
  assert.equal(winningTraySize(null), null);
  assert.equal(winningTraySize({ variantId: 'x', sizes: [], totalReports: 0, updatedAt: T1 }), null);
});

test('deleting one size leaves the others and their counts intact', () => {
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T2);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T3);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2400, 1800, T3);

  const pruned = removeTraySize(record, 2400, 1800, T3);

  assert.deepEqual(pruned.sizes.map((s) => s.lengthMm), [2100]);
  assert.equal(pruned.sizes[0].reports, 3);
  assert.equal(pruned.totalReports, 3, 'the total drops by exactly the deleted bucket');
});

test('dimensions are rounded to the nearest 10mm, so near-identical measurements agree', () => {
  // Nobody measures a tray to the millimetre. Without this, 2100 and 2103 are
  // different sizes and neither ever accumulates a convincing count.
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2103, 1798, T1);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2097, 1802, T2);

  assert.equal(record.sizes.length, 1);
  assert.deepEqual(
    { l: record.sizes[0].lengthMm, w: record.sizes[0].widthMm, r: record.sizes[0].reports },
    { l: 2100, w: 1800, r: 2 },
  );
});

test('a variant never accumulates more than twenty distinct sizes', () => {
  let record = null as any;
  // 25 distinct rounded sizes, each reported once.
  for (let i = 0; i < 25; i += 1) {
    record = addTraySizeReport(record, 'ford-ranger-cc', 1500 + i * 10, 1800, T1);
  }

  assert.equal(record.sizes.length, 20);
});

test('capping evicts the least reported size, never a popular one', () => {
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);
  for (let i = 0; i < 5; i += 1) {
    record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T2);
  }
  for (let i = 0; i < 25; i += 1) {
    record = addTraySizeReport(record, 'ford-ranger-cc', 1500 + i * 10, 1800, T3);
  }

  const survivor = record.sizes.find((s: any) => s.lengthMm === 2100 && s.widthMm === 1800);
  assert.ok(survivor, 'the six-report size must survive a flood of one-report sizes');
  assert.equal(survivor.reports, 6);
  assert.equal(record.sizes.length, 20);
});

test('the blob key is namespaced and url safe', () => {
  assert.equal(traySizeKey('ford-ranger-cc'), 'tray-sizes/ford-ranger-cc.json');
  assert.equal(traySizeKey('a/b'), 'tray-sizes/a%2Fb.json');
});
