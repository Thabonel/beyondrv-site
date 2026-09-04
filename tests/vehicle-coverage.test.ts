import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyVehicleCoverage, parseVehicleCoverage } from '../src/lib/vehicleCatalogue/coverage.ts';
import { pickerMakes, pickerModelsForMake } from '../src/lib/vehicleCatalogue/picker.ts';
import type { VehicleCatalogue } from '../src/lib/vehicleCatalogue/types.ts';

const catalogue = {
  schemaVersion: '1.1',
  catalogueVersion: 'test',
  generatedAt: '2026-09-04T00:00:00.000Z',
  sourceDatabaseRowCount: 1,
  models: [{ make: 'Ford', model: 'Ranger', modelYears: [2026] }],
  variants: [],
} as unknown as VehicleCatalogue;

test('a malformed coverage payload yields an empty list rather than throwing', () => {
  for (const bad of [null, undefined, 'nope', 42, {}, { models: 'no' }]) {
    assert.deepEqual(parseVehicleCoverage(bad), emptyVehicleCoverage());
  }
});

test('rows missing a make or model are dropped, not guessed at', () => {
  const parsed = parseVehicleCoverage({
    models: [
      { make: 'Ford', model: 'Ranger' },
      { make: '', model: 'Ranger' },
      { make: 'Ford', model: '   ' },
      { model: 'Ranger' },
      'not an object',
    ],
  });
  assert.equal(parsed.models.length, 1);
  assert.deepEqual(parsed.models[0], { make: 'Ford', model: 'Ranger', hasVariants: false, status: '' });
});

test('duplicate make and model pairs collapse to one', () => {
  const parsed = parseVehicleCoverage({
    models: [{ make: 'Ford', model: 'Ranger' }, { make: 'Ford', model: 'Ranger', hasVariants: true }],
  });
  assert.equal(parsed.models.length, 1);
});

test('hasVariants is only true when the payload says so explicitly', () => {
  const parsed = parseVehicleCoverage({
    models: [
      { make: 'A', model: 'x', hasVariants: true },
      { make: 'B', model: 'y', hasVariants: 'true' },
      { make: 'C', model: 'z' },
    ],
  });
  assert.deepEqual(parsed.models.map((m) => m.hasVariants), [true, false, false]);
});

test('the make list unions published makes with makes we only know of', () => {
  const coverage = parseVehicleCoverage({
    models: [{ make: 'Mercedes-Benz', model: 'Unimog U 1700 L' }, { make: 'Ford', model: 'Ranger' }],
  });
  assert.deepEqual(pickerMakes(catalogue, coverage), ['Ford', 'Mercedes-Benz']);
});

test('a make in both lists appears once', () => {
  const coverage = parseVehicleCoverage({ models: [{ make: 'Ford', model: 'F-150' }] });
  assert.deepEqual(pickerMakes(catalogue, coverage), ['Ford']);
});

test('models union too, so an unresearched model still appears under its make', () => {
  const coverage = parseVehicleCoverage({ models: [{ make: 'Ford', model: 'F-150' }] });
  assert.deepEqual(pickerModelsForMake(catalogue, coverage, 'Ford'), ['F-150', 'Ranger']);
});

test('with no coverage at all the picker still lists every published make and model', () => {
  const coverage = emptyVehicleCoverage();
  assert.deepEqual(pickerMakes(catalogue, coverage), ['Ford']);
  assert.deepEqual(pickerModelsForMake(catalogue, coverage, 'Ford'), ['Ranger']);
});
