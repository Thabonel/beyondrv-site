import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTrayState, isPromoted, validateCatalogueOverrides } from '../src/lib/vehicleCatalogue/derive.ts';

const approved = { id: 'a', customer_selectable: 1, latest_review_id: 7, latest_review_decision: 'approved' };
const unapproved = { id: 'b', customer_selectable: 0, latest_review_id: null, latest_review_decision: null };
const empty = { show: [], hide: [] };
const override = { id: 'b', reason: 'Owner-approved emergency correction', reviewer: 'Jane Reviewer', approvedAt: '2026-08-22' };

test('a tub vehicle has no tray regardless of how kerb is described', () => {
  assert.equal(deriveTrayState('Published kerb weight', 'pickup_tub'), 'not_applicable');
  assert.equal(deriveTrayState('Published kerb weight; tub body, no tray state published', 'pickup_tub'), 'not_applicable');
});

test('a kerb figure measured with the tray on is included', () => {
  assert.equal(deriveTrayState('Kerb weight with Mazda standard tray fitted', 'cab_chassis'), 'included');
});

test('every wording that excludes the tray is detected', () => {
  for (const basis of [
    'Published kerb mass; excludes tray body',
    'Published kerb weight; excludes tray body',
    'Kerb weight with heaviest factory optional equipment; excludes tray body',
    'Kerb weight excludes tray body',
    'Derived from GVM minus published maximum payload; excludes tray',
  ]) {
    assert.equal(deriveTrayState(basis, 'cab_chassis'), 'excluded', basis);
  }
});

test('silence about the tray is unknown, never assumed', () => {
  assert.equal(deriveTrayState('Published kerb weight', 'cab_chassis'), 'unknown');
  assert.equal(deriveTrayState('Approximate kerb weight', 'cab_chassis'), 'unknown');
  assert.equal(deriveTrayState(null, 'cab_chassis'), 'unknown');
});

test('only a selectable row with a latest approved review is promoted', () => {
  assert.equal(isPromoted(approved, empty), true);
  assert.equal(isPromoted(unapproved, empty), false);
  assert.equal(isPromoted({ ...approved, customer_selectable: 0 }, empty), false);
  assert.equal(isPromoted({ ...approved, latest_review_decision: 'changes_requested' }, empty), false);
});

test('hide wins over approval, and an attributable override can promote', () => {
  assert.equal(isPromoted(approved, { show: [], hide: ['a'] }), false);
  assert.equal(isPromoted(unapproved, { show: [override], hide: [] }), true);
});

test('conflicting overrides fail validation instead of choosing silently', () => {
  const result = validateCatalogueOverrides({ show: [override], hide: ['b'] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('both show and hide')));
});

test('legacy string show overrides fail because they have no audit evidence', () => {
  const result = validateCatalogueOverrides({ show: ['b'], hide: [] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('reason')));
});

test('a complete publication override validates', () => {
  const result = validateCatalogueOverrides({ show: [override], hide: [] });
  assert.equal(result.valid, true);
});

test('override dates and audit fields are bounded', () => {
  const invalidDate = validateCatalogueOverrides({
    show: [{ id: 'variant-a', reason: 'Reviewed exception', reviewer: 'Alex', approvedAt: '2026-02-31' }],
    hide: [],
  });
  assert.equal(invalidDate.valid, false);

  const unboundedReason = validateCatalogueOverrides({
    show: [{ id: 'variant-a', reason: 'x'.repeat(501), reviewer: 'Alex', approvedAt: '2026-08-22' }],
    hide: [],
  });
  assert.equal(unboundedReason.valid, false);
});
