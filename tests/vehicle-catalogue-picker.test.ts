import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogueMakes,
  catalogueModelsForMake,
  catalogueVariantById,
  catalogueVariantsForModel,
} from '../src/lib/vehicleCatalogue/picker.ts';
import { vehicleCatalogueFixture } from './fixtures/vehicle-catalogue.ts';

test('picker choices are scoped and ordered without mutating the catalogue', () => {
  assert.deepEqual(catalogueMakes(vehicleCatalogueFixture), ['Ford', 'Mazda']);
  assert.deepEqual(catalogueModelsForMake(vehicleCatalogueFixture, 'Ford'), ['Ranger']);
  assert.deepEqual(catalogueModelsForMake(vehicleCatalogueFixture, 'Unknown'), []);
  assert.deepEqual(
    catalogueVariantsForModel(vehicleCatalogueFixture, 'Mazda', 'BT-50').map((variant) => variant.id),
    ['mazda-bt50-my25-dual-4x4-gt-cc', 'mazda-bt50-my25-dual-4x4-gt-pickup'],
  );
  assert.equal(catalogueVariantById(vehicleCatalogueFixture, 'missing'), undefined);
  assert.equal(catalogueVariantById(vehicleCatalogueFixture, 'mazda-bt50-my25-dual-4x4-gt-cc')?.make, 'Mazda');
});
