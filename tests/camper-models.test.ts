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
  assert.equal(verdictFor(results, 'Advent 2150'), 'also_suits');
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
