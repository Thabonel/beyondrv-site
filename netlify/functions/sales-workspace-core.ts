import { buildLeadIntelligence, type OwnerCopilotEnquiry, type OwnerCopilotLeadStatus } from './owner-copilot-core.ts';

export interface WorkspaceEnquiry extends OwnerCopilotEnquiry {
  leadStatus?: OwnerCopilotLeadStatus | null;
}

export interface WorkspaceAgreement {
  id: string;
  contractNumber?: string;
  sourceEnquiryId?: string;
  opportunityId?: string;
  customerId?: string;
  leadId?: string;
  status?: string;
  buyer?: { name?: string; email?: string; phone?: string };
  product?: { name?: string; slug?: string };
  lineItems?: Array<{ quantity?: number; unitPriceCents?: number; kind?: string }>;
  acceptance?: { status?: string; sentAt?: string; acceptedAt?: string; depositAmountCents?: number };
  updatedAt?: string;
  createdAt?: string;
}

export interface WorkspaceOrder {
  id: string;
  sourceEnquiryId?: string;
  contractId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  productTitle?: string;
  productSlug?: string;
  status?: string;
  paymentStatus?: string;
  depositPaid?: boolean;
  amountPaidCents?: number;
  nextActionDate?: string;
  expectedArrivalDate?: string;
  expectedHandoverDate?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface WorkspaceProduct {
  slug: string;
  title: string;
  category?: string;
  price?: string | number;
}

export interface SalesWorkspaceCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  productInterest: string;
  sourceEnquiryId: string;
  agreementIds: string[];
  buildIds: string[];
  lastActivityAt: string;
  stage: 'enquiry' | 'agreement' | 'build';
}

export interface SalesWorkspaceAgreement {
  id: string;
  contractNumber: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  status: string;
  acceptanceStatus: string;
  totalCents: number;
  updatedAt: string;
  sourceEnquiryId: string;
}

export interface SalesWorkspaceBuild {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  status: string;
  depositVerified: boolean;
  amountPaidCents: number;
  nextActionDate: string;
  expectedArrivalDate: string;
  expectedHandoverDate: string;
  updatedAt: string;
}

export interface SalesWorkspaceAction {
  id: string;
  type: 'enquiry' | 'agreement' | 'build';
  recordId: string;
  title: string;
  customerName: string;
  phone: string;
  productName: string;
  reason: string;
  dueDate: string;
  daysStale: number;
  estimatedValueCents: number;
  priorityGroup: number;
  agreementId: string;
  canCreateAgreement: boolean;
}

export interface SalesWorkspaceProjection {
  generatedAt: string;
  summary: {
    peopleWaiting: number;
    pipelineValueCents: number;
    agreementsToFinish: number;
    activeBuilds: number;
  };
  actions: SalesWorkspaceAction[];
  customers: SalesWorkspaceCustomer[];
  agreements: SalesWorkspaceAgreement[];
  builds: SalesWorkspaceBuild[];
  products: WorkspaceProduct[];
  leads: Array<{ id: string; customerId?: string; productInterest?: string }>;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function timestamp(value: unknown) {
  const candidate = text(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : '';
}

function normaliseEmail(value: unknown) {
  return text(value).toLowerCase();
}

function normalisePhone(value: unknown) {
  const digits = text(value).replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function customerKey(input: { email?: string; phone?: string; id?: string }) {
  const email = normaliseEmail(input.email);
  if (email) return `email:${email}`;
  const phone = normalisePhone(input.phone);
  if (phone) return `phone:${phone}`;
  return `record:${text(input.id)}`;
}

function agreementTotalCents(agreement: WorkspaceAgreement) {
  return (agreement.lineItems ?? []).reduce((total, item) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
    const amount = quantity * Math.abs(Math.round(Number(item.unitPriceCents) || 0));
    return total + (item.kind === 'discount' ? -amount : amount);
  }, 0);
}

function parseProductPriceCents(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  const raw = text(value);
  if (!raw || /poa|contact|tba/i.test(raw)) return 0;
  const match = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1]) * 100) : 0;
}

function normaliseWords(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchProduct(enquiry: WorkspaceEnquiry, products: WorkspaceProduct[]) {
  const interest = normaliseWords(enquiry.product_interest);
  const message = normaliseWords(enquiry.message);
  return products.find(product => {
    const title = normaliseWords(product.title);
    const slug = normaliseWords(product.slug);
    return Boolean(
      interest && (title.includes(interest) || interest.includes(title) || slug.includes(interest) || interest.includes(slug)) ||
      message && (message.includes(title) || message.includes(slug))
    );
  });
}

function daysBetween(now: Date, value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 86_400_000));
}

function sortNewest(left: { updatedAt?: string; createdAt?: string }, right: { updatedAt?: string; createdAt?: string }) {
  return text(right.updatedAt || right.createdAt).localeCompare(text(left.updatedAt || left.createdAt));
}

function agreementAction(agreement: SalesWorkspaceAgreement): { title: string; reason: string; priorityGroup: number } | null {
  if (['cancelled', 'superseded', 'signed'].includes(agreement.status) || agreement.acceptanceStatus === 'accepted') return null;
  if (agreement.acceptanceStatus === 'sent') return { title: 'Follow up agreement', reason: 'Agreement sent; customer acceptance is still outstanding.', priorityGroup: 4 };
  if (agreement.acceptanceStatus === 'prepared') return { title: 'Send prepared agreement', reason: 'The final copy is ready to send to the customer.', priorityGroup: 5 };
  if (agreement.status === 'approved') return { title: 'Prepare final agreement', reason: 'Commercial details are approved and ready for the final copy.', priorityGroup: 5 };
  return { title: 'Finish agreement', reason: 'Complete and confirm the negotiated details.', priorityGroup: 4 };
}

export function buildSalesWorkspaceProjection(input: {
  enquiries: WorkspaceEnquiry[];
  agreements: WorkspaceAgreement[];
  orders: WorkspaceOrder[];
  products: WorkspaceProduct[];
  now?: Date;
}): SalesWorkspaceProjection {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const enquiries = [...input.enquiries].sort((a, b) => text(b.received_at || b.submittedAt).localeCompare(text(a.received_at || a.submittedAt)));
  const agreements = [...input.agreements].sort(sortNewest).map<SalesWorkspaceAgreement>(agreement => ({
    id: agreement.id,
    contractNumber: text(agreement.contractNumber) || agreement.id,
    customerName: text(agreement.buyer?.name) || text(agreement.buyer?.email) || 'Customer details needed',
    customerPhone: text(agreement.buyer?.phone),
    productName: text(agreement.product?.name) || 'Product not selected',
    status: text(agreement.status) || 'draft',
    acceptanceStatus: text(agreement.acceptance?.status) || 'not_prepared',
    totalCents: agreementTotalCents(agreement),
    updatedAt: timestamp(agreement.updatedAt || agreement.createdAt),
    sourceEnquiryId: text(agreement.sourceEnquiryId),
  }));
  const builds = [...input.orders]
    .filter(order => !['delivered', 'cancelled'].includes(text(order.status)))
    .sort(sortNewest)
    .map<SalesWorkspaceBuild>(order => ({
      id: order.id,
      customerName: text(order.customerName) || text(order.customerEmail) || 'Customer details needed',
      customerPhone: text(order.customerPhone),
      productName: text(order.productTitle) || 'Product not selected',
      status: text(order.status) || 'enquiry',
      depositVerified: Boolean(order.depositPaid || order.paymentStatus === 'paid' || order.paymentStatus === 'succeeded'),
      amountPaidCents: Math.max(0, Math.round(Number(order.amountPaidCents) || 0)),
      nextActionDate: text(order.nextActionDate),
      expectedArrivalDate: text(order.expectedArrivalDate),
      expectedHandoverDate: text(order.expectedHandoverDate),
      updatedAt: timestamp(order.updatedAt || order.createdAt),
    }));

  const customerMap = new Map<string, SalesWorkspaceCustomer>();
  function upsertCustomer(candidate: Omit<SalesWorkspaceCustomer, 'agreementIds' | 'buildIds'> & { agreementId?: string; buildId?: string }) {
    const key = customerKey({ email: candidate.email, phone: candidate.phone, id: candidate.id });
    const current = customerMap.get(key);
    const next: SalesWorkspaceCustomer = current ?? {
      id: candidate.id,
      name: '',
      email: '',
      phone: '',
      productInterest: '',
      sourceEnquiryId: '',
      agreementIds: [],
      buildIds: [],
      lastActivityAt: '',
      stage: 'enquiry',
    };
    next.name ||= candidate.name;
    next.email ||= candidate.email;
    next.phone ||= candidate.phone;
    next.productInterest ||= candidate.productInterest;
    next.sourceEnquiryId ||= candidate.sourceEnquiryId;
    if (candidate.agreementId && !next.agreementIds.includes(candidate.agreementId)) next.agreementIds.push(candidate.agreementId);
    if (candidate.buildId && !next.buildIds.includes(candidate.buildId)) next.buildIds.push(candidate.buildId);
    if (candidate.lastActivityAt > next.lastActivityAt) next.lastActivityAt = candidate.lastActivityAt;
    if (candidate.stage === 'build' || (candidate.stage === 'agreement' && next.stage === 'enquiry')) next.stage = candidate.stage;
    customerMap.set(key, next);
  }

  for (const enquiry of enquiries) {
    upsertCustomer({
      id: `enquiry:${enquiry.id}`,
      name: text(enquiry.name) || text(enquiry.email) || 'Unnamed enquiry',
      email: text(enquiry.email),
      phone: text(enquiry.phone),
      productInterest: text(enquiry.product_interest),
      sourceEnquiryId: enquiry.id,
      lastActivityAt: timestamp(enquiry.leadStatus?.updatedAt || enquiry.received_at || enquiry.submittedAt),
      stage: 'enquiry',
    });
  }
  for (const agreement of input.agreements) {
    upsertCustomer({
      id: text(agreement.customerId) || `agreement:${agreement.id}`,
      name: text(agreement.buyer?.name) || text(agreement.buyer?.email) || 'Customer details needed',
      email: text(agreement.buyer?.email),
      phone: text(agreement.buyer?.phone),
      productInterest: text(agreement.product?.name),
      sourceEnquiryId: text(agreement.sourceEnquiryId),
      agreementId: agreement.id,
      lastActivityAt: timestamp(agreement.updatedAt || agreement.createdAt),
      stage: 'agreement',
    });
  }
  for (const order of input.orders) {
    upsertCustomer({
      id: `build:${order.id}`,
      name: text(order.customerName) || text(order.customerEmail) || 'Customer details needed',
      email: text(order.customerEmail),
      phone: text(order.customerPhone),
      productInterest: text(order.productTitle),
      sourceEnquiryId: text(order.sourceEnquiryId),
      buildId: order.id,
      lastActivityAt: timestamp(order.updatedAt || order.createdAt),
      stage: 'build',
    });
  }

  const actions: SalesWorkspaceAction[] = [];
  const activeAgreementByEnquiryId = new Map(
    agreements
      .filter(agreement => agreement.sourceEnquiryId && !['cancelled', 'superseded'].includes(agreement.status))
      .map(agreement => [agreement.sourceEnquiryId, agreement] as const),
  );
  const activeEnquiryStatuses = new Set(['new', 'contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled']);
  for (const enquiry of enquiries) {
    if (activeAgreementByEnquiryId.has(enquiry.id)) continue;
    const leadStatus = enquiry.leadStatus ?? { enquiryId: enquiry.id, status: 'new', updatedAt: enquiry.submittedAt };
    const status = text(leadStatus.status) || 'new';
    if (!activeEnquiryStatuses.has(status)) continue;
    const intelligence = buildLeadIntelligence(enquiry, leadStatus, now);
    const explicitDueDate = text(leadStatus.nextFollowUpDate || enquiry.callback_date);
    const dueDate = explicitDueDate || intelligence.followUpDueDate;
    const isDue = Boolean(dueDate && dueDate <= today);
    const needsAttention = status === 'new' || isDue || ['hot', 'warm', 'waiting_on_byondrv'].includes(intelligence.urgency);
    if (!needsAttention) continue;
    const product = matchProduct(enquiry, input.products);
    const staleFrom = timestamp(leadStatus.lastContactedAt || leadStatus.updatedAt || enquiry.received_at || enquiry.submittedAt);
    actions.push({
      id: `enquiry:${enquiry.id}`,
      type: 'enquiry',
      recordId: enquiry.id,
      title: status === 'new' ? 'Call new enquiry' : isDue ? 'Follow up customer' : 'Review sales enquiry',
      customerName: text(enquiry.name) || text(enquiry.email) || 'Unnamed enquiry',
      phone: text(enquiry.phone),
      productName: text(enquiry.product_interest) || product?.title || 'Product to confirm',
      reason: intelligence.nextAction,
      dueDate,
      daysStale: daysBetween(now, staleFrom),
      estimatedValueCents: parseProductPriceCents(product?.price),
      priorityGroup: status === 'new' || isDue ? 4 : 3,
      agreementId: '',
      canCreateAgreement: true,
    });
  }

  for (const agreement of agreements) {
    const action = agreementAction(agreement);
    if (!action) continue;
    actions.push({
      id: `agreement:${agreement.id}`,
      type: 'agreement',
      recordId: agreement.id,
      title: action.title,
      customerName: agreement.customerName,
      phone: agreement.customerPhone,
      productName: agreement.productName,
      reason: action.reason,
      dueDate: '',
      daysStale: daysBetween(now, agreement.updatedAt),
      estimatedValueCents: agreement.totalCents,
      priorityGroup: action.priorityGroup,
      agreementId: agreement.id,
      canCreateAgreement: false,
    });
  }

  for (const build of builds) {
    const depositNeedsAttention = build.status === 'enquiry' && !build.depositVerified;
    const nextActionDue = Boolean(build.nextActionDate && build.nextActionDate <= today);
    if (!depositNeedsAttention && !nextActionDue) continue;
    actions.push({
      id: `build:${build.id}`,
      type: 'build',
      recordId: build.id,
      title: depositNeedsAttention ? 'Confirm deposit and release readiness' : 'Build update due',
      customerName: build.customerName,
      phone: build.customerPhone,
      productName: build.productName,
      reason: depositNeedsAttention ? 'Production must not start until the deposit and release gates are verified.' : 'The recorded next action date has arrived.',
      dueDate: build.nextActionDate,
      daysStale: daysBetween(now, build.updatedAt),
      estimatedValueCents: build.amountPaidCents,
      priorityGroup: depositNeedsAttention ? 5 : 3,
      agreementId: '',
      canCreateAgreement: false,
    });
  }

  actions.sort((left, right) =>
    right.priorityGroup - left.priorityGroup ||
    right.estimatedValueCents - left.estimatedValueCents ||
    right.daysStale - left.daysStale ||
    left.customerName.localeCompare(right.customerName)
  );

  const linkedEnquiryIds = new Set(agreements.map(agreement => agreement.sourceEnquiryId).filter(Boolean));
  const agreementPipeline = agreements
    .filter(agreement => !['cancelled', 'superseded'].includes(agreement.status))
    .reduce((total, agreement) => total + Math.max(0, agreement.totalCents), 0);
  const unlinkedEnquiryPipeline = actions
    .filter(action => action.type === 'enquiry' && !linkedEnquiryIds.has(action.recordId))
    .reduce((total, action) => total + Math.max(0, action.estimatedValueCents), 0);

  return {
    generatedAt: now.toISOString(),
    summary: {
      peopleWaiting: actions.filter(action => action.type === 'enquiry').length,
      pipelineValueCents: agreementPipeline + unlinkedEnquiryPipeline,
      agreementsToFinish: actions.filter(action => action.type === 'agreement').length,
      activeBuilds: builds.filter(build => build.status !== 'enquiry').length,
    },
    actions,
    customers: Array.from(customerMap.values()).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    agreements,
    builds,
    products: input.products,
    leads: enquiries.map(enquiry => ({ id: enquiry.id, productInterest: text(enquiry.product_interest) })),
  };
}
