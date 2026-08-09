import { createHash } from 'node:crypto';
import { getConfiguratorCatalogue } from '../../src/lib/configurator/catalogue.ts';
import { evaluateConfiguration } from '../../src/lib/configurator/engine.ts';
import type {
  ConfigurationCustomItem,
  ConfigurationEvaluation,
  ConfigurationDrawingVersion,
  ConfigurationCustomerReview,
  ConfigurationProductionTracking,
  ConfigurationRecord,
  ConfigurationSelection,
  ConfigurationSnapshot,
  ConfigurationStatus,
  ConfiguratorCatalogue,
} from '../../src/lib/configurator/types.ts';

export const CONFIGURATION_STORE = 'byondrv-configurations';

const CONFIGURATION_STATUSES: ConfigurationStatus[] = [
  'draft',
  'ready_for_review',
  'approved',
  'quoted',
  'converted_to_contract',
  'ordered',
  'superseded',
  'archived',
];

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function integer(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringList(value: unknown, maxItems = 100) {
  return Array.isArray(value)
    ? value.map(item => clean(item, 240)).filter(Boolean).slice(0, maxItems)
    : [];
}

function normaliseSelections(value: unknown): ConfigurationSelection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const optionId = clean(record.optionId, 160);
    if (!optionId || seen.has(optionId)) return [];
    seen.add(optionId);
    return [{ optionId, quantity: Math.max(1, integer(record.quantity, 1)) }];
  }).slice(0, 200);
}

function normaliseCustomItems(value: unknown): ConfigurationCustomItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const description = clean(record.description, 500);
    const kind = record.kind === 'discount' ? 'discount' : 'custom';
    const drawingStatus = ['not_started', 'requested', 'in_progress', 'ready_for_review', 'approved'].includes(String(record.drawingStatus))
      ? String(record.drawingStatus) as ConfigurationCustomItem['drawingStatus']
      : kind === 'discount' ? 'not_applicable' : 'not_started';
    return [{
      id: clean(record.id, 160) || `custom_${Date.now()}_${index}`,
      description,
      kind,
      retailPriceCents: Math.max(0, integer(record.retailPriceCents)),
      internalCostCents: kind === 'discount' ? 0 : nullableNumber(record.internalCostCents),
      weightDeltaKg: kind === 'discount' ? 0 : nullableNumber(record.weightDeltaKg),
      reason: clean(record.reason, 1000),
      visualBrief: kind === 'discount' ? '' : clean(record.visualBrief, 4000),
      drawingStatus,
    } satisfies ConfigurationCustomItem];
  }).slice(0, 100);
}

export function emptyCustomerReview(): ConfigurationCustomerReview {
  return { status: 'not_created', tokenHash: '', tokenHint: '', createdAt: '', expiresAt: '', viewedAt: '', decidedAt: '', decidedByName: '', decidedByEmail: '', decisionNotes: '', configurationUpdatedAt: '' };
}

export function emptyProductionTracking(): ConfigurationProductionTracking {
  return { status: 'not_released', orderId: '', depositReference: '', depositReceivedAt: '', expectedArrivalDate: '', expectedHandoverDate: '', nextActionDate: '', events: [] };
}

export function hydrateConfigurationRecord(record: ConfigurationRecord): ConfigurationRecord {
  const review = record.customerReview && typeof record.customerReview === 'object' ? record.customerReview : emptyCustomerReview();
  const production = record.production && typeof record.production === 'object' ? record.production : emptyProductionTracking();
  return {
    ...record,
    drawings: normaliseDrawings(record.drawings, []),
    customerReview: { ...emptyCustomerReview(), ...review },
    production: {
      ...emptyProductionTracking(),
      ...production,
      events: Array.isArray(production.events) ? production.events : [],
    },
  };
}

function normaliseDrawings(value: unknown, fallback: ConfigurationDrawingVersion[] = []): ConfigurationDrawingVersion[] {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const id = clean(record.id, 180);
    const key = clean(record.key, 600);
    const externalUrl = clean(record.externalUrl, 1000);
    if (!id || (!key && !externalUrl)) return [];
    const status = ['uploaded', 'in_review', 'changes_requested', 'approved', 'superseded'].includes(String(record.status))
      ? String(record.status) as ConfigurationDrawingVersion['status']
      : 'uploaded';
    return [{
      id,
      customItemId: clean(record.customItemId, 180),
      version: Math.max(1, integer(record.version, 1)),
      filename: clean(record.filename, 240),
      contentType: clean(record.contentType, 160),
      sizeBytes: Math.max(0, integer(record.sizeBytes)),
      store: clean(record.store, 160),
      key,
      externalUrl,
      notes: clean(record.notes, 4000),
      status,
      uploadedAt: clean(record.uploadedAt, 100),
      uploadedBy: clean(record.uploadedBy, 160),
      reviewedAt: clean(record.reviewedAt, 100),
      reviewedBy: clean(record.reviewedBy, 160),
    } satisfies ConfigurationDrawingVersion];
  }).slice(0, 500);
}

function status(value: unknown, fallback: ConfigurationStatus): ConfigurationStatus {
  return CONFIGURATION_STATUSES.includes(value as ConfigurationStatus) ? value as ConfigurationStatus : fallback;
}

export function configurationKey(configurationId: string) {
  return `configurations/${encodeURIComponent(configurationId)}.json`;
}

export function configurationSnapshotKey(configurationId: string, revision: number) {
  return `configuration-snapshots/${encodeURIComponent(configurationId)}/${Math.max(1, integer(revision, 1))}.json`;
}

export function newConfigurationId(now = new Date()) {
  return `configuration_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newConfigurationNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const entropy = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(-7).toUpperCase();
  return `BRV-CFG-${date}-${entropy}`;
}

export function normaliseConfigurationInput(
  input: Record<string, unknown>,
  existing?: ConfigurationRecord,
  now = new Date(),
  catalogue: ConfiguratorCatalogue = getConfiguratorCatalogue(),
): ConfigurationRecord {
  const timestamp = now.toISOString();
  const customerInput = input.customer && typeof input.customer === 'object' ? input.customer as Record<string, unknown> : {};
  const existingCustomer = existing?.customer ?? { name: '', email: '', phone: '' };
  const fallbackStatus = existing?.status ?? 'draft';
  const nextStatus = status(input.status, fallbackStatus);
  const drawings = normaliseDrawings(input.drawings, existing?.drawings ?? []);
  const customItems = normaliseCustomItems(input.customItems).map(item => item.kind === 'custom' && item.drawingStatus === 'approved' && !drawings.some(drawing => drawing.customItemId === item.id && drawing.status === 'approved')
    ? { ...item, drawingStatus: 'ready_for_review' as const }
    : item);

  return {
    id: (existing?.id ?? clean(input.id, 200)) || newConfigurationId(now),
    configurationNumber: (existing?.configurationNumber ?? clean(input.configurationNumber, 200)) || newConfigurationNumber(now),
    revision: existing?.revision ?? Math.max(1, integer(input.revision, 1)),
    parentConfigurationId: existing?.parentConfigurationId ?? clean(input.parentConfigurationId, 200),
    status: nextStatus,
    catalogueVersion: (existing?.catalogueVersion ?? clean(input.catalogueVersion, 200)) || catalogue.catalogueVersion,
    modelId: clean(input.modelId, 200) || existing?.modelId || catalogue.models.find(model => model.active && model.adminVisible)?.id || '',
    customerId: clean(input.customerId, 240),
    leadId: clean(input.leadId, 240),
    customer: {
      name: clean(customerInput.name, 240) || existingCustomer.name,
      email: clean(customerInput.email, 320).toLowerCase() || existingCustomer.email,
      phone: clean(customerInput.phone, 100) || existingCustomer.phone,
    },
    selectedOptions: normaliseSelections(input.selectedOptions),
    customItems,
    drawings,
    customerReview: existing?.customerReview ?? emptyCustomerReview(),
    production: existing?.production ?? emptyProductionTracking(),
    acknowledgedWarningIds: stringList(input.acknowledgedWarningIds),
    ownerNotes: clean(input.ownerNotes, 8000),
    customerNotes: clean(input.customerNotes, 4000),
    linkedContractIds: existing?.linkedContractIds ?? stringList(input.linkedContractIds),
    linkedOrderIds: existing?.linkedOrderIds ?? stringList(input.linkedOrderIds),
    approvedSnapshotKey: existing?.approvedSnapshotKey ?? '',
    approvedSnapshotDigest: existing?.approvedSnapshotDigest ?? '',
    approvedAt: existing?.approvedAt ?? '',
    approvedBy: existing?.approvedBy ?? '',
    createdBy: existing?.createdBy ?? 'owner',
    updatedBy: 'owner',
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function evaluateConfigurationRecord(record: ConfigurationRecord, catalogue: ConfiguratorCatalogue = getConfiguratorCatalogue()): ConfigurationEvaluation {
  return evaluateConfiguration(catalogue, record.modelId, record.selectedOptions, record.customItems);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function snapshotDigest(snapshot: Omit<ConfigurationSnapshot, 'digest'>) {
  return createHash('sha256').update(JSON.stringify(stable(snapshot))).digest('hex');
}

export function createConfigurationSnapshot(record: ConfigurationRecord, approvedBy = 'owner', now = new Date(), catalogue: ConfiguratorCatalogue = getConfiguratorCatalogue()): ConfigurationSnapshot {
  const evaluation = evaluateConfigurationRecord(record, catalogue);
  if (!evaluation.valid || !evaluation.model) throw new Error('A valid model and configuration are required before approval.');
  const approvedAt = now.toISOString();
  const withoutDigest: Omit<ConfigurationSnapshot, 'digest'> = {
    configurationId: record.id,
    configurationNumber: record.configurationNumber,
    revision: record.revision,
    catalogueVersion: record.catalogueVersion,
    model: evaluation.model,
    customer: record.customer,
    customerId: record.customerId,
    leadId: record.leadId,
    selections: evaluation.selections.map(selection => ({
      optionId: selection.optionId,
      name: selection.option.name,
      categoryId: selection.option.categoryId,
      quantity: selection.quantity,
      unitPriceCents: selection.option.retailPriceDeltaCents,
      retailTotalCents: selection.retailTotalCents,
      internalCostTotalCents: selection.internalCostTotalCents,
      weightTotalKg: selection.weightTotalKg,
    })),
    customItems: record.customItems,
    drawings: record.drawings,
    customerReview: {
      status: record.customerReview.status,
      decidedAt: record.customerReview.decidedAt,
      decidedByName: record.customerReview.decidedByName,
      decidedByEmail: record.customerReview.decidedByEmail,
    },
    warnings: evaluation.warnings,
    pricing: evaluation.pricing,
    weight: evaluation.weight,
    ownerNotes: record.ownerNotes,
    customerNotes: record.customerNotes,
    approvedBy,
    approvedAt,
  };
  return { ...withoutDigest, digest: snapshotDigest(withoutDigest) };
}

export function createConfigurationCopy(source: ConfigurationRecord, kind: 'duplicate' | 'revision', now = new Date(), catalogue: ConfiguratorCatalogue = getConfiguratorCatalogue()): ConfigurationRecord {
  const input: Record<string, unknown> = {
    modelId: source.modelId,
    catalogueVersion: source.catalogueVersion,
    customerId: source.customerId,
    leadId: source.leadId,
    customer: source.customer,
    selectedOptions: source.selectedOptions,
    customItems: source.customItems,
    drawings: kind === 'revision' ? source.drawings : [],
    customerReview: emptyCustomerReview(),
    production: emptyProductionTracking(),
    ownerNotes: source.ownerNotes,
    customerNotes: source.customerNotes,
    status: 'draft',
  };
  const copy = normaliseConfigurationInput(input, undefined, now, catalogue);
  if (kind === 'revision') {
    copy.configurationNumber = source.configurationNumber;
    copy.revision = source.revision + 1;
    copy.parentConfigurationId = source.id;
  }
  return copy;
}

export function configurationSnapshotToContractInput(snapshot: ConfigurationSnapshot, catalogue: ConfiguratorCatalogue = getConfiguratorCatalogue()) {
  const categoryNames = new Map(catalogue.categories.map(category => [category.id, category.name]));
  const groupedSelections = new Map<string, string[]>();
  for (const selection of snapshot.selections) {
    const heading = categoryNames.get(selection.categoryId) || 'Configured Options';
    const items = groupedSelections.get(heading) || [];
    items.push(`${selection.name}${selection.quantity > 1 ? ` × ${selection.quantity}` : ''}`);
    groupedSelections.set(heading, items);
  }

  return {
    status: 'draft',
    customerId: snapshot.customerId,
    leadId: snapshot.leadId,
    buyer: {
      name: snapshot.customer.name,
      email: snapshot.customer.email,
      phone: snapshot.customer.phone,
    },
    product: {
      slug: snapshot.model.productSlug,
      name: snapshot.model.name,
      category: snapshot.model.productCategory,
      buildIdentifier: `${snapshot.configurationNumber}-R${snapshot.revision}`,
      weights: snapshot.weight.status === 'known' && snapshot.weight.configuredWeightKg !== null
        ? `Indicative configured weight ${snapshot.weight.configuredWeightKg} kg — confirm before customer approval`
        : '',
    },
    configurationReference: {
      configurationId: snapshot.configurationId,
      configurationNumber: snapshot.configurationNumber,
      revision: snapshot.revision,
      snapshotDigest: snapshot.digest,
    },
    lineItems: [
      { id: 'base', description: snapshot.model.name, quantity: 1, unitPriceCents: snapshot.pricing.basePriceCents, kind: 'base' },
      ...snapshot.selections.map(selection => ({ id: selection.optionId, description: selection.name, quantity: selection.quantity, unitPriceCents: selection.unitPriceCents, kind: 'extra' })),
      ...snapshot.customItems.map(item => ({ id: item.id, description: item.description, quantity: 1, unitPriceCents: item.retailPriceCents, kind: item.kind, reason: item.reason })),
    ],
    specificationSections: [
      { heading: 'Configured Model', items: [`${snapshot.model.name} — configuration ${snapshot.configurationNumber}, revision ${snapshot.revision}`] },
      { heading: 'Order and Build Process', items: [snapshot.model.orderProcess.customerSummary] },
      ...[...groupedSelections.entries()].map(([heading, items]) => ({ heading, items })),
      ...(snapshot.customItems.some(item => item.kind === 'custom')
        ? [{ heading: 'Custom Alterations', items: snapshot.customItems.filter(item => item.kind === 'custom').map(item => `${item.description} — 3D drawing approved. Visual brief: ${item.visualBrief}`) }]
        : []),
    ],
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(cents: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function qualifiedModelMoney(model: ConfigurationEvaluation['model'], cents: number) {
  if (model?.priceQualifier === 'poa') return 'POA';
  if (model?.priceQualifier === 'from') return `From ${money(cents)}`;
  if (model?.priceQualifier === 'negotiable') return `${money(cents)} negotiable`;
  return money(cents);
}

export function renderConfigurationSummaryHtml(record: ConfigurationRecord, evaluation?: ConfigurationEvaluation, catalogue: ConfiguratorCatalogue = getConfiguratorCatalogue()) {
  evaluation = evaluation ?? evaluateConfigurationRecord(record, catalogue);
  const categoryNames = new Map(catalogue.categories.map(category => [category.id, category.name]));
  const selectionRows = evaluation.selections.map(selection => `
    <tr>
      <td>${escapeHtml(categoryNames.get(selection.option.categoryId) || selection.option.categoryId)}</td>
      <td>${escapeHtml(selection.option.name)}${selection.quantity > 1 ? ` × ${selection.quantity}` : ''}</td>
      <td>${money(selection.retailTotalCents)}</td>
    </tr>`).join('');
  const customRows = record.customItems.map(item => `
    <tr>
      <td>${item.kind === 'discount' ? 'Discount' : 'Custom alteration'}</td>
      <td>${escapeHtml(item.description)}${item.kind === 'custom' && item.visualBrief ? `<br><span class="muted">3D drawing: ${escapeHtml(item.visualBrief)}</span>` : ''}</td>
      <td>${item.kind === 'discount' ? '−' : ''}${money(item.retailPriceCents)}</td>
    </tr>`).join('');
  const warnings = evaluation.warnings.map(item => `<li>${escapeHtml(item.message)}</li>`).join('');
  const weightText = evaluation.weight.status === 'known' && evaluation.weight.configuredWeightKg !== null
    ? `${evaluation.weight.configuredWeightKg.toLocaleString('en-AU')} kg indicative configured weight`
    : 'Weight information is incomplete and must be confirmed before relying on payload calculations.';

  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(record.configurationNumber)} — Beyond RV configuration</title>
  <style>
    :root{font-family:Arial,sans-serif;color:#171717}body{max-width:900px;margin:0 auto;padding:36px;line-height:1.45}header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #e8540a;padding-bottom:20px;margin-bottom:26px}h1{font-size:28px;margin:0}h2{font-size:18px;margin:28px 0 10px}p{margin:6px 0}.muted{color:#666}.total{font-size:24px;font-weight:800;color:#b54108}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #ddd;padding:10px 6px}th:last-child,td:last-child{text-align:right}.notice{background:#fff7ed;border:1px solid #fdba74;padding:14px;margin-top:24px}footer{border-top:1px solid #ddd;margin-top:30px;padding-top:14px;color:#666;font-size:12px}@media print{body{padding:0}.no-print{display:none}}
  </style>
</head>
<body>
  <header>
    <div><h1>Beyond RV Camper Configuration</h1><p class="muted">${escapeHtml(record.configurationNumber)} · Revision ${record.revision}</p></div>
    <div><strong>Beyond RV Campers</strong><p>77 Coleyville Rd, Mutdapilly QLD 4307</p><p>0430 863 819 · beyondcaravans@gmail.com</p></div>
  </header>
  <h2>${escapeHtml(evaluation.model?.name || 'Camper configuration')}</h2>
  ${record.customer.name || record.customer.email ? `<p>Prepared for <strong>${escapeHtml(record.customer.name || record.customer.email)}</strong></p>` : ''}
  <p>${escapeHtml(record.customerNotes)}</p>
  ${evaluation.model?.orderProcess?.customerSummary ? `<div class="notice"><strong>Made-to-order process</strong><p>${escapeHtml(evaluation.model.orderProcess.customerSummary)}</p></div>` : ''}
  <table>
    <thead><tr><th>Category</th><th>Selection</th><th>Price</th></tr></thead>
    <tbody>
      <tr><td>Base camper</td><td>${escapeHtml(evaluation.model?.name || '')}</td><td>${qualifiedModelMoney(evaluation.model, evaluation.pricing.basePriceCents)}</td></tr>
      ${selectionRows}${customRows}
    </tbody>
  </table>
  <h2>Configured total</h2>
  <p class="total">${qualifiedModelMoney(evaluation.model, evaluation.pricing.configuredTotalCents)}</p>
  <p>${escapeHtml(weightText)}</p>
  ${warnings ? `<div class="notice"><strong>Items to confirm</strong><ul>${warnings}</ul></div>` : ''}
  <div class="notice"><strong>Important</strong><p>Pricing, specifications, availability, suitability and payload figures remain subject to final written confirmation by Beyond RV. This configuration summary is not a binding sale agreement.</p></div>
  <footer>Generated from catalogue ${escapeHtml(record.catalogueVersion)}. Configuration ${escapeHtml(record.configurationNumber)}, revision ${record.revision}.</footer>
</body>
</html>`;
}
