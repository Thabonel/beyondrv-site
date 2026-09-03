import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSlideOnSuitability } from '../src/lib/vehicleSuitabilityCalculator.js';

const base = {
  vehicleGvm: '3350', currentVehicleWeight: '2200', passengerWeight: '160',
  accessoryWeight: '80', luggageOrGearWeight: '100', camperDryWeight: '500',
  camperWaterWeight: '60', camperGearWeight: '50', camperOptionsWeight: '20',
  trayLength: '2400', trayWidth: '1850',
  requiredTrayLength: '2100', requiredTrayWidth: '1750',
  rearAxleChecked: true, tyreRatingsChecked: true, centreOfGravityChecked: true,
};

test('returns neutral before the customer has started', () => {
  const result = calculateSlideOnSuitability(base, { started: false });
  assert.equal(result.status, 'neutral');
});

test('a comfortable combination with all confirmations ticked is green', () => {
  const result = calculateSlideOnSuitability(base, { started: true });
  assert.equal(result.status, 'green');
  if (!('values' in result)) {
    assert.fail('expected calculateSlideOnSuitability to return values for a green result');
  }
  assert.equal(result.values.vehiclePayloadBeforeAdditions, 1150);
  assert.equal(result.values.additionalVehicleLoad, 340);
  assert.equal(result.values.availablePayloadBeforeCamper, 810);
  assert.equal(result.values.remainingGvmMargin, 3350 - 3170);
});

test('exceeding GVM is red and says how far over', () => {
  const result = calculateSlideOnSuitability({ ...base, camperDryWeight: '900' }, { started: true });
  assert.equal(result.status, 'red');
  assert.ok(result.notes.some((n: string) => n.includes('over GVM')));
});

test('a margin under 150 kg is amber even when nothing is exceeded', () => {
  const result = calculateSlideOnSuitability({ ...base, camperDryWeight: '640' }, { started: true });
  assert.equal(result.status, 'amber');
});

test('a tray shorter than the camper requires is red', () => {
  const result = calculateSlideOnSuitability({ ...base, trayLength: '2000' }, { started: true });
  assert.equal(result.status, 'red');
  assert.ok(result.notes.some((n: string) => n.includes('below the required')));
});

test('an unchecked rear axle confirmation forces amber', () => {
  const result = calculateSlideOnSuitability({ ...base, rearAxleChecked: false }, { started: true });
  assert.equal(result.status, 'amber');
  assert.ok(result.notes.some((n: string) => n.includes('Rear axle limits have not been confirmed')));
});

test('a missing required field returns the calculations that already have enough data', () => {
  const result = calculateSlideOnSuitability({ ...base, vehicleGvm: '' }, { started: true });
  assert.equal(result.status, 'amber');
  assert.equal(result.title, 'Results available — add the missing details');
  assert.match(result.dataQuality, /vehicle GVM/);
  if (!('values' in result)) assert.fail('expected the available partial values');
  assert.equal(result.values.estimatedLoadedCamperWeight, 630);
  assert.equal(result.values.trayLengthFit, 300);
  assert.equal(result.values.estimatedLoadedVehicleWeight, undefined);
});

test('blank optional additions count as zero once the core figures exist', () => {
  const result = calculateSlideOnSuitability({
    ...base,
    passengerWeight: '', accessoryWeight: '', luggageOrGearWeight: '',
    camperWaterWeight: '', camperGearWeight: '', camperOptionsWeight: '',
  }, { started: true });

  assert.equal(result.status, 'green');
  if (!('values' in result)) assert.fail('expected calculated values');
  assert.equal(result.values.availablePayloadBeforeCamper, 1150);
  assert.equal(result.values.vehiclePayloadBeforeAdditions, 1150);
  assert.equal(result.values.additionalVehicleLoad, 0);
  assert.equal(result.values.estimatedLoadedCamperWeight, 500);
  assert.equal(result.values.estimatedLoadedVehicleWeight, 2700);
});

test('a known unsafe result is shown immediately even while another result is incomplete', () => {
  const result = calculateSlideOnSuitability({ ...base, camperDryWeight: '1400', trayWidth: '' }, { started: true });

  assert.equal(result.status, 'red');
  assert.equal(result.title, 'Not recommended on this partial estimate');
  assert.ok(result.notes.some((note: string) => note.includes('over GVM')));
  if (!('values' in result)) assert.fail('expected the available partial values');
  assert.equal(result.values.trayWidthFit, undefined);
});
