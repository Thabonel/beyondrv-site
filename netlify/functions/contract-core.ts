export const CONTRACT_STORE = 'byondrv-contracts';
export const CONTRACT_TEMPLATE_VERSION = '12c-master-v2-manual-acceptance';
export const CONTRACT_TERMS_VERSION = '2026-07-23-v0.1-legal-review-draft';

export const APPROVED_SELLER = {
  legalName: 'Passion Industries Pty Ltd',
  tradingName: 'Beyond RV Campers',
  abn: '45 145 189 297',
  address: '77 Coleyville Rd, Mutdapilly QLD 4307',
  phone: '0430 863 819',
  email: 'beyondcaravans@gmail.com',
  website: 'www.beyondrv.com.au',
} as const;

export type ContractStatus = 'draft' | 'ready_for_review' | 'approved' | 'sent' | 'signed' | 'cancelled' | 'superseded';
export type AcceptanceMethod = '' | 'hand_signed_copy' | 'deposit_payment' | 'email_confirmation';
export type AcceptanceStatus = 'not_prepared' | 'prepared' | 'sent' | 'accepted' | 'declined' | 'cancelled';

export interface AgreementAcceptance {
  status: AcceptanceStatus;
  method: AcceptanceMethod;
  preparedAt: string;
  sentAt: string;
  sentToEmail: string;
  acceptedAt: string;
  acceptedByName: string;
  acceptedByEmail: string;
  evidenceReference: string;
  evidenceNotes: string;
  depositAmountCents: number;
  depositReference: string;
  recordedAt: string;
  recordedBy: string;
}

export interface ContractLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  kind: 'base' | 'extra' | 'custom' | 'discount';
  reason?: string;
}

export interface ContractSpecificationSection {
  heading: string;
  items: string[];
}

export interface ContractConfigurationReference {
  configurationId: string;
  configurationNumber: string;
  revision: number;
  snapshotDigest: string;
}

export interface ContractRecord {
  id: string;
  contractNumber: string;
  version: number;
  parentContractId: string;
  supersededByContractId: string;
  revisionReason: string;
  sourceAiActionId: string;
  proposedChanges: Array<{ action: string; item: string; previousValue: string; requestedValue: string; sourceExcerpt: string }>;
  templateVersion: string;
  termsVersion: string;
  status: ContractStatus;
  customerId: string;
  leadId: string;
  buyer: {
    name: string;
    organisation: string;
    address: string;
    phone: string;
    email: string;
  };
  product: {
    slug: string;
    name: string;
    category: string;
    buildIdentifier: string;
    dimensions: string;
    weights: string;
  };
  configurationReference?: ContractConfigurationReference;
  lineItems: ContractLineItem[];
  specificationSections: ContractSpecificationSection[];
  exclusions: string[];
  deliveryNotes: string;
  validityDate: string;
  ownerApproval: {
    approvedAt: string;
    approvedBy: string;
  };
  acceptance: AgreementAcceptance;
  /** @deprecated Retained only to read historical SignWell records. */
  signature: {
    provider: 'signwell' | '';
    documentId: string;
    status: string;
    testMode: boolean;
    editUrl: string;
    completedPdfUrl: string;
    createdAt: string;
    sentAt: string;
    completedAt: string;
    lastCheckedAt: string;
  };
  documentSnapshot: {
    store: string;
    key: string;
    sha256: string;
    mimeType: string;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function emptyAgreementAcceptance(): AgreementAcceptance {
  return {
    status: 'not_prepared',
    method: '',
    preparedAt: '',
    sentAt: '',
    sentToEmail: '',
    acceptedAt: '',
    acceptedByName: '',
    acceptedByEmail: '',
    evidenceReference: '',
    evidenceNotes: '',
    depositAmountCents: 0,
    depositReference: '',
    recordedAt: '',
    recordedBy: '',
  };
}

function cleanAcceptance(value: unknown, fallback?: AgreementAcceptance): AgreementAcceptance {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const status = ['not_prepared', 'prepared', 'sent', 'accepted', 'declined', 'cancelled'].includes(String(record.status))
    ? String(record.status) as AcceptanceStatus
    : fallback?.status || 'not_prepared';
  const method = ['hand_signed_copy', 'deposit_payment', 'email_confirmation'].includes(String(record.method))
    ? String(record.method) as AcceptanceMethod
    : fallback?.method || '';
  return {
    status,
    method,
    preparedAt: text(record.preparedAt, 80) || fallback?.preparedAt || '',
    sentAt: text(record.sentAt, 80) || fallback?.sentAt || '',
    sentToEmail: text(record.sentToEmail, 240).toLowerCase() || fallback?.sentToEmail || '',
    acceptedAt: text(record.acceptedAt, 80) || fallback?.acceptedAt || '',
    acceptedByName: text(record.acceptedByName, 180) || fallback?.acceptedByName || '',
    acceptedByEmail: text(record.acceptedByEmail, 240).toLowerCase() || fallback?.acceptedByEmail || '',
    evidenceReference: text(record.evidenceReference, 1000) || fallback?.evidenceReference || '',
    evidenceNotes: text(record.evidenceNotes, 2000) || fallback?.evidenceNotes || '',
    depositAmountCents: Math.max(0, finiteInteger(record.depositAmountCents) || fallback?.depositAmountCents || 0),
    depositReference: text(record.depositReference, 300) || fallback?.depositReference || '',
    recordedAt: text(record.recordedAt, 80) || fallback?.recordedAt || '',
    recordedBy: text(record.recordedBy, 180) || fallback?.recordedBy || '',
  };
}

export const TWELVE_C_SOURCE_SPECIFICATIONS: ContractSpecificationSection[] = [
  {
    heading: 'Internal Features',
    items: [
      'Fold out queen size bed with foam mattress',
      'Quality cabinetry throughout',
      'Cabinet doors with locking latches and spring loaded hinges',
      '360 degree swivel dinette table with leatherette upholstery',
      'Dometic reverse cycle air conditioner with 3600W compressor cooling capacity',
      'Two way fan in ensuite with LED lights',
      'Skylight with LED lights',
      'Smoke alarm and fire extinguisher',
      'Ensuite bathroom with hot and cold shower',
      'Bunk bed with foam mattress',
      'Thetford cassette toilet',
    ],
  },
  {
    heading: 'External Features',
    items: [
      'Electric roll out awning',
      'Slide out step',
      'Picnic table',
      'Stainless steel kitchen with 4 burner stove',
      'Stainless steel sink and drying rack with hot and cold water',
      'Pantry, cutlery drawer and storage drawer',
      'External 240V power, 12V power and TV point',
      'External shower with hot and cold water',
      'Storage with slide out for BBQ or generator',
      'Double jerrycan holder',
      'Spare mud terrain tyre with alloy rim mounted on rear',
      'Grab handle at entrance door',
    ],
  },
  {
    heading: 'Electrical',
    items: [
      'Battery management system',
      '2000 watt inverter',
      '2 x 180W solar panels',
      '1 x 100Ah lithium-ion smart battery with Bluetooth connectivity',
      'LED lighting throughout',
      '240V, 12V, USB ports and cigarette sockets throughout',
      'External lighting including lightbar on front of vehicle',
      'Bluetooth stereo',
      '24 inch high definition TV',
      'Australian compliant wiring and fittings',
      'Australian electrical certification',
    ],
  },
  {
    heading: 'Plumbing',
    items: [
      '190L fresh water tank',
      '95L grey water tank',
      '12V water pump',
      'Truma Ultrarapid gas/electric hot water system',
      'External shower',
      'Town water pressure inlets',
      'Australian gas certification',
    ],
  },
  {
    heading: 'Build & Construction Features',
    items: [
      'Heavy duty hot dipped chassis and drawbar',
      'DO35 off-road hitch',
      'Independent coil suspension with dual shock absorbers',
      'Fibreglass insulated construction with a welded aluminium frame',
      'Double glazed windows with integrated blind and screen',
      'Full length door with integrated security screen',
      'Stone protector on drawbar',
      'Internal storage for gas bottles',
      'Checker plate protection on body',
      'Heavy duty jockey wheel',
      'Alloy wheels and mud terrain tyres',
    ],
  },
];

function text(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function finiteInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

export function contractKey(contractId: string) {
  return `contracts/${encodeURIComponent(contractId)}.json`;
}

export function newContractId(now = new Date()) {
  return `contract_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newContractNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const entropy = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(-9).toUpperCase();
  return `BRV-${date}-${entropy}`;
}

export function calculateLineItemTotal(item: Pick<ContractLineItem, 'quantity' | 'unitPriceCents' | 'kind'>) {
  const total = Math.max(0, finiteInteger(item.quantity)) * Math.abs(finiteInteger(item.unitPriceCents));
  return item.kind === 'discount' ? -total : total;
}

export function calculateContractTotal(lineItems: ContractLineItem[]) {
  return lineItems.reduce((total, item) => total + calculateLineItemTotal(item), 0);
}

export function calculatePaymentStages(totalCents: number) {
  const safeTotal = Math.max(0, finiteInteger(totalCents));
  const signingCents = Math.round(safeTotal * 0.30);
  const arrivalCents = Math.round(safeTotal * 0.20);
  const deliveryCents = safeTotal - signingCents - arrivalCents;
  return [
    { percentage: 30, trigger: 'On signing the contract', amountCents: signingCents },
    { percentage: 20, trigger: 'When the camper arrives in Australia', amountCents: arrivalCents },
    { percentage: 50, trigger: 'On taking delivery', amountCents: deliveryCents },
  ];
}

export function parseMoneyToCents(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  const normalised = text(value, 80).replace(/[$,\s]/g, '');
  if (!normalised || !/^-?\d+(\.\d{1,2})?$/.test(normalised)) return 0;
  return Math.round(Number(normalised) * 100);
}

export function formatAud(cents: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function cleanStringArray(value: unknown, maxItems = 100) {
  if (!Array.isArray(value)) return [];
  return value.map(item => text(item, 500)).filter(Boolean).slice(0, maxItems);
}

function cleanSections(value: unknown): ContractSpecificationSection[] {
  if (!Array.isArray(value)) return [];
  return value.map(section => {
    const record = section && typeof section === 'object' ? section as Record<string, unknown> : {};
    return { heading: text(record.heading, 120), items: cleanStringArray(record.items) };
  }).filter(section => section.heading && section.items.length).slice(0, 20);
}

function cleanLineItems(value: unknown): ContractLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const kind = ['base', 'extra', 'custom', 'discount'].includes(String(record.kind))
      ? String(record.kind) as ContractLineItem['kind']
      : 'custom';
    return {
      id: text(record.id, 120) || `item_${index + 1}`,
      description: text(record.description, 300),
      quantity: Math.max(1, finiteInteger(record.quantity) || 1),
      unitPriceCents: Math.abs(finiteInteger(record.unitPriceCents)),
      kind,
      reason: text(record.reason, 300),
    };
  }).filter(item => item.description).slice(0, 100);
}

export function normaliseContractInput(input: Record<string, unknown>, existing?: ContractRecord | null): ContractRecord {
  const now = new Date();
  const buyer = input.buyer && typeof input.buyer === 'object' ? input.buyer as Record<string, unknown> : {};
  const product = input.product && typeof input.product === 'object' ? input.product as Record<string, unknown> : {};
  const configurationReference = input.configurationReference && typeof input.configurationReference === 'object'
    ? input.configurationReference as Record<string, unknown>
    : {};
  const approval = existing?.ownerApproval ?? { approvedAt: '', approvedBy: '' };
  const status = ['draft', 'ready_for_review', 'approved', 'sent', 'signed', 'cancelled', 'superseded'].includes(String(input.status))
    ? String(input.status) as ContractStatus
    : existing?.status || 'draft';

  return {
    id: existing?.id || text(input.id, 200) || newContractId(now),
    contractNumber: existing?.contractNumber || text(input.contractNumber, 80) || newContractNumber(now),
    version: existing?.version || 1,
    parentContractId: existing?.parentContractId || text(input.parentContractId, 240),
    supersededByContractId: existing?.supersededByContractId || text(input.supersededByContractId, 240),
    revisionReason: existing?.revisionReason || text(input.revisionReason, 1000),
    sourceAiActionId: existing?.sourceAiActionId || text(input.sourceAiActionId, 240),
    proposedChanges: Array.isArray(input.proposedChanges)
      ? input.proposedChanges.slice(0, 30).map(item => {
        const change = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          action: text(change.action, 40),
          item: text(change.item, 300),
          previousValue: text(change.previousValue, 1000),
          requestedValue: text(change.requestedValue, 1000),
          sourceExcerpt: text(change.sourceExcerpt, 1000),
        };
      })
      : existing?.proposedChanges || [],
    templateVersion: existing?.templateVersion || CONTRACT_TEMPLATE_VERSION,
    termsVersion: existing?.termsVersion || text(input.termsVersion, 120) || CONTRACT_TERMS_VERSION,
    status,
    customerId: text(input.customerId, 240),
    leadId: text(input.leadId, 240),
    buyer: {
      name: text(buyer.name, 180),
      organisation: text(buyer.organisation, 180),
      address: text(buyer.address, 500),
      phone: text(buyer.phone, 80),
      email: text(buyer.email, 240).toLowerCase(),
    },
    product: {
      slug: text(product.slug, 240),
      name: text(product.name, 240),
      category: text(product.category, 100),
      buildIdentifier: text(product.buildIdentifier, 180),
      dimensions: text(product.dimensions, 300),
      weights: text(product.weights, 500),
    },
    configurationReference: existing?.configurationReference ?? {
      configurationId: text(configurationReference.configurationId, 240),
      configurationNumber: text(configurationReference.configurationNumber, 120),
      revision: Math.max(0, finiteInteger(configurationReference.revision)),
      snapshotDigest: text(configurationReference.snapshotDigest, 128),
    },
    lineItems: cleanLineItems(input.lineItems),
    specificationSections: cleanSections(input.specificationSections),
    exclusions: cleanStringArray(input.exclusions),
    deliveryNotes: text(input.deliveryNotes, 3000),
    validityDate: text(input.validityDate, 40),
    ownerApproval: status === 'approved' && !approval.approvedAt
      ? { approvedAt: now.toISOString(), approvedBy: 'owner' }
      : status === 'draft' || status === 'ready_for_review'
        ? { approvedAt: '', approvedBy: '' }
        : approval,
    acceptance: cleanAcceptance(input.acceptance, existing?.acceptance),
    signature: existing?.signature ?? {
      provider: '',
      documentId: '',
      status: '',
      testMode: true,
      editUrl: '',
      completedPdfUrl: '',
      createdAt: '',
      sentAt: '',
      completedAt: '',
      lastCheckedAt: '',
    },
    documentSnapshot: existing?.documentSnapshot ?? { store: '', key: '', sha256: '', mimeType: '', createdAt: '' },
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function createContractRevision(parent: ContractRecord, version: number, reason: string, now = new Date()): ContractRecord {
  const id = newContractId(now);
  return {
    ...JSON.parse(JSON.stringify(parent)) as ContractRecord,
    id,
    version,
    parentContractId: parent.id,
    supersededByContractId: '',
    revisionReason: text(reason, 1000),
    status: 'draft',
    ownerApproval: { approvedAt: '', approvedBy: '' },
    acceptance: emptyAgreementAcceptance(),
    signature: { provider: '', documentId: '', status: '', testMode: true, editUrl: '', completedPdfUrl: '', createdAt: '', sentAt: '', completedAt: '', lastCheckedAt: '' },
    documentSnapshot: { store: '', key: '', sha256: '', mimeType: '', createdAt: '' },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function diffContractVersions(previous: ContractRecord, revised: ContractRecord) {
  const changes: Array<{ field: string; previousValue: string; revisedValue: string }> = [];
  const compare = (field: string, before: unknown, after: unknown) => {
    const previousValue = typeof before === 'string' ? before : JSON.stringify(before ?? '');
    const revisedValue = typeof after === 'string' ? after : JSON.stringify(after ?? '');
    if (previousValue !== revisedValue) changes.push({ field, previousValue, revisedValue });
  };
  compare('Buyer', previous.buyer, revised.buyer);
  compare('Product', previous.product, revised.product);
  compare('Pricing', previous.lineItems, revised.lineItems);
  compare('Specifications', previous.specificationSections, revised.specificationSections);
  compare('Exclusions', previous.exclusions, revised.exclusions);
  compare('Delivery notes', previous.deliveryNotes, revised.deliveryNotes);
  return {
    changes,
    previousTotalCents: calculateContractTotal(previous.lineItems),
    revisedTotalCents: calculateContractTotal(revised.lineItems),
    priceDeltaCents: calculateContractTotal(revised.lineItems) - calculateContractTotal(previous.lineItems),
  };
}

export function validateContract(contract: ContractRecord) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!contract.buyer.name) errors.push('Add the buyer’s legal name.');
  if (!contract.buyer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contract.buyer.email)) errors.push('Add a valid buyer email address.');
  if (!contract.product.name) errors.push('Select or enter a product.');
  if (!contract.lineItems.length) errors.push('Add at least one price line item.');
  if (contract.lineItems.some(item => item.kind === 'discount' && !item.reason)) errors.push('Add a reason for every discount.');
  const totalCents = calculateContractTotal(contract.lineItems);
  if (totalCents <= 0) errors.push('The total contract value must be greater than zero.');
  if (!contract.specificationSections.length) errors.push('Add at least one specification or inclusion section.');
  if (!contract.deliveryNotes) warnings.push('Delivery or handover notes have not been added.');
  if (!contract.buyer.address) warnings.push('Buyer address has not been added.');
  if (/legal-review-draft/i.test(contract.termsVersion)) warnings.push('The incorporated Terms version is still marked as requiring legal review. Do not send it to a customer until approved.');
  return { valid: errors.length === 0, errors, warnings, totalCents, paymentStages: calculatePaymentStages(totalCents) };
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderContractHtml(contract: ContractRecord) {
  const validation = validateContract(contract);
  const rows = contract.lineItems.map(item => `
    <tr><td>${escapeHtml(item.description)}${item.reason ? `<br><small>Reason: ${escapeHtml(item.reason)}</small>` : ''}</td><td>${item.quantity}</td><td>${formatAud(item.unitPriceCents)}</td><td>${formatAud(calculateLineItemTotal(item))}</td></tr>`).join('');
  const specs = contract.specificationSections.map(section => `
    <section><h2>${escapeHtml(section.heading)}</h2><ul>${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`).join('');
  const stages = validation.paymentStages.map(stage => `<tr><td>${stage.percentage}%</td><td>${escapeHtml(stage.trigger)}</td><td>${formatAud(stage.amountCents)}</td></tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(contract.contractNumber)} Sale Agreement</title>
<style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;margin:0;font-size:11pt;line-height:1.4}header{border-bottom:3px solid #e8540a;padding-bottom:10px;margin-bottom:18px}.brand{font-size:22pt;font-weight:800}.tagline{color:#e8540a;font-weight:700}.seller{font-size:9pt;color:#444;margin-top:8px}.meta,.parties{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:15px 0}.card{border:1px solid #bbb;border-radius:6px;padding:10px}h1{font-size:18pt;text-align:center;margin:18px 0}h2{font-size:12pt;text-transform:uppercase;border-bottom:1px solid #bbb;padding-bottom:4px;margin:18px 0 7px}p{margin:4px 0}ul{margin:6px 0 0 20px;padding:0}li{margin:3px 0}table{border-collapse:collapse;width:100%;margin:8px 0 14px}th,td{border:1px solid #aaa;padding:7px;text-align:left;vertical-align:top}th{background:#f0f0f0}.money{text-align:right}.total{font-weight:800;font-size:12pt}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:36px}.line{border-top:1px solid #222;padding-top:5px;margin-top:42px}.notice{border-left:4px solid #e8540a;padding:9px 12px;background:#fff7ed}.page-break{break-before:page}@media print{section,table,.card{break-inside:avoid}}
</style></head><body>
<header><div class="brand">BEYOND RV CAMPERS</div><div class="tagline">Quality you can trust!</div><div class="seller">${escapeHtml(APPROVED_SELLER.legalName)} trading as ${escapeHtml(APPROVED_SELLER.tradingName)} · ABN ${escapeHtml(APPROVED_SELLER.abn)}<br>${escapeHtml(APPROVED_SELLER.address)} · ${escapeHtml(APPROVED_SELLER.phone)} · ${escapeHtml(APPROVED_SELLER.email)} · ${escapeHtml(APPROVED_SELLER.website)}</div></header>
<h1>Sale Agreement</h1>
<div class="meta"><div><strong>Contract:</strong> ${escapeHtml(contract.contractNumber)}<br><strong>Version:</strong> ${contract.version}<br><strong>Date:</strong> ${escapeHtml(contract.createdAt.slice(0,10))}</div><div><strong>Template:</strong> ${escapeHtml(contract.templateVersion)}<br><strong>Terms:</strong> ${escapeHtml(contract.termsVersion)}<br><strong>Status:</strong> ${escapeHtml(contract.status.replace(/_/g,' '))}${contract.validityDate ? `<br><strong>Valid until:</strong> ${escapeHtml(contract.validityDate)}` : ''}</div></div>
<div class="parties"><div class="card"><strong>BUYER</strong><p>${escapeHtml(contract.buyer.name)}</p>${contract.buyer.organisation ? `<p>${escapeHtml(contract.buyer.organisation)}</p>` : ''}<p>${escapeHtml(contract.buyer.address)}</p><p>${escapeHtml(contract.buyer.phone)}</p><p>${escapeHtml(contract.buyer.email)}</p></div><div class="card"><strong>SELLER</strong><p>${escapeHtml(APPROVED_SELLER.legalName)}</p><p>${escapeHtml(APPROVED_SELLER.address)}</p><p>${escapeHtml(APPROVED_SELLER.phone)}</p><p>${escapeHtml(APPROVED_SELLER.email)}</p><p>ABN ${escapeHtml(APPROVED_SELLER.abn)}</p></div></div>
<h2>Product</h2><p><strong>${escapeHtml(contract.product.name)}</strong>${contract.product.buildIdentifier ? ` · ${escapeHtml(contract.product.buildIdentifier)}` : ''}</p>${contract.configurationReference?.configurationNumber ? `<p><strong>Approved configuration:</strong> ${escapeHtml(contract.configurationReference.configurationNumber)} · Revision ${contract.configurationReference.revision}</p>` : ''}${contract.product.dimensions ? `<p><strong>Dimensions:</strong> ${escapeHtml(contract.product.dimensions)}</p>` : ''}${contract.product.weights ? `<p><strong>Weights:</strong> ${escapeHtml(contract.product.weights)}</p>` : ''}
<h2>Price</h2><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="3">Total contract value (AUD)</td><td>${formatAud(validation.totalCents)}</td></tr></tbody></table>
${specs}
${contract.exclusions.length ? `<section><h2>Exclusions</h2><ul>${contract.exclusions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
<section><h2>Payment Information</h2><table><thead><tr><th>Stage</th><th>Due</th><th>Amount</th></tr></thead><tbody>${stages}</tbody></table></section>
${contract.deliveryNotes ? `<section><h2>Delivery & Handover</h2><p>${escapeHtml(contract.deliveryNotes).replace(/\n/g,'<br>')}</p></section>` : ''}
<section><h2>Terms and Conditions</h2><p>The Beyond RV Campers Terms and Conditions of Sale identified above form part of this Agreement and must be supplied with it. They cover payment, specifications, changes and addendums, delivery, handover, title and risk, cancellation, applicable lay-by protections, consumer guarantees, warranty claims, safe use, privacy and disputes.</p><p><strong>Australian Consumer Law:</strong> Nothing in this Agreement excludes, restricts or modifies a consumer guarantee, right or remedy that cannot lawfully be excluded, restricted or modified.</p></section>
<section class="notice"><strong>Acceptance</strong><p>By signing this Agreement or, where permitted by law, by paying the Deposit after receiving the complete Agreement, the Buyer confirms that they have read and agree to be bound by the Agreement, including its terms, conditions and schedules.</p><p>Payment does not replace a signature where a signature is required by law. Nothing in this clause excludes or limits the Buyer’s rights under the Australian Consumer Law.</p><p>The Buyer may print and sign this Agreement, then return a clear scan or photograph by email. The Seller will retain the returned copy, email or payment record as acceptance evidence.</p></section>
<div class="signatures"><div><div class="line">Buyer signature</div><p>Name: ${escapeHtml(contract.buyer.name)}</p><p>Date:</p></div><div><div class="line">Seller signature</div><p>Name:</p><p>Date:</p></div></div>
</body></html>`;
}
