import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliseDimensionResearch, TRAY_MEASUREMENT_STEPS } from '../netlify/functions/vehicle-dimension-research-core.ts';

const base = {
  vehicleId: 'ford-ranger-test',
  vehicleLabel: 'Ford Ranger test vehicle',
  searchedSources: [{ title: 'Ford Australia', url: 'https://www.ford.com.au/ranger/dimensions/' }],
};

test('one sourced usable-dimension result is returned as a confirmable match', () => {
  const result = normaliseDimensionResearch({
    ...base,
    rawOptions: [{
      name: 'Factory pickup tub', lengthMm: 1547, widthMm: 1584,
      dimensionKind: 'usable_internal', confidence: 'high',
      sourceUrl: 'https://www.ford.com.au/ranger/dimensions/?campaign=test', sourceTitle: 'Ignored title',
    }],
  });
  assert.equal(result.status, 'single');
  assert.deepEqual(result.options[0], {
    name: 'Factory pickup tub', lengthMm: 1547, widthMm: 1584,
    dimensionKind: 'usable_internal', confidence: 'high',
    source: base.searchedSources[0],
  });
});

test('several sourced configurations require the customer to choose', () => {
  const second = { title: 'Tray maker', url: 'https://tray.example/ranger' };
  const result = normaliseDimensionResearch({
    ...base,
    searchedSources: [...base.searchedSources, second],
    rawOptions: [
      { name: 'Factory tub', lengthMm: 1547, widthMm: 1584, dimensionKind: 'usable_internal', confidence: 'high', sourceUrl: base.searchedSources[0].url },
      { name: 'Steel tray', lengthMm: 1800, widthMm: 1850, dimensionKind: 'load_floor', confidence: 'high', sourceUrl: second.url },
    ],
  });
  assert.equal(result.status, 'multiple');
  assert.equal(result.options.length, 2);
});

test('unsourced, partial or exterior dimensions are rejected and measurement help is returned', () => {
  const result = normaliseDimensionResearch({
    ...base,
    rawOptions: [
      { name: 'Only a length', lengthMm: 1547, dimensionKind: 'usable_internal', confidence: 'high', sourceUrl: base.searchedSources[0].url },
      { name: 'Overall vehicle', lengthMm: 5445, widthMm: 1991, dimensionKind: 'overall_external', confidence: 'high', sourceUrl: base.searchedSources[0].url },
      { name: 'Invented source', lengthMm: 1547, widthMm: 1584, dimensionKind: 'usable_internal', confidence: 'high', sourceUrl: 'https://invented.example/spec' },
    ],
  });
  assert.equal(result.status, 'not_found');
  assert.deepEqual(result.options, []);
  assert.deepEqual(result.measurementSteps, TRAY_MEASUREMENT_STEPS);
});
