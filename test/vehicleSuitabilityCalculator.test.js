import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCaravanSuitability,
  calculateSlideOnSuitability
} from '../src/lib/vehicleSuitabilityCalculator.js';

const healthyCaravan = {
  vehicleGvm: 3500,
  vehicleGcm: 6500,
  currentVehicleWeight: 2500,
  passengerWeight: 150,
  accessoryWeight: 100,
  luggageWeight: 100,
  vehicleBrakedTowingCapacity: 3500,
  vehicleTowBallLimit: 350,
  estimatedTowBallDownload: 200,
  caravanAtmRating: 3000,
  estimatedActualLoadedCaravanWeight: 2500,
  caravanGtmRating: 2800
};

const healthySlideOn = {
  vehicleGvm: 3500,
  currentVehicleWeight: 2000,
  passengerWeight: 150,
  accessoryWeight: 100,
  luggageOrGearWeight: 100,
  camperDryWeight: 650,
  camperWaterWeight: 80,
  camperGearWeight: 100,
  camperOptionsWeight: 50,
  trayLength: 2150,
  trayWidth: 1850,
  requiredTrayLength: 2100,
  requiredTrayWidth: 1750,
  rearAxleChecked: true,
  tyreRatingsChecked: true,
  centreOfGravityChecked: true
};

test('blank form returns Enter your numbers', () => {
  assert.equal(calculateCaravanSuitability({}, { started: false }).status, 'neutral');
  assert.equal(calculateCaravanSuitability({}, { started: false }).statusLabel, 'Enter your numbers to calculate a result.');
});

test('missing required field returns Needs review', () => {
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, vehicleGvm: '' }, { started: true }).status, 'amber');
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, vehicleGvm: '' }, { started: true }).statusLabel, 'Needs review — not enough information.');
});

test('caravan over GVM returns Red', () => {
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, vehicleGvm: 3000 }, { started: true }).status, 'red');
});

test('caravan over GCM returns Red', () => {
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, vehicleGcm: 5400 }, { started: true }).status, 'red');
});

test('caravan over ATM returns Red', () => {
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, caravanAtmRating: 2400 }, { started: true }).status, 'red');
});

test('caravan over GTM returns Red', () => {
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, caravanGtmRating: 2200 }, { started: true }).status, 'red');
});

test('caravan over tow ball limit returns Red', () => {
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, vehicleTowBallLimit: 150 }, { started: true }).status, 'red');
});

test('caravan tight margin returns Amber', () => {
  assert.equal(calculateCaravanSuitability({ ...healthyCaravan, vehicleGvm: 3150 }, { started: true }).status, 'amber');
});

test('caravan healthy margins returns Green', () => {
  assert.equal(calculateCaravanSuitability(healthyCaravan, { started: true }).status, 'green');
});

test('slide-on over GVM returns Red', () => {
  assert.equal(calculateSlideOnSuitability({ ...healthySlideOn, currentVehicleWeight: 2400 }, { started: true }).status, 'red');
});

test('slide-on tray too small returns Red', () => {
  assert.equal(calculateSlideOnSuitability({ ...healthySlideOn, trayLength: 2000 }, { started: true }).status, 'red');
});

test('slide-on tight margin returns Amber', () => {
  assert.equal(calculateSlideOnSuitability({ ...healthySlideOn, currentVehicleWeight: 2121 }, { started: true }).status, 'amber');
});

test('slide-on healthy margins returns Green', () => {
  assert.equal(calculateSlideOnSuitability(healthySlideOn, { started: true }).status, 'green');
});
