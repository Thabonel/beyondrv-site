import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTrayState, isPromoted } from '../src/lib/vehicleCatalogue/derive.ts';

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

test('verified rows promote and flagged rows do not', () => {
  const empty = { show: [], hide: [] };
  assert.equal(isPromoted({ id: 'a', verification_status: 'source_verified' }, empty), true);
  assert.equal(isPromoted({ id: 'b', verification_status: 'needs_secondary_review' }, empty), false);
});

test('hide wins over a verified status, and show wins over a flagged one', () => {
  assert.equal(isPromoted({ id: 'a', verification_status: 'source_verified' }, { show: [], hide: ['a'] }), false);
  assert.equal(isPromoted({ id: 'b', verification_status: 'needs_secondary_review' }, { show: ['b'], hide: [] }), true);
});

test('an id in both lists is hidden, because withholding is the safe direction', () => {
  assert.equal(isPromoted({ id: 'a', verification_status: 'source_verified' }, { show: ['a'], hide: ['a'] }), false);
});
