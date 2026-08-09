import { APPROVED_SELLER, calculateContractTotal, formatAud, type ContractRecord } from './contract-core.ts';

export const CONTRACT_ADDENDUM_STORE = 'byondrv-contract-addenda';
export type AddendumStatus = 'draft' | 'ready_for_review' | 'approved' | 'sent' | 'signed' | 'cancelled';
export type ChangeSourceType = 'gmail' | 'phone' | 'in_person' | 'owner_manual';
export type ChangeAction = 'add' | 'remove' | 'replace' | 'clarify';

export interface ContractChange {
  id: string;
  action: ChangeAction;
  category: string;
  item: string;
  previousValue: string;
  revisedValue: string;
  priceDeltaCents: number;
  deliveryImpact: string;
  sourceExcerpt: string;
  ownerConfirmed: boolean;
}

export interface ContractAddendumRecord {
  id: string;
  addendumNumber: string;
  contractId: string;
  originalSignedContractId: string;
  contractNumber: string;
  sequence: number;
  sourceType: ChangeSourceType;
  sourceReference: string;
  requestedAt: string;
  requestNote: string;
  changes: ContractChange[];
  previousTotalCents: number;
  addedCostCents: number;
  removedCostCents: number;
  netChangeCents: number;
  revisedTotalCents: number;
  paymentImpact: string;
  deliveryImpact: string;
  status: AddendumStatus;
  ownerApproval: { approvedAt: string; approvedBy: string };
  acceptance: ContractRecord['acceptance'];
  /** @deprecated Retained only to read historical SignWell records. */
  signature: ContractRecord['signature'];
  documentSnapshot: ContractRecord['documentSnapshot'];
  createdAt: string;
  updatedAt: string;
}

function text(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function integer(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

export function addendumKey(id: string) {
  return `addenda/${encodeURIComponent(id)}.json`;
}

export function newAddendumId(now = new Date()) {
  return `addendum_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanChanges(value: unknown): ContractChange[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const action = ['add', 'remove', 'replace', 'clarify'].includes(String(record.action)) ? String(record.action) as ChangeAction : 'clarify';
    const rawDelta = integer(record.priceDeltaCents);
    const priceDeltaCents = action === 'add' ? Math.abs(rawDelta) : action === 'remove' ? -Math.abs(rawDelta) : rawDelta;
    return {
      id: text(record.id, 120) || `change_${index + 1}`,
      action,
      category: text(record.category, 160),
      item: text(record.item, 300),
      previousValue: text(record.previousValue, 1000),
      revisedValue: text(record.revisedValue, 1000),
      priceDeltaCents,
      deliveryImpact: text(record.deliveryImpact, 1000),
      sourceExcerpt: text(record.sourceExcerpt, 2000),
      ownerConfirmed: record.ownerConfirmed === true,
    };
  }).filter(change => change.item || change.revisedValue).slice(0, 100);
}

export function calculateAddendumPricing(previousTotalCents: number, changes: ContractChange[]) {
  const addedCostCents = changes.reduce((sum, change) => sum + Math.max(0, change.priceDeltaCents), 0);
  const removedCostCents = changes.reduce((sum, change) => sum + Math.abs(Math.min(0, change.priceDeltaCents)), 0);
  const netChangeCents = addedCostCents - removedCostCents;
  return { previousTotalCents, addedCostCents, removedCostCents, netChangeCents, revisedTotalCents: previousTotalCents + netChangeCents };
}

export function normaliseAddendumInput(
  input: Record<string, unknown>,
  baseContract: ContractRecord,
  previousTotalCents: number,
  sequence: number,
  existing?: ContractAddendumRecord | null,
  options: { actorUserId?: string } = {},
): ContractAddendumRecord {
  const now = new Date();
  const actorUserId = text(options.actorUserId, 180) || 'legacy-admin';
  const changes = cleanChanges(input.changes);
  const pricing = calculateAddendumPricing(previousTotalCents, changes);
  const status = ['draft', 'ready_for_review', 'approved', 'sent', 'signed', 'cancelled'].includes(String(input.status))
    ? String(input.status) as AddendumStatus
    : existing?.status || 'draft';
  const priorApproval = existing?.ownerApproval || { approvedAt: '', approvedBy: '' };
  return {
    id: existing?.id || text(input.id, 240) || newAddendumId(now),
    addendumNumber: existing?.addendumNumber || `${baseContract.contractNumber}-A${String(sequence).padStart(2, '0')}`,
    contractId: baseContract.id,
    originalSignedContractId: baseContract.id,
    contractNumber: baseContract.contractNumber,
    sequence,
    sourceType: ['gmail', 'phone', 'in_person', 'owner_manual'].includes(String(input.sourceType)) ? String(input.sourceType) as ChangeSourceType : 'owner_manual',
    sourceReference: text(input.sourceReference, 500),
    requestedAt: text(input.requestedAt, 80) || now.toISOString(),
    requestNote: text(input.requestNote, 4000),
    changes,
    ...pricing,
    paymentImpact: text(input.paymentImpact, 2000),
    deliveryImpact: text(input.deliveryImpact, 2000),
    status,
    ownerApproval: status === 'approved' && !priorApproval.approvedAt
      ? { approvedAt: now.toISOString(), approvedBy: actorUserId }
      : ['draft', 'ready_for_review'].includes(status) ? { approvedAt: '', approvedBy: '' } : priorApproval,
    acceptance: existing?.acceptance || {
      status: 'not_prepared', method: '', preparedAt: '', sentAt: '', sentToEmail: '', acceptedAt: '',
      acceptedByName: '', acceptedByEmail: '', evidenceReference: '', evidenceNotes: '', depositAmountCents: 0,
      depositReference: '', recordedAt: '', recordedBy: '', preparedByUserId: '', sentByUserId: '',
    },
    signature: existing?.signature || { provider: '', documentId: '', status: '', testMode: true, editUrl: '', completedPdfUrl: '', createdAt: '', sentAt: '', completedAt: '', lastCheckedAt: '' },
    documentSnapshot: existing?.documentSnapshot || { store: '', key: '', sha256: '', mimeType: '', createdAt: '' },
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function validateAddendum(addendum: ContractAddendumRecord, baseContract?: ContractRecord | null) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!baseContract || baseContract.status !== 'signed') errors.push('Select an immutable signed contract.');
  if (!addendum.requestedAt) errors.push('Add the customer request date.');
  if (!addendum.requestNote) errors.push('Record what the customer requested.');
  if (!addendum.changes.length) errors.push('Add at least one proposed change.');
  addendum.changes.forEach((change, index) => {
    if (!change.item) errors.push(`Change ${index + 1}: add the affected item.`);
    if (!change.revisedValue) errors.push(`Change ${index + 1}: add the revised value or scope.`);
    if (!change.ownerConfirmed) errors.push(`Change ${index + 1}: confirm the change and price impact.`);
  });
  if (!addendum.paymentImpact) errors.push('Confirm the payment impact, including “No change” when applicable.');
  if (!addendum.deliveryImpact) errors.push('Confirm the delivery impact, including “No change” when applicable.');
  if (addendum.revisedTotalCents < 0) errors.push('The revised contract total cannot be negative.');
  if (addendum.previousTotalCents + addendum.netChangeCents !== addendum.revisedTotalCents) errors.push('The addendum total calculation is inconsistent.');
  if (addendum.changes.some(change => !change.previousValue)) warnings.push('One or more changes do not state the previous value.');
  return { valid: errors.length === 0, errors, warnings };
}

export function calculateEffectiveDeal(baseContract: ContractRecord, completedAddenda: ContractAddendumRecord[]) {
  const baseTotalCents = calculateContractTotal(baseContract.lineItems);
  const applied = completedAddenda.filter(addendum => addendum.status === 'signed').sort((a, b) => a.sequence - b.sequence);
  const netChangeCents = applied.reduce((sum, addendum) => sum + addendum.netChangeCents, 0);
  return { baseTotalCents, netChangeCents, effectiveTotalCents: baseTotalCents + netChangeCents, signedAddenda: applied };
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function renderAddendumHtml(addendum: ContractAddendumRecord, baseContract: ContractRecord) {
  const changeRows = addendum.changes.map(change => `<tr><td>${escapeHtml(change.action)}</td><td>${escapeHtml(change.item)}</td><td>${escapeHtml(change.previousValue || 'Not stated')}</td><td>${escapeHtml(change.revisedValue)}</td><td>${formatAud(change.priceDeltaCents)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(addendum.addendumNumber)}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;font-size:11pt;line-height:1.4}header{border-bottom:3px solid #e8540a;padding-bottom:10px}.brand{font-size:22pt;font-weight:800}.seller{font-size:9pt;color:#444;margin-top:7px}h1{text-align:center;font-size:18pt}h2{font-size:12pt;text-transform:uppercase;border-bottom:1px solid #bbb;padding-bottom:4px;margin-top:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #bbb;border-radius:6px;padding:10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:7px;text-align:left;vertical-align:top}th{background:#f0f0f0}.notice{border-left:4px solid #e8540a;padding:10px;background:#fff7ed;margin-top:18px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:42px}.line{border-top:1px solid #222;padding-top:5px;margin-top:42px}@media print{table,.card{break-inside:avoid}}</style></head><body>
<header><div class="brand">BEYOND RV CAMPERS</div><div class="seller">${escapeHtml(APPROVED_SELLER.legalName)} · ABN ${escapeHtml(APPROVED_SELLER.abn)}<br>${escapeHtml(APPROVED_SELLER.address)} · ${escapeHtml(APPROVED_SELLER.phone)} · ${escapeHtml(APPROVED_SELLER.email)}</div></header>
<h1>Contract Addendum</h1><div class="grid"><div class="card"><strong>Addendum</strong><br>${escapeHtml(addendum.addendumNumber)}<br><strong>Original contract</strong><br>${escapeHtml(baseContract.contractNumber)}<br><strong>Original accepted date</strong><br>${escapeHtml(baseContract.acceptance?.acceptedAt?.slice(0,10) || baseContract.signature?.completedAt?.slice(0,10) || 'Recorded in acceptance evidence')}</div><div class="card"><strong>Buyer</strong><br>${escapeHtml(baseContract.buyer.name)}<br>${escapeHtml(baseContract.buyer.email)}<br><strong>Product</strong><br>${escapeHtml(baseContract.product.name)}</div></div>
<h2>Customer Request</h2><p><strong>Source:</strong> ${escapeHtml(addendum.sourceType.replace(/_/g,' '))} · <strong>Requested:</strong> ${escapeHtml(addendum.requestedAt.slice(0,10))}</p><p>${escapeHtml(addendum.requestNote).replace(/\n/g,'<br>')}</p>
<h2>Approved Changes</h2><table><thead><tr><th>Action</th><th>Item</th><th>Previous</th><th>Revised</th><th>Price change</th></tr></thead><tbody>${changeRows}</tbody></table>
<h2>Commercial Impact</h2><table><tbody><tr><th>Previous contract total</th><td>${formatAud(addendum.previousTotalCents)}</td></tr><tr><th>Added cost</th><td>${formatAud(addendum.addedCostCents)}</td></tr><tr><th>Removed cost</th><td>-${formatAud(addendum.removedCostCents)}</td></tr><tr><th>Net price change</th><td>${formatAud(addendum.netChangeCents)}</td></tr><tr><th>Revised contract total</th><td><strong>${formatAud(addendum.revisedTotalCents)}</strong></td></tr></tbody></table>
<p><strong>Payment impact:</strong> ${escapeHtml(addendum.paymentImpact)}</p><p><strong>Delivery/handover impact:</strong> ${escapeHtml(addendum.deliveryImpact)}</p>
<div class="notice"><strong>Continuing terms</strong><p>This addendum changes only the items expressly stated above. All other terms of the original sale agreement remain unchanged and effective.</p><p><strong>Acceptance:</strong> The Buyer accepts this addendum by signing it or by sending an explicit written acceptance that identifies this addendum number. Payment alone is not used to accept an addendum unless the addendum expressly states otherwise.</p></div>
<div class="signatures"><div><div class="line">Buyer signature</div><p>Name: ${escapeHtml(baseContract.buyer.name)}</p><p>Date:</p></div><div><div class="line">Seller signature</div><p>Name:</p><p>Date:</p></div></div></body></html>`;
}
