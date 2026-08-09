import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIGURATOR_CATALOGUE } from '../src/lib/configurator/catalogue.ts';
import { evaluateConfiguration, validateConfiguratorCatalogue } from '../src/lib/configurator/engine.ts';
import { OPTIONAL_EXTRAS } from '../src/data/optional-extras.ts';
import type { ConfiguratorCatalogue } from '../src/lib/configurator/types.ts';
import {
  createConfigurationCopy,
  createConfigurationSnapshot,
  configurationSnapshotToContractInput,
  normaliseConfigurationInput,
  renderConfigurationSummaryHtml,
  snapshotDigest,
} from '../netlify/functions/configuration-core.ts';
import { calculateContractTotal, normaliseContractInput, renderContractHtml } from '../netlify/functions/contract-core.ts';
import { createReviewToken, reviewLinkState } from '../netlify/functions/configuration-review-core.ts';

function testCatalogue(): ConfiguratorCatalogue {
  return {
    schemaVersion: '1.0.0',
    catalogueVersion: 'test-1',
    readiness: 'approved_internal',
    publishedAt: '2026-08-08T00:00:00Z',
    currency: 'AUD',
    taxTreatment: 'gst_inclusive',
    notice: 'Test catalogue',
    categories: [{ id: 'power', name: 'Power', sortOrder: 1 }],
    models: [{
      id: 'pilot', productSlug: 'pilot', version: '1', name: 'Pilot Camper', description: '', productCategory: 'slide-on', active: true, adminVisible: true, customerVisible: false,
      basePriceCents: 5_000_000, priceQualifier: 'exact', priceVerificationStatus: 'owner_confirmed', baseCostCents: 3_000_000, baseWeightKg: 800,
      orderProcess: { availability: 'made_to_order', buildStartsOn: 'deposit_paid', productionLocation: 'China', finishingLocation: 'Local factory', customerSummary: 'Deposit starts production in China before local finishing.' },
      standardOptionIds: [], defaultOptionIds: [],
    }],
    options: [
      { id: 'battery', categoryId: 'power', name: 'Battery', shortDescription: '', active: true, adminVisible: true, customerVisible: false, modelIds: ['pilot'], selectionMode: 'quantity', minQuantity: 1, maxQuantity: 3, retailPriceDeltaCents: 150_000, internalCostDeltaCents: 80_000, weightDeltaKg: 28, visualBindingId: null, verificationStatus: 'owner_confirmed', sortOrder: 1 },
      { id: 'inverter', categoryId: 'power', name: 'Inverter', shortDescription: '', active: true, adminVisible: true, customerVisible: false, modelIds: ['pilot'], selectionMode: 'multiple', retailPriceDeltaCents: 350_000, internalCostDeltaCents: 200_000, weightDeltaKg: 12, visualBindingId: null, verificationStatus: 'owner_confirmed', sortOrder: 2 },
      { id: 'legacy-inverter', categoryId: 'power', name: 'Legacy inverter', shortDescription: '', active: true, adminVisible: true, customerVisible: false, modelIds: ['pilot'], selectionMode: 'multiple', retailPriceDeltaCents: 100_000, internalCostDeltaCents: 50_000, weightDeltaKg: 10, visualBindingId: null, verificationStatus: 'owner_confirmed', sortOrder: 3 },
    ],
    rules: [
      { id: 'battery-requires-inverter', type: 'requires_all', severity: 'hard', whenOptionId: 'battery', targetOptionIds: ['inverter'], autoResolve: true, ownerOverridable: false, adminMessage: 'Battery requires inverter.' },
      { id: 'inverter-excludes-legacy', type: 'excludes', severity: 'hard', whenOptionId: 'inverter', targetOptionIds: ['legacy-inverter'], autoResolve: false, ownerOverridable: false, adminMessage: 'Choose only one inverter.' },
    ],
  };
}

test('owner-reviewed catalogue is structurally valid and clearly marked as incomplete', () => {
  const validation = validateConfiguratorCatalogue(CONFIGURATOR_CATALOGUE);
  assert.equal(validation.valid, true);
  assert.match(validation.warnings.join(' '), /owner-reviewed/i);
  assert.match(validation.warnings.join(' '), /compatibility rules/i);
  assert.equal(CONFIGURATOR_CATALOGUE.models[0].basePriceCents, 7_200_000);
  assert.equal(CONFIGURATOR_CATALOGUE.models[0].priceVerificationStatus, 'owner_confirmed');
  assert.equal(CONFIGURATOR_CATALOGUE.models[0].orderProcess.buildStartsOn, 'deposit_paid');
  assert.equal(CONFIGURATOR_CATALOGUE.models[0].customerVisible, false);
  const modelPrices = new Map(CONFIGURATOR_CATALOGUE.models.map(model => [model.id, [model.basePriceCents, model.priceQualifier]]));
  assert.deepEqual(modelPrices.get('7ft-electric-poptop-slide-on'), [6_880_000, 'exact']);
  assert.deepEqual(modelPrices.get('advent-2300-hardtop-slide-on'), [7_500_000, 'exact']);
  assert.deepEqual(modelPrices.get('advent-2450-hardtop-slide-on'), [7_780_000, 'exact']);
  assert.deepEqual(modelPrices.get('expedition-3-5m-family-poptop'), [14_000_000, 'from']);
  assert.deepEqual(modelPrices.get('expedition-4-7m-hardtop'), [9_800_000, 'from']);
  assert.deepEqual(modelPrices.get('3-5m-diy-camper-box-with-cabover-and-underfloor-storage'), [3_899_900, 'from']);
  assert.deepEqual(modelPrices.get('mercedes-sprinter-motorhome'), [22_500_000, 'negotiable']);
  assert.deepEqual(modelPrices.get('expedition-blue-unimog-overlander'), [0, 'poa']);
  assert.equal(CONFIGURATOR_CATALOGUE.models.find(model => model.id === 'expedition-blue-unimog-overlander')?.active, false);
});

test('configurator retail option prices stay aligned with the website optional extras', () => {
  const configuredByLegacyId = new Map(CONFIGURATOR_CATALOGUE.options.map(option => [option.legacyId, option]));
  assert.equal(configuredByLegacyId.size, OPTIONAL_EXTRAS.length);
  for (const websiteExtra of OPTIONAL_EXTRAS) {
    const configured = configuredByLegacyId.get(websiteExtra.id);
    assert.ok(configured, `Missing configurator option for website extra ${websiteExtra.id}`);
    assert.equal(configured.retailPriceDeltaCents, websiteExtra.price * 100, `Price mismatch for ${websiteExtra.id}`);
  }
});

test('engine calculates base, quantities, automatic requirements, cost, margin and weight', () => {
  const result = evaluateConfiguration(testCatalogue(), 'pilot', [{ optionId: 'battery', quantity: 2 }], []);
  assert.equal(result.valid, true);
  assert.deepEqual(result.selections.map(selection => [selection.optionId, selection.quantity]), [['battery', 2], ['inverter', 1]]);
  assert.equal(result.selections.find(selection => selection.optionId === 'inverter')?.automaticallySelected, true);
  assert.equal(result.pricing.optionsTotalCents, 650_000);
  assert.equal(result.pricing.configuredTotalCents, 5_650_000);
  assert.equal(result.pricing.internalCostCents, 3_360_000);
  assert.equal(result.pricing.marginCents, 2_290_000);
  assert.equal(result.weight.configuredWeightKg, 868);
  assert.equal(result.weight.status, 'known');
});

test('engine blocks conflicting and unavailable selections', () => {
  const result = evaluateConfiguration(testCatalogue(), 'pilot', [
    { optionId: 'inverter', quantity: 1 },
    { optionId: 'legacy-inverter', quantity: 1 },
    { optionId: 'unknown', quantity: 1 },
  ], []);
  assert.equal(result.valid, false);
  assert.match(result.errors.map(error => error.message).join(' '), /only one inverter/i);
  assert.match(result.errors.map(error => error.message).join(' '), /not available/i);
});

test('engine clamps quantities and reports the adjustment', () => {
  const result = evaluateConfiguration(testCatalogue(), 'pilot', [{ optionId: 'battery', quantity: 12 }], []);
  assert.equal(result.selections.find(selection => selection.optionId === 'battery')?.quantity, 3);
  assert.match(result.warnings.map(warning => warning.message).join(' '), /adjusted/i);
});

test('custom items and discounts require reasons and preserve deterministic arithmetic', () => {
  const invalid = evaluateConfiguration(testCatalogue(), 'pilot', [], [{ id: 'custom', description: 'Special cabinet', kind: 'custom', retailPriceCents: 200_000, internalCostCents: 120_000, weightDeltaKg: 15, reason: '', visualBrief: '', drawingStatus: 'not_started' }]);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.map(error => error.message).join(' '), /reason/i);
  assert.match(invalid.errors.map(error => error.message).join(' '), /visual brief/i);
  assert.match(invalid.errors.map(error => error.message).join(' '), /3D drawing/i);

  const uncharged = evaluateConfiguration(testCatalogue(), 'pilot', [], [
    { id: 'custom', description: 'Window relocation', kind: 'custom', retailPriceCents: 0, internalCostCents: null, weightDeltaKg: null, reason: 'Customer request', visualBrief: 'Move the window 200mm rearward.', drawingStatus: 'approved' },
  ]);
  assert.equal(uncharged.valid, false);
  assert.match(uncharged.errors.map(error => error.message).join(' '), /positive customer charge/i);

  const valid = evaluateConfiguration(testCatalogue(), 'pilot', [], [
    { id: 'custom', description: 'Special cabinet', kind: 'custom', retailPriceCents: 200_000, internalCostCents: 120_000, weightDeltaKg: 15, reason: 'Customer request', visualBrief: 'Add the cabinet beside the entry door.', drawingStatus: 'approved' },
    { id: 'discount', description: 'Launch discount', kind: 'discount', retailPriceCents: 50_000, internalCostCents: 0, weightDeltaKg: 0, reason: 'Owner approved', visualBrief: '', drawingStatus: 'not_applicable' },
  ]);
  assert.equal(valid.valid, true);
  assert.equal(valid.pricing.configuredTotalCents, 5_150_000);
  assert.equal(valid.pricing.internalCostCents, 3_120_000);
  assert.equal(valid.weight.configuredWeightKg, 815);
});

test('approved snapshot has a stable digest and preserves resolved option facts', () => {
  const source = normaliseConfigurationInput({
    modelId: 'advent-2150-hardtop-slide-on',
    customer: { name: 'Test Buyer', email: 'buyer@example.com' },
    selectedOptions: [{ optionId: 'solar-additional-200w', quantity: 2 }],
  }, undefined, new Date('2026-08-08T00:00:00Z'));
  const snapshot = createConfigurationSnapshot(source, 'owner', new Date('2026-08-08T01:00:00Z'));
  assert.equal(snapshot.pricing.configuredTotalCents, 7_300_000);
  assert.equal(snapshot.selections[0].name, 'Additional 200W solar panel');
  assert.equal(snapshot.digest.length, 64);
  const { digest, ...withoutDigest } = snapshot;
  assert.equal(snapshotDigest(withoutDigest), digest);
});

test('approved snapshot converts to an exact linked contract draft without re-keying totals', () => {
  const source = normaliseConfigurationInput({
    modelId: 'advent-2150-hardtop-slide-on',
    customerId: 'customer-1',
    customer: { name: 'Test Buyer', email: 'buyer@example.com', phone: '0400 000 000' },
    selectedOptions: [{ optionId: 'battery-extra-200ah', quantity: 2 }],
    customItems: [{ id: 'discount', description: 'Owner discount', kind: 'discount', retailPriceCents: 50_000, internalCostCents: 0, weightDeltaKg: 0, reason: 'Owner approved', visualBrief: '', drawingStatus: 'not_applicable' }],
  });
  const snapshot = createConfigurationSnapshot(source, 'owner', new Date('2026-08-08T01:00:00Z'));
  const contract = normaliseContractInput(configurationSnapshotToContractInput(snapshot));
  assert.equal(calculateContractTotal(contract.lineItems), snapshot.pricing.configuredTotalCents);
  assert.equal(contract.configurationReference?.configurationId, source.id);
  assert.equal(contract.configurationReference?.snapshotDigest, snapshot.digest);
  assert.equal(contract.lineItems.find(item => item.id === 'battery-extra-200ah')?.quantity, 2);
  assert.match(renderContractHtml(contract), new RegExp(source.configurationNumber));
});

test('configuration revisions retain their number while duplicates receive a new number', () => {
  const source = normaliseConfigurationInput({ modelId: 'advent-2150-hardtop-slide-on' }, undefined, new Date('2026-08-08T00:00:00Z'));
  const revision = createConfigurationCopy(source, 'revision', new Date('2026-08-09T00:00:00Z'));
  const duplicate = createConfigurationCopy(source, 'duplicate', new Date('2026-08-09T00:00:00Z'));
  assert.equal(revision.configurationNumber, source.configurationNumber);
  assert.equal(revision.revision, 2);
  assert.equal(revision.parentConfigurationId, source.id);
  assert.notEqual(duplicate.configurationNumber, source.configurationNumber);
  assert.equal(duplicate.revision, 1);
});

test('configuration records initialise operational workflow state and retain linked drawing versions', () => {
  const record = normaliseConfigurationInput({
    modelId: 'advent-2150-hardtop-slide-on',
    drawings: [{ id: 'drawing-1', customItemId: 'custom-1', version: 2, filename: 'layout-v2.pdf', contentType: 'application/pdf', sizeBytes: 0, store: '', key: '', externalUrl: 'https://example.com/layout-v2.pdf', notes: 'Customer layout', status: 'approved', uploadedAt: '2026-08-08T00:00:00Z', uploadedBy: 'owner', reviewedAt: '2026-08-08T01:00:00Z', reviewedBy: 'owner' }],
  });
  assert.equal(record.drawings.length, 1);
  assert.equal(record.drawings[0].externalUrl, 'https://example.com/layout-v2.pdf');
  assert.equal(record.customerReview.status, 'not_created');
  assert.equal(record.production.status, 'not_released');
  assert.deepEqual(record.production.events, []);
});

test('saved custom alterations cannot claim drawing approval without registered evidence', () => {
  const withoutEvidence = normaliseConfigurationInput({
    modelId: 'advent-2150-hardtop-slide-on',
    customItems: [{ id: 'custom-1', description: 'Window move', kind: 'custom', retailPriceCents: 100_000, internalCostCents: null, weightDeltaKg: null, reason: 'Customer request', visualBrief: 'Move the window rearward.', drawingStatus: 'approved' }],
  });
  assert.equal(withoutEvidence.customItems[0].drawingStatus, 'ready_for_review');

  const withEvidence = normaliseConfigurationInput({
    modelId: 'advent-2150-hardtop-slide-on',
    customItems: withoutEvidence.customItems.map(item => ({ ...item, drawingStatus: 'approved' })),
    drawings: [{ id: 'drawing-1', customItemId: 'custom-1', version: 1, filename: 'window.pdf', contentType: 'application/pdf', sizeBytes: 100, store: 'byondrv-configuration-files', key: 'drawings/test/window.pdf', externalUrl: '', notes: '', status: 'approved', uploadedAt: '2026-08-08T00:00:00Z', uploadedBy: 'owner', reviewedAt: '2026-08-08T01:00:00Z', reviewedBy: 'owner' }],
  });
  assert.equal(withEvidence.customItems[0].drawingStatus, 'approved');
});

test('review links reject stale, expired and mismatched configuration state', () => {
  const generated = createReviewToken();
  assert.equal(generated.hash.length, 64);
  const record = normaliseConfigurationInput({ modelId: 'advent-2150-hardtop-slide-on' }, undefined, new Date('2026-08-08T00:00:00Z'));
  record.customerReview = { ...record.customerReview, status: 'pending', tokenHash: generated.hash, expiresAt: '2026-08-20T00:00:00Z', configurationUpdatedAt: record.updatedAt };
  assert.equal(reviewLinkState(record, generated.hash, new Date('2026-08-10T00:00:00Z')).valid, true);
  assert.match(reviewLinkState(record, '0'.repeat(64), new Date('2026-08-10T00:00:00Z')).reason, /no longer valid/i);
  assert.match(reviewLinkState(record, generated.hash, new Date('2026-08-21T00:00:00Z')).reason, /expired/i);
  record.updatedAt = '2026-08-09T00:00:00Z';
  assert.match(reviewLinkState(record, generated.hash, new Date('2026-08-10T00:00:00Z')).reason, /changed/i);
});

test('customer summary omits owner-only notes and internal commercial data', () => {
  const record = normaliseConfigurationInput({
    modelId: 'advent-2150-hardtop-slide-on',
    customer: { name: '<script>Buyer</script>' },
    customerNotes: 'Customer-safe summary note',
    ownerNotes: 'PRIVATE SUPPLIER COST 123',
    selectedOptions: [{ optionId: 'starlink-mini-install', quantity: 1 }],
  });
  const html = renderConfigurationSummaryHtml(record);
  assert.match(html, /Customer-safe summary note/);
  assert.match(html, /&lt;script&gt;Buyer&lt;\/script&gt;/);
  assert.doesNotMatch(html, /PRIVATE SUPPLIER COST/);
  assert.doesNotMatch(html, /internal cost/i);
});
