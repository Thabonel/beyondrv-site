import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';
import type { VehicleCatalogue, CatalogueVariant } from '../src/lib/vehicleCatalogue/types.ts';

const variant: CatalogueVariant = {
  id: 'x', make: 'Mazda', model: 'BT-50', modelYear: 2025, grade: 'XT',
  cabType: 'single_cab', bodyType: 'cab_chassis', drivetrain: '4x4',
  label: 'Mazda BT-50 XT single cab 4x4 (2025)',
  gvmKg: 3100, kerbKg: 1914, kerbBasis: 'Kerb weight with Mazda standard tray fitted',
  payloadKg: 1186, frontGawrKg: 1450, rearGawrKg: 1910,
  trayLengthMm: null, trayWidthMm: null, trayState: 'included', trayMassKg: null,
  promotedByOverride: false,
  source: { manufacturer: 'Mazda Australia', title: 'Payload Calculator', url: 'https://example.test', accessedDate: '2026-08-18' },
};

const catalogue: VehicleCatalogue = {
  schemaVersion: '1.0', catalogueVersion: 'test', generatedAt: '2026-08-18T00:00:00.000Z',
  sourceDatabaseRowCount: 159, models: [{ make: 'Mazda', model: 'BT-50', modelYears: [2025] }],
  variants: [variant],
};

test('a well-formed catalogue is valid', () => {
  assert.equal(validateVehicleCatalogue(catalogue).valid, true);
});

test('a missing schemaVersion is an error', () => {
  const bad = { ...catalogue, schemaVersion: '' };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('a variant whose mass arithmetic does not reconcile is an error', () => {
  const bad = { ...catalogue, variants: [{ ...variant, payloadKg: 999 }] };
  const result = validateVehicleCatalogue(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('does not reconcile')));
});

test('a duplicate variant id is an error', () => {
  const bad = { ...catalogue, variants: [variant, variant] };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('a variant whose make and model are missing from the model index is an error', () => {
  const bad = { ...catalogue, models: [] };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('an empty catalogue is valid but warns', () => {
  const empty = { ...catalogue, models: [], variants: [] };
  const result = validateVehicleCatalogue(empty);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.length > 0);
});

test('a variant with an empty source url is an error mentioning the variant id', () => {
  const bad = { ...catalogue, variants: [{ ...variant, source: { ...variant.source, url: '' } }] };
  const result = validateVehicleCatalogue(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes(variant.id) && e.includes('source url')));
});

test('a variant with an empty id is an error', () => {
  const bad = { ...catalogue, variants: [{ ...variant, id: '' }] };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('a variant with an empty source accessedDate is an error mentioning the variant id', () => {
  const bad = { ...catalogue, variants: [{ ...variant, source: { ...variant.source, accessedDate: '' } }] };
  const result = validateVehicleCatalogue(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes(variant.id) && e.includes('accessedDate')));
});
