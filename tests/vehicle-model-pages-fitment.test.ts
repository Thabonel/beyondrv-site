import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payload, loadAllowance, rearAxleHeadroom, towingAtGvm, calculatorUrl, queryPrefill } from '../src/lib/vehicleModelPages/fitment.ts';
import { deriveTrayState } from '../src/lib/vehicleCatalogue/derive.ts';

test('payload reconciles published figures without hiding a mismatch or missing mass', () => {
  assert.deepEqual(payload(3350, 2200, 1150), { calculated: 1150, published: 1150, matches: true });
  assert.deepEqual(payload(3350, 2200, 1200), { calculated: 1150, published: 1200, matches: false });
  assert.deepEqual(payload(3350, null, 1200), { calculated: null, published: 1200, matches: null });
});
test('allowance preserves deficits and unknowns', () => {
  assert.equal(loadAllowance(1150), 760);
  assert.equal(loadAllowance(200), -190);
  assert.equal(loadAllowance(null), null);
  assert.equal(loadAllowance(1000, { passengerWeight: 200, accessoryWeight: 100, luggageOrGearWeight: 50 }), 650);
});
test('all four tray states use the catalogue derivation', () => {
  assert.equal(deriveTrayState('tray fitted', 'cab_chassis'), 'included');
  assert.equal(deriveTrayState('excludes tray', 'cab_chassis'), 'excluded');
  assert.equal(deriveTrayState(null, 'pickup_tub'), 'not_applicable');
  assert.equal(deriveTrayState(null, 'cab_chassis'), 'unknown');
});
test('GCM arithmetic is distinct from a towing certification', () => {
  assert.equal(towingAtGvm(6000, 3500), 2500);
  assert.equal(towingAtGvm(null, 3500), null);
  assert.equal(towingAtGvm(6000, 6500), -500);
});
test('rear axle margin requires both published figures', () => {
  assert.equal(rearAxleHeadroom(5000, 1033), 3967);
  assert.equal(rearAxleHeadroom(5000, null), null);
});
test('query prefill accepts only positive finite numbers, independently', () => {
  assert.deepEqual(queryPrefill('?vehicleGvm=3350&currentVehicleWeight=2200&trayLength=-1&trayWidth=Infinity'), { gvm: '3350', currentWeight: '2200' });
  for (const value of ['', '0', '-1', 'NaN', '1e999', '123abc']) assert.deepEqual(queryPrefill(`?vehicleGvm=${value}`), {});
  assert.deepEqual(queryPrefill('?trayLength=2150&trayWidth=1850'), { trayLength: '2150', trayWidth: '1850' });
  assert.equal(calculatorUrl({ gvmKg: 3350, kerbKg: null, trayLengthMm: null, trayWidthMm: null }), '/slide-on-camper-weight-calculator/?vehicleGvm=3350');
});
