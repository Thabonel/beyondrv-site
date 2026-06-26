export type UnifiedLifecycleSourceType =
  | 'stripe_order'
  | 'enquiry'
  | 'availability_request'
  | 'quote_request';

export type UnifiedLifecycleRecordType =
  | 'paid_shop_order'
  | 'unpaid_enquiry'
  | 'availability_request'
  | 'quote_request'
  | 'container_follow_up'
  | 'customer_order'
  | 'archived';

export interface UnifiedLifecycleOrderSource {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  productSlug?: string;
  productTitle?: string;
  productCategory?: string;
  orderType?: string;
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  shippingMethod?: string;
  sourceEnquiryId?: string;
  amountPaidCents?: number;
  currency?: string;
  depositPaid?: boolean;
  orderSource?: string;
  notes?: string;
  shippingNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedLifecycleEnquirySource {
  id: string;
  submittedAt?: string;
  received_at?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  product_interest?: string;
  enquiry_intent?: string;
  fitment_context?: string;
  callback_date?: string;
  leadStatus?: {
    status?: string;
    notes?: string;
    nextFollowUpDate?: string;
    updatedAt?: string;
    archivedAt?: string;
    priority?: string;
  } | null;
}

export interface UnifiedLifecycleRecord {
  id: string;
  sourceRecordId: string;
  sourceType: UnifiedLifecycleSourceType;
  sourceLabel: string;
  recordType: UnifiedLifecycleRecordType;
  recordLabel: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productTitle: string;
  productSlug: string;
  paymentStatus: string;
  enquiryStatus: string;
  fulfilmentStatus: string;
  fulfilmentLabel: string;
  containerFollowUp: boolean;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
  sourceStore: 'customer-orders' | 'customer-enquiries';
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeDate(value: unknown) {
  if (typeof value !== 'string') return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function pickDate(...values: unknown[]) {
  for (const value of values) {
    const result = safeDate(value);
    if (result) return result;
  }
  return '';
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lower(value: unknown) {
  return clean(value, 120).toLowerCase();
}

function hasContainerSignal(value: string) {
  return /container|china|factory|awaiting shipping|ready for handover|in transit/i.test(value);
}

function inferEnquirySourceType(enquiry: UnifiedLifecycleEnquirySource): UnifiedLifecycleSourceType {
  const intent = lower(enquiry.enquiry_intent);
  const fitment = lower(enquiry.fitment_context);
  const leadStatus = lower(enquiry.leadStatus?.status);
  const message = lower(enquiry.message);
  const productInterest = lower(enquiry.product_interest);

  if (fitment === 'vehicle-fitment' || intent === 'vehicle-suitability' || /fitment|vehicle/.test(message)) {
    return 'availability_request';
  }

  if (
    leadStatus === 'quoted' ||
    intent === 'quote' ||
    intent === 'buy' ||
    intent === 'register' ||
    /quote|price|deposit|purchase/.test(message) ||
    /quote|price|deposit|purchase/.test(productInterest)
  ) {
    return 'quote_request';
  }

  return 'enquiry';
}

function inferOrderRecordType(order: UnifiedLifecycleOrderSource): UnifiedLifecycleRecordType {
  if (lower(order.status) === 'cancelled') return 'archived';
  if (lower(order.status) === 'enquiry') return 'customer_order';
  if (order.sourceEnquiryId && !order.orderSource && !order.paymentStatus && !order.depositPaid) return 'quote_request';
  if (order.depositPaid || lower(order.paymentStatus) === 'paid' || lower(order.paymentStatus) === 'succeeded' || order.orderSource === 'stripe_checkout') {
    return 'paid_shop_order';
  }
  return order.sourceEnquiryId ? 'quote_request' : 'customer_order';
}

function inferEnquiryRecordType(sourceType: UnifiedLifecycleSourceType): UnifiedLifecycleRecordType {
  if (sourceType === 'availability_request') return 'availability_request';
  if (sourceType === 'quote_request') return 'quote_request';
  return 'unpaid_enquiry';
}

function fulfilmentLabelForOrder(order: UnifiedLifecycleOrderSource) {
  return clean(order.shippingStatus || order.status || 'new', 80) || 'new';
}

function fulfilmentLabelForEnquiry(enquiry: UnifiedLifecycleEnquirySource) {
  return clean(enquiry.leadStatus?.status || 'new', 80) || 'new';
}

function containerSignalFromOrder(order: UnifiedLifecycleOrderSource) {
  const status = lower(order.status);
  if (['ordered_from_factory', 'in_china_production', 'awaiting_shipping'].includes(status)) return true;
  return hasContainerSignal([order.notes, order.shippingNotes].filter(Boolean).join(' '));
}

function containerSignalFromEnquiry(enquiry: UnifiedLifecycleEnquirySource) {
  return hasContainerSignal([enquiry.message, enquiry.leadStatus?.notes, enquiry.leadStatus?.status].filter(Boolean).join(' '));
}

export function normalizeUnifiedOrder(order: UnifiedLifecycleOrderSource): UnifiedLifecycleRecord {
  const createdAt = pickDate(order.createdAt, order.updatedAt);
  const updatedAt = pickDate(order.updatedAt, order.createdAt) || createdAt;
  const paymentStatus = clean(order.paymentStatus || (order.depositPaid ? 'paid' : ''), 40);
  const fulfilmentStatus = fulfilmentLabelForOrder(order);
  const recordType = inferOrderRecordType(order);
  const containerFollowUp = containerSignalFromOrder(order);

  return {
    id: `lifecycle-order:${order.id}`,
    sourceRecordId: order.id,
    sourceType: 'stripe_order',
    sourceLabel: 'Stripe order',
    recordType,
    recordLabel: formatLabel(recordType),
    customerName: clean(order.customerName, 180),
    customerEmail: clean(order.customerEmail, 240),
    customerPhone: clean(order.customerPhone, 80),
    productTitle: clean(order.productTitle || '', 240),
    productSlug: clean(order.productSlug || '', 240),
    paymentStatus,
    enquiryStatus: '',
    fulfilmentStatus,
    fulfilmentLabel: formatLabel(fulfilmentStatus),
    containerFollowUp,
    internalNotes: clean([order.notes, order.shippingNotes].filter(Boolean).join('\n\n'), 4000),
    createdAt: createdAt || updatedAt,
    updatedAt: updatedAt || createdAt,
    sourceStore: 'customer-orders',
  };
}

export function normalizeUnifiedEnquiry(enquiry: UnifiedLifecycleEnquirySource): UnifiedLifecycleRecord {
  const sourceType = inferEnquirySourceType(enquiry);
  const createdAt = pickDate(enquiry.submittedAt, enquiry.received_at, enquiry.leadStatus?.updatedAt);
  const updatedAt = pickDate(enquiry.leadStatus?.updatedAt, enquiry.submittedAt, enquiry.received_at) || createdAt;
  const enquiryStatus = clean(enquiry.leadStatus?.status || 'new', 80) || 'new';
  const recordType = inferEnquiryRecordType(sourceType);
  const containerFollowUp = containerSignalFromEnquiry(enquiry);
  const fulfilmentStatus = fulfilmentLabelForEnquiry(enquiry);

  return {
    id: `lifecycle-enquiry:${enquiry.id}`,
    sourceRecordId: enquiry.id,
    sourceType,
    sourceLabel: formatLabel(sourceType),
    recordType,
    recordLabel: formatLabel(recordType),
    customerName: clean(enquiry.name, 180),
    customerEmail: clean(enquiry.email, 240),
    customerPhone: clean(enquiry.phone, 80),
    productTitle: clean(enquiry.product_interest || '', 240),
    productSlug: '',
    paymentStatus: '',
    enquiryStatus,
    fulfilmentStatus,
    fulfilmentLabel: formatLabel(fulfilmentStatus),
    containerFollowUp,
    internalNotes: clean([enquiry.message, enquiry.leadStatus?.notes].filter(Boolean).join('\n\n'), 4000),
    createdAt: createdAt || updatedAt,
    updatedAt: updatedAt || createdAt,
    sourceStore: 'customer-enquiries',
  };
}

export function buildUnifiedLifecycleRecords(input: {
  orders?: UnifiedLifecycleOrderSource[];
  enquiries?: UnifiedLifecycleEnquirySource[];
}) {
  const records = [
    ...(input.orders ?? []).filter((order): order is UnifiedLifecycleOrderSource => Boolean(order?.id)).map(normalizeUnifiedOrder),
    ...(input.enquiries ?? []).filter((enquiry): enquiry is UnifiedLifecycleEnquirySource => Boolean(enquiry?.id)).map(normalizeUnifiedEnquiry),
  ];

  return records.sort((a, b) => {
    const dateDiff = new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id);
  });
}
