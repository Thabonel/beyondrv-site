import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';
import type { VehicleCatalogue, CatalogueVariant } from '../src/lib/vehicleCatalogue/types.ts';

const variant: CatalogueVariant = {
  id: 'x', make: 'Mazda', model: 'BT-50', modelYear: 2025, grade: 'XT',
  cabType: 'single_cab', bodyType: 'cab_chassis', drivetrain: '4x4',
  engine: '3.0L diesel', transmission: '6-speed automatic', wheelbaseMm: 3125,
  label: 'Mazda BT-50 XT single cab 4x4 (2025)',
  gvmKg: 3100, kerbKg: 1914, kerbBasis: 'Kerb weight with Mazda standard tray fitted',
  payloadKg: 1186, frontGawrKg: 1450, rearGawrKg: 1910,
  trayLengthMm: null, trayWidthMm: null, trayState: 'included', trayMassKg: null,
  platform: 'ute' as const, maxBodyLengthMm: null, correctedFields: [],
  promotedByOverride: false,
  publication: { approvalId: 'review:7', approvedAt: '2026-08-22T00:00:00.000Z', method: 'review' },
  source: { manufacturer: 'Mazda Australia', title: 'Payload Calculator', url: 'https://www.mazda.com.au/payload-calculator/', accessedDate: '2026-08-18' },
};

const catalogue: VehicleCatalogue = {
  schemaVersion: '1.1', catalogueVersion: 'test', generatedAt: '2026-08-18T00:00:00.000Z',
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

test('a variant with an empty source url is an error with its exact path', () => {
  const bad = { ...catalogue, variants: [{ ...variant, source: { ...variant.source, url: '' } }] };
  const result = validateVehicleCatalogue(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('variants[0].source.url')));
});

test('a variant with an empty id is an error', () => {
  const bad = { ...catalogue, variants: [{ ...variant, id: '' }] };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('a variant with an empty source accessedDate is an error with its exact path', () => {
  const bad = { ...catalogue, variants: [{ ...variant, source: { ...variant.source, accessedDate: '' } }] };
  const result = validateVehicleCatalogue(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('variants[0].source.accessedDate')));
});

test('missing model and variant arrays return validation errors instead of throwing', () => {
  const result = validateVehicleCatalogue({ schemaVersion: '1.1', catalogueVersion: 'bad', generatedAt: catalogue.generatedAt, sourceDatabaseRowCount: 1 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('models must be an array')));
  assert.ok(result.errors.some((error) => error.includes('variants must be an array')));
});

test('numeric strings are rejected at the runtime boundary', () => {
  const bad = { ...catalogue, variants: [{ ...variant, gvmKg: '3100' }] };
  const result = validateVehicleCatalogue(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('gvmKg must be an integer')));
});

test('unapproved source hosts and non-HTTPS URLs are rejected', () => {
  for (const url of ['https://evil.example/vehicle', 'javascript:alert(1)', 'http://www.mazda.com.au/']) {
    const result = validateVehicleCatalogue({ ...catalogue, variants: [{ ...variant, source: { ...variant.source, url } }] });
    assert.equal(result.valid, false, url);
  }
});

test('publication evidence is required and must agree with override state', () => {
  const missing = validateVehicleCatalogue({ ...catalogue, variants: [{ ...variant, publication: undefined }] });
  assert.equal(missing.valid, false);
  const inconsistent = validateVehicleCatalogue({ ...catalogue, variants: [{ ...variant, promotedByOverride: true }] });
  assert.equal(inconsistent.valid, false);
});

test('unsupported schema versions are rejected', () => {
  const result = validateVehicleCatalogue({ ...catalogue, schemaVersion: '1.0' });
  assert.equal(result.valid, false);
});

test('publication references must agree with their method', () => {
  const candidate = structuredClone(catalogue);
  candidate.variants[0].publication.approvalId = 'override:manual';
  const result = validateVehicleCatalogue(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /must identify a review/);
});

test('future source access dates are rejected', () => {
  const candidate = structuredClone(catalogue);
  candidate.variants[0].source.accessedDate = '2100-01-01';
  const result = validateVehicleCatalogue(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /cannot be in the future/);
});

test('the model index must exactly describe published model years', () => {
  const candidate = structuredClone(catalogue);
  candidate.models[0].modelYears = [2024, 2023];
  const result = validateVehicleCatalogue(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /does not match its published model years/);
});

test('two variants sharing a label is an error, because the picker cannot tell them apart', () => {
  const bad: VehicleCatalogue = {
    ...catalogue,
    variants: [
      { ...variant, id: 'a', label: 'Same Label' },
      { ...variant, id: 'b', label: 'Same Label' },
    ],
  };

  const result = validateVehicleCatalogue(bad);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Same Label')), result.errors.join(' | '));
});

// The build records which figures Beyond RV corrected. The validator rebuilds
// every variant field by field, so a field it does not copy is silently lost,
// and the page then credits a hand-typed number to the manufacturer.
test('corrected field names survive validation', () => {
  const corrected = { ...catalogue, variants: [{ ...variant, correctedFields: ['gvmKg', 'payloadKg'] }] };

  const result = validateVehicleCatalogue(corrected);

  assert.equal(result.valid, true, result.errors.join(' '));
  if (!result.valid) return;
  assert.deepEqual(result.catalogue.variants[0].correctedFields, ['gvmKg', 'payloadKg']);
});

test('a variant with no corrections reports an empty list, never undefined', () => {
  const result = validateVehicleCatalogue(catalogue);

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.catalogue.variants[0].correctedFields, []);
});

test('a corrected field name outside the correctable set is an error', () => {
  const bad = { ...catalogue, variants: [{ ...variant, correctedFields: ['engine'] }] };

  const result = validateVehicleCatalogue(bad);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('correctedFields')), result.errors.join(' '));
});

test('correctedFields that is not an array is an error', () => {
  const bad = { ...catalogue, variants: [{ ...variant, correctedFields: 'gvmKg' }] };

  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

// Trucks join the same catalogue as utes. Existing entries predate the field,
// so a variant without one has to keep working.
test('platform defaults to ute when a variant does not state one', () => {
  const result = validateVehicleCatalogue(catalogue);

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.catalogue.variants[0].platform, 'ute');
});

test('a truck variant keeps its platform and max body length', () => {
  const truck = {
    ...catalogue,
    variants: [{ ...variant, platform: 'truck', maxBodyLengthMm: 4865 }],
  };

  const result = validateVehicleCatalogue(truck);

  assert.equal(result.valid, true, result.errors.join(' '));
  if (!result.valid) return;
  assert.equal(result.catalogue.variants[0].platform, 'truck');
  assert.equal(result.catalogue.variants[0].maxBodyLengthMm, 4865);
});

test('a variant with no max body length reports null, not undefined', () => {
  const result = validateVehicleCatalogue(catalogue);

  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.catalogue.variants[0].maxBodyLengthMm, null);
});

test('an unknown platform is an error rather than a silent ute', () => {
  const bad = { ...catalogue, variants: [{ ...variant, platform: 'spaceship' }] };

  const result = validateVehicleCatalogue(bad);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('platform')), result.errors.join(' '));
});
