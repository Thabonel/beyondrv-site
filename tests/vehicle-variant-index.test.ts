import assert from 'node:assert/strict';
import test from 'node:test';
import catalogue from '../src/data/vehicle-selector/catalogue.json' with { type: 'json' };
import index from '../netlify/functions/vehicle-variant-index.json' with { type: 'json' };

test('the function-side index lists every catalogue variant', () => {
  const catalogueIds = catalogue.variants.map((v: { id: string }) => v.id).sort();
  const indexIds = index.variants.map((v: { id: string }) => v.id).sort();

  assert.deepEqual(indexIds, catalogueIds, 'run `npm run catalogue:build` to regenerate the index');
});

test('the index carries the body type, which decides whether a tray applies', () => {
  const byId = new Map(catalogue.variants.map((v: { id: string; bodyType: string }) => [v.id, v.bodyType]));

  for (const entry of index.variants as Array<{ id: string; bodyType: string }>) {
    assert.equal(entry.bodyType, byId.get(entry.id), `${entry.id} has the wrong body type`);
  }
});

test('the index carries the label, so moderation shows a vehicle not an id', () => {
  const byId = new Map(catalogue.variants.map((v: { id: string; label: string }) => [v.id, v.label]));

  for (const entry of index.variants as Array<{ id: string; label: string }>) {
    assert.equal(entry.label, byId.get(entry.id), `${entry.id} has the wrong label`);
    assert.ok(entry.label.length > 0);
  }
});

test('the index carries nothing beyond what the endpoint needs', () => {
  for (const entry of index.variants as Array<Record<string, unknown>>) {
    assert.deepEqual(Object.keys(entry).sort(), ['bodyType', 'id', 'label']);
  }
});
