import { Component, type ReactNode, useState, useRef, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import initialRecentBuilds from '../data/homepage/recent-builds.json';
import initialTestimonials from '../data/homepage/testimonials.json';
import { adminFetch, clearAdminToken } from '../lib/adminApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

class AdminSectionBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : 'Admin section failed to load.' };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem', color: '#f87171', fontSize: '0.85rem', lineHeight: 1.45 }}>
          Could not load this admin section: {this.state.error}
        </div>
      );
    }

    return this.props.children;
  }
}

type JudgeDecision = 'allow' | 'block' | 'revise' | 'escalate';

interface PendingChange {
  path: string;
  content: string;
  description: string;
  proposal_id: string;
  judgeDecision: JudgeDecision;
  risk_flags: string[];
  escalation_reason?: string;
}

type DeployStatus = 'idle' | 'deploying' | 'done' | 'error';
type PanelTab = 'dashboard' | 'products' | 'orders' | 'media' | 'homepage' | 'enquiries' | 'customers' | 'leads' | 'drafts' | 'audit' | 'knowledge' | 'pending';
type ProductCategory = 'slide-on' | 'caravan' | 'expedition';
type ProductStatus = 'available' | 'on-sale' | 'coming-soon';
type SuitabilityDataStatus = 'draft' | 'target' | 'confirmed';
type EnquirySourceType = 'website_form' | 'manual_email' | 'phone_call' | 'facebook' | 'instagram' | 'referral' | 'walk_in' | 'other';
type EnquiryQueueFilter = 'active' | 'needs-response' | 'follow-up-due' | 'hot' | 'all';
type OrderType = 'standard_model' | 'one_off_stock' | 'demo_unit' | 'used_stock' | 'custom_build';
type OrderStatus =
  | 'enquiry'
  | 'deposit_received'
  | 'ordered_from_factory'
  | 'in_china_production'
  | 'awaiting_shipping'
  | 'in_transit'
  | 'arrived_mutdapilly'
  | 'local_fitout'
  | 'ready_for_handover'
  | 'delivered'
  | 'cancelled';
const MAX_RECENT_BUILDS = 3;
const MAX_UPLOAD_IMAGE_EDGE = 2000;
const UPLOAD_IMAGE_QUALITY = 0.82;
const MAX_GIF_UPLOAD_BYTES = 4 * 1024 * 1024;

type MediaScope = 'products' | 'pages';

const PAGE_MEDIA_TARGETS = [
  { slug: 'about', label: 'About page' },
  { slug: 'homepage', label: 'Homepage' },
  { slug: 'our-caravans', label: 'Our Caravans page' },
  { slug: 'our-slide-on-campers', label: 'Slide-Ons page' },
  { slug: 'expedition', label: 'Expedition page' },
  { slug: 'on-sale', label: 'On Sale page' },
  { slug: 'custom', label: 'Custom Builds page' },
];

interface YoutubeVideoMeta {
  id?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  uploadDate?: string;
  duration?: string;
  startSeconds?: number;
  transcriptSummary?: string;
}

interface ProductRecord {
  slug: string;
  title: string;
  price: string;
  status: 'available' | 'on-sale' | 'coming-soon' | string;
  category: ProductCategory | string;
  tagline: string;
  featured?: boolean;
  onSale?: boolean;
  heroImage?: string;
  gallery?: string[];
  galleryCount?: number;
  relatedSlugs?: string[];
  youtubeVideo?: YoutubeVideoMeta;
  suitabilityData?: SuitabilityData;
}

interface SuitabilityData {
  status: SuitabilityDataStatus;
  dryWeightKg?: string;
  estimatedLoadedWeightKg?: string;
  requiredTrayLengthMm?: string;
  requiredTrayWidthMm?: string;
  centreOfGravityMm?: string;
  atmKg?: string;
  gtmKg?: string;
  towBallWeightKg?: string;
  notes?: string;
}

interface NewProductForm {
  title: string;
  category: ProductCategory;
  price: string;
  tagline: string;
  keySpecs: string;
  description: string;
  heroImage: string;
  galleryText: string;
  youtubeVideoUrl: string;
  youtubeVideoTitle: string;
  youtubeVideoDescription: string;
  youtubeVideoThumbnail: string;
  youtubeVideoUploadDate: string;
  youtubeVideoDuration: string;
  youtubeVideoTranscriptSummary: string;
}

interface EditProductForm {
  slug: string;
  title: string;
  price: string;
  status: ProductStatus;
  tagline: string;
  featured: boolean;
  onSale: boolean;
  heroImage: string;
  galleryText: string;
  relatedSlugs: string[];
  youtubeVideoUrl: string;
  youtubeVideoTitle: string;
  youtubeVideoDescription: string;
  youtubeVideoThumbnail: string;
  youtubeVideoUploadDate: string;
  youtubeVideoDuration: string;
  youtubeVideoTranscriptSummary: string;
  suitabilityStatus: SuitabilityDataStatus;
  suitabilityDryWeightKg: string;
  suitabilityEstimatedLoadedWeightKg: string;
  suitabilityRequiredTrayLengthMm: string;
  suitabilityRequiredTrayWidthMm: string;
  suitabilityCentreOfGravityMm: string;
  suitabilityAtmKg: string;
  suitabilityGtmKg: string;
  suitabilityTowBallWeightKg: string;
  suitabilityNotes: string;
  notes: string;
}

interface MediaFile {
  key: string;
  url: string;
  optimizedUrl: string;
  metadata: {
    alt?: string;
    slug?: string;
    filename?: string;
    contentType?: string;
    uploadedAt?: string;
    scope?: MediaScope;
  };
}

interface EnquiryRecord {
  id: string;
  submittedAt: string;
  received_at?: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source_type?: EnquirySourceType;
  manual_entry?: boolean;
  createdBy?: string;
  email_subject?: string;
  email_body?: string;
  conversation_summary?: string;
  main_questions?: string;
  vehicle_details?: string;
  budget_notes?: string;
  timeline?: string;
  source_note?: string;
  product_interest?: string;
  enquiry_intent?: string;
  callback_date?: string;
  callback_time?: string;
  referral_source_self_reported?: string;
  referral_source_other?: string;
  leadStatus?: {
    enquiryId: string;
    status: 'new' | 'contacted' | 'replied' | 'called' | 'qualified' | 'quoted' | 'follow-up-scheduled' | 'won' | 'lost' | 'spam';
    priority?: 'hot' | 'warm' | 'info-only' | 'spam-low-quality';
    notes?: string;
    nextFollowUpDate?: string;
    outcomeReason?: '' | 'too-expensive' | 'wrong-vehicle' | 'no-payload' | 'bought-elsewhere' | 'just-researching' | 'no-response' | 'timing-not-right' | 'other';
    firstResponseAt?: string;
    lastContactedAt?: string;
    updatedAt?: string;
    aiClassification?: {
      suggestedPriority?: 'hot' | 'warm' | 'info-only' | 'spam-low-quality';
      intent?: string;
      urgency?: string;
      productInterest?: string;
      missingDetails?: string[];
      reason?: string;
      nextBestAction?: string;
      generatedAt?: string;
    };
  };
}

interface OrderRecord {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productSlug: string;
  productTitle: string;
  productCategory: string;
  sourceEnquiryId?: string;
  orderType: OrderType;
  status: OrderStatus;
  depositPaid: boolean;
  factoryOrderDate: string;
  expectedArrivalDate: string;
  expectedHandoverDate: string;
  nextActionDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

type OrderForm = Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: string };

interface CopilotCustomerRecord {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CopilotLeadRecord {
  id: string;
  customerId?: string;
  sourceEnquiryId?: string;
  productInterest?: string;
  status?: string;
  score?: number;
  nextFollowUpDate?: string;
  notes?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CopilotAiActionRecord {
  id: string;
  actionType?: string;
  relatedLeadId?: string;
  relatedCustomerId?: string;
  approvalState?: string;
  output?: string;
  warnings?: string[];
  missingFacts?: string[];
  outputWarnings?: string[];
  blockedPhrases?: string[];
  sources?: ProductKnowledgeSourceView[];
  createdAt?: string;
  updatedAt?: string;
}

interface CopilotAuditRecord {
  id: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  actor?: string;
  detail?: Record<string, unknown>;
  createdAt?: string;
}

interface LeadReminderItem {
  id: string;
  enquiryId: string;
  type: string;
  customerName: string;
  productInterest: string;
  submittedAt: string;
  status: string;
  priority: string;
  nextFollowUpDate: string;
  reason: string;
}

interface LeadReminderSummary {
  newUnreplied: LeadReminderItem[];
  hotLeads: LeadReminderItem[];
  followUpsDueToday: LeadReminderItem[];
  overdueFollowUps: LeadReminderItem[];
  quotedNeedsFollowUp: LeadReminderItem[];
  manualMissingFollowUp: LeadReminderItem[];
  total: number;
}

interface OwnerCopilotTask {
  id: string;
  title: string;
  relatedLeadId?: string;
  relatedCustomerId?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'open' | 'completed' | 'snoozed' | 'cancelled';
  notes?: string;
  createdAt?: string;
  completedAt?: string;
}

interface OwnerCopilotTimelineEvent {
  id: string;
  eventType: string;
  summary: string;
  relatedLeadId?: string;
  relatedTaskId?: string;
  source?: string;
  aiGenerated?: boolean;
  createdAt: string;
}

interface OwnerCopilotLeadDetail {
  tasks: OwnerCopilotTask[];
  timeline: OwnerCopilotTimelineEvent[];
}

interface ProductKnowledgeSourceView {
  id?: string;
  title: string;
  type: string;
  url?: string;
  confidence?: number;
  facts?: string[];
}

interface ProductKnowledgeLookupResult {
  query: string;
  sources: ProductKnowledgeSourceView[];
  warnings: string[];
  missingFacts: string[];
  groundingRules?: string[];
}

interface ResponseGrounding {
  warnings: string[];
  missingFacts: string[];
  outputWarnings?: string[];
  sources: ProductKnowledgeSourceView[];
}

interface ManualEnquiryForm {
  source_type: Exclude<EnquirySourceType, 'website_form'>;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  email_subject: string;
  email_body: string;
  product_interest: string;
  enquiry_intent: string;
  source_note: string;
  received_at: string;
  notes: string;
  conversation_summary: string;
  main_questions: string;
  vehicle_details: string;
  budget_notes: string;
  timeline: string;
  priority: NonNullable<NonNullable<EnquiryRecord['leadStatus']>['priority']>;
  nextFollowUpDate: string;
}

interface ContactConfig {
  toEmail: string;
  fromEmail: string;
  hasResendKey: boolean;
  ready: boolean;
  missing: string[];
}

interface RecentBuild {
  id: string;
  title: string;
  image: string;
  alt: string;
  tags: string[];
  link?: string;
  caption?: string;
  completedDate?: string;
  vehiclePlatform?: string;
  productSlug?: string;
  isVisible: boolean;
  sortOrder: number;
}

interface Testimonial {
  id: string;
  quote: string;
  customerName: string;
  customerLocation?: string;
  productName?: string;
  image?: string;
  rating?: number;
  source?: string;
  approvedDate?: string;
  isVisible: boolean;
  sortOrder: number;
}

const VERDICT_STYLE: Record<JudgeDecision, { label: string; color: string; border: string }> = {
  allow:    { label: '✓ Approved',  color: '#4ade80', border: '1px solid #1a3a1a' },
  escalate: { label: '⚠ Escalated', color: '#fb923c', border: '1px solid #3a2010' },
  block:    { label: '✕ Blocked',   color: '#f87171', border: '1px solid #3a1010' },
  revise:   { label: '↩ Revised',   color: '#a78bfa', border: '1px solid #2a1a3a' },
};

const EMPTY_PRODUCT_FORM: NewProductForm = {
  title: '',
  category: 'slide-on',
  price: '',
  tagline: '',
  keySpecs: '',
  description: '',
  heroImage: '',
  galleryText: '',
  youtubeVideoUrl: '',
  youtubeVideoTitle: '',
  youtubeVideoDescription: '',
  youtubeVideoThumbnail: '',
  youtubeVideoUploadDate: '',
  youtubeVideoDuration: '',
  youtubeVideoTranscriptSummary: '',
};

const EMPTY_RECENT_BUILD: RecentBuild = {
  id: '',
  title: '',
  image: '',
  alt: '',
  tags: ['Finished in Mutdapilly, Queensland'],
  link: '',
  isVisible: true,
  sortOrder: 1,
};

const EMPTY_TESTIMONIAL: Testimonial = {
  id: '',
  quote: '',
  customerName: '',
  customerLocation: '',
  productName: '',
  rating: 5,
  isVisible: false,
  sortOrder: 1,
};

function localDateTimeValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function emptyManualEnquiryForm(): ManualEnquiryForm {
  return {
    source_type: 'manual_email',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    email_subject: '',
    email_body: '',
    product_interest: '',
    enquiry_intent: '',
    source_note: '',
    received_at: localDateTimeValue(),
    notes: '',
    conversation_summary: '',
    main_questions: '',
    vehicle_details: '',
    budget_notes: '',
    timeline: '',
    priority: 'warm',
    nextFollowUpDate: '',
  };
}

const SOURCE_LABELS: Record<EnquirySourceType, string> = {
  website_form: 'Website form',
  manual_email: 'Manual email',
  phone_call: 'Phone call',
  facebook: 'Facebook',
  instagram: 'Instagram',
  referral: 'Referral',
  walk_in: 'Walk-in',
  other: 'Other source',
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  enquiry: 'Enquiry',
  deposit_received: 'Deposit received',
  ordered_from_factory: 'Ordered from factory',
  in_china_production: 'In China production',
  awaiting_shipping: 'Awaiting shipping',
  in_transit: 'In transit',
  arrived_mutdapilly: 'Arrived Mutdapilly',
  local_fitout: 'Local fitout',
  ready_for_handover: 'Ready for handover',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  standard_model: 'Standard model',
  one_off_stock: 'One-off stock',
  demo_unit: 'Demo unit',
  used_stock: 'Used stock',
  custom_build: 'Custom build',
};

const ORDER_STATUS_GROUPS: OrderStatus[] = [
  'deposit_received',
  'ordered_from_factory',
  'in_china_production',
  'awaiting_shipping',
  'in_transit',
  'arrived_mutdapilly',
  'local_fitout',
  'ready_for_handover',
  'enquiry',
  'delivered',
  'cancelled',
];

function emptyOrderForm(): OrderForm {
  return {
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    productSlug: '',
    productTitle: '',
    productCategory: '',
    sourceEnquiryId: '',
    orderType: 'standard_model',
    status: 'deposit_received',
    depositPaid: false,
    factoryOrderDate: '',
    expectedArrivalDate: '',
    expectedHandoverDate: '',
    nextActionDate: '',
    notes: '',
  };
}

function orderTypeForProduct(product: ProductRecord): OrderType {
  return product.onSale || product.status === 'on-sale' ? 'one_off_stock' : 'standard_model';
}

function orderFormFromProduct(product: ProductRecord): OrderForm {
  return {
    ...emptyOrderForm(),
    productSlug: product.slug,
    productTitle: product.title,
    productCategory: String(product.category ?? ''),
    orderType: orderTypeForProduct(product),
  };
}

function orderFormFromEnquiry(enquiry: EnquiryRecord, products: ProductRecord[]): OrderForm {
  const product = products.find(item => item.title === enquiry.product_interest || item.slug === enquiry.product_interest);
  return {
    ...emptyOrderForm(),
    customerName: enquiry.name ?? '',
    customerEmail: enquiry.email ?? '',
    customerPhone: enquiry.phone ?? '',
    productSlug: product?.slug ?? '',
    productTitle: product?.title ?? enquiry.product_interest ?? '',
    productCategory: product?.category ? String(product.category) : '',
    sourceEnquiryId: enquiry.id,
    orderType: product ? orderTypeForProduct(product) : 'standard_model',
    status: enquiry.leadStatus?.status === 'won' ? 'deposit_received' : 'enquiry',
    depositPaid: enquiry.leadStatus?.status === 'won',
    nextActionDate: enquiry.leadStatus?.nextFollowUpDate ?? '',
    notes: enquiry.leadStatus?.notes ?? '',
  };
}

function orderFormFromRecord(order: OrderRecord): OrderForm {
  return {
    id: order.id,
    customerName: order.customerName ?? '',
    customerEmail: order.customerEmail ?? '',
    customerPhone: order.customerPhone ?? '',
    productSlug: order.productSlug ?? '',
    productTitle: order.productTitle ?? '',
    productCategory: order.productCategory ?? '',
    sourceEnquiryId: order.sourceEnquiryId ?? '',
    orderType: order.orderType ?? 'standard_model',
    status: order.status ?? 'enquiry',
    depositPaid: Boolean(order.depositPaid),
    factoryOrderDate: order.factoryOrderDate ?? '',
    expectedArrivalDate: order.expectedArrivalDate ?? '',
    expectedHandoverDate: order.expectedHandoverDate ?? '',
    nextActionDate: order.nextActionDate ?? '',
    notes: order.notes ?? '',
  };
}

function isOrderStatusError(status: string) {
  return /\b(add|could|invalid|missing|unavailable|failed|not found)\b/i.test(status);
}

function isAdminWarningStatus(status: string) {
  return /\b(could|failed|unsupported|unavailable|missing|invalid|not configured|netlify blobs)\b/i.test(status);
}

function reminderTodayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function reminderStatus(enquiry: EnquiryRecord) {
  return (enquiry.leadStatus?.status ?? 'new').toLowerCase();
}

function reminderPriority(enquiry: EnquiryRecord) {
  return (enquiry.leadStatus?.priority ?? 'warm').toLowerCase();
}

function isClosedLeadStatus(status: string) {
  return ['won', 'lost', 'spam'].includes(status);
}

function isRepliedOrBeyond(status: string) {
  return ['contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled', 'won', 'lost'].includes(status);
}

function daysSinceReminderDate(value?: string) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : (Date.now() - date.getTime()) / 86_400_000;
}

function reminderItem(enquiry: EnquiryRecord, type: string, reason: string): LeadReminderItem {
  return {
    id: `${enquiry.id}:${type}`,
    enquiryId: enquiry.id,
    type,
    customerName: enquiry.name || 'Unnamed lead',
    productInterest: enquiry.product_interest || 'General enquiry',
    submittedAt: enquiry.received_at || enquiry.submittedAt || '',
    status: reminderStatus(enquiry),
    priority: reminderPriority(enquiry),
    nextFollowUpDate: enquiry.leadStatus?.nextFollowUpDate || enquiry.callback_date || '',
    reason,
  };
}

function calculateAdminLeadReminders(enquiries: EnquiryRecord[]): LeadReminderSummary {
  const today = reminderTodayKey();
  const summary: LeadReminderSummary = {
    newUnreplied: [],
    hotLeads: [],
    followUpsDueToday: [],
    overdueFollowUps: [],
    quotedNeedsFollowUp: [],
    manualMissingFollowUp: [],
    total: 0,
  };

  for (const enquiry of enquiries) {
    const status = reminderStatus(enquiry);
    const priority = reminderPriority(enquiry);
    const firstResponseAt = enquiry.leadStatus?.firstResponseAt ?? '';
    const followUpDate = enquiry.leadStatus?.nextFollowUpDate || enquiry.callback_date || '';

    if (status === 'new' && !firstResponseAt) {
      summary.newUnreplied.push(reminderItem(enquiry, 'new-unreplied', 'New enquiry has not been replied to.'));
    }
    if (priority === 'hot' && !isRepliedOrBeyond(status) && !firstResponseAt) {
      summary.hotLeads.push(reminderItem(enquiry, 'hot-unreplied', 'Hot lead needs a reply.'));
    }
    if (followUpDate === today && !isClosedLeadStatus(status)) {
      summary.followUpsDueToday.push(reminderItem(enquiry, 'follow-up-due-today', 'Follow-up is due today.'));
    }
    if (followUpDate && followUpDate < today && !isClosedLeadStatus(status)) {
      summary.overdueFollowUps.push(reminderItem(enquiry, 'follow-up-overdue', 'Follow-up is overdue.'));
    }
    if (status === 'quoted' && daysSinceReminderDate(enquiry.leadStatus?.lastContactedAt || enquiry.leadStatus?.updatedAt) >= 3) {
      summary.quotedNeedsFollowUp.push(reminderItem(enquiry, 'quoted-needs-follow-up', 'Quoted lead has not been contacted recently.'));
    }
    if (['phone_call', 'manual_email'].includes(enquiry.source_type ?? 'website_form') && !followUpDate && !isClosedLeadStatus(status)) {
      summary.manualMissingFollowUp.push(reminderItem(enquiry, 'manual-missing-follow-up', 'Manual lead is missing a follow-up date.'));
    }
  }

  summary.total = [
    summary.newUnreplied,
    summary.hotLeads,
    summary.followUpsDueToday,
    summary.overdueFollowUps,
    summary.quotedNeedsFollowUp,
    summary.manualMissingFollowUp,
  ].reduce((count, section) => count + section.length, 0);
  return summary;
}

function enquiryQueueDate(enquiry: EnquiryRecord) {
  const date = new Date(enquiry.received_at ?? enquiry.submittedAt);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function isClosedEnquiry(enquiry: EnquiryRecord) {
  return isClosedLeadStatus(reminderStatus(enquiry));
}

function hasCustomerResponse(enquiry: EnquiryRecord) {
  return Boolean(enquiry.leadStatus?.firstResponseAt || enquiry.leadStatus?.lastContactedAt || isRepliedOrBeyond(reminderStatus(enquiry)));
}

function isFollowUpDue(enquiry: EnquiryRecord) {
  if (isClosedEnquiry(enquiry)) return false;
  const value = enquiry.leadStatus?.nextFollowUpDate || enquiry.callback_date || '';
  if (!value) return false;
  return value <= reminderTodayKey();
}

function responseSla(enquiry: EnquiryRecord) {
  if (isClosedEnquiry(enquiry)) return { label: 'Closed', color: '#777', border: '#444', rank: 0 };
  if (hasCustomerResponse(enquiry)) return { label: 'Responded', color: '#8f8', border: '#1a3a1a', rank: 1 };

  const ageHours = (Date.now() - enquiryQueueDate(enquiry).getTime()) / 36e5;
  if (ageHours >= 24) return { label: 'Response overdue', color: '#f87171', border: '#3a1010', rank: 5 };
  if (ageHours >= 12) return { label: 'Due today', color: '#fb923c', border: '#63301f', rank: 4 };
  return { label: 'Awaiting response', color: '#facc15', border: '#4a3a10', rank: 3 };
}

function queueRank(enquiry: EnquiryRecord) {
  const sla = responseSla(enquiry).rank;
  const followUp = isFollowUpDue(enquiry) ? 6 : 0;
  const priority = enquiry.leadStatus?.priority === 'hot' ? 2 : enquiry.leadStatus?.priority === 'warm' ? 1 : 0;
  return followUp + sla + priority;
}

function matchesQueueFilter(enquiry: EnquiryRecord, filter: EnquiryQueueFilter) {
  if (filter === 'all') return true;
  if (filter === 'active') return !isClosedEnquiry(enquiry);
  if (filter === 'needs-response') return !isClosedEnquiry(enquiry) && !hasCustomerResponse(enquiry);
  if (filter === 'follow-up-due') return isFollowUpDue(enquiry);
  if (filter === 'hot') return enquiry.leadStatus?.priority === 'hot' && !isClosedEnquiry(enquiry);
  return true;
}

function slugifyTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function adminImageUrl(src: string) {
  if (!src) return '';
  if (src.startsWith('/images/optimized/')) return src;
  if (src.startsWith('/images/products/')) return src;
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=800&fit=cover`;
}

function parseGalleryText(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function extractYouTubeVideoId(input: string) {
  const value = input.trim();
  if (!value) return '';
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] ?? '';
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId) return watchId;
      const parts = url.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex(part => ['embed', 'shorts', 'live'].includes(part));
      if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
    }
  } catch {
    return '';
  }

  return '';
}

function isValidYouTubeVideoId(id: string) {
  return /^[a-zA-Z0-9_-]{6,20}$/.test(id);
}

function youtubeWatchUrl(id?: string, startSeconds?: number) {
  return id ? `https://www.youtube.com/watch?v=${id}${startSeconds ? `&t=${startSeconds}s` : ''}` : '';
}

function youtubeThumbnailUrl(id?: string) {
  return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : '';
}

function formatGalleryText(images: string[]) {
  return images.join('\n');
}

function AdminProductThumb({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = src && !failed ? adminImageUrl(src) : '';

  return (
    <div style={{ width: '100%', height: '110px', background: '#101010', borderBottom: '1px solid #303030', position: 'relative', overflow: 'hidden' }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
      ) : (
        <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#777', fontSize: '0.72rem', padding: '0.75rem', textAlign: 'center' }}>
          No hero image for {title}
        </div>
      )}
    </div>
  );
}

function ProductImagePreview({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = src && !failed ? adminImageUrl(src) : '';

  return (
    <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#0d0d0d', border: '1px solid #333', borderRadius: '6px', overflow: 'hidden' }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
      ) : (
        <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#777', fontSize: '0.72rem', padding: '0.75rem', textAlign: 'center' }}>
          No image preview for {title}
        </div>
      )}
    </div>
  );
}

function ProductGalleryEditor({
  heroImage,
  galleryText,
  onGalleryTextChange,
  onHeroImageChange,
}: {
  heroImage?: string;
  galleryText: string;
  onGalleryTextChange: (next: string) => void;
  onHeroImageChange?: (next: string) => void;
}) {
  const [newImage, setNewImage] = useState('');
  const gallery = parseGalleryText(galleryText);

  function updateGallery(nextGallery: string[]) {
    onGalleryTextChange(formatGalleryText(nextGallery));
  }

  function moveImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= gallery.length) return;
    const nextGallery = [...gallery];
    [nextGallery[index], nextGallery[nextIndex]] = [nextGallery[nextIndex], nextGallery[index]];
    updateGallery(nextGallery);
  }

  function removeImage(index: number) {
    updateGallery(gallery.filter((_, itemIndex) => itemIndex !== index));
  }

  function addImage() {
    const trimmed = newImage.trim();
    if (!trimmed || gallery.includes(trimmed)) return;
    updateGallery([...gallery, trimmed]);
    if (!heroImage && onHeroImageChange) onHeroImageChange(trimmed);
    setNewImage('');
  }

  return (
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
        <div style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 700 }}>Gallery Photos</div>
        <div style={{ color: '#777', fontSize: '0.68rem' }}>Shown top to bottom in this order</div>
      </div>
      <div style={{ display: 'grid', gap: '0.4rem', maxHeight: '360px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.45rem', background: '#101010' }}>
        {gallery.map((image, index) => (
          <div key={`${image}-${index}`} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', gap: '0.55rem', alignItems: 'center', padding: '0.45rem', border: '1px solid #282828', borderRadius: '6px', background: '#181818' }}>
            <ProductImagePreview src={image} title={`Gallery image ${index + 1}`} />
            <div style={{ minWidth: 0, display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', minWidth: 0 }}>
                <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>Photo {index + 1}</span>
                <span title={image} style={{ color: '#aaa', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{image}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.3rem' }}>
                <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} style={{ background: '#222', color: index === 0 ? '#666' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.34rem', cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Up</button>
                <button type="button" onClick={() => moveImage(index, 1)} disabled={index === gallery.length - 1} style={{ background: '#222', color: index === gallery.length - 1 ? '#666' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.34rem', cursor: index === gallery.length - 1 ? 'not-allowed' : 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Down</button>
                <button type="button" onClick={() => onHeroImageChange?.(image)} disabled={!onHeroImageChange} style={{ background: '#222', color: !onHeroImageChange ? '#666' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.34rem', cursor: !onHeroImageChange ? 'not-allowed' : 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Set Hero</button>
                <button type="button" onClick={() => removeImage(index)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.34rem', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Remove</button>
              </div>
            </div>
          </div>
        ))}
        {gallery.length === 0 && (
          <div style={{ color: '#777', fontSize: '0.74rem', textAlign: 'center', padding: '0.8rem' }}>No gallery photos yet.</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.35rem' }}>
        <input
          value={newImage}
          onChange={e => setNewImage(e.target.value)}
          placeholder="Add image URL or path"
          style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.76rem' }}
        />
        <button type="button" onClick={addImage} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.45rem 0.65rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem' }}>
          Add
        </button>
      </div>
    </div>
  );
}

interface ProductVideoEditorProps {
  videoUrl: string;
  title: string;
  description: string;
  thumbnail: string;
  uploadDate: string;
  duration: string;
  transcriptSummary: string;
  onChange: (patch: {
    youtubeVideoUrl?: string;
    youtubeVideoTitle?: string;
    youtubeVideoDescription?: string;
    youtubeVideoThumbnail?: string;
    youtubeVideoUploadDate?: string;
    youtubeVideoDuration?: string;
    youtubeVideoTranscriptSummary?: string;
  }) => void;
}

function ProductVideoEditor({
  videoUrl,
  title,
  description,
  thumbnail,
  uploadDate,
  duration,
  transcriptSummary,
  onChange,
}: ProductVideoEditorProps) {
  const videoId = extractYouTubeVideoId(videoUrl);
  const hasVideoInput = Boolean(videoUrl.trim() || title.trim() || description.trim() || thumbnail.trim() || uploadDate.trim() || duration.trim() || transcriptSummary.trim());
  const videoIsValid = !videoUrl.trim() || isValidYouTubeVideoId(videoId);
  const previewTitle = title.trim() || 'Product walkthrough video';

  function setVideoUrl(nextUrl: string) {
    const nextId = extractYouTubeVideoId(nextUrl);
    onChange({
      youtubeVideoUrl: nextUrl,
      ...(nextId && !thumbnail.trim() ? { youtubeVideoThumbnail: youtubeThumbnailUrl(nextId) } : {}),
    });
  }

  return (
    <div style={{ display: 'grid', gap: '0.45rem', border: '1px solid #333', borderRadius: '6px', padding: '0.55rem', background: '#101010' }}>
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Product Video</div>
        <div style={{ color: '#777', fontSize: '0.68rem', marginTop: '0.15rem' }}>Paste a YouTube URL. The clean video ID will be saved to the product page.</div>
      </div>
      <input
        value={videoUrl}
        onChange={e => setVideoUrl(e.target.value)}
        placeholder="YouTube URL, Shorts URL, embed URL, or video ID"
        style={{ background: '#1a1a1a', border: videoIsValid ? '1px solid #444' : '1px solid #fb923c', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <input
          value={title}
          onChange={e => onChange({ youtubeVideoTitle: e.target.value })}
          placeholder="Video title"
          style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem' }}
        />
        <input
          value={uploadDate}
          onChange={e => onChange({ youtubeVideoUploadDate: e.target.value })}
          placeholder="Upload date, e.g. 2026-05-28"
          style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem' }}
        />
      </div>
      <input
        value={thumbnail}
        onChange={e => onChange({ youtubeVideoThumbnail: e.target.value })}
        placeholder={videoId ? youtubeThumbnailUrl(videoId) : 'Thumbnail URL'}
        style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem' }}
      />
      <input
        value={duration}
        onChange={e => onChange({ youtubeVideoDuration: e.target.value })}
        placeholder="Duration, e.g. PT5M42S"
        style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem' }}
      />
      <textarea
        value={description}
        onChange={e => onChange({ youtubeVideoDescription: e.target.value })}
        placeholder="Short video description"
        rows={2}
        style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem', lineHeight: 1.4 }}
      />
      <textarea
        value={transcriptSummary}
        onChange={e => onChange({ youtubeVideoTranscriptSummary: e.target.value })}
        placeholder="Optional transcript summary for search and AI context"
        rows={2}
        style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem', lineHeight: 1.4 }}
      />
      {videoUrl.trim() && (
        <div style={{ color: videoIsValid ? '#aaa' : '#fb923c', fontSize: '0.7rem' }}>
          {videoIsValid ? `Detected video ID: ${videoId}` : 'Could not detect a valid YouTube video ID from this value.'}
        </div>
      )}
      {videoIsValid && videoId && (
        <div style={{ aspectRatio: '16 / 9', border: '1px solid #333', borderRadius: '6px', overflow: 'hidden', background: '#050505' }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`}
            title={previewTitle}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          />
        </div>
      )}
      {hasVideoInput && !videoUrl.trim() && (
        <div style={{ color: '#fb923c', fontSize: '0.7rem' }}>Add a YouTube URL or clear all video fields.</div>
      )}
    </div>
  );
}

function redirectToLoginIfUnauthorized(res: Response) {
  if (res.status === 401) {
    clearAdminToken();
    window.location.href = '/.netlify/functions/admin-login';
    return true;
  }
  return false;
}

async function readAdminJson<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackError);
  }
}

function makePendingChange(path: string, content: string, description: string): PendingChange {
  return {
    path,
    content,
    description,
    proposal_id: `admin-ui-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    judgeDecision: 'allow',
    risk_flags: [],
  };
}

function orderedItems<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function renumber<T extends { sortOrder: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

function limitRecentBuilds(items: RecentBuild[]) {
  return renumber(orderedItems(items).slice(0, MAX_RECENT_BUILDS));
}

function mediaTargetValue(scope: MediaScope, slug: string) {
  return `${scope}::${slug}`;
}

function parseMediaTarget(value: string): { scope: MediaScope; slug: string } {
  const [scope, ...slugParts] = value.split('::');
  return {
    scope: scope === 'pages' ? 'pages' : 'products',
    slug: slugParts.join('::'),
  };
}

export default function AdminPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm the Beyond RV admin assistant. I can help with site changes, lead follow-ups, and SEO health checks." }
  ]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<PanelTab>('dashboard');
  const [knowledgeInput, setKnowledgeInput] = useState('');
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeProduct, setKnowledgeProduct] = useState('');
  const [knowledgeLookup, setKnowledgeLookup] = useState<ProductKnowledgeLookupResult | null>(null);
  const [knowledgeLookupStatus, setKnowledgeLookupStatus] = useState('');
  const [knowledgeLookupLoading, setKnowledgeLookupLoading] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [newProduct, setNewProduct] = useState<NewProductForm>(EMPTY_PRODUCT_FORM);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<EditProductForm | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersStatus, setOrdersStatus] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm | null>(null);
  const [copilotCustomers, setCopilotCustomers] = useState<CopilotCustomerRecord[]>([]);
  const [copilotLeads, setCopilotLeads] = useState<CopilotLeadRecord[]>([]);
  const [copilotRecordsLoading, setCopilotRecordsLoading] = useState(false);
  const [copilotRecordsStatus, setCopilotRecordsStatus] = useState('');
  const [copilotAiActions, setCopilotAiActions] = useState<CopilotAiActionRecord[]>([]);
  const [copilotAuditLogs, setCopilotAuditLogs] = useState<CopilotAuditRecord[]>([]);
  const [copilotOpsLoading, setCopilotOpsLoading] = useState(false);
  const [copilotOpsStatus, setCopilotOpsStatus] = useState('');
  const [previewChange, setPreviewChange] = useState<PendingChange | null>(null);
  const [mediaScope, setMediaScope] = useState<MediaScope>('products');
  const [mediaSlug, setMediaSlug] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaStatus, setMediaStatus] = useState('');
  const [mediaAlt, setMediaAlt] = useState('');
  const [newProductMediaStatus, setNewProductMediaStatus] = useState('');
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(false);
  const [enquiriesStatus, setEnquiriesStatus] = useState('');
  const [leadSaving, setLeadSaving] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [responseGrounding, setResponseGrounding] = useState<Record<string, ResponseGrounding>>({});
  const [responseActionIds, setResponseActionIds] = useState<Record<string, string>>({});
  const [responseGenerating, setResponseGenerating] = useState<string | null>(null);
  const [responseStatuses, setResponseStatuses] = useState<Record<string, string>>({});
  const [aiActionSaving, setAiActionSaving] = useState<string | null>(null);
  const [recordSyncSaving, setRecordSyncSaving] = useState<string | null>(null);
  const [classificationSaving, setClassificationSaving] = useState<string | null>(null);
  const [classificationStatuses, setClassificationStatuses] = useState<Record<string, string>>({});
  const [showManualEnquiryForm, setShowManualEnquiryForm] = useState(false);
  const [manualEnquiryMode, setManualEnquiryMode] = useState<'manual_email' | 'phone_call'>('manual_email');
  const [manualEnquiry, setManualEnquiry] = useState<ManualEnquiryForm>(() => emptyManualEnquiryForm());
  const [manualEnquirySaving, setManualEnquirySaving] = useState(false);
  const [manualEnquiryStatus, setManualEnquiryStatus] = useState('');
  const [browserRemindersEnabled, setBrowserRemindersEnabled] = useState(false);
  const [browserReminderStatus, setBrowserReminderStatus] = useState('');
  const [enquiryQueueFilter, setEnquiryQueueFilter] = useState<EnquiryQueueFilter>('active');
  const [openLeadDetailId, setOpenLeadDetailId] = useState<string | null>(null);
  const [leadDetails, setLeadDetails] = useState<Record<string, OwnerCopilotLeadDetail>>({});
  const [leadDetailStatus, setLeadDetailStatus] = useState<Record<string, string>>({});
  const [taskDrafts, setTaskDrafts] = useState<Record<string, { title: string; dueDate: string; priority: 'high' | 'medium' | 'low'; notes: string }>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [taskSaving, setTaskSaving] = useState<string | null>(null);
  const [contactConfig, setContactConfig] = useState<ContactConfig | null>(null);
  const [recentBuilds, setRecentBuilds] = useState<RecentBuild[]>(limitRecentBuilds(initialRecentBuilds as RecentBuild[]));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(renumber(orderedItems(initialTestimonials as Testimonial[])));
  const [homepageStatus, setHomepageStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [deployResults, setDeployResults] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const newProductFileRef = useRef<HTMLInputElement>(null);
  const enquiryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const notifiedReminderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const res = await adminFetch('/.netlify/functions/admin-products');
        if (redirectToLoginIfUnauthorized(res)) return;
        if (!res.ok) throw new Error('Could not load products');
        const data = await res.json() as { products: ProductRecord[] };
        if (!cancelled) setProducts(data.products ?? []);
      } catch {
        if (!cancelled) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'I could not load the product manager list. The chat can still make changes if you type the product name.' }]);
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    loadProducts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!productsLoading && !mediaSlug && products[0]) {
      setMediaSlug(products[0].slug);
    }
  }, [mediaSlug, products, productsLoading]);

  useEffect(() => {
    if (!mediaSlug) return;
    void loadMedia(mediaSlug, mediaScope);
  }, [mediaSlug, mediaScope]);

  useEffect(() => {
    if (activeTab === 'enquiries') {
      void loadEnquiries();
      void loadContactConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'products') {
      void loadOrders();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'customers' || activeTab === 'leads' || activeTab === 'drafts' || activeTab === 'audit') {
      void loadCopilotRecords();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'drafts' || activeTab === 'audit') {
      void loadCopilotOps();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!browserRemindersEnabled || activeTab !== 'enquiries' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reminders = calculateAdminLeadReminders(enquiries);
    const candidates = [
      ...reminders.hotLeads,
      ...reminders.followUpsDueToday,
      ...reminders.overdueFollowUps,
    ];
    for (const reminder of candidates) {
      if (notifiedReminderIds.current.has(reminder.id)) continue;
      notifiedReminderIds.current.add(reminder.id);
      const title = reminder.type === 'hot-unreplied'
        ? `Hot lead needs reply: ${reminder.customerName}`
        : reminder.type === 'follow-up-due-today'
          ? `Follow-up due today: ${reminder.customerName}`
          : `Overdue follow-up: ${reminder.customerName}`;
      new Notification(title, {
        body: `${reminder.productInterest}. ${reminder.reason}`,
        tag: reminder.id,
      });
    }
  }, [activeTab, browserRemindersEnabled, enquiries]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const res = await adminFetch('/.netlify/functions/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { text: string; pendingChanges: PendingChange[] };
      if (!res.ok) throw new Error(data.text ?? 'Admin AI request failed');

      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);

      if (data.pendingChanges?.length) {
        setPending(prev => {
          const updated = [...prev];
          for (const change of data.pendingChanges) {
            const idx = updated.findIndex(p => p.path === change.path);
            if (idx >= 0) updated[idx] = change;
            else updated.push(change);
          }
          return updated;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      sendMessage(`[Image upload] filename: ${file.name}, base64: ${base64.slice(0, 20)}...`);
    };
    reader.readAsDataURL(file);
  }

  async function loadMedia(slug = mediaSlug, scope = mediaScope) {
    if (!slug) return;
    setMediaLoading(true);
    try {
      const params = new URLSearchParams({ scope, slug });
      const res = await adminFetch(`/.netlify/functions/admin-media?${params.toString()}`);
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { files: MediaFile[]; storageReady?: boolean; warning?: string };
      if (!res.ok) throw new Error(data.warning ?? 'Could not load media');
      setMediaFiles(data.files ?? []);
      setMediaStatus(data.warning ?? '');
    } catch {
      setMediaStatus(scope === 'pages' ? 'Could not load media for this page.' : 'Could not load media for this product.');
    } finally {
      setMediaLoading(false);
    }
  }

  async function loadEnquiries() {
    setEnquiriesLoading(true);
    try {
      const res = await adminFetch('/.netlify/functions/admin-enquiries');
      if (redirectToLoginIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('Could not load enquiries');
      const data = await res.json() as { enquiries?: EnquiryRecord[]; storageReady?: boolean; warning?: string };
      setEnquiries(Array.isArray(data.enquiries) ? data.enquiries.filter(Boolean) : []);
      setEnquiriesStatus(data.warning ?? '');
    } catch {
      setEnquiriesStatus('Could not load recent enquiries.');
    } finally {
      setEnquiriesLoading(false);
    }
  }

  async function loadContactConfig() {
    try {
      const res = await adminFetch('/.netlify/functions/admin-contact-config');
      if (redirectToLoginIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('Could not load contact config');
      const data = await res.json() as ContactConfig;
      setContactConfig(data);
    } catch {
      setContactConfig(null);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const res = await adminFetch('/.netlify/functions/admin-orders');
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ orders?: OrderRecord[]; error?: string }>(res, 'Orders are unavailable in this environment.');
      if (!res.ok) throw new Error(data.error ?? 'Could not load orders');
      setOrders(Array.isArray(data.orders) ? data.orders.filter(Boolean) : []);
      setOrdersStatus('');
    } catch (err) {
      setOrdersStatus(err instanceof Error ? err.message : 'Could not load orders.');
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadCopilotRecords() {
    setCopilotRecordsLoading(true);
    setCopilotRecordsStatus('Loading Copilot records...');
    try {
      const [customerRes, leadRes] = await Promise.all([
        adminFetch('/.netlify/functions/admin-owner-copilot-records?type=customers'),
        adminFetch('/.netlify/functions/admin-owner-copilot-records?type=leads'),
      ]);
      if (redirectToLoginIfUnauthorized(customerRes) || redirectToLoginIfUnauthorized(leadRes)) return;
      const customerData = await readAdminJson<{ customers?: CopilotCustomerRecord[]; error?: string }>(customerRes, 'Could not load customers.');
      const leadData = await readAdminJson<{ leads?: CopilotLeadRecord[]; error?: string }>(leadRes, 'Could not load leads.');
      if (!customerRes.ok) throw new Error(customerData.error ?? 'Could not load customers.');
      if (!leadRes.ok) throw new Error(leadData.error ?? 'Could not load leads.');
      setCopilotCustomers(Array.isArray(customerData.customers) ? customerData.customers : []);
      setCopilotLeads(Array.isArray(leadData.leads) ? leadData.leads : []);
      setCopilotRecordsStatus('');
    } catch (err) {
      setCopilotRecordsStatus(err instanceof Error ? err.message : 'Could not load Copilot records.');
    } finally {
      setCopilotRecordsLoading(false);
    }
  }

  async function loadCopilotOps() {
    setCopilotOpsLoading(true);
    setCopilotOpsStatus('Loading Copilot activity...');
    try {
      const [actionRes, auditRes] = await Promise.all([
        adminFetch('/.netlify/functions/admin-owner-copilot-ai-actions'),
        adminFetch('/.netlify/functions/admin-owner-copilot-audit'),
      ]);
      if (redirectToLoginIfUnauthorized(actionRes) || redirectToLoginIfUnauthorized(auditRes)) return;
      const actionData = await readAdminJson<{ actions?: CopilotAiActionRecord[]; error?: string }>(actionRes, 'Could not load drafts.');
      const auditData = await readAdminJson<{ logs?: CopilotAuditRecord[]; error?: string }>(auditRes, 'Could not load audit logs.');
      if (!actionRes.ok) throw new Error(actionData.error ?? 'Could not load drafts.');
      if (!auditRes.ok) throw new Error(auditData.error ?? 'Could not load audit logs.');
      setCopilotAiActions(Array.isArray(actionData.actions) ? actionData.actions : []);
      setCopilotAuditLogs(Array.isArray(auditData.logs) ? auditData.logs : []);
      setCopilotOpsStatus('');
    } catch (err) {
      setCopilotOpsStatus(err instanceof Error ? err.message : 'Could not load Copilot activity.');
    } finally {
      setCopilotOpsLoading(false);
    }
  }

  function startProductOrder(product: ProductRecord, status: OrderStatus = 'deposit_received') {
    setOrderForm({ ...orderFormFromProduct(product), status, depositPaid: status !== 'enquiry' });
    setActiveTab('orders');
    setOrdersStatus('');
  }

  function startEnquiryOrder(enquiry: EnquiryRecord) {
    setOrderForm(orderFormFromEnquiry(enquiry, products));
    setActiveTab('orders');
    setOrdersStatus('');
  }

  async function saveOrder() {
    if (!orderForm) return;
    const missing = [
      !orderForm.customerName.trim() && 'customer name',
      !orderForm.productTitle.trim() && 'product',
    ].filter(Boolean);
    if (missing.length) {
      setOrdersStatus(`Add ${missing.join(' and ')} before saving.`);
      return;
    }

    setOrderSaving(true);
    try {
      const method = orderForm.id ? 'PATCH' : 'POST';
      const res = await adminFetch('/.netlify/functions/admin-orders', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderForm),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ order?: OrderRecord; error?: string }>(res, 'Orders are unavailable in this environment.');
      if (!res.ok || !data.order) throw new Error(data.error ?? 'Could not save order');
      setOrders(prev => {
        const existing = prev.findIndex(order => order.id === data.order!.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data.order!;
          return next;
        }
        return [data.order!, ...prev];
      });
      setOrderForm(null);
      setOrdersStatus('Order saved.');
    } catch (err) {
      setOrdersStatus(err instanceof Error ? err.message : 'Could not save order.');
    } finally {
      setOrderSaving(false);
    }
  }

  async function enableBrowserLeadReminders() {
    if (typeof Notification === 'undefined') {
      setBrowserReminderStatus('Browser notifications are not supported in this browser.');
      return;
    }
    if (Notification.permission === 'denied') {
      setBrowserReminderStatus('Browser notifications are blocked in this browser.');
      return;
    }
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission === 'granted') {
      setBrowserRemindersEnabled(true);
      setBrowserReminderStatus('Browser notifications are enabled while this page is open.');
    } else {
      setBrowserRemindersEnabled(false);
      setBrowserReminderStatus('Browser notifications were not enabled.');
    }
  }

  function openEnquiry(enquiryId: string) {
    enquiryRefs.current[enquiryId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function lookupProductKnowledge() {
    const query = knowledgeSearch.trim();
    const productInterest = knowledgeProduct.trim();
    if (!query && !productInterest) {
      setKnowledgeLookupStatus('Add a product or question first.');
      return;
    }
    setKnowledgeLookupLoading(true);
    setKnowledgeLookupStatus('Searching approved product knowledge...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-product-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, productInterest }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ context?: ProductKnowledgeLookupResult; error?: string }>(res, 'Could not search product knowledge.');
      if (!res.ok || !data.context) throw new Error(data.error ?? 'Could not search product knowledge.');
      setKnowledgeLookup(data.context);
      setKnowledgeLookupStatus(data.context.sources.length ? 'Approved knowledge found.' : 'No approved source matched this question.');
    } catch (err) {
      setKnowledgeLookupStatus(err instanceof Error ? err.message : 'Could not search product knowledge.');
    } finally {
      setKnowledgeLookupLoading(false);
    }
  }

  async function loadLeadDetail(enquiryId: string) {
    setLeadDetailStatus(prev => ({ ...prev, [enquiryId]: 'Loading lead detail...' }));
    try {
      const [taskRes, timelineRes] = await Promise.all([
        adminFetch(`/.netlify/functions/admin-owner-copilot-tasks?leadId=${encodeURIComponent(enquiryId)}`),
        adminFetch(`/.netlify/functions/admin-owner-copilot-timeline?leadId=${encodeURIComponent(enquiryId)}`),
      ]);
      if (redirectToLoginIfUnauthorized(taskRes) || redirectToLoginIfUnauthorized(timelineRes)) return;
      const taskData = await readAdminJson<{ tasks?: OwnerCopilotTask[]; error?: string }>(taskRes, 'Could not load lead tasks.');
      const timelineData = await readAdminJson<{ events?: OwnerCopilotTimelineEvent[]; error?: string }>(timelineRes, 'Could not load lead timeline.');
      if (!taskRes.ok) throw new Error(taskData.error ?? 'Could not load lead tasks.');
      if (!timelineRes.ok) throw new Error(timelineData.error ?? 'Could not load lead timeline.');
      setLeadDetails(prev => ({
        ...prev,
        [enquiryId]: {
          tasks: Array.isArray(taskData.tasks) ? taskData.tasks : [],
          timeline: Array.isArray(timelineData.events) ? timelineData.events : [],
        },
      }));
      setLeadDetailStatus(prev => ({ ...prev, [enquiryId]: '' }));
    } catch (err) {
      setLeadDetailStatus(prev => ({ ...prev, [enquiryId]: err instanceof Error ? err.message : 'Could not load lead detail.' }));
    }
  }

  function toggleLeadDetail(enquiry: EnquiryRecord) {
    const nextId = openLeadDetailId === enquiry.id ? null : enquiry.id;
    setOpenLeadDetailId(nextId);
    if (nextId && !leadDetails[nextId]) {
      setTaskDrafts(prev => ({
        ...prev,
        [nextId]: prev[nextId] ?? {
          title: `Follow up ${enquiry.name || 'lead'}`,
          dueDate: enquiry.leadStatus?.nextFollowUpDate || enquiry.callback_date || reminderTodayKey(),
          priority: enquiry.leadStatus?.priority === 'hot' ? 'high' : 'medium',
          notes: '',
        },
      }));
      void loadLeadDetail(nextId);
    }
  }

  async function createLeadTask(enquiry: EnquiryRecord) {
    const draft = taskDrafts[enquiry.id] ?? { title: '', dueDate: '', priority: 'medium' as const, notes: '' };
    if (!draft.title.trim()) {
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: 'Add a task title first.' }));
      return;
    }
    setTaskSaving(enquiry.id);
    try {
      const res = await adminFetch('/.netlify/functions/admin-owner-copilot-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          relatedLeadId: enquiry.id,
          dueDate: draft.dueDate,
          priority: draft.priority,
          notes: draft.notes,
          source: 'admin-lead-detail',
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ task?: OwnerCopilotTask; error?: string }>(res, 'Could not create task.');
      if (!res.ok || !data.task) throw new Error(data.error ?? 'Could not create task.');
      setTaskDrafts(prev => ({
        ...prev,
        [enquiry.id]: { title: '', dueDate: draft.dueDate, priority: draft.priority, notes: '' },
      }));
      await loadLeadDetail(enquiry.id);
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: 'Task created.' }));
    } catch (err) {
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: err instanceof Error ? err.message : 'Could not create task.' }));
    } finally {
      setTaskSaving(null);
    }
  }

  async function syncEnquiryToCopilotRecords(enquiry: EnquiryRecord) {
    setRecordSyncSaving(enquiry.id);
    setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: 'Saving customer and lead records...' }));
    try {
      const res = await adminFetch('/.netlify/functions/admin-owner-copilot-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'enquiry',
          id: enquiry.id,
          sourceEnquiryId: enquiry.id,
          name: enquiry.name,
          email: enquiry.email,
          phone: enquiry.phone,
          productInterest: enquiry.product_interest,
          status: enquiry.leadStatus?.status === 'quoted' ? 'quote_sent' : enquiry.leadStatus?.status === 'lost' ? 'lost' : enquiry.leadStatus?.status === 'won' ? 'won' : 'new',
          nextFollowUpDate: enquiry.leadStatus?.nextFollowUpDate || '',
          notes: enquiry.leadStatus?.notes || enquiry.message || '',
          message: enquiry.message,
          submittedAt: enquiry.received_at || enquiry.submittedAt,
          source: 'admin-enquiry-sync',
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ lead?: { id: string }; customer?: { id: string }; error?: string }>(res, 'Could not save Copilot records.');
      if (!res.ok || !data.lead?.id || !data.customer?.id) throw new Error(data.error ?? 'Could not save Copilot records.');
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: 'Customer and lead records saved.' }));
      void loadCopilotRecords();
      if (openLeadDetailId === enquiry.id) await loadLeadDetail(enquiry.id);
    } catch (err) {
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: err instanceof Error ? err.message : 'Could not save Copilot records.' }));
    } finally {
      setRecordSyncSaving(null);
    }
  }

  async function completeLeadTask(enquiryId: string, taskId: string) {
    setTaskSaving(taskId);
    try {
      const res = await adminFetch('/.netlify/functions/admin-owner-copilot-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: 'completed' }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ task?: OwnerCopilotTask; error?: string }>(res, 'Could not complete task.');
      if (!res.ok || !data.task) throw new Error(data.error ?? 'Could not complete task.');
      await loadLeadDetail(enquiryId);
      setLeadDetailStatus(prev => ({ ...prev, [enquiryId]: 'Task completed.' }));
    } catch (err) {
      setLeadDetailStatus(prev => ({ ...prev, [enquiryId]: err instanceof Error ? err.message : 'Could not complete task.' }));
    } finally {
      setTaskSaving(null);
    }
  }

  async function addLeadNote(enquiry: EnquiryRecord) {
    const note = noteDrafts[enquiry.id]?.trim() ?? '';
    if (!note) {
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: 'Add a note first.' }));
      return;
    }
    try {
      const res = await adminFetch('/.netlify/functions/admin-owner-copilot-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'note_added',
          relatedLeadId: enquiry.id,
          summary: note,
          source: 'admin-lead-detail',
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ event?: OwnerCopilotTimelineEvent; error?: string }>(res, 'Could not save note.');
      if (!res.ok || !data.event) throw new Error(data.error ?? 'Could not save note.');
      setNoteDrafts(prev => ({ ...prev, [enquiry.id]: '' }));
      await loadLeadDetail(enquiry.id);
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: 'Note added.' }));
    } catch (err) {
      setLeadDetailStatus(prev => ({ ...prev, [enquiry.id]: err instanceof Error ? err.message : 'Could not save note.' }));
    }
  }

  function setManualMode(mode: 'manual_email' | 'phone_call') {
    setManualEnquiryMode(mode);
    setManualEnquiry(prev => ({
      ...prev,
      source_type: mode,
      email_subject: mode === 'manual_email' ? prev.email_subject : '',
      email_body: mode === 'manual_email' ? prev.email_body : '',
      conversation_summary: mode === 'phone_call' ? prev.conversation_summary : '',
    }));
    setManualEnquiryStatus('');
  }

  function updateManualEnquiry(patch: Partial<ManualEnquiryForm>) {
    setManualEnquiry(prev => ({ ...prev, ...patch }));
  }

  async function saveManualEnquiry() {
    setManualEnquirySaving(true);
    setManualEnquiryStatus('');
    try {
      const payload = {
        ...manualEnquiry,
        source_type: manualEnquiryMode === 'manual_email' ? 'manual_email' : manualEnquiry.source_type,
      };
      const res = await adminFetch('/.netlify/functions/admin-manual-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { enquiry?: EnquiryRecord; error?: string };
      if (!res.ok || !data.enquiry) throw new Error(data.error ?? 'Could not save manual enquiry');

      const leadStatus = {
        enquiryId: data.enquiry.id,
        status: 'new' as const,
        priority: manualEnquiry.priority,
        notes: manualEnquiry.notes,
        nextFollowUpDate: manualEnquiry.nextFollowUpDate,
        outcomeReason: '' as const,
        firstResponseAt: '',
        lastContactedAt: '',
        updatedAt: data.enquiry.submittedAt,
      };
      setEnquiries(prev => [{ ...data.enquiry!, leadStatus }, ...prev]);
      setManualEnquiry(emptyManualEnquiryForm());
      setManualEnquiryMode('manual_email');
      setShowManualEnquiryForm(false);
      setEnquiriesStatus('');
      setManualEnquiryStatus('Manual enquiry saved.');
    } catch (err) {
      setManualEnquiryStatus(err instanceof Error ? err.message : 'Could not save manual enquiry.');
    } finally {
      setManualEnquirySaving(false);
    }
  }

  async function saveLeadStatus(
    enquiry: EnquiryRecord,
    patch: Partial<NonNullable<EnquiryRecord['leadStatus']>>
  ) {
    const current = enquiry.leadStatus ?? {
      enquiryId: enquiry.id,
      status: 'new' as const,
      priority: 'warm' as const,
      notes: '',
      nextFollowUpDate: enquiry.callback_date ?? '',
      outcomeReason: '',
      firstResponseAt: '',
      lastContactedAt: '',
      updatedAt: enquiry.submittedAt,
    };
    const next = { ...current, ...patch, enquiryId: enquiry.id };
    setEnquiries(prev => prev.map(item => item.id === enquiry.id ? { ...item, leadStatus: next } : item));
    setLeadSaving(enquiry.id);
    try {
      const res = await adminFetch('/.netlify/functions/admin-lead-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiryId: enquiry.id,
          status: next.status,
          priority: next.priority ?? 'warm',
          notes: next.notes ?? '',
          nextFollowUpDate: next.nextFollowUpDate ?? '',
          outcomeReason: next.outcomeReason ?? '',
          firstResponseAt: next.firstResponseAt ?? '',
          lastContactedAt: next.lastContactedAt ?? '',
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { leadStatus?: EnquiryRecord['leadStatus']; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not save lead status');
      if (data.leadStatus) {
        setEnquiries(prev => prev.map(item => item.id === enquiry.id ? { ...item, leadStatus: data.leadStatus } : item));
      }
      setEnquiriesStatus('');
      return true;
    } catch (err) {
      setEnquiriesStatus(err instanceof Error ? err.message : 'Could not save lead status.');
      setEnquiries(prev => prev.map(item => item.id === enquiry.id ? { ...item, leadStatus: current } : item));
      return false;
    } finally {
      setLeadSaving(null);
    }
  }

  async function generateEnquiryResponse(enquiry: EnquiryRecord) {
    setResponseGenerating(enquiry.id);
    setResponseStatuses(prev => ({ ...prev, [enquiry.id]: 'Generating response...' }));
    try {
      const res = await adminFetch('/.netlify/functions/admin-generate-enquiry-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId: enquiry.id }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as {
        draft?: string;
        error?: string;
        warnings?: string[];
        missingFacts?: string[];
        outputWarnings?: string[];
        sources?: ProductKnowledgeSourceView[];
        aiActionId?: string;
      };
      if (!res.ok || !data.draft) throw new Error(data.error ?? 'Could not generate response');
      setResponseDrafts(prev => ({ ...prev, [enquiry.id]: data.draft ?? '' }));
      if (data.aiActionId) setResponseActionIds(prev => ({ ...prev, [enquiry.id]: data.aiActionId ?? '' }));
      setResponseGrounding(prev => ({
        ...prev,
        [enquiry.id]: {
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
          missingFacts: Array.isArray(data.missingFacts) ? data.missingFacts : [],
          outputWarnings: Array.isArray(data.outputWarnings) ? data.outputWarnings : [],
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      }));
      setResponseStatuses(prev => ({ ...prev, [enquiry.id]: 'Draft generated. Review before sending.' }));
    } catch (err) {
      setResponseStatuses(prev => ({
        ...prev,
        [enquiry.id]: err instanceof Error ? err.message : 'Could not generate response.',
      }));
    } finally {
      setResponseGenerating(null);
    }
  }

  async function updateResponseActionState(enquiry: EnquiryRecord, approvalState: 'edited' | 'approved' | 'rejected' | 'copied' | 'sent_manually') {
    const actionId = responseActionIds[enquiry.id];
    if (!actionId) {
      setResponseStatuses(prev => ({ ...prev, [enquiry.id]: 'Generate a draft before changing its approval state.' }));
      return false;
    }
    setAiActionSaving(enquiry.id);
    try {
      const res = await adminFetch('/.netlify/functions/admin-owner-copilot-ai-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionId,
          approvalState,
          output: responseDrafts[enquiry.id] ?? '',
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return false;
      const data = await readAdminJson<{ action?: { approvalState?: string }; error?: string }>(res, 'Could not update draft state.');
      if (!res.ok || !data.action) throw new Error(data.error ?? 'Could not update draft state.');
      setResponseStatuses(prev => ({ ...prev, [enquiry.id]: `Draft marked ${approvalState.replace(/_/g, ' ')}.` }));
      return true;
    } catch (err) {
      setResponseStatuses(prev => ({ ...prev, [enquiry.id]: err instanceof Error ? err.message : 'Could not update draft state.' }));
      return false;
    } finally {
      setAiActionSaving(null);
    }
  }

  async function classifyEnquiry(enquiry: EnquiryRecord) {
    setClassificationSaving(enquiry.id);
    setClassificationStatuses(prev => ({ ...prev, [enquiry.id]: 'Classifying lead...' }));
    try {
      const res = await adminFetch('/.netlify/functions/admin-classify-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId: enquiry.id }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { leadStatus?: EnquiryRecord['leadStatus']; error?: string };
      if (!res.ok || !data.leadStatus) throw new Error(data.error ?? 'Could not classify lead');
      setEnquiries(prev => prev.map(item => item.id === enquiry.id ? { ...item, leadStatus: data.leadStatus } : item));
      setClassificationStatuses(prev => ({ ...prev, [enquiry.id]: 'Lead classification saved. Review before applying any changes.' }));
    } catch (err) {
      setClassificationStatuses(prev => ({
        ...prev,
        [enquiry.id]: err instanceof Error ? err.message : 'Could not classify lead.',
      }));
    } finally {
      setClassificationSaving(null);
    }
  }

  async function applyClassificationPriority(enquiry: EnquiryRecord) {
    const suggestedPriority = enquiry.leadStatus?.aiClassification?.suggestedPriority;
    if (!suggestedPriority) return;
    const saved = await saveLeadStatus(enquiry, { priority: suggestedPriority });
    if (saved) setClassificationStatuses(prev => ({ ...prev, [enquiry.id]: 'Suggested priority applied.' }));
  }

  async function copyEnquiryResponse(enquiry: EnquiryRecord) {
    const draft = responseDrafts[enquiry.id]?.trim();
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      await updateResponseActionState(enquiry, 'copied');
      setResponseStatuses(prev => ({ ...prev, [enquiry.id]: 'Copied. Paste it into your email app before sending.' }));
    } catch {
      setResponseStatuses(prev => ({ ...prev, [enquiry.id]: 'Could not copy response.' }));
    }
  }

  async function markEnquiryReplied(enquiry: EnquiryRecord) {
    const now = new Date().toISOString();
    const saved = await saveLeadStatus(enquiry, {
      status: 'contacted',
      firstResponseAt: enquiry.leadStatus?.firstResponseAt || now,
      lastContactedAt: now,
    });
    if (saved) {
      if (responseActionIds[enquiry.id]) await updateResponseActionState(enquiry, 'sent_manually');
      setResponseStatuses(prev => ({ ...prev, [enquiry.id]: 'Marked as replied.' }));
    }
  }

  function readBlobAsBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(blob);
    });
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read image file'));
      img.src = src;
    });
  }

  function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  }

  function uploadFilenameFor(file: File, contentType: string) {
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    if (contentType === 'image/webp') return `${baseName}.webp`;
    if (contentType === 'image/jpeg') return `${baseName}.jpg`;
    return file.name;
  }

  async function prepareImageForUpload(file: File) {
    if (file.type === 'image/gif') {
      if (file.size > MAX_GIF_UPLOAD_BYTES) {
        throw new Error('Animated GIF uploads must be 4MB or smaller.');
      }
      return {
        filename: file.name,
        contentType: file.type,
        data: await readBlobAsBase64(file),
      };
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Unsupported image type.');
    }

    const img = await loadImageElement(await readFileAsDataUrl(file));
    const longestEdge = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longestEdge > MAX_UPLOAD_IMAGE_EDGE ? MAX_UPLOAD_IMAGE_EDGE / longestEdge : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare image for upload.');
    context.drawImage(img, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/webp', UPLOAD_IMAGE_QUALITY);
    if (!blob) blob = await canvasToBlob(canvas, 'image/jpeg', UPLOAD_IMAGE_QUALITY);
    if (!blob) throw new Error('Could not prepare image for upload.');

    return {
      filename: uploadFilenameFor(file, blob.type),
      contentType: blob.type || 'image/webp',
      data: await readBlobAsBase64(blob),
    };
  }

  async function uploadProductImage(slug: string, file: File, alt: string) {
    const prepared = await prepareImageForUpload(file);
    const res = await adminFetch('/.netlify/functions/admin-media-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'products',
        slug,
        filename: prepared.filename,
        contentType: prepared.contentType,
        data: prepared.data,
        alt,
      }),
    });
    if (redirectToLoginIfUnauthorized(res)) return '';
    const data = await res.json() as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed');
    return data.url;
  }

  async function uploadMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !mediaSlug) return;
    setMediaLoading(true);
    setMediaStatus('Preparing image...');

    try {
      const prepared = await prepareImageForUpload(file);
      setMediaStatus('Uploading image...');
      const res = await adminFetch('/.netlify/functions/admin-media-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: mediaScope,
          slug: mediaSlug,
          filename: prepared.filename,
          contentType: prepared.contentType,
          data: prepared.data,
          alt: mediaAlt,
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setMediaStatus('Image uploaded.');
      setMediaAlt('');
      await loadMedia(mediaSlug, mediaScope);
    } catch (err) {
      setMediaStatus(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setMediaLoading(false);
      if (mediaFileRef.current) mediaFileRef.current.value = '';
    }
  }

  async function uploadNewProductMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const proposedSlug = slugifyTitle(newProduct.title);

    if (!files.length) return;
    if (!proposedSlug) {
      setNewProductMediaStatus('Enter the product title before uploading photos.');
      if (newProductFileRef.current) newProductFileRef.current.value = '';
      return;
    }

    setMediaLoading(true);
    setNewProductMediaStatus(`Uploading ${files.length} photo${files.length === 1 ? '' : 's'}...`);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        uploadedUrls.push(await uploadProductImage(proposedSlug, file, newProduct.title));
      }

      setNewProduct(prev => {
        const gallery = parseGalleryText(prev.galleryText);
        const nextGallery = [...gallery];
        for (const url of uploadedUrls) {
          if (url && !nextGallery.includes(url)) nextGallery.push(url);
        }
        return {
          ...prev,
          heroImage: prev.heroImage || uploadedUrls[0] || '',
          galleryText: formatGalleryText(nextGallery),
        };
      });
      setNewProductMediaStatus('Photos uploaded and added to this product draft.');
    } catch (err) {
      setNewProductMediaStatus(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setMediaLoading(false);
      if (newProductFileRef.current) newProductFileRef.current.value = '';
    }
  }

  async function deleteMedia(key: string) {
    const ok = window.confirm('Delete this uploaded image? Product pages using this image will need their gallery updated first.');
    if (!ok) return;
    setMediaLoading(true);
    try {
      const res = await adminFetch('/.netlify/functions/admin-media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('Delete failed');
      await loadMedia(mediaSlug, mediaScope);
      setMediaStatus('Image deleted.');
    } catch {
      setMediaStatus('Could not delete image.');
    } finally {
      setMediaLoading(false);
    }
  }

  function editFormFromProduct(product: ProductRecord): EditProductForm {
    return {
      slug: product.slug,
      title: product.title,
      price: product.price,
      status: (['available', 'on-sale', 'coming-soon'].includes(product.status) ? product.status : 'available') as ProductStatus,
      tagline: product.tagline,
      featured: Boolean(product.featured),
      onSale: Boolean(product.onSale),
      heroImage: product.heroImage ?? '',
      galleryText: (product.gallery ?? []).join('\n'),
      relatedSlugs: product.relatedSlugs ?? [],
      youtubeVideoUrl: youtubeWatchUrl(product.youtubeVideo?.id, product.youtubeVideo?.startSeconds),
      youtubeVideoTitle: product.youtubeVideo?.title ?? '',
      youtubeVideoDescription: product.youtubeVideo?.description ?? '',
      youtubeVideoThumbnail: product.youtubeVideo?.thumbnail ?? '',
      youtubeVideoUploadDate: product.youtubeVideo?.uploadDate ?? '',
      youtubeVideoDuration: product.youtubeVideo?.duration ?? '',
      youtubeVideoTranscriptSummary: product.youtubeVideo?.transcriptSummary ?? '',
      suitabilityStatus: product.suitabilityData?.status ?? 'draft',
      suitabilityDryWeightKg: product.suitabilityData?.dryWeightKg ?? '',
      suitabilityEstimatedLoadedWeightKg: product.suitabilityData?.estimatedLoadedWeightKg ?? '',
      suitabilityRequiredTrayLengthMm: product.suitabilityData?.requiredTrayLengthMm ?? '',
      suitabilityRequiredTrayWidthMm: product.suitabilityData?.requiredTrayWidthMm ?? '',
      suitabilityCentreOfGravityMm: product.suitabilityData?.centreOfGravityMm ?? '',
      suitabilityAtmKg: product.suitabilityData?.atmKg ?? '',
      suitabilityGtmKg: product.suitabilityData?.gtmKg ?? '',
      suitabilityTowBallWeightKg: product.suitabilityData?.towBallWeightKg ?? '',
      suitabilityNotes: product.suitabilityData?.notes ?? '',
      notes: '',
    };
  }

  function applyMediaToProduct(url: string, mode: 'hero' | 'gallery') {
    if (mediaScope !== 'products') {
      setMediaStatus('Choose a product target before using Hero or Gallery.');
      return;
    }
    const product = products.find(item => item.slug === mediaSlug);
    if (!product) return;
    const form = editFormFromProduct(product);

    if (mode === 'hero') {
      form.heroImage = url;
      form.notes = 'Set the uploaded image as the product hero image.';
    } else {
      const gallery = parseGalleryText(form.galleryText);
      if (!gallery.includes(url)) gallery.push(url);
      form.galleryText = gallery.join('\n');
      form.notes = 'Add the uploaded image to the end of the product gallery.';
    }

    setEditProduct(form);
    setActiveTab('products');
  }

  function queueKnowledgeUpdate() {
    const text = knowledgeInput.trim();
    if (!text) return;
    setKnowledgeInput('');
    sendMessage(
      `Update the chatbot business knowledge file at src/data/chatbot-knowledge.md with this information. ` +
      `Read the current file first, preserve useful existing notes, and add or update the relevant note clearly without adding private customer data:\n\n${text}`
    );
  }

  async function handleAIRewrite() {
    const text = knowledgeInput.trim();
    if (!text || rewriting) return;
    setRewriting(true);
    try {
      const res = await adminFetch('/.netlify/functions/knowledge-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Rewrite failed');
      if (data.text) setKnowledgeInput(data.text);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, AI rewrite failed. Please try again.' }]);
    } finally {
      setRewriting(false);
    }
  }

  function requestProductUpdate(product: ProductRecord, task: string) {
    setActiveTab('pending');
    sendMessage(
      `${task}\n\nProduct: ${product.title}\nSlug: ${product.slug}\n` +
      `Read src/content/products/${product.slug}.md first, then queue a complete-file change for review.`
    );
  }

  function startStructuredEdit(product: ProductRecord) {
    setEditProduct(editFormFromProduct(product));
  }

  function queueStructuredEdit() {
    if (!editProduct) return;
    const missing = [
      !editProduct.title.trim() && 'title',
      !editProduct.price.trim() && 'price',
      !editProduct.tagline.trim() && 'tagline',
      !editProduct.heroImage.trim() && 'hero image',
    ].filter(Boolean);

    if (missing.length) {
      setMessages(prev => [...prev, { role: 'assistant', content: `The product edit form needs: ${missing.join(', ')}.` }]);
      return;
    }

    const gallery = parseGalleryText(editProduct.galleryText);
    const knownSlugs = new Set(products.map(product => product.slug));
    const invalidRelated = editProduct.relatedSlugs.filter(slug => !knownSlugs.has(slug));
    const videoId = extractYouTubeVideoId(editProduct.youtubeVideoUrl);
    const hasVideoFields = Boolean(
      editProduct.youtubeVideoUrl.trim() ||
      editProduct.youtubeVideoTitle.trim() ||
      editProduct.youtubeVideoDescription.trim() ||
      editProduct.youtubeVideoThumbnail.trim() ||
      editProduct.youtubeVideoUploadDate.trim() ||
      editProduct.youtubeVideoDuration.trim() ||
      editProduct.youtubeVideoTranscriptSummary.trim()
    );

    if (gallery.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'The gallery must contain at least one image URL or path.' }]);
      return;
    }

    if (invalidRelated.length) {
      setMessages(prev => [...prev, { role: 'assistant', content: `These related product slugs are not valid: ${invalidRelated.join(', ')}.` }]);
      return;
    }

    if (hasVideoFields && !editProduct.youtubeVideoUrl.trim()) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Add a YouTube URL for the product video, or clear all video fields.' }]);
      return;
    }

    if (editProduct.youtubeVideoUrl.trim() && !isValidYouTubeVideoId(videoId)) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'The YouTube video URL does not look valid. Paste a normal YouTube, youtu.be, Shorts, embed URL, or a clean video ID.' }]);
      return;
    }

    if (videoId && !editProduct.youtubeVideoTitle.trim()) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Add a short video title before queueing the product edit.' }]);
      return;
    }

    setActiveTab('pending');
    setLoading(true);
    adminFetch('/.netlify/functions/admin-product-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: editProduct.slug,
        title: editProduct.title.trim(),
        price: editProduct.price.trim(),
        status: editProduct.status,
        onSale: editProduct.onSale,
        featured: editProduct.featured,
        tagline: editProduct.tagline.trim(),
        heroImage: editProduct.heroImage.trim(),
        gallery,
        relatedSlugs: editProduct.relatedSlugs,
        youtubeVideo: videoId
          ? {
              url: editProduct.youtubeVideoUrl.trim(),
              title: editProduct.youtubeVideoTitle.trim(),
              description: editProduct.youtubeVideoDescription.trim(),
              thumbnail: editProduct.youtubeVideoThumbnail.trim(),
              uploadDate: editProduct.youtubeVideoUploadDate.trim(),
              duration: editProduct.youtubeVideoDuration.trim(),
              transcriptSummary: editProduct.youtubeVideoTranscriptSummary.trim(),
            }
          : null,
        suitabilityData: {
          status: editProduct.suitabilityStatus,
          dryWeightKg: editProduct.suitabilityDryWeightKg.trim(),
          estimatedLoadedWeightKg: editProduct.suitabilityEstimatedLoadedWeightKg.trim(),
          requiredTrayLengthMm: editProduct.suitabilityRequiredTrayLengthMm.trim(),
          requiredTrayWidthMm: editProduct.suitabilityRequiredTrayWidthMm.trim(),
          centreOfGravityMm: editProduct.suitabilityCentreOfGravityMm.trim(),
          atmKg: editProduct.suitabilityAtmKg.trim(),
          gtmKg: editProduct.suitabilityGtmKg.trim(),
          towBallWeightKg: editProduct.suitabilityTowBallWeightKg.trim(),
          notes: editProduct.suitabilityNotes.trim(),
        },
      }),
    })
      .then(async res => {
        if (redirectToLoginIfUnauthorized(res)) return;
        const data = await res.json() as { pendingChange?: PendingChange; error?: string };
        if (!res.ok || !data.pendingChange) throw new Error(data.error ?? 'Could not queue product edit');
        setPending(prev => {
          const existing = prev.findIndex(change => change.path === data.pendingChange!.path);
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = data.pendingChange!;
            return next;
          }
          return [...prev, data.pendingChange!];
        });
        setMessages(prev => [...prev, { role: 'assistant', content: `${editProduct.title.trim()} edit queued. Open Pending to review and deploy it.` }]);
        setEditProduct(null);
      })
      .catch(err => {
        setMessages(prev => [...prev, { role: 'assistant', content: err instanceof Error ? err.message : 'Could not queue product edit.' }]);
      })
      .finally(() => setLoading(false));
  }

  function queueNewProduct() {
    const gallery = parseGalleryText(newProduct.galleryText);
    const missing = [
      !newProduct.title.trim() && 'title',
      !newProduct.price.trim() && 'price',
      !newProduct.tagline.trim() && 'tagline',
      !newProduct.keySpecs.trim() && 'key specs',
      !newProduct.description.trim() && 'description',
      !newProduct.heroImage.trim() && 'hero photo',
      gallery.length === 0 && 'gallery photos',
    ].filter(Boolean);

    if (missing.length) {
      setMessages(prev => [...prev, { role: 'assistant', content: `The new product form needs: ${missing.join(', ')}.` }]);
      return;
    }

    const proposedSlug = slugifyTitle(newProduct.title);
    if (products.some(product => product.slug === proposedSlug)) {
      setMessages(prev => [...prev, { role: 'assistant', content: `A product already uses the slug "${proposedSlug}". Change the title or ask me to edit the existing product instead.` }]);
      return;
    }

    const videoId = extractYouTubeVideoId(newProduct.youtubeVideoUrl);
    const hasVideoFields = Boolean(
      newProduct.youtubeVideoUrl.trim() ||
      newProduct.youtubeVideoTitle.trim() ||
      newProduct.youtubeVideoDescription.trim() ||
      newProduct.youtubeVideoThumbnail.trim() ||
      newProduct.youtubeVideoUploadDate.trim() ||
      newProduct.youtubeVideoDuration.trim() ||
      newProduct.youtubeVideoTranscriptSummary.trim()
    );

    if (hasVideoFields && !newProduct.youtubeVideoUrl.trim()) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Add a YouTube URL for the new product video, or clear all video fields.' }]);
      return;
    }

    if (newProduct.youtubeVideoUrl.trim() && !isValidYouTubeVideoId(videoId)) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'The YouTube video URL does not look valid. Paste a normal YouTube, youtu.be, Shorts, embed URL, or a clean video ID.' }]);
      return;
    }

    if (videoId && !newProduct.youtubeVideoTitle.trim()) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Add a short video title before queueing the new product draft.' }]);
      return;
    }

    const videoInstructions = videoId
      ? `YouTube video frontmatter:\n` +
        `id: ${videoId}\n` +
        `title: ${newProduct.youtubeVideoTitle.trim()}\n` +
        `description: ${newProduct.youtubeVideoDescription.trim() || 'None'}\n` +
        `thumbnail: ${newProduct.youtubeVideoThumbnail.trim() || youtubeThumbnailUrl(videoId)}\n` +
        `uploadDate: ${newProduct.youtubeVideoUploadDate.trim() || 'None'}\n` +
        `duration: ${newProduct.youtubeVideoDuration.trim() || 'None'}\n` +
        `transcriptSummary: ${newProduct.youtubeVideoTranscriptSummary.trim() || 'None'}`
      : `YouTube video frontmatter: None. Do not add a youtubeVideo block.`;

    setActiveTab('pending');
    sendMessage(
      `Create a new ${newProduct.category} product page using the existing product markdown format.\n\n` +
      `Title: ${newProduct.title.trim()}\n` +
      `Price: ${newProduct.price.trim()}\n` +
      `Tagline: ${newProduct.tagline.trim()}\n` +
      `Status: available\n` +
      `Category: ${newProduct.category}\n` +
      `Hero image: ${newProduct.heroImage.trim()}\n` +
      `Gallery order, one image per line:\n${gallery.join('\n')}\n\n` +
      `Key specs, one per line:\n${newProduct.keySpecs.trim()}\n\n` +
      `Description/body copy:\n${newProduct.description.trim()}\n\n` +
      `${videoInstructions}\n\n` +
      `Use a URL-safe slug based on the title. Before proposing the new file, list src/content/products and confirm the slug does not already exist. ` +
      `Use exactly the supplied hero image and gallery order. Store only the clean YouTube video ID in youtubeVideo.id. Do not invent image URLs or video metadata.`
    );
    setNewProduct(EMPTY_PRODUCT_FORM);
    setShowNewProductForm(false);
  }

  function updateRecentBuild(id: string, patch: Partial<RecentBuild>) {
    setRecentBuilds(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function updateTestimonial(id: string, patch: Partial<Testimonial>) {
    setTestimonials(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function addRecentBuild() {
    const title = `Recent Build ${Date.now().toString().slice(-4)}`;
    setRecentBuilds(prev => {
      const current = orderedItems(prev);
      const keep = current.slice(0, Math.max(0, MAX_RECENT_BUILDS - 1));
      return renumber([
        {
          ...EMPTY_RECENT_BUILD,
          id: slugifyTitle(`${title}-${Date.now()}`),
          title,
          sortOrder: 1,
        },
        ...keep,
      ]);
    });
  }

  function addTestimonial() {
    const title = `testimonial-${testimonials.length + 1}`;
    setTestimonials(prev => renumber([
      ...prev,
      {
        ...EMPTY_TESTIMONIAL,
        id: slugifyTitle(`${title}-${Date.now()}`),
        sortOrder: prev.length + 1,
      },
    ]));
  }

  function removeRecentBuild(id: string) {
    setRecentBuilds(prev => renumber(prev.filter(item => item.id !== id)));
  }

  function removeTestimonial(id: string) {
    setTestimonials(prev => renumber(prev.filter(item => item.id !== id)));
  }

  function moveRecentBuild(id: string, direction: -1 | 1) {
    setRecentBuilds(prev => {
      const next = orderedItems(prev);
      const index = next.findIndex(item => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return renumber(next);
    });
  }

  function moveTestimonial(id: string, direction: -1 | 1) {
    setTestimonials(prev => {
      const next = orderedItems(prev);
      const index = next.findIndex(item => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return renumber(next);
    });
  }

  function applyProductToRecentBuild(id: string, slug: string) {
    const product = products.find(item => item.slug === slug);
    if (!product) return;
    updateRecentBuild(id, {
      image: product.heroImage ?? '',
      alt: `${product.title} build at Beyond RV`,
      link: `/${product.slug}/`,
      productSlug: product.slug,
      title: product.title.includes('Advent') ? `${product.title.replace(' Hardtop Slide-On', '')} Build` : product.title,
    });
  }

  function validateHomepageData() {
    const buildErrors = orderedItems(recentBuilds).flatMap((build, index) => {
      const prefix = `Recent build ${index + 1}`;
      return [
        !build.id.trim() && `${prefix}: ID`,
        !build.title.trim() && `${prefix}: title`,
        !build.image.trim() && `${prefix}: image`,
        !build.alt.trim() && `${prefix}: alt text`,
        build.tags.filter(tag => tag.trim()).length === 0 && `${prefix}: at least one tag`,
      ].filter(Boolean);
    });

    const testimonialErrors = orderedItems(testimonials).flatMap((testimonial, index) => {
      const prefix = `Testimonial ${index + 1}`;
      return [
        !testimonial.id.trim() && `${prefix}: ID`,
        !testimonial.quote.trim() && `${prefix}: quote`,
        !testimonial.customerName.trim() && `${prefix}: customer name`,
        testimonial.rating && (testimonial.rating < 1 || testimonial.rating > 5) && `${prefix}: rating must be 1-5`,
      ].filter(Boolean);
    });

    return [...buildErrors, ...testimonialErrors];
  }

  function queueHomepageUpdate() {
    const errors = validateHomepageData();
    if (errors.length) {
      setHomepageStatus(`Fix before queueing: ${errors.join(', ')}.`);
      return;
    }

    const cleanBuilds = limitRecentBuilds(recentBuilds).map(build => ({
      ...build,
      id: slugifyTitle(build.id) || slugifyTitle(build.title),
      title: build.title.trim(),
      image: build.image.trim(),
      alt: build.alt.trim(),
      tags: build.tags.map(tag => tag.trim()).filter(Boolean),
      link: build.link?.trim() || undefined,
      caption: build.caption?.trim() || undefined,
      completedDate: build.completedDate?.trim() || undefined,
      vehiclePlatform: build.vehiclePlatform?.trim() || undefined,
      productSlug: build.productSlug?.trim() || undefined,
    }));

    const cleanTestimonials = renumber(orderedItems(testimonials)).map(testimonial => ({
      ...testimonial,
      id: slugifyTitle(testimonial.id) || slugifyTitle(testimonial.customerName),
      quote: testimonial.quote.trim(),
      customerName: testimonial.customerName.trim(),
      customerLocation: testimonial.customerLocation?.trim() || undefined,
      productName: testimonial.productName?.trim() || undefined,
      image: testimonial.image?.trim() || undefined,
      rating: testimonial.rating || undefined,
      source: testimonial.source?.trim() || undefined,
      approvedDate: testimonial.approvedDate?.trim() || undefined,
    }));

    setRecentBuilds(cleanBuilds);
    setTestimonials(cleanTestimonials);
    setPending(prev => [
      ...prev,
      makePendingChange(
        'src/data/homepage/recent-builds.json',
        `${JSON.stringify(cleanBuilds, null, 2)}\n`,
        'Update homepage recent builds'
      ),
      makePendingChange(
        'src/data/homepage/testimonials.json',
        `${JSON.stringify(cleanTestimonials, null, 2)}\n`,
        'Update homepage testimonials'
      ),
    ]);
    setHomepageStatus('Homepage updates queued. Open Pending to preview and deploy.');
    setActiveTab('pending');
  }

  async function deploy() {
    if (!pending.length || deployStatus === 'deploying') return;

    const escalated = pending.filter(c => c.judgeDecision === 'escalate');
    if (escalated.length) {
      const ok = window.confirm(
        `${escalated.length} change(s) were flagged for escalation by the safety judge:\n\n` +
        escalated.map(c => `• ${c.description}\n  Reason: ${c.escalation_reason ?? 'See risk flags'}`).join('\n\n') +
        '\n\nDeploy anyway?'
      );
      if (!ok) return;
    }

    setDeployStatus('deploying');
    try {
      const res = await adminFetch('/.netlify/functions/admin-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: pending }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { results: { path: string; ok: boolean; error?: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Deploy failed');
      const failed = data.results.filter(r => !r.ok);
      if (failed.length) {
        setDeployStatus('error');
        setDeployResults(`${failed.length} file(s) failed to commit.`);
      } else {
        setDeployStatus('done');
        setDeployResults(`${pending.length} change(s) deployed. Site rebuilds in ~30s.`);
        setPending([]);
      }
    } catch {
      setDeployStatus('error');
      setDeployResults('Deploy failed. Check your connection and try again.');
    }
  }

  const deployLabel = {
    idle: `Deploy ${pending.length} Change${pending.length !== 1 ? 's' : ''}`,
    deploying: 'Deploying…',
    done: '✓ Live in ~30s',
    error: 'Deploy Failed',
  }[deployStatus];

  const hasEscalated = pending.some(c => c.judgeDecision === 'escalate');
  const filteredProducts = products.filter((product) => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return true;
    return [product.title, product.slug, product.category, product.status]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const leadReminders = calculateAdminLeadReminders(enquiries);
  const browserReminderCandidates = [
    ...leadReminders.hotLeads,
    ...leadReminders.followUpsDueToday,
    ...leadReminders.overdueFollowUps,
  ];
  const leadReminderSections = [
    ['New unreplied enquiries', leadReminders.newUnreplied],
    ['Hot unreplied leads', leadReminders.hotLeads],
    ['Follow-ups due today', leadReminders.followUpsDueToday],
    ['Overdue follow-ups', leadReminders.overdueFollowUps],
    ['Quoted leads needing follow-up', leadReminders.quotedNeedsFollowUp],
    ['Manual leads missing follow-up date', leadReminders.manualMissingFollowUp],
  ] as const;
  const queueCounts = {
    active: enquiries.filter(enquiry => !isClosedEnquiry(enquiry)).length,
    needsResponse: enquiries.filter(enquiry => !isClosedEnquiry(enquiry) && !hasCustomerResponse(enquiry)).length,
    followUpDue: enquiries.filter(isFollowUpDue).length,
    hot: enquiries.filter(enquiry => enquiry.leadStatus?.priority === 'hot' && !isClosedEnquiry(enquiry)).length,
    all: enquiries.length,
  };
  const queuedEnquiries = enquiries
    .filter(enquiry => matchesQueueFilter(enquiry, enquiryQueueFilter))
    .sort((a, b) => {
      const rankDiff = queueRank(b) - queueRank(a);
      if (rankDiff) return rankDiff;
      return enquiryQueueDate(b).getTime() - enquiryQueueDate(a).getTime();
    });
  const activeOrderCounts = orders.reduce<Record<string, number>>((counts, order) => {
    if (!order.productSlug || ['delivered', 'cancelled'].includes(order.status)) return counts;
    counts[order.productSlug] = (counts[order.productSlug] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <>
    <div style={{ height: 'calc(100vh - 60px)', padding: '1rem', fontFamily: 'inherit' }}>
      <div style={{ minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ color: '#fff', fontWeight: 800 }}>Admin Tools</div>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <button
              onClick={() => setShowChatDrawer(true)}
              style={{ background: '#E8540A', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.65rem', cursor: 'pointer', fontWeight: 700 }}
            >
              Chat
            </button>
            <button
              onClick={() => setShowHelp(true)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.65rem', cursor: 'pointer', fontWeight: 700 }}
            >
              Help
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', borderBottom: '1px solid #333' }}>
          {(['dashboard', 'products', 'orders', 'media', 'homepage', 'enquiries', 'customers', 'leads', 'drafts', 'audit', 'knowledge', 'pending'] as PanelTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#E8540A' : 'transparent',
                color: activeTab === tab ? '#fff' : '#aaa',
                border: 'none',
                borderRight: tab !== 'pending' ? '1px solid #333' : 'none',
                padding: '0.75rem 0.25rem',
                cursor: 'pointer',
                fontWeight: 700,
                textTransform: 'capitalize',
                fontSize: '0.72rem',
              }}
            >
              {tab === 'pending' ? `Pending (${pending.length})` : tab}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <AdminSectionBoundary>
            <AdminDashboard pendingCount={pending.length} />
          </AdminSectionBoundary>
        )}

        {activeTab === 'products' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: editProduct || showNewProductForm ? 0 : '0.45rem' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>{editProduct ? 'Edit Product' : showNewProductForm ? 'Add Product Draft' : 'Product Manager'}</div>
                  {editProduct && <div style={{ color: '#888', fontSize: '0.74rem', marginTop: '0.18rem' }}>{editProduct.slug}</div>}
                </div>
                {editProduct && (
                  <button onClick={() => setEditProduct(null)} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.42rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                    Back
                  </button>
                )}
                {showNewProductForm && !editProduct && (
                  <button onClick={() => setShowNewProductForm(false)} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.42rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                    Back
                  </button>
                )}
                {!editProduct && !showNewProductForm && (
                  <button onClick={() => setShowNewProductForm(true)} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.46rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>
                    Add Product
                  </button>
                )}
              </div>
              {!editProduct && !showNewProductForm && (
                <input
                  value={productFilter}
                  onChange={e => setProductFilter(e.target.value)}
                  placeholder="Search products..."
                  style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.65rem', fontSize: '0.82rem', outline: 'none' }}
                />
              )}
            </div>
            {!editProduct && !showNewProductForm && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {productsLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading products...</p>}
                {!productsLoading && filteredProducts.map(product => (
                  <div key={product.slug} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)' }}>
                    <AdminProductThumb src={product.heroImage} title={product.title} />
                    <div style={{ padding: '0.65rem 0.7rem', minWidth: 0, display: 'grid', gap: '0.35rem', alignContent: 'center' }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.25 }}>{product.title}</div>
                      <div style={{ color: '#aaa', fontSize: '0.74rem' }}>
                        {product.price} · {product.category} · {product.status} · {product.galleryCount ?? 0} photos
                        {activeOrderCounts[product.slug] ? ` · ${activeOrderCounts[product.slug]} active order${activeOrderCounts[product.slug] === 1 ? '' : 's'}` : ''}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: product.onSale || product.status === 'on-sale' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '0.35rem' }}>
                        <button
                          onClick={() => startStructuredEdit(product)}
                          style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => startProductOrder(product, 'deposit_received')}
                          style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                        >
                          Order
                        </button>
                        {(product.onSale || product.status === 'on-sale') && (
                        <button
                          onClick={() => requestProductUpdate(product, `This one-off sale product has sold. Remove it from active product listings and make sure the old URL redirects to ${product.category === 'caravan' ? '/our-caravans/' : product.category === 'expedition' ? '/expedition/' : '/our-slide-on-campers/'}. Do not remove standard product-line models unless they are one-off sale stock.`)}
                          style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                        >
                          Sold
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!productsLoading && filteredProducts.length === 0 && (
                  <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>No matching products</p>
                )}
              </div>
            )}
            {editProduct && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.85rem', display: 'grid', gap: '0.6rem', alignContent: 'start', background: '#141414' }}>
                <input value={editProduct.title} onChange={e => setEditProduct(p => p && ({ ...p, title: e.target.value }))} placeholder="Title" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <input value={editProduct.price} onChange={e => setEditProduct(p => p && ({ ...p, price: e.target.value }))} placeholder="$72,000" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <select value={editProduct.status} onChange={e => setEditProduct(p => p && ({ ...p, status: e.target.value as ProductStatus }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="available">Available</option>
                    <option value="on-sale">On sale</option>
                    <option value="coming-soon">Coming soon</option>
                  </select>
                </div>
                <input value={editProduct.tagline} onChange={e => setEditProduct(p => p && ({ ...p, tagline: e.target.value }))} placeholder="Tagline" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: '0.55rem', alignItems: 'center', border: '1px solid #333', borderRadius: '6px', padding: '0.45rem', background: '#101010' }}>
                  <ProductImagePreview src={editProduct.heroImage} title={`${editProduct.title} hero`} />
                  <div style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
                    <div style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 700 }}>Hero Image</div>
                    <input value={editProduct.heroImage} onChange={e => setEditProduct(p => p && ({ ...p, heroImage: e.target.value }))} placeholder="Hero image URL or path" style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', color: '#ddd', fontSize: '0.78rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.onSale} onChange={e => setEditProduct(p => p && ({ ...p, onSale: e.target.checked }))} />
                    On sale
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.featured} onChange={e => setEditProduct(p => p && ({ ...p, featured: e.target.checked }))} />
                    Featured
                  </label>
                </div>
                <ProductGalleryEditor
                  heroImage={editProduct.heroImage}
                  galleryText={editProduct.galleryText}
                  onGalleryTextChange={galleryText => setEditProduct(p => p && ({ ...p, galleryText }))}
                  onHeroImageChange={heroImage => setEditProduct(p => p && ({ ...p, heroImage }))}
                />
                <ProductVideoEditor
                  videoUrl={editProduct.youtubeVideoUrl}
                  title={editProduct.youtubeVideoTitle}
                  description={editProduct.youtubeVideoDescription}
                  thumbnail={editProduct.youtubeVideoThumbnail}
                  uploadDate={editProduct.youtubeVideoUploadDate}
                  duration={editProduct.youtubeVideoDuration}
                  transcriptSummary={editProduct.youtubeVideoTranscriptSummary}
                  onChange={patch => setEditProduct(p => p && ({ ...p, ...patch }))}
                />
                <div style={{ display: 'grid', gap: '0.45rem', border: '1px solid #333', borderRadius: '6px', padding: '0.6rem', background: '#101010' }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Suitability Checker Data</div>
                    <div style={{ color: '#777', fontSize: '0.68rem', marginTop: '0.15rem', lineHeight: 1.35 }}>Use draft or target while lighter slide-on weights are being developed. Only confirmed data should later be used for public model matching.</div>
                  </div>
                  <select value={editProduct.suitabilityStatus} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityStatus: e.target.value as SuitabilityDataStatus }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="draft">Draft</option>
                    <option value="target">Target</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <input value={editProduct.suitabilityDryWeightKg} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityDryWeightKg: e.target.value }))} placeholder="Slide-on dry weight kg" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={editProduct.suitabilityEstimatedLoadedWeightKg} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityEstimatedLoadedWeightKg: e.target.value }))} placeholder="Estimated loaded weight kg" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={editProduct.suitabilityRequiredTrayLengthMm} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityRequiredTrayLengthMm: e.target.value }))} placeholder="Required tray length mm" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={editProduct.suitabilityRequiredTrayWidthMm} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityRequiredTrayWidthMm: e.target.value }))} placeholder="Required tray width mm" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={editProduct.suitabilityCentreOfGravityMm} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityCentreOfGravityMm: e.target.value }))} placeholder="Centre of gravity mm" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={editProduct.suitabilityAtmKg} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityAtmKg: e.target.value }))} placeholder="Caravan ATM kg" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={editProduct.suitabilityGtmKg} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityGtmKg: e.target.value }))} placeholder="Caravan GTM kg" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={editProduct.suitabilityTowBallWeightKg} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityTowBallWeightKg: e.target.value }))} placeholder="Loaded tow ball weight kg" inputMode="numeric" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  </div>
                  <textarea value={editProduct.suitabilityNotes} onChange={e => setEditProduct(p => p && ({ ...p, suitabilityNotes: e.target.value }))} placeholder="Suitability notes, assumptions, or why data is not confirmed yet" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 700 }}>Related Products</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', maxHeight: '96px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.45rem', background: '#101010' }}>
                    {products.filter(product => product.slug !== editProduct.slug).map(product => (
                      <label key={product.slug} style={{ color: '#ddd', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={editProduct.relatedSlugs.includes(product.slug)}
                          onChange={e => setEditProduct(p => {
                            if (!p) return p;
                            const relatedSlugs = e.target.checked
                              ? [...p.relatedSlugs, product.slug]
                              : p.relatedSlugs.filter(slug => slug !== product.slug);
                            return { ...p, relatedSlugs };
                          })}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <textarea value={editProduct.notes} onChange={e => setEditProduct(p => p && ({ ...p, notes: e.target.value }))} placeholder="Optional notes for copy/spec changes" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <button onClick={() => setEditProduct(null)} style={{ background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: '6px', padding: '0.55rem', cursor: 'pointer', fontWeight: 700 }}>
                    Cancel
                  </button>
                  <button onClick={queueStructuredEdit} disabled={loading} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.55rem', cursor: 'pointer', fontWeight: 700 }}>
                    Queue Edit
                  </button>
                </div>
              </div>
            )}
            {!editProduct && showNewProductForm && <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.85rem', display: 'grid', gap: '0.5rem', alignContent: 'start', background: '#141414' }}>
              <input value={newProduct.title} onChange={e => setNewProduct(p => ({ ...p, title: e.target.value }))} placeholder="Product title" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value as ProductCategory }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                  <option value="slide-on">Slide-on</option>
                  <option value="caravan">Caravan</option>
                  <option value="expedition">Expedition</option>
                </select>
                <input value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} placeholder="$72,000" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              </div>
              <input value={newProduct.tagline} onChange={e => setNewProduct(p => ({ ...p, tagline: e.target.value }))} placeholder="Short tagline" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              <textarea value={newProduct.keySpecs} onChange={e => setNewProduct(p => ({ ...p, keySpecs: e.target.value }))} placeholder="Key specs, one per line" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
              <textarea value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Product description" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
              <div style={{ display: 'grid', gap: '0.45rem', border: '1px solid #333', borderRadius: '6px', padding: '0.55rem', background: '#101010' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Product Photos</div>
                    <div style={{ color: '#777', fontSize: '0.68rem', marginTop: '0.15rem' }}>{newProduct.title.trim() ? `Uploads will be saved under ${slugifyTitle(newProduct.title)}` : 'Enter the product title first, then upload photos.'}</div>
                  </div>
                  <button type="button" onClick={() => newProductFileRef.current?.click()} disabled={mediaLoading || !newProduct.title.trim()} style={{ background: '#222', color: mediaLoading || !newProduct.title.trim() ? '#666' : '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.42rem 0.65rem', cursor: mediaLoading || !newProduct.title.trim() ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                    Upload Photos
                  </button>
                  <input ref={newProductFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={uploadNewProductMedia} />
                </div>
                {newProductMediaStatus && <div style={{ color: newProductMediaStatus.includes('failed') || newProductMediaStatus.includes('Enter') ? '#fb923c' : '#aaa', fontSize: '0.7rem' }}>{newProductMediaStatus}</div>}
                {newProduct.heroImage && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.5rem', alignItems: 'center' }}>
                    <ProductImagePreview src={newProduct.heroImage} title={`${newProduct.title} hero`} />
                    <div style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }}>
                      <div style={{ color: '#aaa', fontSize: '0.72rem', fontWeight: 700 }}>Hero Image</div>
                      <input value={newProduct.heroImage} onChange={e => setNewProduct(p => ({ ...p, heroImage: e.target.value }))} placeholder="Hero image URL or path" style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.74rem' }} />
                    </div>
                  </div>
                )}
                <ProductGalleryEditor
                  heroImage={newProduct.heroImage}
                  galleryText={newProduct.galleryText}
                  onGalleryTextChange={galleryText => setNewProduct(p => ({ ...p, galleryText }))}
                  onHeroImageChange={heroImage => setNewProduct(p => ({ ...p, heroImage }))}
                />
                <ProductVideoEditor
                  videoUrl={newProduct.youtubeVideoUrl}
                  title={newProduct.youtubeVideoTitle}
                  description={newProduct.youtubeVideoDescription}
                  thumbnail={newProduct.youtubeVideoThumbnail}
                  uploadDate={newProduct.youtubeVideoUploadDate}
                  duration={newProduct.youtubeVideoDuration}
                  transcriptSummary={newProduct.youtubeVideoTranscriptSummary}
                  onChange={patch => setNewProduct(p => ({ ...p, ...patch }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <button onClick={() => setShowNewProductForm(false)} style={{ background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: '6px', padding: '0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                  Cancel
                </button>
                <button onClick={queueNewProduct} disabled={loading} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                  Queue Product Draft
                </button>
              </div>
            </div>}
          </div>
        )}

        {activeTab === 'orders' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'grid', gap: '0.55rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>Orders & Stock</div>
                  <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.15rem' }}>Track ordered units from deposit through factory, shipping, local fitout, and handover.</div>
                </div>
                <button
                  onClick={() => setOrderForm(emptyOrderForm())}
                  style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.46rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  Add Order
                </button>
              </div>
              {ordersStatus && <div style={{ color: isOrderStatusError(ordersStatus) ? '#fb923c' : '#8f8', fontSize: '0.78rem' }}>{ordersStatus}</div>}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
              {ordersLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading orders...</p>}
              {!ordersLoading && orders.length === 0 && !orderForm && !isOrderStatusError(ordersStatus) && (
                <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>No orders yet. Create one from a product, an enquiry, or the Add Order button.</p>
              )}
              {ORDER_STATUS_GROUPS.map(status => {
                const group = orders.filter(order => order.status === status);
                if (!group.length) return null;
                return (
                  <section key={status} style={{ display: 'grid', gap: '0.45rem' }}>
                    <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ORDER_STATUS_LABELS[status]} ({group.length})</div>
                    {group.map(order => (
                      <div key={order.id} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', padding: '0.7rem', display: 'grid', gap: '0.45rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.65rem' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.25 }}>{order.customerName || 'Unnamed customer'}</div>
                            <div style={{ color: '#aaa', fontSize: '0.76rem', marginTop: '0.14rem' }}>{order.productTitle || 'Product not set'}</div>
                          </div>
                          <button
                            onClick={() => setOrderForm(orderFormFromRecord(order))}
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.38rem 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                          >
                            Edit
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', color: '#bbb', fontSize: '0.72rem' }}>
                          <span style={{ border: '1px solid #444', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>{ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}</span>
                          {order.depositPaid && <span style={{ border: '1px solid #1a3a1a', color: '#8f8', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>Deposit paid</span>}
                          {order.nextActionDate && <span style={{ border: '1px solid #63301f', color: '#fb923c', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>Next: {order.nextActionDate}</span>}
                          {order.expectedArrivalDate && <span style={{ border: '1px solid #444', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>ETA: {order.expectedArrivalDate}</span>}
                        </div>
                        <div style={{ color: '#777', fontSize: '0.72rem' }}>
                          {[order.customerPhone, order.customerEmail].filter(Boolean).join(' · ') || 'No contact details saved'}
                        </div>
                        {order.notes && <div style={{ color: '#ccc', fontSize: '0.76rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{order.notes}</div>}
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'grid', gap: '0.55rem' }}>
              <div style={{ color: '#fff', fontWeight: 700 }}>Media Manager</div>
              <select
                value={mediaTargetValue(mediaScope, mediaSlug)}
                onChange={e => {
                  const target = parseMediaTarget(e.target.value);
                  setMediaScope(target.scope);
                  setMediaSlug(target.slug);
                }}
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.82rem' }}
              >
                <optgroup label="Site pages">
                  {PAGE_MEDIA_TARGETS.map(page => (
                    <option key={page.slug} value={mediaTargetValue('pages', page.slug)}>{page.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Products">
                  {products.map(product => (
                    <option key={product.slug} value={mediaTargetValue('products', product.slug)}>{product.title}</option>
                  ))}
                </optgroup>
              </select>
              <input
                value={mediaAlt}
                onChange={e => setMediaAlt(e.target.value)}
                placeholder="Alt text for uploaded image"
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.82rem' }}
              />
              <button
                onClick={() => mediaFileRef.current?.click()}
                disabled={!mediaSlug || mediaLoading}
                style={{ background: mediaSlug ? '#E8540A' : '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem', cursor: mediaSlug ? 'pointer' : 'not-allowed', fontWeight: 700 }}
              >
                Upload Image
              </button>
              <input ref={mediaFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={uploadMedia} />
              {mediaStatus && <p style={{ margin: 0, color: isAdminWarningStatus(mediaStatus) ? '#f87' : '#8f8', fontSize: '0.78rem' }}>{mediaStatus}</p>}
              <p style={{ margin: 0, color: '#888', fontSize: '0.76rem', lineHeight: 1.35 }}>
                Use Site pages for About, Homepage, and category-page images. Use Products when an image should become a product hero or gallery image.
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.65rem', alignContent: 'start' }}>
              {mediaLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading media...</p>}
              {!mediaLoading && mediaFiles.length === 0 && (
                <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>No uploaded media for this {mediaScope === 'pages' ? 'page' : 'product'} yet</p>
              )}
              {!mediaLoading && mediaFiles.map(file => (
                <div key={file.key} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', overflow: 'hidden' }}>
                  <img src={file.optimizedUrl} alt={file.metadata.alt ?? ''} style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '0.65rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ color: '#ddd', fontSize: '0.76rem', overflowWrap: 'anywhere' }}>{file.metadata.filename ?? file.key.split('/').pop()}</div>
                    {file.metadata.alt && <div style={{ color: '#888', fontSize: '0.72rem' }}>{file.metadata.alt}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: mediaScope === 'products' ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: '0.35rem' }}>
                      {mediaScope === 'products' && <>
                        <button onClick={() => applyMediaToProduct(file.url, 'hero')} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                          Hero
                        </button>
                        <button onClick={() => applyMediaToProduct(file.url, 'gallery')} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                          Gallery
                        </button>
                      </>}
                      <button onClick={() => {
                        void navigator.clipboard.writeText(file.url);
                        setMediaStatus('Image URL copied.');
                      }} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                        Copy URL
                      </button>
                      <button onClick={() => deleteMedia(file.key)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'homepage' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'grid', gap: '0.45rem' }}>
              <div style={{ color: '#fff', fontWeight: 700 }}>Homepage Sections</div>
              <p style={{ color: '#888', fontSize: '0.78rem', lineHeight: 1.4, margin: 0 }}>
                Edit the 3 homepage recent builds and customer testimonials. Adding a new recent build replaces the oldest one automatically.
              </p>
              {homepageStatus && (
                <p style={{ color: homepageStatus.startsWith('Fix') ? '#f87' : '#8f8', fontSize: '0.78rem', lineHeight: 1.35, margin: 0 }}>{homepageStatus}</p>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
              <section style={{ display: 'grid', gap: '0.55rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '0.9rem' }}>Recent Builds ({recentBuilds.length}/{MAX_RECENT_BUILDS})</h3>
                  <button onClick={addRecentBuild} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.38rem 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                    Add / Replace Oldest
                  </button>
                </div>
                {orderedItems(recentBuilds).map((build, index) => (
                  <div key={build.id} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', padding: '0.7rem', display: 'grid', gap: '0.45rem' }}>
                    {build.image && (
                      <div style={{ width: '180px', maxWidth: '100%', height: '120px', background: '#0b0b0b', border: '1px solid #303030', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src={adminImageUrl(build.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.35rem', alignItems: 'center' }}>
                      <input value={build.title} onChange={e => updateRecentBuild(build.id, { title: e.target.value })} placeholder="Build title" style={{ minWidth: 0, background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <button onClick={() => moveRecentBuild(build.id, -1)} disabled={index === 0} style={{ background: '#222', color: index === 0 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                      <button onClick={() => moveRecentBuild(build.id, 1)} disabled={index === recentBuilds.length - 1} style={{ background: '#222', color: index === recentBuilds.length - 1 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === recentBuilds.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                      <button onClick={() => removeRecentBuild(build.id)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer' }}>×</button>
                    </div>
                    <select
                      value={build.productSlug ?? ''}
                      onChange={e => applyProductToRecentBuild(build.id, e.target.value)}
                      style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }}
                    >
                      <option value="">Use product hero image...</option>
                      {products.map(product => (
                        <option key={product.slug} value={product.slug}>{product.title}</option>
                      ))}
                    </select>
                    <input value={build.image} onChange={e => updateRecentBuild(build.id, { image: e.target.value })} placeholder="Image path" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    <input value={build.alt} onChange={e => updateRecentBuild(build.id, { alt: e.target.value })} placeholder="Image alt text" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    <input value={build.link ?? ''} onChange={e => updateRecentBuild(build.id, { link: e.target.value })} placeholder="/product-link/" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    <textarea
                      value={build.tags.join('\n')}
                      onChange={e => updateRecentBuild(build.id, { tags: e.target.value.split('\n') })}
                      placeholder="Tags, one per line"
                      rows={3}
                      style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.76rem' }}>
                      <input type="checkbox" checked={build.isVisible} onChange={e => updateRecentBuild(build.id, { isVisible: e.target.checked })} />
                      Show on homepage
                    </label>
                  </div>
                ))}
              </section>

              <section style={{ display: 'grid', gap: '0.55rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '0.9rem' }}>Testimonials</h3>
                  <button onClick={addTestimonial} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.38rem 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                    Add
                  </button>
                </div>
                {orderedItems(testimonials).map((testimonial, index) => (
                  <div key={testimonial.id} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', padding: '0.7rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.35rem', alignItems: 'center' }}>
                      <input value={testimonial.customerName} onChange={e => updateTestimonial(testimonial.id, { customerName: e.target.value })} placeholder="Customer display name" style={{ minWidth: 0, background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <button onClick={() => moveTestimonial(testimonial.id, -1)} disabled={index === 0} style={{ background: '#222', color: index === 0 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                      <button onClick={() => moveTestimonial(testimonial.id, 1)} disabled={index === testimonials.length - 1} style={{ background: '#222', color: index === testimonials.length - 1 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === testimonials.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                      <button onClick={() => removeTestimonial(testimonial.id)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer' }}>×</button>
                    </div>
                    <textarea
                      value={testimonial.quote}
                      onChange={e => updateTestimonial(testimonial.id, { quote: e.target.value })}
                      placeholder="Exact customer quote"
                      rows={4}
                      style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input value={testimonial.productName ?? ''} onChange={e => updateTestimonial(testimonial.id, { productName: e.target.value })} placeholder="Product/build" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <input value={testimonial.customerLocation ?? ''} onChange={e => updateTestimonial(testimonial.id, { customerLocation: e.target.value })} placeholder="Location" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: '0.4rem' }}>
                      <input value={testimonial.source ?? ''} onChange={e => updateTestimonial(testimonial.id, { source: e.target.value })} placeholder="Source or approval note" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <input type="number" min={1} max={5} value={testimonial.rating ?? ''} onChange={e => updateTestimonial(testimonial.id, { rating: e.target.value ? Number(e.target.value) : undefined })} placeholder="Rating" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.76rem' }}>
                      <input type="checkbox" checked={testimonial.isVisible} onChange={e => updateTestimonial(testimonial.id, { isVisible: e.target.checked })} />
                      Show on homepage
                    </label>
                  </div>
                ))}
              </section>
            </div>
            <div style={{ padding: '0.75rem', borderTop: '1px solid #333' }}>
              <button onClick={queueHomepageUpdate} style={{ width: '100%', background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>
                Queue Homepage Updates
              </button>
            </div>
          </div>
        )}

        {activeTab === 'enquiries' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700 }}>Recent Enquiries</div>
                <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>Stored contact form submissions</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowManualEnquiryForm(prev => !prev);
                    setManualEnquiryStatus('');
                  }}
                  style={{ background: '#E8540A', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  Add Manual Enquiry
                </button>
                <button
                  onClick={loadEnquiries}
                  disabled={enquiriesLoading}
                  style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  Refresh
                </button>
              </div>
            </div>
            {contactConfig && (
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #333', background: contactConfig.ready ? '#102416' : '#2a1410', color: contactConfig.ready ? '#8f8' : '#fb923c', fontSize: '0.78rem', lineHeight: 1.45 }}>
                {contactConfig.ready
                  ? `Email notifications are configured for ${contactConfig.toEmail}.`
                  : `Email notifications need setup. Missing: ${contactConfig.missing.join(', ')}.`}
              </div>
            )}
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #333', background: '#151515', display: 'grid', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.55rem', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>Needs Attention</div>
                  <div style={{ color: leadReminders.total ? '#fb923c' : '#8f8', fontSize: '0.74rem', marginTop: '0.15rem' }}>
                    {leadReminders.total ? `${leadReminders.total} reminder${leadReminders.total === 1 ? '' : 's'} across recent enquiries.` : 'No recent lead reminders.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={enableBrowserLeadReminders}
                  disabled={browserRemindersEnabled}
                  style={{ background: browserRemindersEnabled ? '#102416' : '#222', border: browserRemindersEnabled ? '1px solid #1a3a1a' : '1px solid #444', color: browserRemindersEnabled ? '#8f8' : '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: browserRemindersEnabled ? 'default' : 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                >
                  {browserRemindersEnabled ? 'Browser Alerts On' : 'Enable Browser Alerts'}
                </button>
              </div>
              {browserReminderStatus && (
                <div style={{ color: '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>
                  {browserReminderStatus}{browserReminderCandidates.length ? ` High-value reminders ready: ${browserReminderCandidates.length}.` : ''}
                </div>
              )}
              {leadReminders.total > 0 && (
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {leadReminderSections.filter(([, items]) => items.length > 0).map(([title, items]) => (
                    <div key={title} style={{ display: 'grid', gap: '0.35rem' }}>
                      <div style={{ color: '#ddd', fontSize: '0.74rem', fontWeight: 700 }}>{title}</div>
                      {items.slice(0, 4).map(reminder => (
                        <div key={reminder.id} style={{ background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '0.5rem', display: 'grid', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{reminder.customerName}</div>
                            <button
                              type="button"
                              onClick={() => openEnquiry(reminder.enquiryId)}
                              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.24rem 0.4rem', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}
                            >
                              Open
                            </button>
                          </div>
                          <div style={{ color: '#aaa', fontSize: '0.72rem', lineHeight: 1.4 }}>
                            {reminder.productInterest} · {reminder.reason}
                          </div>
                          <div style={{ color: '#777', fontSize: '0.68rem', lineHeight: 1.4 }}>
                            {reminder.submittedAt ? new Date(reminder.submittedAt).toLocaleDateString() : 'No enquiry date'} · status: {reminder.status} · priority: {reminder.priority}{reminder.nextFollowUpDate ? ` · follow-up: ${reminder.nextFollowUpDate}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {showManualEnquiryForm && (
              <div style={{ borderBottom: '1px solid #333', background: '#151515', padding: '0.85rem 1rem', display: 'grid', gap: '0.65rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>Add manual enquiry</div>
                    <div style={{ color: '#888', fontSize: '0.74rem', marginTop: '0.15rem' }}>No email is sent. The record is saved into Recent Enquiries.</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setManualMode('manual_email')}
                      style={{ background: manualEnquiryMode === 'manual_email' ? '#E8540A' : '#222', border: manualEnquiryMode === 'manual_email' ? 'none' : '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                    >
                      Paste Email Enquiry
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualMode('phone_call')}
                      style={{ background: manualEnquiryMode === 'phone_call' ? '#E8540A' : '#222', border: manualEnquiryMode === 'phone_call' ? 'none' : '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                    >
                      Add Phone Conversation
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem' }}>
                  {manualEnquiryMode === 'phone_call' && (
                    <select
                      value={manualEnquiry.source_type}
                      onChange={e => updateManualEnquiry({ source_type: e.target.value as ManualEnquiryForm['source_type'] })}
                      style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                    >
                      <option value="phone_call">Phone call</option>
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="referral">Referral</option>
                      <option value="walk_in">Walk-in</option>
                      <option value="other">Other</option>
                    </select>
                  )}
                  <input value={manualEnquiry.customer_name} onChange={e => updateManualEnquiry({ customer_name: e.target.value })} placeholder="Customer name" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                  <input value={manualEnquiry.customer_email} onChange={e => updateManualEnquiry({ customer_email: e.target.value })} placeholder="Customer email" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                  <input value={manualEnquiry.customer_phone} onChange={e => updateManualEnquiry({ customer_phone: e.target.value })} placeholder="Customer phone" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                  <input value={manualEnquiry.product_interest} onChange={e => updateManualEnquiry({ product_interest: e.target.value })} placeholder="Product interest" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                  <input value={manualEnquiry.enquiry_intent} onChange={e => updateManualEnquiry({ enquiry_intent: e.target.value })} placeholder="Intent, e.g. quote" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                  <input type="datetime-local" value={manualEnquiry.received_at} onChange={e => updateManualEnquiry({ received_at: e.target.value })} style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                </div>
                {manualEnquiryMode === 'manual_email' ? (
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    <input value={manualEnquiry.email_subject} onChange={e => updateManualEnquiry({ email_subject: e.target.value })} placeholder="Email subject" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    <textarea
                      value={manualEnquiry.email_body}
                      onChange={e => updateManualEnquiry({ email_body: e.target.value })}
                      placeholder="Paste the full email enquiry"
                      rows={7}
                      style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', lineHeight: 1.45 }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    <textarea value={manualEnquiry.conversation_summary} onChange={e => updateManualEnquiry({ conversation_summary: e.target.value })} placeholder="Conversation summary" rows={4} style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', lineHeight: 1.45 }} />
                    <textarea value={manualEnquiry.main_questions} onChange={e => updateManualEnquiry({ main_questions: e.target.value })} placeholder="Main questions" rows={2} style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', lineHeight: 1.45 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem' }}>
                      <input value={manualEnquiry.vehicle_details} onChange={e => updateManualEnquiry({ vehicle_details: e.target.value })} placeholder="Vehicle details" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <input value={manualEnquiry.budget_notes} onChange={e => updateManualEnquiry({ budget_notes: e.target.value })} placeholder="Budget notes" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <input value={manualEnquiry.timeline} onChange={e => updateManualEnquiry({ timeline: e.target.value })} placeholder="Timeline" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem' }}>
                  <select value={manualEnquiry.priority} onChange={e => updateManualEnquiry({ priority: e.target.value as ManualEnquiryForm['priority'] })} style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}>
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="info-only">Info only</option>
                    <option value="spam-low-quality">Spam / low quality</option>
                  </select>
                  <input type="date" value={manualEnquiry.nextFollowUpDate} onChange={e => updateManualEnquiry({ nextFollowUpDate: e.target.value })} style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                  <input value={manualEnquiry.source_note} onChange={e => updateManualEnquiry({ source_note: e.target.value })} placeholder="Source note" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }} />
                </div>
                <textarea value={manualEnquiry.notes} onChange={e => updateManualEnquiry({ notes: e.target.value })} placeholder="Internal notes" rows={2} style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', lineHeight: 1.45 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.45rem', alignItems: 'center' }}>
                  <div style={{ color: manualEnquiryStatus.includes('saved') ? '#8f8' : '#fb923c', fontSize: '0.76rem' }}>{manualEnquiryStatus}</div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualEnquiryForm(false);
                        setManualEnquiryStatus('');
                      }}
                      style={{ background: '#222', border: '1px solid #444', color: '#aaa', borderRadius: '6px', padding: '0.48rem 0.65rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveManualEnquiry}
                      disabled={manualEnquirySaving}
                      style={{ background: '#E8540A', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.48rem 0.65rem', cursor: manualEnquirySaving ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                    >
                      {manualEnquirySaving ? 'Saving...' : 'Save Manual Enquiry'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.65rem', alignContent: 'start' }}>
              {enquiriesStatus && <p style={{ color: '#fb923c', fontSize: '0.85rem', lineHeight: 1.45 }}>{enquiriesStatus}</p>}
              {enquiriesLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading enquiries...</p>}
              {!enquiriesLoading && enquiries.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {[
                    ['active', `Active ${queueCounts.active}`],
                    ['needs-response', `Needs response ${queueCounts.needsResponse}`],
                    ['follow-up-due', `Follow-up due ${queueCounts.followUpDue}`],
                    ['hot', `Hot ${queueCounts.hot}`],
                    ['all', `All ${queueCounts.all}`],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEnquiryQueueFilter(value as EnquiryQueueFilter)}
                      style={{ background: enquiryQueueFilter === value ? '#E8540A' : '#222', border: enquiryQueueFilter === value ? 'none' : '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.38rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {!enquiriesLoading && enquiries.length === 0 && (
                <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>
                  No stored enquiries yet. Email notifications may still have been sent.
                </p>
              )}
              {!enquiriesLoading && enquiries.length > 0 && queuedEnquiries.length === 0 && (
                <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>
                  No enquiries match this queue filter.
                </p>
              )}
              {!enquiriesLoading && queuedEnquiries.map(enquiry => (
                <div
                  key={enquiry.id}
                  ref={node => {
                    enquiryRefs.current[enquiry.id] = node;
                  }}
                  style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', padding: '0.75rem', display: 'grid', gap: '0.4rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>{enquiry.name || 'Unnamed enquiry'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', justifyContent: 'flex-end' }}>
                      <div style={{ color: responseSla(enquiry).color, border: `1px solid ${responseSla(enquiry).border}`, borderRadius: '999px', padding: '0.18rem 0.45rem', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                        {responseSla(enquiry).label}
                      </div>
                      <div style={{ color: enquiry.manual_entry ? '#fb923c' : '#aaa', border: enquiry.manual_entry ? '1px solid #63301f' : '1px solid #444', borderRadius: '999px', padding: '0.18rem 0.45rem', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                        {SOURCE_LABELS[enquiry.source_type ?? 'website_form']}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#aaa', fontSize: '0.76rem' }}>
                    {new Date(enquiry.received_at ?? enquiry.submittedAt).toLocaleString()} · {enquiry.product_interest || 'General enquiry'}
                  </div>
                  <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.78rem' }}>
                    {enquiry.phone && <a href={`tel:${enquiry.phone}`} style={{ color: '#E8540A', textDecoration: 'none' }}>{enquiry.phone}</a>}
                    {enquiry.email && <a href={`mailto:${enquiry.email}`} style={{ color: '#E8540A', textDecoration: 'none' }}>{enquiry.email}</a>}
                  </div>
                  {enquiry.email_subject && (
                    <div style={{ color: '#ccc', fontSize: '0.76rem' }}>Subject: {enquiry.email_subject}</div>
                  )}
                  {(enquiry.callback_date || enquiry.callback_time) && (
                    <div style={{ color: '#ccc', fontSize: '0.76rem' }}>
                      Callback: {[enquiry.callback_date, enquiry.callback_time].filter(Boolean).join(' ')}
                    </div>
                  )}
                  <div style={{ color: '#ddd', fontSize: '0.78rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{enquiry.message}</div>
                  {(enquiry.main_questions || enquiry.vehicle_details || enquiry.budget_notes || enquiry.timeline || enquiry.source_note) && (
                    <div style={{ color: '#aaa', fontSize: '0.74rem', lineHeight: 1.45, display: 'grid', gap: '0.1rem' }}>
                      {enquiry.main_questions && <div>Main questions: {enquiry.main_questions}</div>}
                      {enquiry.vehicle_details && <div>Vehicle: {enquiry.vehicle_details}</div>}
                      {enquiry.budget_notes && <div>Budget: {enquiry.budget_notes}</div>}
                      {enquiry.timeline && <div>Timeline: {enquiry.timeline}</div>}
                      {enquiry.source_note && <div>Source note: {enquiry.source_note}</div>}
                    </div>
                  )}
                  {enquiry.referral_source_self_reported && (
                    <div style={{ color: '#777', fontSize: '0.72rem' }}>
                      Heard about us: {enquiry.referral_source_self_reported}{enquiry.referral_source_other ? ` - ${enquiry.referral_source_other}` : ''}
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid #303030', marginTop: '0.25rem', paddingTop: '0.55rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <select
                        value={enquiry.leadStatus?.status ?? 'new'}
                        onChange={e => saveLeadStatus(enquiry, { status: e.target.value as NonNullable<EnquiryRecord['leadStatus']>['status'] })}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="replied">Replied</option>
                        <option value="called">Called</option>
                        <option value="qualified">Qualified</option>
                        <option value="quoted">Quoted</option>
                        <option value="follow-up-scheduled">Follow-up scheduled</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                        <option value="spam">Spam</option>
                      </select>
                      <input
                        type="date"
                        value={enquiry.leadStatus?.nextFollowUpDate ?? enquiry.callback_date ?? ''}
                        onChange={e => saveLeadStatus(enquiry, { nextFollowUpDate: e.target.value })}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <select
                        value={enquiry.leadStatus?.priority ?? 'warm'}
                        onChange={e => saveLeadStatus(enquiry, { priority: e.target.value as NonNullable<EnquiryRecord['leadStatus']>['priority'] })}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                      >
                        <option value="hot">Hot</option>
                        <option value="warm">Warm</option>
                        <option value="info-only">Info only</option>
                        <option value="spam-low-quality">Spam / low quality</option>
                      </select>
                      <select
                        value={enquiry.leadStatus?.outcomeReason ?? ''}
                        onChange={e => saveLeadStatus(enquiry, { outcomeReason: e.target.value as NonNullable<EnquiryRecord['leadStatus']>['outcomeReason'] })}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                      >
                        <option value="">Outcome reason</option>
                        <option value="too-expensive">Too expensive</option>
                        <option value="wrong-vehicle">Wrong vehicle</option>
                        <option value="no-payload">No payload</option>
                        <option value="bought-elsewhere">Bought elsewhere</option>
                        <option value="just-researching">Just researching</option>
                        <option value="no-response">No response</option>
                        <option value="timing-not-right">Timing not right</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <textarea
                      value={enquiry.leadStatus?.notes ?? ''}
                      onChange={e => setEnquiries(prev => prev.map(item => item.id === enquiry.id ? {
                        ...item,
                        leadStatus: {
                          enquiryId: enquiry.id,
                          status: item.leadStatus?.status ?? 'new',
                          priority: item.leadStatus?.priority ?? 'warm',
                          nextFollowUpDate: item.leadStatus?.nextFollowUpDate ?? item.callback_date ?? '',
                          outcomeReason: item.leadStatus?.outcomeReason ?? '',
                          firstResponseAt: item.leadStatus?.firstResponseAt ?? '',
                          lastContactedAt: item.leadStatus?.lastContactedAt ?? '',
                          updatedAt: item.leadStatus?.updatedAt ?? item.submittedAt,
                          notes: e.target.value,
                        },
                      } : item))}
                      onBlur={e => saveLeadStatus(enquiry, { notes: e.target.value })}
                      placeholder="Lead notes"
                      rows={2}
                      disabled={leadSaving === enquiry.id}
                      style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                    />
                    {leadSaving === enquiry.id && (
                      <div style={{ color: '#777', fontSize: '0.72rem' }}>Saving lead status...</div>
                    )}
                    <div style={{ borderTop: '1px solid #303030', paddingTop: '0.5rem', display: 'grid', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => classifyEnquiry(enquiry)}
                          disabled={classificationSaving === enquiry.id}
                          style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: classificationSaving === enquiry.id ? 'wait' : 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                        >
                          {enquiry.leadStatus?.aiClassification ? 'Reclassify Lead' : 'Classify Lead'}
                        </button>
                        {enquiry.leadStatus?.aiClassification?.suggestedPriority && (
                          <button
                            type="button"
                            onClick={() => applyClassificationPriority(enquiry)}
                            disabled={leadSaving === enquiry.id}
                            style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: leadSaving === enquiry.id ? 'wait' : 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                          >
                            Apply Suggested Priority
                          </button>
                        )}
                      </div>
                      {enquiry.leadStatus?.aiClassification && (
                        <div style={{ background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '0.5rem', color: '#ccc', fontSize: '0.72rem', lineHeight: 1.45, display: 'grid', gap: '0.12rem' }}>
                          <div style={{ color: '#fff', fontWeight: 700 }}>AI classification</div>
                          <div>Priority: {enquiry.leadStatus.aiClassification.suggestedPriority ?? 'Not sure'} · urgency: {enquiry.leadStatus.aiClassification.urgency ?? 'Not sure'} · intent: {enquiry.leadStatus.aiClassification.intent ?? 'Not sure'}</div>
                          {enquiry.leadStatus.aiClassification.reason && <div>Reason: {enquiry.leadStatus.aiClassification.reason}</div>}
                          {enquiry.leadStatus.aiClassification.nextBestAction && <div>Next action: {enquiry.leadStatus.aiClassification.nextBestAction}</div>}
                          {Boolean(enquiry.leadStatus.aiClassification.missingDetails?.length) && <div>Missing: {enquiry.leadStatus.aiClassification.missingDetails?.join(', ')}</div>}
                        </div>
                      )}
                      {classificationStatuses[enquiry.id] && (
                        <div style={{ color: '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>{classificationStatuses[enquiry.id]}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #303030', marginTop: '0.25rem', paddingTop: '0.55rem', display: 'grid', gap: '0.45rem' }}>
                    {(enquiry.leadStatus?.firstResponseAt || enquiry.leadStatus?.lastContactedAt) && (
                      <div style={{ color: '#777', fontSize: '0.72rem', lineHeight: 1.45 }}>
                        {enquiry.leadStatus?.firstResponseAt && `First response: ${new Date(enquiry.leadStatus.firstResponseAt).toLocaleString()}`}
                        {enquiry.leadStatus?.firstResponseAt && enquiry.leadStatus?.lastContactedAt && ' · '}
                        {enquiry.leadStatus?.lastContactedAt && `Last contacted: ${new Date(enquiry.leadStatus.lastContactedAt).toLocaleString()}`}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <button
                        onClick={() => startEnquiryOrder(enquiry)}
                        style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                      >
                        Convert to Order
                      </button>
                      <button
                        onClick={() => generateEnquiryResponse(enquiry)}
                        disabled={responseGenerating === enquiry.id}
                        style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: responseGenerating === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                      >
                        {responseDrafts[enquiry.id] ? 'Regenerate' : 'Generate Response'}
                      </button>
                      {responseDrafts[enquiry.id] && (
                        <button
                          onClick={() => copyEnquiryResponse(enquiry)}
                          disabled={aiActionSaving === enquiry.id}
                          style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: aiActionSaving === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                        >
                          Copy Response
                        </button>
                      )}
                      {responseDrafts[enquiry.id] && (
                        <>
                          <button
                            onClick={() => updateResponseActionState(enquiry, 'approved')}
                            disabled={aiActionSaving === enquiry.id}
                            style={{ background: '#12331f', border: '1px solid #256d3d', color: '#bbf7d0', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: aiActionSaving === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                          >
                            Approve Draft
                          </button>
                          <button
                            onClick={() => updateResponseActionState(enquiry, 'rejected')}
                            disabled={aiActionSaving === enquiry.id}
                            style={{ background: '#331515', border: '1px solid #7f1d1d', color: '#fecaca', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: aiActionSaving === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                          >
                            Reject Draft
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => markEnquiryReplied(enquiry)}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: leadSaving === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                      >
                        Mark as Replied
                      </button>
                      <button
                        onClick={() => toggleLeadDetail(enquiry)}
                        style={{ background: openLeadDetailId === enquiry.id ? '#E8540A' : '#222', border: openLeadDetailId === enquiry.id ? 'none' : '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                      >
                        {openLeadDetailId === enquiry.id ? 'Hide Details' : 'Details'}
                      </button>
                      <button
                        onClick={() => syncEnquiryToCopilotRecords(enquiry)}
                        disabled={recordSyncSaving === enquiry.id}
                        style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: recordSyncSaving === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                      >
                        {recordSyncSaving === enquiry.id ? 'Saving...' : 'Save Copilot Records'}
                      </button>
                    </div>
                    {responseDrafts[enquiry.id] && (
                      <textarea
                        value={responseDrafts[enquiry.id]}
                        onChange={e => setResponseDrafts(prev => ({ ...prev, [enquiry.id]: e.target.value }))}
                        onBlur={() => updateResponseActionState(enquiry, 'edited')}
                        rows={8}
                        style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', lineHeight: 1.45 }}
                      />
                    )}
                    {responseGrounding[enquiry.id] && (
                      <div style={{ background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '0.55rem', display: 'grid', gap: '0.35rem', color: '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>
                        <div style={{ color: '#fff', fontWeight: 700 }}>Draft grounding</div>
                        {responseGrounding[enquiry.id].sources.length > 0 && (
                          <div style={{ display: 'grid', gap: '0.4rem' }}>
                            {responseGrounding[enquiry.id].sources.map((source, sourceIndex) => (
                              <div key={`${source.title}-${sourceIndex}`} style={{ borderTop: sourceIndex ? '1px solid #252525' : 'none', paddingTop: sourceIndex ? '0.35rem' : 0 }}>
                                <div>
                                  Source: {source.url ? (
                                    <a href={source.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{source.title}</a>
                                  ) : (
                                    <span style={{ color: '#ddd' }}>{source.title}</span>
                                  )}
                                  {typeof source.confidence === 'number' && <span> · {source.confidence}% match</span>}
                                </div>
                                {Boolean(source.facts?.length) && (
                                  <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#aaa' }}>
                                    {source.facts?.slice(0, 4).map((fact, factIndex) => <li key={factIndex}>{fact}</li>)}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {responseGrounding[enquiry.id].missingFacts.length > 0 && (
                          <div style={{ color: '#fb923c' }}>
                            Check before sending: {responseGrounding[enquiry.id].missingFacts.join(' ')}
                          </div>
                        )}
                        {responseGrounding[enquiry.id].warnings.length > 0 && (
                          <div style={{ color: '#fb923c' }}>
                            Guardrails: {responseGrounding[enquiry.id].warnings.join(' ')}
                          </div>
                        )}
                        {Boolean(responseGrounding[enquiry.id].outputWarnings?.length) && (
                          <div style={{ color: '#f87171' }}>
                            Draft validation: {responseGrounding[enquiry.id].outputWarnings?.join(' ')}
                          </div>
                        )}
                      </div>
                    )}
                    {responseStatuses[enquiry.id] && (
                      <div style={{ color: '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>{responseStatuses[enquiry.id]}</div>
                    )}
                    {openLeadDetailId === enquiry.id && (() => {
                      const detail = leadDetails[enquiry.id] ?? { tasks: [], timeline: [] };
                      const taskDraft = taskDrafts[enquiry.id] ?? { title: '', dueDate: '', priority: 'medium' as const, notes: '' };
                      const openTasks = detail.tasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled');
                      return (
                        <div style={{ borderTop: '1px solid #303030', paddingTop: '0.6rem', display: 'grid', gap: '0.6rem' }}>
                          <div style={{ display: 'grid', gap: '0.45rem', background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '0.6rem' }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Create follow-up task</div>
                            <input
                              value={taskDraft.title}
                              onChange={e => setTaskDrafts(prev => ({ ...prev, [enquiry.id]: { ...taskDraft, title: e.target.value } }))}
                              placeholder="Task title"
                              style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.4rem' }}>
                              <input
                                type="date"
                                value={taskDraft.dueDate}
                                onChange={e => setTaskDrafts(prev => ({ ...prev, [enquiry.id]: { ...taskDraft, dueDate: e.target.value } }))}
                                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                              />
                              <select
                                value={taskDraft.priority}
                                onChange={e => setTaskDrafts(prev => ({ ...prev, [enquiry.id]: { ...taskDraft, priority: e.target.value as 'high' | 'medium' | 'low' } }))}
                                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => createLeadTask(enquiry)}
                                disabled={taskSaving === enquiry.id}
                                style={{ background: '#E8540A', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: taskSaving === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem', whiteSpace: 'nowrap' }}
                              >
                                {taskSaving === enquiry.id ? 'Saving...' : 'Add Task'}
                              </button>
                            </div>
                            <textarea
                              value={taskDraft.notes}
                              onChange={e => setTaskDrafts(prev => ({ ...prev, [enquiry.id]: { ...taskDraft, notes: e.target.value } }))}
                              placeholder="Optional task notes"
                              rows={2}
                              style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                            />
                          </div>

                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Open tasks</div>
                            {openTasks.length === 0 ? (
                              <div style={{ color: '#777', fontSize: '0.74rem' }}>No open tasks for this lead.</div>
                            ) : (
                              openTasks.map(task => (
                                <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center', background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '0.5rem' }}>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.76rem' }}>{task.title}</div>
                                    <div style={{ color: '#888', fontSize: '0.68rem', marginTop: '0.1rem' }}>{task.dueDate || 'No due date'} · {task.priority || 'medium'}</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => completeLeadTask(enquiry.id, task.id)}
                                    disabled={taskSaving === task.id}
                                    style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.38rem 0.5rem', cursor: taskSaving === task.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.72rem' }}
                                  >
                                    Done
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Lead note</div>
                            <textarea
                              value={noteDrafts[enquiry.id] ?? ''}
                              onChange={e => setNoteDrafts(prev => ({ ...prev, [enquiry.id]: e.target.value }))}
                              placeholder="Log a call note, decision, or customer context"
                              rows={2}
                              style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                            />
                            <button
                              type="button"
                              onClick={() => addLeadNote(enquiry)}
                              style={{ justifySelf: 'start', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}
                            >
                              Add Timeline Note
                            </button>
                          </div>

                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Timeline</div>
                            {detail.timeline.length === 0 ? (
                              <div style={{ color: '#777', fontSize: '0.74rem' }}>No timeline events for this lead yet.</div>
                            ) : (
                              detail.timeline.map(event => (
                                <div key={event.id} style={{ borderLeft: '2px solid #E8540A', paddingLeft: '0.55rem', display: 'grid', gap: '0.12rem' }}>
                                  <div style={{ color: '#fff', fontSize: '0.74rem', fontWeight: 700 }}>{event.summary}</div>
                                  <div style={{ color: '#777', fontSize: '0.66rem' }}>
                                    {event.createdAt ? new Date(event.createdAt).toLocaleString() : ''} · {event.eventType.replace(/_/g, ' ')}
                                    {event.aiGenerated ? ' · AI generated' : ''}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {leadDetailStatus[enquiry.id] && (
                            <div style={{ color: isAdminWarningStatus(leadDetailStatus[enquiry.id]) ? '#fb923c' : '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>{leadDetailStatus[enquiry.id]}</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800 }}>Copilot Customers</div>
                <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>{copilotCustomers.length} normalized customer records</div>
              </div>
              <button type="button" onClick={loadCopilotRecords} disabled={copilotRecordsLoading} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: copilotRecordsLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>
                Refresh
              </button>
            </div>
            {copilotRecordsStatus && <div style={{ color: isAdminWarningStatus(copilotRecordsStatus) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{copilotRecordsStatus}</div>}
            {copilotCustomers.length === 0 && !copilotRecordsLoading ? (
              <div style={{ color: '#777', fontSize: '0.82rem' }}>No Copilot customers yet. New website and manual enquiries will create them automatically.</div>
            ) : (
              copilotCustomers.map(customer => {
                const leadCount = copilotLeads.filter(lead => lead.customerId === customer.id).length;
                return (
                  <div key={customer.id} style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.75rem', display: 'grid', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{customer.name || customer.email || customer.phone || 'Unnamed customer'}</div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>{leadCount} lead{leadCount === 1 ? '' : 's'}</div>
                    </div>
                    <div style={{ color: '#aaa', fontSize: '0.76rem', lineHeight: 1.45 }}>{[customer.email, customer.phone].filter(Boolean).join(' · ') || 'No contact details saved'}</div>
                    {customer.notes && <div style={{ color: '#888', fontSize: '0.74rem', lineHeight: 1.45 }}>{customer.notes}</div>}
                    <div style={{ color: '#666', fontSize: '0.68rem' }}>Source: {customer.source || 'unknown'} · Updated: {customer.updatedAt ? new Date(customer.updatedAt).toLocaleString() : 'Not recorded'}</div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'leads' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800 }}>Copilot Leads</div>
                <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>{copilotLeads.length} normalized lead records</div>
              </div>
              <button type="button" onClick={loadCopilotRecords} disabled={copilotRecordsLoading} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: copilotRecordsLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>
                Refresh
              </button>
            </div>
            {copilotRecordsStatus && <div style={{ color: isAdminWarningStatus(copilotRecordsStatus) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{copilotRecordsStatus}</div>}
            {copilotLeads.length === 0 && !copilotRecordsLoading ? (
              <div style={{ color: '#777', fontSize: '0.82rem' }}>No Copilot leads yet. New website and manual enquiries will create them automatically.</div>
            ) : (
              copilotLeads.map(lead => {
                const customer = copilotCustomers.find(item => item.id === lead.customerId);
                return (
                  <div key={lead.id} style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.75rem', display: 'grid', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{customer?.name || customer?.email || customer?.phone || 'Unmatched customer'}</div>
                      <span style={{ color: '#fb923c', border: '1px solid #7c2d12', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase' }}>{lead.status || 'new'}</span>
                    </div>
                    <div style={{ color: '#aaa', fontSize: '0.76rem', lineHeight: 1.45 }}>Product: {lead.productInterest || 'Not specified'} · Score: {typeof lead.score === 'number' ? lead.score : 0}</div>
                    {lead.nextFollowUpDate && <div style={{ color: '#fb923c', fontSize: '0.74rem' }}>Next follow-up: {lead.nextFollowUpDate}</div>}
                    {lead.notes && <div style={{ color: '#888', fontSize: '0.74rem', lineHeight: 1.45 }}>{lead.notes}</div>}
                    <div style={{ color: '#666', fontSize: '0.68rem' }}>Source: {lead.source || 'unknown'} · Enquiry: {lead.sourceEnquiryId || 'none'} · Updated: {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : 'Not recorded'}</div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'drafts' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800 }}>AI Drafts</div>
                <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>{copilotAiActions.length} stored AI actions</div>
              </div>
              <button type="button" onClick={loadCopilotOps} disabled={copilotOpsLoading} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: copilotOpsLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>Refresh</button>
            </div>
            {copilotOpsStatus && <div style={{ color: isAdminWarningStatus(copilotOpsStatus) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{copilotOpsStatus}</div>}
            {copilotAiActions.length === 0 && !copilotOpsLoading ? (
              <div style={{ color: '#777', fontSize: '0.82rem' }}>No AI drafts stored yet.</div>
            ) : (
              copilotAiActions.map(action => {
                const lead = copilotLeads.find(item => item.id === action.relatedLeadId);
                const customer = copilotCustomers.find(item => item.id === lead?.customerId || item.id === action.relatedCustomerId);
                return (
                  <div key={action.id} style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.75rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{customer?.name || customer?.email || action.relatedLeadId || 'AI draft'}</div>
                      <span style={{ color: '#93c5fd', border: '1px solid #1d4ed8', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase' }}>{action.approvalState || 'draft'}</span>
                    </div>
                    <div style={{ color: '#aaa', fontSize: '0.76rem', lineHeight: 1.45 }}>{action.output?.slice(0, 600) || 'No draft output saved.'}</div>
                    {Boolean(action.outputWarnings?.length) && <div style={{ color: '#f87171', fontSize: '0.74rem' }}>Validation: {action.outputWarnings?.join(' ')}</div>}
                    {Boolean(action.missingFacts?.length) && <div style={{ color: '#fb923c', fontSize: '0.74rem' }}>Check: {action.missingFacts?.join(' ')}</div>}
                    <div style={{ color: '#666', fontSize: '0.68rem' }}>Lead: {action.relatedLeadId || 'none'} · Created: {action.createdAt ? new Date(action.createdAt).toLocaleString() : 'Not recorded'}</div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800 }}>Audit Log</div>
                <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>{copilotAuditLogs.length} recent records</div>
              </div>
              <button type="button" onClick={loadCopilotOps} disabled={copilotOpsLoading} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: copilotOpsLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>Refresh</button>
            </div>
            {copilotOpsStatus && <div style={{ color: isAdminWarningStatus(copilotOpsStatus) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{copilotOpsStatus}</div>}
            {copilotAuditLogs.length === 0 && !copilotOpsLoading ? (
              <div style={{ color: '#777', fontSize: '0.82rem' }}>No audit logs recorded yet.</div>
            ) : (
              copilotAuditLogs.map(log => (
                <div key={log.id} style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.75rem', display: 'grid', gap: '0.25rem' }}>
                  <div style={{ color: '#fff', fontWeight: 800 }}>{(log.action || 'audit_event').replace(/_/g, ' ')}</div>
                  <div style={{ color: '#aaa', fontSize: '0.76rem' }}>Target: {log.targetType || 'unknown'} · {log.targetId || 'none'} · Actor: {log.actor || 'system'}</div>
                  {log.detail && <div style={{ color: '#888', fontSize: '0.72rem', lineHeight: 1.45 }}>{JSON.stringify(log.detail)}</div>}
                  <div style={{ color: '#666', fontSize: '0.68rem' }}>{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'No timestamp'}</div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
            <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.65rem' }}>
              <div style={{ color: '#fff', fontWeight: 800 }}>Approved Product Lookup</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 0.4fr) auto', gap: '0.5rem' }}>
                <input
                  value={knowledgeSearch}
                  onChange={e => setKnowledgeSearch(e.target.value)}
                  placeholder="Ask about payload, price, availability, warranty, delivery, features..."
                  style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.8rem' }}
                />
                <input
                  value={knowledgeProduct}
                  onChange={e => setKnowledgeProduct(e.target.value)}
                  placeholder="Optional product"
                  style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={lookupProductKnowledge}
                  disabled={knowledgeLookupLoading || (!knowledgeSearch.trim() && !knowledgeProduct.trim())}
                  style={{ background: knowledgeSearch.trim() || knowledgeProduct.trim() ? '#E8540A' : '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.55rem 0.75rem', cursor: knowledgeLookupLoading ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                >
                  {knowledgeLookupLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              {knowledgeLookupStatus && <div style={{ color: isAdminWarningStatus(knowledgeLookupStatus) ? '#fb923c' : '#aaa', fontSize: '0.74rem' }}>{knowledgeLookupStatus}</div>}
              {knowledgeLookup && (
                <div style={{ display: 'grid', gap: '0.65rem', color: '#aaa', fontSize: '0.76rem', lineHeight: 1.45 }}>
                  {knowledgeLookup.sources.map((source, index) => (
                    <div key={`${source.title}-${index}`} style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.65rem' }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>
                        {source.url ? <a href={source.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{source.title}</a> : source.title}
                        {typeof source.confidence === 'number' && <span style={{ color: '#888', fontWeight: 600 }}> · {source.confidence}% match</span>}
                      </div>
                      {Boolean(source.facts?.length) && (
                        <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                          {source.facts?.map((fact, factIndex) => <li key={factIndex}>{fact}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                  {knowledgeLookup.missingFacts.length > 0 && <div style={{ color: '#fb923c' }}>Missing facts: {knowledgeLookup.missingFacts.join(' ')}</div>}
                  {knowledgeLookup.warnings.length > 0 && <div style={{ color: '#fb923c' }}>Guardrails: {knowledgeLookup.warnings.join(' ')}</div>}
                </div>
              )}
            </div>

            <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem' }}>
              <div style={{ color: '#fff', fontWeight: 700, marginBottom: '0.45rem' }}>Chatbot Knowledge</div>
              <p style={{ color: '#888', fontSize: '0.82rem', lineHeight: 1.45, margin: '0 0 0.7rem' }}>
                Add facts the website chatbot should know about the business, stock, process, or policies.
              </p>
              <textarea
                value={knowledgeInput}
                onChange={e => setKnowledgeInput(e.target.value)}
                placeholder="Example: Customers can inspect campers by appointment at Mutdapilly. Ask them to call first."
                rows={9}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.65rem', fontSize: '0.84rem', lineHeight: 1.45, outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                <button
                  onClick={handleAIRewrite}
                  disabled={rewriting || !knowledgeInput.trim()}
                  style={{ flex: 1, background: knowledgeInput.trim() && !rewriting ? '#2563eb' : '#333', color: knowledgeInput.trim() && !rewriting ? '#fff' : '#666', border: 'none', borderRadius: '6px', padding: '0.65rem', cursor: knowledgeInput.trim() && !rewriting ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  {rewriting ? 'Rewriting...' : 'AI Rewrite'}
                </button>
                <button
                  onClick={queueKnowledgeUpdate}
                  disabled={loading || !knowledgeInput.trim()}
                  style={{ flex: 1, background: knowledgeInput.trim() ? '#E8540A' : '#333', color: knowledgeInput.trim() ? '#fff' : '#666', border: 'none', borderRadius: '6px', padding: '0.65rem', cursor: knowledgeInput.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  Queue Knowledge Update
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#fff' }}>Pending Changes ({pending.length})</span>
              {hasEscalated && (
                <span style={{ fontSize: '0.7rem', background: '#3a2010', color: '#fb923c', padding: '2px 6px', borderRadius: '4px' }}>
                  ⚠ Needs review
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pending.length === 0 && (
                <p style={{ color: '#555', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>No changes yet</p>
              )}
              {pending.map((c, i) => {
                const vs = VERDICT_STYLE[c.judgeDecision] ?? VERDICT_STYLE.allow;
                return (
                  <div key={i} style={{ background: '#1a1a1a', border: vs.border, borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#E8540A' }}>✏️ {c.path.split('/').pop()}</span>
                      <span style={{ color: vs.color, fontSize: '0.7rem', fontWeight: 600 }}>{vs.label}</span>
                    </div>
                    <div style={{ color: '#ccc', lineHeight: 1.4 }}>{c.description}</div>
                    {c.judgeDecision === 'escalate' && c.escalation_reason && (
                      <div style={{ color: '#fb923c', fontSize: '0.72rem', marginTop: '0.3rem', lineHeight: 1.3 }}>
                        ⚠ {c.escalation_reason}
                      </div>
                    )}
                    {c.risk_flags?.length > 0 && c.judgeDecision !== 'allow' && (
                      <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                        Flags: {c.risk_flags.join(', ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.45rem' }}>
                      <button
                        onClick={() => setPreviewChange(c)}
                        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                      >Preview</button>
                      <button
                        onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                      >✕ remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '0.75rem', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {deployResults && (
                <p style={{ fontSize: '0.8rem', color: deployStatus === 'error' ? '#f87' : '#8f8', margin: 0 }}>{deployResults}</p>
              )}
              <button
                onClick={deploy}
                disabled={pending.length === 0 || deployStatus === 'deploying'}
                style={{
                  background: pending.length === 0 ? '#333' : hasEscalated ? '#7c3a10' : '#E8540A',
                  color: pending.length === 0 ? '#666' : '#fff',
                  border: hasEscalated ? '1px solid #fb923c' : 'none',
                  borderRadius: '6px',
                  padding: '0.7rem',
                  fontWeight: 700,
                  cursor: pending.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >{hasEscalated ? `⚠ ${deployLabel}` : deployLabel}</button>
              {deployStatus === 'done' && (
                <button
                  onClick={() => { setDeployStatus('idle'); setDeployResults(''); }}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}
                >Make more changes</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    {showChatDrawer && (
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.52)', display: 'flex', justifyContent: 'flex-end' }}
      >
        <div style={{ width: 'min(520px, 100%)', height: '100%', background: '#111', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 80px rgba(0,0,0,0.45)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #333', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <span>Admin Chat</span>
            <button
              onClick={() => setShowChatDrawer(false)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #252525', display: 'grid', gap: '0.55rem' }}>
            <div style={{ color: '#777', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Try asking</div>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {[
                'Show me weak SEO pages this week',
                'Find recent enquiries from John',
                'Show hot leads due for follow-up',
              ].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  style={{ background: '#1a1a1a', border: '1px solid #333', color: '#ccc', borderRadius: '999px', padding: '0.32rem 0.6rem', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.74rem' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                background: m.role === 'user' ? '#E8540A' : '#222',
                color: '#fff',
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#888', fontSize: '0.85rem' }}>Thinking...</div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid #333' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ background: '#222', border: '1px solid #444', color: '#aaa', borderRadius: '6px', padding: '0 0.75rem', cursor: 'pointer', fontSize: '1.1rem' }}
              title="Upload image"
            >+</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about leads, SEO, or site changes..."
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.9rem', outline: 'none', minWidth: 0 }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0 1rem', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >Send</button>
          </div>
        </div>
      </div>
    )}
    {orderForm && (
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div style={{ width: 'min(780px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #333', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{orderForm.id ? 'Edit Order' : 'Add Order'}</h2>
              <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.15rem' }}>Keep this lightweight: customer, product, status, dates, and the next action.</div>
            </div>
            <button
              onClick={() => setOrderForm(null)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input value={orderForm.customerName} onChange={e => setOrderForm(p => p && ({ ...p, customerName: e.target.value }))} placeholder="Customer name" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }} />
              <input value={orderForm.customerPhone} onChange={e => setOrderForm(p => p && ({ ...p, customerPhone: e.target.value }))} placeholder="Phone" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }} />
            </div>
            <input value={orderForm.customerEmail} onChange={e => setOrderForm(p => p && ({ ...p, customerEmail: e.target.value }))} placeholder="Email" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <select
                value={orderForm.productSlug}
                onChange={e => {
                  const product = products.find(item => item.slug === e.target.value);
                  setOrderForm(p => p && ({
                    ...p,
                    productSlug: product?.slug ?? '',
                    productTitle: product?.title ?? p.productTitle,
                    productCategory: product?.category ? String(product.category) : p.productCategory,
                    orderType: product ? orderTypeForProduct(product) : p.orderType,
                  }));
                }}
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }}
              >
                <option value="">Choose product</option>
                {products.map(product => (
                  <option key={product.slug} value={product.slug}>{product.title}</option>
                ))}
              </select>
              <input value={orderForm.productTitle} onChange={e => setOrderForm(p => p && ({ ...p, productTitle: e.target.value }))} placeholder="Product / custom build" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <select value={orderForm.orderType} onChange={e => setOrderForm(p => p && ({ ...p, orderType: e.target.value as OrderType }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }}>
                {Object.entries(ORDER_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={orderForm.status} onChange={e => setOrderForm(p => p && ({ ...p, status: e.target.value as OrderStatus }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }}>
                {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.8rem', border: '1px solid #333', borderRadius: '6px', padding: '0.52rem', background: '#101010' }}>
                <input type="checkbox" checked={orderForm.depositPaid} onChange={e => setOrderForm(p => p && ({ ...p, depositPaid: e.target.checked }))} />
                Deposit paid
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem', color: '#888', fontSize: '0.7rem' }}>
                Factory order
                <input type="date" value={orderForm.factoryOrderDate} onChange={e => setOrderForm(p => p && ({ ...p, factoryOrderDate: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem', color: '#888', fontSize: '0.7rem' }}>
                Expected arrival
                <input type="date" value={orderForm.expectedArrivalDate} onChange={e => setOrderForm(p => p && ({ ...p, expectedArrivalDate: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem', color: '#888', fontSize: '0.7rem' }}>
                Handover
                <input type="date" value={orderForm.expectedHandoverDate} onChange={e => setOrderForm(p => p && ({ ...p, expectedHandoverDate: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem', color: '#888', fontSize: '0.7rem' }}>
                Next action
                <input type="date" value={orderForm.nextActionDate} onChange={e => setOrderForm(p => p && ({ ...p, nextActionDate: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              </label>
            </div>
            <textarea value={orderForm.notes} onChange={e => setOrderForm(p => p && ({ ...p, notes: e.target.value }))} placeholder="Short notes: factory order number, fitout tasks, customer preferences, delivery constraints" rows={4} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.82rem', lineHeight: 1.4 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button onClick={() => setOrderForm(null)} style={{ background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: '6px', padding: '0.62rem', cursor: 'pointer', fontWeight: 700 }}>
                Cancel
              </button>
              <button onClick={saveOrder} disabled={orderSaving} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.62rem', cursor: orderSaving ? 'wait' : 'pointer', fontWeight: 700 }}>
                {orderSaving ? 'Saving...' : 'Save Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {showHelp && (
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div style={{ width: 'min(860px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #333', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Admin Help</h2>
            <button
              onClick={() => setShowHelp(false)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: '1rem 1.1rem 1.2rem', display: 'grid', gap: '1rem', fontSize: '0.9rem', lineHeight: 1.55 }}>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>How the admin works</h3>
              <p style={{ margin: 0, color: '#ddd' }}>
                The admin has two jobs: show the owner what needs attention, and prepare safe site changes for review. Dashboard, Enquiries, and Media save operational data directly. Product, homepage, content, and chatbot changes are queued in Pending Changes so they can be previewed before deployment.
              </p>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Use chat for questions and safe actions</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Admin Chat can search recent enquiries, update lead status or follow-up dates, check SEO health, and queue site/content changes for review.</li>
                <li>Use the structured tabs for visual workflows such as product photos, gallery ordering, homepage cards, media uploads, orders, and final Pending deployment review.</li>
                <li>Use Admin Chat for wording changes, redirects, removing a sold one-off listing, asking what needs attention, checking weak SEO pages, or updating a clear lead follow-up.</li>
                <li>Do not use Admin Chat for normal product photo changes. Remove, reorder, add, or set hero photos in Products, then click Queue Edit.</li>
                <li>Lead status changes from chat save immediately. Site file changes from chat still go to Pending and must be previewed before deployment.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Read the dashboard</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open Dashboard first. It summarises product stock, listed value, recent leads, due follow-ups, email readiness, and pending changes.</li>
                <li>Use the 7, 30, and 90 day buttons to change the reporting window for lead and analytics signals.</li>
                <li>Check Due Follow-Ups first. Overdue follow-ups need action before browsing product statistics.</li>
                <li>Check Email Delivery and Launch Readiness. Red items are setup blockers, orange items are warnings, and green items are ready.</li>
                <li>Use Products Needing Attention to find weak listings, stale stock, or products that need better photos or copy.</li>
                <li>Use Product Interest, Funnel, and Traffic Quality to understand which products and marketing sources are producing enquiries.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Manage enquiries and follow-ups</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open Enquiries to see contact form submissions backed up from the website.</li>
                <li>Use the phone and email links to contact the customer.</li>
                <li>Set the lead status to New, Contacted, Quoted, Won, Lost, or Spam.</li>
                <li>Set the follow-up date for the next call or email. Due and overdue items appear on Dashboard.</li>
                <li>Add short notes after each contact attempt, quote, or outcome. Do not store passwords, payment details, or unnecessary private information.</li>
                <li>Marking a lead Won does not automatically remove a product from the website. Use Products or Admin Chat to make stock changes deliberately.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Update a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open the Products tab and search for the product.</li>
                <li>Use Edit to change safe fields like price, status, tagline, sale state, featured state, hero image, gallery order, or related products.</li>
                <li>Use Gallery Photos to see the images in order. Move photos up or down, remove photos, add a new image path, or set a gallery photo as the hero image.</li>
                <li>Use Product Video to paste the YouTube URL for a walkthrough. Normal YouTube links, youtu.be links, Shorts links, and embed links are accepted.</li>
                <li>Add a clear video title. The admin will detect the video ID, show a preview, and queue the video metadata with the product edit.</li>
                <li>To remove a video from a product, clear the Product Video fields before queueing the edit.</li>
                <li>Use the notes box for copy or spec changes that need more explanation.</li>
                <li>Click Queue Edit. The edit is sent directly to Pending without using Admin Chat.</li>
                <li>Open Pending, use Preview to inspect the generated file, and remove anything that looks wrong.</li>
                <li>Click Deploy. The live site usually updates after the Netlify rebuild completes.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Upload product photos</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open the Media tab and choose the product.</li>
                <li>Add short alt text, then upload a JPG, PNG, WebP, or GIF image up to 12MB.</li>
                <li>The uploaded image is stored in Netlify Blobs, so it does not need to be committed to Git.</li>
                <li>Use Hero to prepare that image as the main product image, or Gallery to add it to the product gallery list.</li>
                <li>Open Pending, preview the product file, then deploy when the image order is correct.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Update homepage proof sections</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open the Homepage tab to edit Recent Builds and customer testimonials.</li>
                <li>Recent Builds is capped at 3 items. Adding a new recent build places it first and removes the oldest build automatically.</li>
                <li>For Recent Builds, use a product hero image or paste an approved image path, then update the title, alt text, link, tags, and visibility.</li>
                <li>Use the arrow buttons to reorder cards. Hidden cards stay in the data file but do not appear on the homepage.</li>
                <li>For Testimonials, enter only real customer-provided wording. Do not invent names, quotes, or ratings.</li>
                <li>Click Queue Homepage Updates, then open Pending to preview the JSON files before deploying.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Add a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Use Add Product in the Products tab.</li>
                <li>Provide the product title, price, category, tagline, main specs, description, and selling points.</li>
                <li>Upload the product photos in the same form. The first uploaded photo becomes the hero image automatically.</li>
                <li>Use the gallery controls to move photos up or down, remove any wrong photo, or set a different hero image before queuing the draft.</li>
                <li>If the product has a walkthrough, paste the YouTube URL in Product Video and add a short title before queueing the draft.</li>
                <li>The assistant will create a draft product file using the existing product format.</li>
                <li>Use Preview in Pending and deploy only after the new product path, price, specs, and image order have been checked.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Remove or sell a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>For normal product-line models, use Order to create an order record. Do not remove the product page just because one unit sold.</li>
                <li>For one-off on-sale, demo, or used stock, use Sold only when the listing should be removed from active sale pages.</li>
                <li>Use Orders to track deposit, factory production, shipping, Mutdapilly fitout, handover, and the next owner action.</li>
                <li>Review any pending product or redirect changes before deploying.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Teach the chatbot</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Use the Chatbot Knowledge box for facts that apply across the business, not just one product.</li>
                <li>Add short, factual notes about process, appointments, stock, delivery, policy, warranty, or common customer questions.</li>
                <li>Do not add passwords, API keys, private customer details, or anything the public should not see.</li>
                <li>Click Queue Knowledge Update, review the pending change, then Deploy.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Deploy pending changes</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open Pending after asking the assistant to change a product, page, redirect, or chatbot knowledge.</li>
                <li>Use Preview to inspect the complete proposed file content before deployment.</li>
                <li>Remove any change that looks wrong or unclear.</li>
                <li>If a change is flagged for review, read the reason carefully before deciding whether to deploy.</li>
                <li>Click Deploy only when the queued changes match the intended business change. The live site normally updates after the Netlify rebuild finishes.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Best practice</h3>
              <p style={{ margin: 0, color: '#ddd' }}>
                Start each session by checking Dashboard and Enquiries. Keep product/content edits small, use exact product names and prices, and preview every queued file before deployment. Treat the dashboard value as an estimate, not accounting data, and keep customer notes factual and brief.
              </p>
            </section>
          </div>
        </div>
      </div>
    )}
    {previewChange && (
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div style={{ width: 'min(980px, 100%)', maxHeight: '88vh', overflow: 'hidden', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderBottom: '1px solid #333', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Pending File Preview</h2>
              <p style={{ margin: '0.25rem 0 0', color: '#888', fontSize: '0.8rem' }}>{previewChange.path}</p>
            </div>
            <button
              onClick={() => setPreviewChange(null)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #333', color: '#ddd', fontSize: '0.85rem', lineHeight: 1.45 }}>
            {previewChange.description}
          </div>
          <pre style={{ margin: 0, padding: '1rem', overflow: 'auto', color: '#ddd', background: '#0b0b0b', fontSize: '0.78rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
            {previewChange.content}
          </pre>
        </div>
      </div>
    )}
    </>
  );
}
