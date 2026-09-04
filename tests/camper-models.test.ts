import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILD_TOLERANCE_MM, modelsForTray } from '../src/lib/camperModels.ts';

const MODELS = [
  { slug: '7ft-electric-poptop-slide-on', name: '7ft Electric Pop-Top', url: '/7ft-electric-poptop-slide-on/', nominalLengthMm: 2120, status: 'target' },
  { slug: 'advent-2150-hardtop-slide-on', name: 'Advent 2150', url: '/advent-2150-hardtop-slide-on/', nominalLengthMm: 2150, status: 'target' },
  { slug: 'advent-2300-hardtop-slide-on', name: 'Advent 2300', url: '/advent-2300-hardtop-slide-on/', nominalLengthMm: 2300, status: 'target' },
  { slug: 'advent-2450-hardtop-slide-on', name: 'Advent 2450', url: '/advent-2450-hardtop-slide-on/', nominalLengthMm: 2450, status: 'target' },
];

const verdictFor = (results: ReturnType<typeof modelsForTray>, name: string) =>
  results.find((r) => r.model.name === name)?.verdict;

test('a tray longer than every model points at the longest one', () => {
  const results = modelsForTray(3000, MODELS);

  assert.equal(verdictFor(results, 'Advent 2450'), 'best');
  assert.equal(verdictFor(results, 'Advent 2300'), 'also_suits');
  // 2450, 2300 and 2150 are three size classes. Only the next one down is an
  // alternative; below that the customer is being shown a smaller camper than
  // their tray calls for.
  assert.equal(verdictFor(results, 'Advent 2150'), 'smaller');
});

test('a tray exactly a model length picks that model', () => {
  assert.equal(verdictFor(modelsForTray(2300, MODELS), 'Advent 2300'), 'best');
  assert.equal(verdictFor(modelsForTray(2300, MODELS), 'Advent 2450'), 'too_long');
});

// Build to order absorbs a small difference, which is what the tolerance is.
test('a tray one tolerance short of a model still suits it', () => {
  assert.equal(BUILD_TOLERANCE_MM, 50);
  assert.equal(verdictFor(modelsForTray(2300 - BUILD_TOLERANCE_MM, MODELS), 'Advent 2300'), 'best');
});

test('a tray one millimetre beyond the tolerance does not suit that model', () => {
  const results = modelsForTray(2300 - BUILD_TOLERANCE_MM - 1, MODELS);

  assert.equal(verdictFor(results, 'Advent 2300'), 'too_long');
  assert.equal(verdictFor(results, 'Advent 2150'), 'best');
});

test('results run longest first, so the best model leads', () => {
  const results = modelsForTray(3000, MODELS);

  assert.deepEqual(results.map((r) => r.model.nominalLengthMm), [2450, 2300, 2150, 2120]);
  assert.equal(results[0].verdict, 'best');
});

test('a tray shorter than every model leaves nothing suiting it', () => {
  const results = modelsForTray(1500, MODELS);

  assert.ok(results.every((r) => r.verdict === 'too_long'), JSON.stringify(results));
});

test('a model still in draft is not offered', () => {
  const withDraft = MODELS.map((m) => (m.name === 'Advent 2450' ? { ...m, status: 'draft' } : m));

  const results = modelsForTray(3000, withDraft);

  assert.equal(verdictFor(results, 'Advent 2450'), 'unknown');
  // The draft model must not win, or an unconfirmed size would lead the result.
  assert.equal(verdictFor(results, 'Advent 2300'), 'best');
});

test('a model with no nominal length is unknown', () => {
  const results = modelsForTray(3000, [...MODELS, { slug: 'diy', name: 'DIY box', url: '/diy/', nominalLengthMm: null, status: 'target' }]);

  assert.equal(verdictFor(results, 'DIY box'), 'unknown');
});

test('a tray length that is missing, zero or negative tells us nothing', () => {
  for (const bad of [0, -1, Number.NaN]) {
    const results = modelsForTray(bad, MODELS);
    assert.ok(results.every((r) => r.verdict === 'unknown'), `tray ${bad} produced a verdict`);
  }
});

test('two models inside the tolerance of each other both suit', () => {
  // The 7ft is 2120 and the Advent 2150 is 2150: at this tray the choice is roof.
  const results = modelsForTray(2150, MODELS);

  assert.equal(verdictFor(results, 'Advent 2150'), 'best');
  assert.equal(verdictFor(results, '7ft Electric Pop-Top'), 'also_suits');
});

const WIDE = [
  { slug: 'truck-47', name: '4.7m Hardtop', url: '/truck-47/', nominalLengthMm: 4700, status: 'target' },
  { slug: 'box-35', name: '3.5m DIY Box', url: '/box-35/', nominalLengthMm: 3500, status: 'target' },
  { slug: 'cabover-35', name: '3.5m Cabover', url: '/cabover-35/', nominalLengthMm: 3500, status: 'target' },
  ...MODELS,
];

// A 4.2m truck tray physically accommodates a 2120mm ute slide-on, with two
// metres to spare. Offering it is true and useless.
test('a truck tray is not offered the whole ute range as alternatives', () => {
  const results = modelsForTray(4200, WIDE);

  assert.equal(verdictFor(results, '3.5m DIY Box'), 'best');
  assert.equal(verdictFor(results, '3.5m Cabover'), 'also_suits');
  assert.equal(verdictFor(results, '4.7m Hardtop'), 'too_long');
  // Two size classes below the best is a different product line, not an option.
  assert.equal(verdictFor(results, 'Advent 2300'), 'smaller');
  assert.equal(verdictFor(results, 'Advent 2150'), 'smaller');
  assert.equal(verdictFor(results, '7ft Electric Pop-Top'), 'smaller');
});

test('the next size class down is still offered as an alternative', () => {
  const results = modelsForTray(4200, WIDE);

  assert.equal(verdictFor(results, 'Advent 2450'), 'also_suits');
});

// Models within the build tolerance are one size, so a 30mm gap must not push
// the 7ft into a lower class than the Advent 2150.
test('models within the tolerance count as one size class', () => {
  const results = modelsForTray(2300, MODELS);

  assert.equal(verdictFor(results, 'Advent 2300'), 'best');
  assert.equal(verdictFor(results, 'Advent 2150'), 'also_suits');
  assert.equal(verdictFor(results, '7ft Electric Pop-Top'), 'also_suits');
});
