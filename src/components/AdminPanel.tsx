import React, { Component, type ReactNode, useState, useRef, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import initialRecentBuilds from '../data/homepage/recent-builds.json';
import initialTestimonials from '../data/homepage/testimonials.json';
import initialPaymentSettings from '../data/payment-settings.json';
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
type PanelTab = 'dashboard' | 'products' | 'shop' | 'orders' | 'settings' | 'media' | 'homepage' | 'enquiries' | 'customers' | 'leads' | 'drafts' | 'audit' | 'knowledge' | 'google' | 'matches' | 'reports' | 'pending';
type ProductCategory = 'slide-on' | 'caravan' | 'expedition';
type ProductStatus = 'available' | 'on-sale' | 'coming-soon';
type CommerceAvailability = 'available_in_australia' | 'coming_next_container' | 'made_to_order' | 'ask_availability' | 'unavailable';
type SourceType = 'china_container' | 'local_supplier' | 'workshop_stock' | 'custom_made_to_order' | 'other';
type ShopProductType = 'stock' | 'service';
type ShopFulfilmentType = 'ship' | 'pickup' | 'install' | 'quote_required';
type ShopShippingSize = 'small' | 'medium' | 'large' | 'oversized';
type ShopShippingDataStatus = 'estimated' | 'confirmed';
type SuitabilityDataStatus = 'draft' | 'target' | 'confirmed';
type EnquirySourceType = 'website_form' | 'manual_email' | 'phone_call' | 'facebook' | 'instagram' | 'referral' | 'walk_in' | 'other';
type EnquiryQueueFilter = 'active' | 'needs-response' | 'follow-up-due' | 'hot' | 'all' | 'archived';
type OrderType = 'standard_model' | 'one_off_stock' | 'demo_unit' | 'used_stock' | 'custom_build';
type ShippingMethod = 'australia_post' | 'brisbane_local_delivery' | 'pickup';
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

interface PaymentSettings {
  vehicleDepositPercent: number;
  depositLegalNoticeTitle: string;
  depositLegalNoticeBody: string[];
}

interface ProductRecord {
  store?: boolean;
  productType?: ShopProductType;
  slug: string;
  title: string;
  name?: string;
  description?: string;
  price: string | number;
  compareAtPrice?: string | number;
  saleLabel?: string;
  status: 'available' | 'on-sale' | 'coming-soon' | string;
  category: ProductCategory | string;
  tagline: string;
  availability?: CommerceAvailability;
  purchasableOnline?: boolean;
  depositEnabled?: boolean;
  fullPaymentEnabled?: boolean;
  sourceType?: SourceType;
  fulfilmentType?: ShopFulfilmentType;
  shippingSize?: ShopShippingSize;
  leadTimeText?: string;
  containerEtaText?: string;
  containerEtaDate?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  pickupLocation?: string;
  requiresInstallation?: boolean;
  packedWeightKg?: number;
  packedLengthCm?: number;
  packedWidthCm?: number;
  packedHeightCm?: number;
  shippingDataStatus?: ShopShippingDataStatus;
  featured?: boolean;
  onSale?: boolean;
  heroImage?: string;
  gallery?: string[];
  galleryCount?: number;
  relatedSlugs?: string[];
  internalStockEstimate?: string;
  targetAustraliaStock?: string;
  containerReorderQuantity?: string;
  minimumComfortStock?: string;
  lastStockCheckedAt?: string;
  lastStockCheckedBy?: string;
  containerEligible?: boolean;
  usualContainerLeadTimeDays?: string;
  supplierNotes?: string;
  youtubeVideo?: YoutubeVideoMeta;
  suitabilityData?: SuitabilityData;
}

interface QueuedShopDraft extends ProductRecord {
  pendingPath?: string;
  pendingLabel?: string;
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
  mode: 'business' | 'shop';
  title: string;
  category: string;
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
  productType: ShopProductType;
  fulfilmentType: ShopFulfilmentType;
  shippingSize: ShopShippingSize;
  availability: CommerceAvailability;
  purchasableOnline: boolean;
  depositEnabled: boolean;
  fullPaymentEnabled: boolean;
  sourceType: SourceType;
  leadTimeText: string;
  containerEtaText: string;
  containerEtaDate: string;
  weight: string;
  dimensionLength: string;
  dimensionWidth: string;
  dimensionHeight: string;
  pickupLocation: string;
  requiresInstallation: boolean;
  packedWeightKg: string;
  packedLengthCm: string;
  packedWidthCm: string;
  packedHeightCm: string;
  shippingDataStatus: ShopShippingDataStatus;
}

interface EditProductForm {
  store: boolean;
  slug: string;
  title: string;
  price: string;
  compareAtPrice: string;
  saleLabel: string;
  category: string;
  productType: ShopProductType;
  status: ProductStatus;
  availability: CommerceAvailability;
  purchasableOnline: boolean;
  depositEnabled: boolean;
  fullPaymentEnabled: boolean;
  sourceType: SourceType;
  fulfilmentType: ShopFulfilmentType;
  shippingSize: ShopShippingSize;
  leadTimeText: string;
  containerEtaText: string;
  containerEtaDate: string;
  weight: string;
  dimensionLength: string;
  dimensionWidth: string;
  dimensionHeight: string;
  pickupLocation: string;
  requiresInstallation: boolean;
  packedWeightKg: string;
  packedLengthCm: string;
  packedWidthCm: string;
  packedHeightCm: string;
  shippingDataStatus: ShopShippingDataStatus;
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
  internalStockEstimate: string;
  targetAustraliaStock: string;
  containerReorderQuantity: string;
  minimumComfortStock: string;
  lastStockCheckedAt: string;
  lastStockCheckedBy: string;
  containerEligible: boolean;
  usualContainerLeadTimeDays: string;
  supplierNotes: string;
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
  fitment_context?: string;
  fit_check_summary?: string;
  vehicle_make_model_year?: string;
  tray_type?: string;
  tray_length?: string;
  gvm_upgrade_status?: string;
  travellers?: string;
  travel_style?: string;
  towing_requirement?: string;
  budget_range?: string;
  timeframe?: string;
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
    archivedAt?: string;
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
  paymentType?: 'deposit' | 'full';
  purchaseKind?: 'product' | 'cart';
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeEventId?: string;
  paymentStatus?: string;
  amountPaidCents?: number;
  currency?: string;
  orderSource?: string;
  shippingName?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostcode?: string;
  shippingCountry?: string;
  shippingMethod?: ShippingMethod;
  shippingChargeCents?: number;
  shippingStatus?: string;
  shippingCarrier?: string;
  shippingService?: string;
  trackingNumber?: string;
  shippingLabelId?: string;
  shippingLabelCreatedAt?: string;
  shippingLabelPrintedAt?: string;
  shippingLabelUrl?: string;
  shippingBlockReason?: string;
  shippingNotes?: string;
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

interface GoogleIntegrationStatus {
  state: 'not_configured' | 'not_connected' | 'access_revoked' | 'refresh_failed' | 'token_expired' | 'connected' | 'unavailable';
  configured: boolean;
  missing: string[];
  redirectUri: string;
  scopes: string[];
  connectedEmail?: string;
  connectedAt?: string;
  expiresAt?: string;
  lastSyncAt?: string;
  settings?: GoogleOwnerSettings;
  setupChecklist: string[];
}

interface GoogleSyncCheck {
  ready?: boolean;
  state?: GoogleIntegrationStatus['state'];
  message?: string;
  synced?: number;
  skipped?: number;
  requiredOwnerInputs?: string[];
  error?: string;
}

interface GoogleOwnerSettings {
  gmailQuery: string;
  gmailMaxResults: number;
  ignoredSenders: string[];
  driveFolderIds: string[];
  driveMaxResults: number;
  summarizeDriveFiles: boolean;
  updatedAt?: string;
}

interface CopilotMatchSuggestion {
  targetType: 'customer' | 'lead';
  targetId: string;
  confidence: number;
  decision: 'auto_link' | 'needs_confirmation' | 'possible_only' | 'do_not_suggest';
  reasons: string[];
}

interface GmailThreadRecord {
  id: string;
  subject?: string;
  fromEmail?: string;
  toEmail?: string;
  snippet?: string;
  productInterest?: string;
  receivedAt?: string;
  suggestions?: CopilotMatchSuggestion[];
  matchDecision?: string;
  linkedTargetType?: string;
  linkedTargetId?: string;
}

interface DriveFileRecord {
  id: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  folderName?: string;
  description?: string;
  productInterest?: string;
  modifiedAt?: string;
  suggestions?: CopilotMatchSuggestion[];
  matchDecision?: string;
  linkedTargetType?: string;
  linkedTargetId?: string;
}

interface WeeklyReportRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  sections: { title: string; value: number; detail: string }[];
  recommendations: string[];
  sourceCounts?: Record<string, number>;
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

const DEFAULT_PICKUP_LOCATION = '77 Coleyville Rd, Mutdapilly QLD 4307';

const VERDICT_STYLE: Record<JudgeDecision, { label: string; color: string; border: string }> = {
  allow:    { label: '✓ Approved',  color: '#4ade80', border: '1px solid #1a3a1a' },
  escalate: { label: '⚠ Escalated', color: '#fb923c', border: '1px solid #3a2010' },
  block:    { label: '✕ Blocked',   color: '#f87171', border: '1px solid #3a1010' },
  revise:   { label: '↩ Revised',   color: '#a78bfa', border: '1px solid #2a1a3a' },
};

const EMPTY_PRODUCT_FORM: NewProductForm = {
  mode: 'business',
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
  productType: 'stock',
  fulfilmentType: 'ship',
  shippingSize: 'medium',
  availability: 'available_in_australia',
  purchasableOnline: true,
  depositEnabled: true,
  fullPaymentEnabled: true,
  sourceType: 'other',
  leadTimeText: '',
  containerEtaText: '',
  containerEtaDate: '',
  weight: '',
  dimensionLength: '',
  dimensionWidth: '',
  dimensionHeight: '',
  pickupLocation: DEFAULT_PICKUP_LOCATION,
  requiresInstallation: false,
  packedWeightKg: '',
  packedLengthCm: '',
  packedWidthCm: '',
  packedHeightCm: '',
  shippingDataStatus: 'estimated',
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

const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  australia_post: 'Australia Post',
  brisbane_local_delivery: 'Brisbane ute delivery',
  pickup: 'Pickup only',
};

function moneyFromCents(value: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase() === 'AUD' ? 'AUD' : 'AUD',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

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

const SHOP_PRODUCT_TYPE_LABELS: Record<ShopProductType, string> = {
  stock: 'Stock item',
  service: 'Service item',
};

const SHOP_FULFILMENT_LABELS: Record<ShopFulfilmentType, string> = {
  ship: 'Ship',
  pickup: 'Pickup',
  install: 'Install',
  quote_required: 'Quote required',
};

const SHOP_SHIPPING_SIZE_LABELS: Record<ShopShippingSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  oversized: 'Oversized',
};

const SHOP_SHIPPING_DATA_STATUS_LABELS: Record<ShopShippingDataStatus, string> = {
  estimated: 'Estimated',
  confirmed: 'Confirmed',
};

function optionalPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function partialDimensionsFromForm(form: Pick<NewProductForm, 'dimensionLength' | 'dimensionWidth' | 'dimensionHeight'>) {
  const dimensions = {
    length: optionalPositiveNumber(form.dimensionLength),
    width: optionalPositiveNumber(form.dimensionWidth),
    height: optionalPositiveNumber(form.dimensionHeight),
  };
  return dimensions.length !== undefined || dimensions.width !== undefined || dimensions.height !== undefined
    ? dimensions
    : undefined;
}

function formatPartialDimensions(form: Pick<NewProductForm, 'dimensionLength' | 'dimensionWidth' | 'dimensionHeight'>) {
  const parts = [
    form.dimensionLength.trim() ? `length ${form.dimensionLength.trim()} cm` : '',
    form.dimensionWidth.trim() ? `width ${form.dimensionWidth.trim()} cm` : '',
    form.dimensionHeight.trim() ? `height ${form.dimensionHeight.trim()} cm` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'not provided';
}

function formatPackedDimensions(form: Pick<NewProductForm, 'packedLengthCm' | 'packedWidthCm' | 'packedHeightCm'>) {
  const parts = [
    form.packedLengthCm.trim() ? `length ${form.packedLengthCm.trim()} cm` : '',
    form.packedWidthCm.trim() ? `width ${form.packedWidthCm.trim()} cm` : '',
    form.packedHeightCm.trim() ? `height ${form.packedHeightCm.trim()} cm` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'none';
}

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
    shippingName: '',
    shippingAddressLine1: '',
    shippingAddressLine2: '',
    shippingCity: '',
    shippingState: '',
    shippingPostcode: '',
    shippingCountry: 'Australia',
    shippingMethod: 'australia_post',
    shippingChargeCents: 0,
    shippingStatus: 'pending',
    shippingCarrier: '',
    shippingService: '',
    trackingNumber: '',
    shippingLabelId: '',
    shippingLabelCreatedAt: '',
    shippingLabelPrintedAt: '',
    shippingLabelUrl: '',
    shippingBlockReason: '',
    shippingNotes: '',
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
    shippingCountry: 'Australia',
    shippingMethod: 'australia_post',
    shippingChargeCents: 0,
    shippingStatus: 'pending',
    shippingName: enquiry.name ?? '',
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
    shippingName: order.shippingName ?? '',
    shippingAddressLine1: order.shippingAddressLine1 ?? '',
    shippingAddressLine2: order.shippingAddressLine2 ?? '',
    shippingCity: order.shippingCity ?? '',
    shippingState: order.shippingState ?? '',
    shippingPostcode: order.shippingPostcode ?? '',
    shippingCountry: order.shippingCountry ?? 'Australia',
    shippingMethod: order.shippingMethod ?? 'australia_post',
    shippingChargeCents: order.shippingChargeCents ?? 0,
    shippingStatus: order.shippingStatus ?? 'pending',
    shippingCarrier: order.shippingCarrier ?? '',
    shippingService: order.shippingService ?? '',
    trackingNumber: order.trackingNumber ?? '',
    shippingLabelId: order.shippingLabelId ?? '',
    shippingLabelCreatedAt: order.shippingLabelCreatedAt ?? '',
    shippingLabelPrintedAt: order.shippingLabelPrintedAt ?? '',
    shippingLabelUrl: order.shippingLabelUrl ?? '',
    shippingBlockReason: order.shippingBlockReason ?? '',
    shippingNotes: order.shippingNotes ?? '',
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
    if (enquiry.leadStatus?.archivedAt) continue;
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

function isArchivedEnquiry(enquiry: EnquiryRecord) {
  return Boolean(enquiry.leadStatus?.archivedAt);
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
  if (filter === 'archived') return isArchivedEnquiry(enquiry);
  if (isArchivedEnquiry(enquiry)) return false;
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
  if (src.startsWith('/media/')) return src;
  if (src.startsWith('/images/products/')) return src;
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=800`;
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
          placeholder="Upload date, e.g. 2026-05-28T09:00:00+10:00"
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

function formatDepositPercentInput(value: number) {
  const percent = Number.isFinite(value) ? value * 100 : 33.33333333;
  return percent.toFixed(3).replace(/\.?0+$/, '');
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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
  const [shopFilter, setShopFilter] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [queuedShopDrafts, setQueuedShopDrafts] = useState<QueuedShopDraft[]>([]);
  const [newProduct, setNewProduct] = useState<NewProductForm>(EMPTY_PRODUCT_FORM);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductMode, setNewProductMode] = useState<'business' | 'shop'>('business');
  const [editProduct, setEditProduct] = useState<EditProductForm | null>(null);
  const [productEditStatus, setProductEditStatus] = useState('');
  const [editProductMediaStatus, setEditProductMediaStatus] = useState('');
  const [newProductStatus, setNewProductStatus] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersStatus, setOrdersStatus] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [shippingLabelSavingId, setShippingLabelSavingId] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState<OrderForm | null>(null);
  const [copilotCustomers, setCopilotCustomers] = useState<CopilotCustomerRecord[]>([]);
  const [copilotLeads, setCopilotLeads] = useState<CopilotLeadRecord[]>([]);
  const [copilotRecordsLoading, setCopilotRecordsLoading] = useState(false);
  const [copilotRecordsStatus, setCopilotRecordsStatus] = useState('');
  const [copilotAiActions, setCopilotAiActions] = useState<CopilotAiActionRecord[]>([]);
  const [copilotAuditLogs, setCopilotAuditLogs] = useState<CopilotAuditRecord[]>([]);
  const [copilotOpsLoading, setCopilotOpsLoading] = useState(false);
  const [copilotOpsStatus, setCopilotOpsStatus] = useState('');
  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMessage, setGoogleMessage] = useState('');
  const [googleSyncChecks, setGoogleSyncChecks] = useState<Record<'gmail' | 'drive', GoogleSyncCheck | null>>({ gmail: null, drive: null });
  const [googleSettings, setGoogleSettings] = useState<GoogleOwnerSettings>({
    gmailQuery: 'newer_than:30d',
    gmailMaxResults: 10,
    ignoredSenders: [],
    driveFolderIds: [],
    driveMaxResults: 10,
    summarizeDriveFiles: false,
  });
  const [googleIgnoredSendersText, setGoogleIgnoredSendersText] = useState('');
  const [googleDriveFoldersText, setGoogleDriveFoldersText] = useState('');
  const [gmailThreads, setGmailThreads] = useState<GmailThreadRecord[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFileRecord[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesStatus, setMatchesStatus] = useState('');
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsStatus, setReportsStatus] = useState('');
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
  const [showLeadReminders, setShowLeadReminders] = useState(false);
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
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(initialPaymentSettings as PaymentSettings);
  const [paymentDepositPercent, setPaymentDepositPercent] = useState(formatDepositPercentInput((initialPaymentSettings as PaymentSettings).vehicleDepositPercent));
  const [paymentNoticeTitle, setPaymentNoticeTitle] = useState((initialPaymentSettings as PaymentSettings).depositLegalNoticeTitle);
  const [paymentNoticeBody, setPaymentNoticeBody] = useState((initialPaymentSettings as PaymentSettings).depositLegalNoticeBody.join('\n'));
  const [paymentSettingsStatus, setPaymentSettingsStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [deployResults, setDeployResults] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const editProductFileRef = useRef<HTMLInputElement>(null);
  const newProductFileRef = useRef<HTMLInputElement>(null);
  const enquiryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingEnquiryHashRef = useRef<string | null>(null);
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
    setQueuedShopDrafts(prev => prev.filter(draft => {
      if (products.some(product => product.slug === draft.slug)) return false;
      if (!draft.pendingPath) return true;
      return pending.some(change => change.path === draft.pendingPath);
    }));
  }, [pending, products]);

  useEffect(() => {
    if (activeTab === 'enquiries') {
      void loadEnquiries();
      void loadContactConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'products' || activeTab === 'shop') {
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
    if (activeTab === 'google') {
      void loadGoogleStatus();
    }
  }, [activeTab]);

  useEffect(() => {
    function syncEnquiryHash() {
      const hash = window.location.hash || '';
      const match = hash.match(/^#enquiry-(.+)$/);
      pendingEnquiryHashRef.current = match ? decodeURIComponent(match[1]) : null;
      if (pendingEnquiryHashRef.current) {
        setActiveTab('enquiries');
      }
    }

    syncEnquiryHash();
    window.addEventListener('hashchange', syncEnquiryHash);
    return () => window.removeEventListener('hashchange', syncEnquiryHash);
  }, []);

  useEffect(() => {
    const enquiryId = pendingEnquiryHashRef.current;
    if (!enquiryId || activeTab !== 'enquiries' || enquiriesLoading || enquiries.length === 0) return;
    const target = enquiries.find(enquiry => enquiry.id === enquiryId);
    if (!target) return;

    const desiredFilter = isArchivedEnquiry(target) ? 'archived' : 'all';
    if (enquiryQueueFilter !== desiredFilter) {
      setEnquiryQueueFilter(desiredFilter);
      return;
    }

    if (!enquiryRefs.current[enquiryId]) return;

    openEnquiry(enquiryId);
    pendingEnquiryHashRef.current = null;
  }, [activeTab, enquiries, enquiriesLoading, enquiryQueueFilter]);

  useEffect(() => {
    if (activeTab === 'matches') {
      void loadCopilotRecords();
      void loadMatchRecords();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reports') {
      void loadWeeklyReports();
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

  async function sendMessage(text: string): Promise<{ text: string; pendingChanges: PendingChange[] } | null> {
    if (!text.trim() || loading) return null;
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
      if (redirectToLoginIfUnauthorized(res)) return null;
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
      return data;
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
      return null;
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

  async function loadGoogleStatus() {
    setGoogleLoading(true);
    setGoogleMessage('Loading Google integration status...');
    try {
      const res = await adminFetch('/.netlify/functions/google-oauth-status');
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<GoogleIntegrationStatus & { error?: string }>(res, 'Could not load Google status.');
      if (!res.ok) throw new Error(data.error ?? 'Could not load Google status.');
      setGoogleStatus(data);
      if (data.settings) {
        setGoogleSettings(data.settings);
        setGoogleIgnoredSendersText(data.settings.ignoredSenders.join('\n'));
        setGoogleDriveFoldersText(data.settings.driveFolderIds.join('\n'));
      }
      setGoogleMessage(data.state === 'connected'
        ? 'Google is connected for read-only Owner Copilot access.'
        : data.state === 'not_configured'
          ? 'Google OAuth needs Netlify environment variables before the owner can connect.'
          : 'Google is not connected yet.');
    } catch (err) {
      setGoogleStatus(null);
      setGoogleMessage(err instanceof Error ? err.message : 'Could not load Google status.');
    } finally {
      setGoogleLoading(false);
    }
  }

  function connectGoogle() {
    window.location.href = '/.netlify/functions/google-oauth-start';
  }

  async function disconnectGoogle() {
    setGoogleLoading(true);
    setGoogleMessage('Disconnecting Google...');
    try {
      const res = await adminFetch('/.netlify/functions/google-oauth-disconnect', { method: 'POST' });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ ok?: boolean; error?: string }>(res, 'Could not disconnect Google.');
      if (!res.ok) throw new Error(data.error ?? 'Could not disconnect Google.');
      setGoogleMessage('Google access was disconnected.');
      await loadGoogleStatus();
    } catch (err) {
      setGoogleMessage(err instanceof Error ? err.message : 'Could not disconnect Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function saveGoogleSettings() {
    setGoogleLoading(true);
    setGoogleMessage('Saving Google sync settings...');
    try {
      const payload = {
        ...googleSettings,
        ignoredSenders: googleIgnoredSendersText,
        driveFolderIds: googleDriveFoldersText,
      };
      const res = await adminFetch('/.netlify/functions/google-owner-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ settings?: GoogleOwnerSettings; error?: string }>(res, 'Could not save Google settings.');
      if (!res.ok || !data.settings) throw new Error(data.error ?? 'Could not save Google settings.');
      setGoogleSettings(data.settings);
      setGoogleIgnoredSendersText(data.settings.ignoredSenders.join('\n'));
      setGoogleDriveFoldersText(data.settings.driveFolderIds.join('\n'));
      setGoogleMessage('Google sync settings saved.');
      await loadGoogleStatus();
    } catch (err) {
      setGoogleMessage(err instanceof Error ? err.message : 'Could not save Google settings.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function checkGoogleSync(kind: 'gmail' | 'drive') {
    setGoogleLoading(true);
    setGoogleMessage(`Syncing ${kind === 'gmail' ? 'Gmail' : 'Drive'} metadata...`);
    try {
      const res = await adminFetch(`/.netlify/functions/google-${kind}-sync`, { method: 'POST' });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<GoogleSyncCheck>(res, `Could not check ${kind} readiness.`);
      setGoogleSyncChecks(prev => ({ ...prev, [kind]: data }));
      setGoogleMessage(data.message || `${kind === 'gmail' ? 'Gmail' : 'Drive'} readiness checked.`);
      if (res.ok) await loadMatchRecords();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not check ${kind} readiness.`;
      setGoogleSyncChecks(prev => ({ ...prev, [kind]: { error: message } }));
      setGoogleMessage(message);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function loadMatchRecords() {
    setMatchesLoading(true);
    setMatchesStatus('Loading Gmail and Drive match suggestions...');
    try {
      const [gmailRes, driveRes] = await Promise.all([
        adminFetch('/.netlify/functions/admin-gmail-matches'),
        adminFetch('/.netlify/functions/admin-drive-matches'),
      ]);
      if (redirectToLoginIfUnauthorized(gmailRes) || redirectToLoginIfUnauthorized(driveRes)) return;
      const gmailData = await readAdminJson<{ threads?: GmailThreadRecord[]; error?: string }>(gmailRes, 'Could not load Gmail matches.');
      const driveData = await readAdminJson<{ files?: DriveFileRecord[]; error?: string }>(driveRes, 'Could not load Drive matches.');
      if (!gmailRes.ok) throw new Error(gmailData.error ?? 'Could not load Gmail matches.');
      if (!driveRes.ok) throw new Error(driveData.error ?? 'Could not load Drive matches.');
      setGmailThreads(Array.isArray(gmailData.threads) ? gmailData.threads : []);
      setDriveFiles(Array.isArray(driveData.files) ? driveData.files : []);
      setMatchesStatus('');
    } catch (err) {
      setMatchesStatus(err instanceof Error ? err.message : 'Could not load match suggestions.');
    } finally {
      setMatchesLoading(false);
    }
  }

  async function updateExternalMatch(kind: 'gmail' | 'drive', id: string, suggestion: CopilotMatchSuggestion, decision: 'approved' | 'rejected' | 'pinned') {
    setMatchesLoading(true);
    setMatchesStatus(`${decision === 'rejected' ? 'Rejecting' : 'Saving'} ${kind} match...`);
    try {
      const res = await adminFetch(`/.netlify/functions/admin-${kind}-matches`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, targetType: suggestion.targetType, targetId: suggestion.targetId }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ error?: string }>(res, 'Could not update match.');
      if (!res.ok) throw new Error(data.error ?? 'Could not update match.');
      setMatchesStatus(`${kind === 'gmail' ? 'Gmail' : 'Drive'} match ${decision}.`);
      await loadMatchRecords();
    } catch (err) {
      setMatchesStatus(err instanceof Error ? err.message : 'Could not update match.');
    } finally {
      setMatchesLoading(false);
    }
  }

  async function loadWeeklyReports() {
    setReportsLoading(true);
    setReportsStatus('Loading weekly reports...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-weekly-report');
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ reports?: WeeklyReportRecord[]; error?: string }>(res, 'Could not load weekly reports.');
      if (!res.ok) throw new Error(data.error ?? 'Could not load weekly reports.');
      setWeeklyReports(Array.isArray(data.reports) ? data.reports : []);
      setReportsStatus('');
    } catch (err) {
      setReportsStatus(err instanceof Error ? err.message : 'Could not load weekly reports.');
    } finally {
      setReportsLoading(false);
    }
  }

  async function generateWeeklyReport() {
    setReportsLoading(true);
    setReportsStatus('Generating weekly report...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ report?: WeeklyReportRecord; error?: string }>(res, 'Could not generate weekly report.');
      if (!res.ok || !data.report) throw new Error(data.error ?? 'Could not generate weekly report.');
      setWeeklyReports(prev => [data.report!, ...prev.filter(report => report.id !== data.report!.id)]);
      setReportsStatus('Weekly report generated.');
    } catch (err) {
      setReportsStatus(err instanceof Error ? err.message : 'Could not generate weekly report.');
    } finally {
      setReportsLoading(false);
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

  async function createShippingLabel(order: OrderRecord) {
    setShippingLabelSavingId(order.id);
    setOrdersStatus('Creating shipping label...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-shipping-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          deliveryMethod: order.shippingMethod ?? 'australia_post',
          carrier: order.shippingCarrier ?? '',
          service: order.shippingService ?? '',
          trackingNumber: order.trackingNumber ?? '',
          shippingChargeCents: order.shippingChargeCents ?? 0,
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await readAdminJson<{ order?: OrderRecord; label?: { printUrl?: string }; printUrl?: string; error?: string }>(res, 'Shipping labels are unavailable in this environment.');
      if (!res.ok || !data.order) throw new Error(data.error ?? 'Could not create shipping label');
      setOrders(prev => prev.map(item => item.id === data.order!.id ? data.order! : item));
      const printUrl = data.printUrl ?? data.label?.printUrl ?? data.order.shippingLabelUrl;
      if (printUrl) {
        window.open(printUrl, '_blank', 'noopener,noreferrer');
      }
      setOrdersStatus(`Shipping label created for ${data.order.customerName}.`);
    } catch (err) {
      setOrdersStatus(err instanceof Error ? err.message : 'Could not create shipping label.');
    } finally {
      setShippingLabelSavingId(null);
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
    setOpenLeadDetailId(enquiryId);
    if (!leadDetails[enquiryId]) {
      void loadLeadDetail(enquiryId);
    }
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
      archivedAt: '',
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
          archivedAt: next.archivedAt ?? '',
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

  async function uploadEditProductMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !editProduct) return;

    const { slug, title, heroImage } = editProduct;
    setMediaLoading(true);
    setEditProductMediaStatus(`Uploading ${files.length} photo${files.length === 1 ? '' : 's'}...`);

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        uploadedUrls.push(await uploadProductImage(slug, file, title));
      }

      setEditProduct(prev => {
        if (!prev) return prev;
        const gallery = parseGalleryText(prev.galleryText);
        const nextGallery = [...gallery];
        for (const url of uploadedUrls) {
          if (url && !nextGallery.includes(url)) nextGallery.push(url);
        }
        return {
          ...prev,
          heroImage: prev.heroImage || uploadedUrls[0] || heroImage,
          galleryText: formatGalleryText(nextGallery),
        };
      });

      setEditProductMediaStatus('Photo uploaded to this draft. Click Queue Edit to save it.');
    } catch (err) {
      setEditProductMediaStatus(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setMediaLoading(false);
      if (editProductFileRef.current) editProductFileRef.current.value = '';
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
    const availability = product.availability ?? (product.status === 'coming-soon' ? 'coming_next_container' : 'available_in_australia');
    return {
      store: Boolean(product.store),
      slug: product.slug,
      title: product.title,
      price: String(product.price),
      compareAtPrice: product.compareAtPrice !== undefined ? String(product.compareAtPrice) : '',
      saleLabel: product.saleLabel ?? '',
      category: String(product.category ?? ''),
      productType: product.productType ?? 'stock',
      status: (['available', 'on-sale', 'coming-soon'].includes(product.status) ? product.status : 'available') as ProductStatus,
      availability,
      purchasableOnline: product.purchasableOnline ?? (availability === 'available_in_australia'),
      depositEnabled: product.depositEnabled ?? (availability === 'available_in_australia'),
      fullPaymentEnabled: product.fullPaymentEnabled ?? (availability === 'available_in_australia'),
      sourceType: product.sourceType ?? 'other',
      fulfilmentType: product.fulfilmentType ?? 'quote_required',
      shippingSize: product.shippingSize ?? 'medium',
      leadTimeText: product.leadTimeText ?? '',
      containerEtaText: product.containerEtaText ?? '',
      containerEtaDate: product.containerEtaDate ?? '',
      weight: product.weight !== undefined ? String(product.weight) : '',
      dimensionLength: product.dimensions?.length !== undefined ? String(product.dimensions.length) : '',
      dimensionWidth: product.dimensions?.width !== undefined ? String(product.dimensions.width) : '',
      dimensionHeight: product.dimensions?.height !== undefined ? String(product.dimensions.height) : '',
      pickupLocation: product.pickupLocation ?? '',
      requiresInstallation: Boolean(product.requiresInstallation),
      packedWeightKg: product.packedWeightKg !== undefined ? String(product.packedWeightKg) : '',
      packedLengthCm: product.packedLengthCm !== undefined ? String(product.packedLengthCm) : '',
      packedWidthCm: product.packedWidthCm !== undefined ? String(product.packedWidthCm) : '',
      packedHeightCm: product.packedHeightCm !== undefined ? String(product.packedHeightCm) : '',
      shippingDataStatus: product.shippingDataStatus ?? 'estimated',
      tagline: product.tagline || product.description || '',
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
      internalStockEstimate: product.internalStockEstimate ?? '',
      targetAustraliaStock: product.targetAustraliaStock ?? '',
      containerReorderQuantity: product.containerReorderQuantity ?? '',
      minimumComfortStock: product.minimumComfortStock ?? '',
      lastStockCheckedAt: product.lastStockCheckedAt ?? '',
      lastStockCheckedBy: product.lastStockCheckedBy ?? '',
      containerEligible: Boolean(product.containerEligible),
      usualContainerLeadTimeDays: product.usualContainerLeadTimeDays ?? '',
      supplierNotes: product.supplierNotes ?? '',
      notes: '',
    };
  }

  function queuedShopDraftFromForm(form: NewProductForm, slug: string): QueuedShopDraft {
    const gallery = parseGalleryText(form.galleryText);
    const availability = form.availability;
    return {
      store: true,
      slug,
      title: form.title.trim(),
      name: form.title.trim(),
      description: form.description.trim(),
      price: form.price.trim(),
      category: form.category.trim(),
      tagline: form.tagline.trim(),
      status: 'available',
      productType: form.productType,
      availability,
      purchasableOnline: form.purchasableOnline,
      depositEnabled: form.depositEnabled,
      fullPaymentEnabled: form.fullPaymentEnabled,
      sourceType: form.sourceType,
      fulfilmentType: form.fulfilmentType,
      shippingSize: form.shippingSize,
      leadTimeText: form.leadTimeText.trim(),
      containerEtaText: form.containerEtaText.trim(),
      containerEtaDate: form.containerEtaDate.trim(),
      weight: optionalPositiveNumber(form.weight),
      dimensions: partialDimensionsFromForm(form),
      pickupLocation: form.pickupLocation.trim(),
      requiresInstallation: form.requiresInstallation,
      packedWeightKg: form.packedWeightKg ? Number(form.packedWeightKg) : undefined,
      packedLengthCm: form.packedLengthCm ? Number(form.packedLengthCm) : undefined,
      packedWidthCm: form.packedWidthCm ? Number(form.packedWidthCm) : undefined,
      packedHeightCm: form.packedHeightCm ? Number(form.packedHeightCm) : undefined,
      shippingDataStatus: form.shippingDataStatus,
      featured: false,
      onSale: false,
      heroImage: form.heroImage.trim(),
      gallery,
      galleryCount: gallery.length,
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
    setActiveTab(product.store ? 'shop' : 'products');
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
    setProductEditStatus('');
    setEditProductMediaStatus('');
    setActiveTab(product.store ? 'shop' : 'products');
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
      const message = `The product edit form needs: ${missing.join(', ')}.`;
      setProductEditStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    if (editProduct.store && editProduct.productType === 'stock') {
      const stockMissing = [
        editProduct.fulfilmentType === 'ship' && !editProduct.packedWeightKg.trim() && 'packed weight',
        editProduct.fulfilmentType === 'ship' && !editProduct.packedLengthCm.trim() && 'packed length',
        editProduct.fulfilmentType === 'ship' && !editProduct.packedWidthCm.trim() && 'packed width',
        editProduct.fulfilmentType === 'ship' && !editProduct.packedHeightCm.trim() && 'packed height',
      ].filter(Boolean);
      if (stockMissing.length) {
        const message = `Shop stock items need: ${stockMissing.join(', ')}.`;
        setProductEditStatus(message);
        setMessages(prev => [...prev, { role: 'assistant', content: message }]);
        return;
      }
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
      const message = 'The gallery must contain at least one image URL or path.';
      setProductEditStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    if (invalidRelated.length) {
      const message = `These related product slugs are not valid: ${invalidRelated.join(', ')}.`;
      setProductEditStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    if (hasVideoFields && !editProduct.youtubeVideoUrl.trim()) {
      const message = 'Add a YouTube URL for the product video, or clear all video fields.';
      setProductEditStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    if (editProduct.youtubeVideoUrl.trim() && !isValidYouTubeVideoId(videoId)) {
      const message = 'The YouTube video URL does not look valid. Paste a normal YouTube, youtu.be, Shorts, embed URL, or a clean video ID.';
      setProductEditStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    if (videoId && !editProduct.youtubeVideoTitle.trim()) {
      const message = 'Add a short video title before queueing the product edit.';
      setProductEditStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    setLoading(true);
    setProductEditStatus('Queueing product edit...');
    adminFetch('/.netlify/functions/admin-product-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          slug: editProduct.slug,
          title: editProduct.title.trim(),
          category: editProduct.category.trim(),
          price: editProduct.price.trim(),
          compareAtPrice: editProduct.compareAtPrice.trim(),
          saleLabel: editProduct.saleLabel.trim(),
          status: editProduct.status,
          productType: editProduct.productType,
          availability: editProduct.availability,
          purchasableOnline: editProduct.purchasableOnline,
          depositEnabled: editProduct.depositEnabled,
          fullPaymentEnabled: editProduct.fullPaymentEnabled,
          sourceType: editProduct.sourceType,
          fulfilmentType: editProduct.fulfilmentType,
          shippingSize: editProduct.shippingSize,
          leadTimeText: editProduct.leadTimeText.trim(),
          containerEtaText: editProduct.containerEtaText.trim(),
          containerEtaDate: editProduct.containerEtaDate.trim(),
          weight: editProduct.weight.trim(),
          dimensionLength: editProduct.dimensionLength.trim(),
          dimensionWidth: editProduct.dimensionWidth.trim(),
          dimensionHeight: editProduct.dimensionHeight.trim(),
          pickupLocation: editProduct.pickupLocation.trim(),
          requiresInstallation: editProduct.requiresInstallation,
          packedWeightKg: editProduct.packedWeightKg.trim(),
          packedLengthCm: editProduct.packedLengthCm.trim(),
          packedWidthCm: editProduct.packedWidthCm.trim(),
          packedHeightCm: editProduct.packedHeightCm.trim(),
          shippingDataStatus: editProduct.shippingDataStatus,
          onSale: editProduct.onSale,
          featured: editProduct.featured,
          tagline: editProduct.tagline.trim(),
          heroImage: editProduct.heroImage.trim(),
          gallery,
          relatedSlugs: editProduct.relatedSlugs,
          internalStockEstimate: editProduct.internalStockEstimate.trim(),
          targetAustraliaStock: editProduct.targetAustraliaStock.trim(),
          containerReorderQuantity: editProduct.containerReorderQuantity.trim(),
          minimumComfortStock: editProduct.minimumComfortStock.trim(),
          lastStockCheckedAt: editProduct.lastStockCheckedAt.trim(),
          lastStockCheckedBy: editProduct.lastStockCheckedBy.trim(),
          containerEligible: editProduct.containerEligible,
          usualContainerLeadTimeDays: editProduct.usualContainerLeadTimeDays.trim(),
          supplierNotes: editProduct.supplierNotes.trim(),
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
        const message = `${editProduct.title.trim()} edit queued. Open Pending to review and deploy it.`;
        setProductEditStatus(message);
        setMessages(prev => [...prev, { role: 'assistant', content: message }]);
        setEditProduct(null);
        setActiveTab('pending');
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Could not queue product edit.';
        setProductEditStatus(message);
        setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      })
      .finally(() => setLoading(false));
  }

  async function queueNewProduct() {
    const gallery = parseGalleryText(newProduct.galleryText);
    const missing = [
      !newProduct.title.trim() && 'title',
      !newProduct.price.trim() && 'price',
      !newProduct.tagline.trim() && 'tagline',
      !newProduct.category.trim() && 'category',
      !newProduct.description.trim() && 'description',
      !newProduct.heroImage.trim() && 'hero photo',
      gallery.length === 0 && 'gallery photos',
      newProduct.mode === 'business' && !newProduct.keySpecs.trim() && 'key specs',
      newProduct.mode === 'shop' && newProduct.productType === 'stock' && newProduct.fulfilmentType === 'ship' && !newProduct.packedWeightKg.trim() && 'packed weight',
      newProduct.mode === 'shop' && newProduct.productType === 'stock' && newProduct.fulfilmentType === 'ship' && !newProduct.packedLengthCm.trim() && 'packed length',
      newProduct.mode === 'shop' && newProduct.productType === 'stock' && newProduct.fulfilmentType === 'ship' && !newProduct.packedWidthCm.trim() && 'packed width',
      newProduct.mode === 'shop' && newProduct.productType === 'stock' && newProduct.fulfilmentType === 'ship' && !newProduct.packedHeightCm.trim() && 'packed height',
    ].filter(Boolean);

    if (missing.length) {
      const message = `The new product form needs: ${missing.join(', ')}.`;
      setNewProductStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    const proposedSlug = slugifyTitle(newProduct.title);
    if (products.some(product => product.slug === proposedSlug)) {
      const message = `A product already uses the slug "${proposedSlug}". Change the title or ask me to edit the existing product instead.`;
      setNewProductStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
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
      const message = 'Add a YouTube URL for the new product video, or clear all video fields.';
      setNewProductStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    if (newProduct.youtubeVideoUrl.trim() && !isValidYouTubeVideoId(videoId)) {
      const message = 'The YouTube video URL does not look valid. Paste a normal YouTube, youtu.be, Shorts, embed URL, or a clean video ID.';
      setNewProductStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    if (newProduct.mode === 'business' && videoId && !newProduct.youtubeVideoTitle.trim()) {
      const message = 'Add a short video title before queueing the new product draft.';
      setNewProductStatus(message);
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      return;
    }

    const proposedPath = `src/content/products/accessories/${proposedSlug}.md`;
    const stockInstructions = newProduct.productType === 'stock'
      ? `\nProduct type: stock\n` +
        `Fulfilment type: ${newProduct.fulfilmentType}\n` +
        `Shipping size: ${newProduct.shippingSize}\n` +
        `Actual item weight kg, before packaging: ${newProduct.weight.trim() || 'not provided'}\n` +
        `Actual item dimensions cm, before packaging: ${formatPartialDimensions(newProduct)}\n` +
        `Pickup location: ${newProduct.pickupLocation.trim() || 'none'}\n` +
        `Requires installation: ${newProduct.requiresInstallation ? 'yes' : 'no'}\n` +
        `Packed weight kg: ${newProduct.fulfilmentType === 'ship' ? newProduct.packedWeightKg.trim() : 'none'}\n` +
        `Packed dimensions cm: ${newProduct.fulfilmentType === 'ship' ? formatPackedDimensions(newProduct) : 'none'}\n` +
        `Shipping data status: ${newProduct.fulfilmentType === 'ship' ? newProduct.shippingDataStatus : 'none'}\n` +
        `Do not copy packed box specs into item specs. If only some actual item dimensions are provided, include only those known dimension fields and do not invent missing length, width, or height. If actual item specs are not provided, omit weight and dimensions from frontmatter.`
      : `\nProduct type: service\nFulfilment type: ${newProduct.fulfilmentType}\nShipping size: none\n`;

    if (newProduct.mode === 'business') {
      setShowChatDrawer(true);
      setActiveTab('pending');
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

      sendMessage(
        `Create a new ${newProduct.category} product page using the existing product markdown format.\n\n` +
        `Title: ${newProduct.title.trim()}\n` +
        `Price: ${newProduct.price.trim()}\n` +
        `Original price / was price: none\n` +
        `Sale label: none\n` +
        `Tagline: ${newProduct.tagline.trim()}\n` +
        `Status: available\n` +
        `Availability: available_in_australia\n` +
        `Online purchase: yes\n` +
        `Deposit enabled: yes\n` +
        `Full payment enabled: yes\n` +
        `Source type: other\n` +
        `Public lead time: none\n` +
        `Public container ETA: none\n` +
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
      return;
    }

    const queuedDraft = queuedShopDraftFromForm(newProduct, proposedSlug);
    setQueuedShopDrafts(prev => [
      {
        ...queuedDraft,
        pendingLabel: 'Queued shop item',
      },
      ...prev.filter(item => item.slug !== proposedSlug),
    ]);
    setNewProductStatus('');
    setShowChatDrawer(false);
    setActiveTab('shop');
    setShowNewProductForm(false);

    const result = await sendMessage(
      `Create a new shop item markdown file under src/content/products/accessories/ using the shop schema.\n\n` +
      `Title: ${newProduct.title.trim()}\n` +
      `Slug: use a URL-safe slug based on the title.\n` +
      `Category: ${newProduct.category.trim()}\n` +
      `Price: ${newProduct.price.trim()}\n` +
      `Tagline: ${newProduct.tagline.trim()}\n` +
      `Description/body copy: ${newProduct.description.trim()}\n` +
      `Hero image: ${newProduct.heroImage.trim()}\n` +
      `Gallery order, one image per line:\n${gallery.join('\n')}\n` +
      `Availability: ${newProduct.availability}\n` +
      `Online purchase: ${newProduct.purchasableOnline ? 'yes' : 'no'}\n` +
      `Source type: ${newProduct.sourceType}\n` +
      `Public lead time: ${newProduct.leadTimeText.trim() || 'none'}\n` +
      `Public container ETA: ${newProduct.containerEtaText.trim() || 'none'}\n` +
      `Public container ETA date: ${newProduct.containerEtaDate.trim() || 'none'}${stockInstructions}\n\n` +
      `Keep the file simple and owner-friendly. Use store: true and fill only the fields needed by the shop schema. ` +
      `Do not add business-product-only fields such as keySpecs or YouTube metadata.`
    );

    const queuedChange = result?.pendingChanges?.find(change => change.path === proposedPath)
      ?? result?.pendingChanges?.find(change => change.path.endsWith(`/${proposedSlug}.md`));

    if (!queuedChange) {
      setQueuedShopDrafts(prev => prev.filter(item => item.slug !== proposedSlug));
      setNewProductStatus('The shop item could not be queued. Try again.');
      return;
    }

    setQueuedShopDrafts(prev => prev.map(item => item.slug === proposedSlug ? {
      ...item,
      pendingPath: queuedChange.path,
      pendingLabel: queuedChange.description || 'Queued in Pending',
    } : item));
    setNewProduct(EMPTY_PRODUCT_FORM);
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

  function queuePaymentSettingsUpdate() {
    const percent = Number(paymentDepositPercent.trim());
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setPaymentSettingsStatus('Enter a deposit percentage between 0 and 100.');
      return;
    }

    const title = paymentNoticeTitle.trim() || 'Before you pay a deposit';
    const body = paymentNoticeBody
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (body.length === 0) {
      setPaymentSettingsStatus('Add at least one legal notice line.');
      return;
    }

    const nextSettings: PaymentSettings = {
      vehicleDepositPercent: Number((percent / 100).toFixed(10)),
      depositLegalNoticeTitle: title,
      depositLegalNoticeBody: body,
    };

    setPaymentSettings(nextSettings);
    setPaymentDepositPercent(formatDepositPercentInput(nextSettings.vehicleDepositPercent));
    setPaymentNoticeTitle(nextSettings.depositLegalNoticeTitle);
    setPaymentNoticeBody(nextSettings.depositLegalNoticeBody.join('\n'));
    setPending(prev => [
      ...prev.filter(change => change.path !== 'src/data/payment-settings.json'),
      makePendingChange(
        'src/data/payment-settings.json',
        `${JSON.stringify(nextSettings, null, 2)}\n`,
        `Update vehicle deposit to ${formatDepositPercentInput(nextSettings.vehicleDepositPercent)}%`
      ),
    ]);
    setPaymentSettingsStatus('Payment settings queued. Open Pending to preview and deploy.');
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
  const businessProducts = products.filter(product => product.store !== true);
  const shopCatalogueProducts = products.filter(product => product.store === true);
  const filteredBusinessProducts = businessProducts.filter((product) => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return true;
    return [product.title, product.name, product.slug, product.category, product.status, product.availability, product.sourceType, product.saleLabel]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const filteredShopProducts = shopCatalogueProducts.filter((product) => {
    const q = shopFilter.trim().toLowerCase();
    if (!q) return true;
    return [
      product.title,
      product.name,
      product.slug,
      product.category,
      product.status,
      product.productType,
      product.fulfilmentType,
      product.shippingSize,
      product.availability,
      product.sourceType,
      product.saleLabel,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const visibleQueuedShopDrafts = queuedShopDrafts.filter(draft => {
    if (products.some(product => product.slug === draft.slug)) return false;
    if (!draft.pendingPath) return true;
    return pending.some(change => change.path === draft.pendingPath);
  });
  const shopDisplayProducts = [...visibleQueuedShopDrafts, ...filteredShopProducts];
  const businessSections = [
    { key: 'caravan', label: 'Caravans', items: filteredBusinessProducts.filter(product => product.category === 'caravan') },
    { key: 'slide-on', label: 'Slide-ons', items: filteredBusinessProducts.filter(product => product.category === 'slide-on') },
    { key: 'expedition', label: 'Expedition', items: filteredBusinessProducts.filter(product => product.category === 'expedition') },
  ];
  const otherBusinessProducts = filteredBusinessProducts.filter(product => !['caravan', 'slide-on', 'expedition'].includes(String(product.category)));
  const shopSections = [
    { key: 'stock', label: 'Shop stock items', items: shopDisplayProducts.filter(product => product.productType === 'stock') },
    { key: 'service', label: 'Shop services', items: shopDisplayProducts.filter(product => product.productType === 'service') },
  ];
  const renderProductCard = (product: ProductRecord, variant: 'business' | 'shop') => {
    const isShop = variant === 'shop';
    const isQueuedDraft = isShop && Boolean((product as QueuedShopDraft).pendingLabel);
    const metaParts = isShop
      ? [
          'Shop item',
          SHOP_PRODUCT_TYPE_LABELS[product.productType ?? 'stock'],
          product.category,
          product.price,
          product.compareAtPrice ? `was ${product.compareAtPrice}` : '',
          SHOP_FULFILMENT_LABELS[product.fulfilmentType ?? 'quote_required'],
          SHOP_SHIPPING_SIZE_LABELS[product.shippingSize ?? 'medium'],
          product.availability ?? product.status,
          product.purchasableOnline ? 'online' : '',
          product.requiresInstallation ? 'install' : '',
          product.shippingDataStatus ? SHOP_SHIPPING_DATA_STATUS_LABELS[product.shippingDataStatus] : '',
          product.galleryCount ?? 0 ? `${product.galleryCount} photos` : '',
        ]
      : [
          'Vehicle',
          product.category,
          product.price,
          product.compareAtPrice ? `was ${product.compareAtPrice}` : '',
          product.availability ?? product.status,
          product.purchasableOnline ? 'online' : '',
          product.galleryCount ?? 0 ? `${product.galleryCount} photos` : '',
          activeOrderCounts[product.slug] ? `${activeOrderCounts[product.slug]} active order${activeOrderCounts[product.slug] === 1 ? '' : 's'}` : '',
        ];
    const actionColumns = isShop ? '1fr' : product.onSale || product.status === 'on-sale' ? '1fr 1fr 1fr' : '1fr 1fr';

    return (
      <div key={product.slug} style={{ background: isQueuedDraft ? '#20140c' : '#1a1a1a', border: isQueuedDraft ? '1px solid #7c3a10' : '1px solid #303030', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)' }}>
        <AdminProductThumb src={product.heroImage} title={product.title} />
        <div style={{ padding: '0.65rem 0.7rem', minWidth: 0, display: 'grid', gap: '0.35rem', alignContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.25, minWidth: 0 }}>{product.title}</div>
            {isQueuedDraft && (
              <span style={{ background: '#7c3a10', color: '#fed7aa', border: '1px solid #fb923c', borderRadius: '999px', padding: '0.14rem 0.45rem', fontSize: '0.66rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                {(product as QueuedShopDraft).pendingLabel ?? 'Pending'}
              </span>
            )}
          </div>
          <div style={{ color: '#aaa', fontSize: '0.74rem' }}>
            {metaParts.filter(Boolean).join(' · ')}
          </div>
          {isQueuedDraft && (
            <div style={{ color: '#fb923c', fontSize: '0.7rem', lineHeight: 1.4 }}>
              Queued locally and waiting in Pending Changes.
            </div>
          )}
          {product.store && product.productType === 'stock' && !isQueuedDraft && (
            <div style={{ color: '#888', fontSize: '0.7rem', lineHeight: 1.4 }}>
              {product.fulfilmentType === 'ship'
                ? 'Ship-ready stock item with packed shipping dimensions saved for checkout and Australia Post.'
                : product.fulfilmentType === 'pickup'
                  ? 'Pickup stock item with location details saved for staff.'
                  : product.fulfilmentType === 'install'
                    ? 'Installation item for the workshop team.'
                    : 'Quote-required stock item.'}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: actionColumns, gap: '0.35rem' }}>
            <button
              onClick={() => startStructuredEdit(product)}
              style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
            >
              Edit
            </button>
            {!isShop && (
              <button
                onClick={() => startProductOrder(product, 'deposit_received')}
                style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
              >
                Order
              </button>
            )}
            {!isShop && (product.onSale || product.status === 'on-sale') && (
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
    );
  };
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
    active: enquiries.filter(enquiry => !isArchivedEnquiry(enquiry) && !isClosedEnquiry(enquiry)).length,
    needsResponse: enquiries.filter(enquiry => !isArchivedEnquiry(enquiry) && !isClosedEnquiry(enquiry) && !hasCustomerResponse(enquiry)).length,
    followUpDue: enquiries.filter(enquiry => !isArchivedEnquiry(enquiry) && isFollowUpDue(enquiry)).length,
    hot: enquiries.filter(enquiry => !isArchivedEnquiry(enquiry) && enquiry.leadStatus?.priority === 'hot' && !isClosedEnquiry(enquiry)).length,
    all: enquiries.filter(enquiry => !isArchivedEnquiry(enquiry)).length,
    archived: enquiries.filter(isArchivedEnquiry).length,
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
  const matchTargetLabel = (suggestion: CopilotMatchSuggestion) => {
    if (suggestion.targetType === 'customer') {
      const customer = copilotCustomers.find(item => item.id === suggestion.targetId);
      return customer?.name || customer?.email || customer?.phone || suggestion.targetId;
    }
    const lead = copilotLeads.find(item => item.id === suggestion.targetId);
    const customer = copilotCustomers.find(item => item.id === lead?.customerId);
    return `${customer?.name || customer?.email || 'Lead'}${lead?.productInterest ? ` · ${lead.productInterest}` : ''}`;
  };
  const pendingGmailSuggestions = gmailThreads.reduce((count, thread) => count + (!thread.matchDecision ? (thread.suggestions?.length || 0) : 0), 0);
  const pendingDriveSuggestions = driveFiles.reduce((count, file) => count + (!file.matchDecision ? (file.suggestions?.length || 0) : 0), 0);
  const panelTabs: PanelTab[] = ['dashboard', 'products', 'shop', 'orders', 'settings', 'media', 'homepage', 'enquiries', 'customers', 'leads', 'drafts', 'audit', 'knowledge', 'google', 'matches', 'reports', 'pending'];

  function tabLabel(tab: PanelTab) {
    if (tab === 'pending') return `Pending (${pending.length})`;
    return tab.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function selectTab(tab: PanelTab) {
    setActiveTab(tab);
    setShowMobileMenu(false);
  }

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
        <div className="admin-mobile-nav" style={{ display: 'block', padding: '0.75rem 1rem', borderBottom: '1px solid #333', background: '#111' }}>
          <button
            type="button"
            onClick={() => setShowMobileMenu(prev => !prev)}
            aria-expanded={showMobileMenu}
            aria-controls="adminMobileMenu"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <span aria-hidden="true" style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ width: '18px', height: '2px', background: '#fff', borderRadius: '999px', display: 'block' }} />
                <span style={{ width: '18px', height: '2px', background: '#fff', borderRadius: '999px', display: 'block' }} />
                <span style={{ width: '18px', height: '2px', background: '#fff', borderRadius: '999px', display: 'block' }} />
              </span>
              <span>Menu</span>
            </span>
            <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 700 }}>{tabLabel(activeTab)}</span>
          </button>
          {showMobileMenu && (
            <div
              id="adminMobileMenu"
              style={{
                marginTop: '0.75rem',
                background: '#121212',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '0.5rem',
                maxHeight: '60vh',
                overflowY: 'auto',
                boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.35rem 0.55rem 0.55rem' }}>
                Admin sections
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {panelTabs.map(tab => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => selectTab(tab)}
                      style={{
                        background: isActive ? '#E8540A' : 'transparent',
                        color: isActive ? '#fff' : '#ddd',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.8rem 0.75rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        lineHeight: 1.2,
                      }}
                    >
                      {tabLabel(tab)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <AdminSectionBoundary>
            <AdminDashboard pendingCount={pending.length} />
          </AdminSectionBoundary>
        )}

        {(activeTab === 'products' || activeTab === 'shop') && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: editProduct || showNewProductForm ? 0 : '0.45rem' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>
                    {editProduct
                      ? (editProduct.store ? 'Edit Shop Item' : 'Edit Product')
                      : showNewProductForm
                        ? (newProductMode === 'shop' ? 'Add Shop Item' : 'Add Product Draft')
                        : activeTab === 'shop'
                          ? 'Shop Manager'
                          : 'Product Manager'}
                  </div>
                  {editProduct && <div style={{ color: '#888', fontSize: '0.74rem', marginTop: '0.18rem' }}>{editProduct.slug}</div>}
                </div>
                {editProduct && (
                  <button onClick={() => {
                    setEditProduct(null);
                    setEditProductMediaStatus('');
                  }} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.42rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                    Back
                  </button>
                )}
                {showNewProductForm && !editProduct && (
                  <button onClick={() => {
                    setShowNewProductForm(false);
                    setNewProductStatus('');
                  }} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.42rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                    Back
                  </button>
                )}
                {!editProduct && !showNewProductForm && (
                  <button onClick={() => {
                    const mode = activeTab === 'shop' ? 'shop' : 'business';
                    setNewProductMode(mode);
                    setNewProduct({
                      ...EMPTY_PRODUCT_FORM,
                      mode,
                      ...(mode === 'shop' ? { category: '', fulfilmentType: 'pickup' as ShopFulfilmentType, pickupLocation: DEFAULT_PICKUP_LOCATION } : {}),
                    });
                    setNewProductStatus('');
                    setShowNewProductForm(true);
                  }} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.46rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>
                    {activeTab === 'shop' ? 'Add Shop Item' : 'Add Product'}
                  </button>
                )}
              </div>
              {!editProduct && !showNewProductForm && (
                <input
                  value={activeTab === 'shop' ? shopFilter : productFilter}
                  onChange={e => activeTab === 'shop' ? setShopFilter(e.target.value) : setProductFilter(e.target.value)}
                  placeholder={activeTab === 'shop' ? 'Search shop items...' : 'Search products...'}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.65rem', fontSize: '0.82rem', outline: 'none' }}
                />
              )}
              {newProductStatus && !editProduct && !showNewProductForm && (
                <div style={{ marginTop: '0.55rem', background: '#2a1410', border: '1px solid #7c2d12', color: '#fed7aa', borderRadius: '6px', padding: '0.5rem 0.65rem', fontSize: '0.76rem', lineHeight: 1.4 }}>
                  {newProductStatus}
                </div>
              )}
            </div>
            {!editProduct && !showNewProductForm && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
                {productsLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading products...</p>}
                {!productsLoading && (
                  <>
                    {activeTab === 'shop' ? (
                      <>
                        {shopSections.map(section => section.items.length > 0 && (
                          <section key={section.key} style={{ display: 'grid', gap: '0.55rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{section.label} ({section.items.length})</div>
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                              {section.items.map(product => renderProductCard(product, 'shop'))}
                            </div>
                          </section>
                        ))}
                        {!shopSections.some(section => section.items.length > 0) && (
                          <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>No matching shop items</p>
                        )}
                      </>
                    ) : (
                      <>
                        {businessSections.map(section => section.items.length > 0 && (
                          <section key={section.key} style={{ display: 'grid', gap: '0.55rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{section.label} ({section.items.length})</div>
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                              {section.items.map(product => renderProductCard(product, 'business'))}
                            </div>
                          </section>
                        ))}
                        {otherBusinessProducts.length > 0 && (
                          <section style={{ display: 'grid', gap: '0.55rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Other ({otherBusinessProducts.length})</div>
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                              {otherBusinessProducts.map(product => renderProductCard(product, 'business'))}
                            </div>
                          </section>
                        )}
                        {!businessSections.some(section => section.items.length > 0) && otherBusinessProducts.length === 0 && (
                          <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>No matching camper or caravan products</p>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            {editProduct && (
              <div className="admin-edit-product-form" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.85rem', display: 'grid', gap: '0.6rem', alignContent: 'start', background: '#141414' }}>
                <input value={editProduct.title} onChange={e => setEditProduct(p => p && ({ ...p, title: e.target.value }))} placeholder="Title" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                <input
                  value={editProduct.category}
                  onChange={e => setEditProduct(p => p && ({ ...p, category: e.target.value }))}
                  placeholder={editProduct.store ? 'Shop category, e.g. Air Systems' : 'Category'}
                  style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}
                />
                <div className="admin-form-grid admin-form-grid--three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                  <input value={editProduct.price} onChange={e => setEditProduct(p => p && ({ ...p, price: e.target.value }))} placeholder="$72,000" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input value={editProduct.compareAtPrice} onChange={e => setEditProduct(p => p && ({ ...p, compareAtPrice: e.target.value }))} placeholder="Original price / was price" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <select value={editProduct.status} onChange={e => setEditProduct(p => p && ({ ...p, status: e.target.value as ProductStatus }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="available">Available</option>
                    <option value="on-sale">On sale</option>
                    <option value="coming-soon">Coming soon</option>
                  </select>
                </div>
                <input value={editProduct.tagline} onChange={e => {
                  setProductEditStatus('');
                  setEditProduct(p => p && ({ ...p, tagline: e.target.value }));
                }} placeholder={editProduct.store ? 'Short shop description' : 'Tagline'} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.4rem' }}>
                  <input value={editProduct.saleLabel} onChange={e => setEditProduct(p => p && ({ ...p, saleLabel: e.target.value }))} placeholder="Sale label" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <select value={editProduct.availability} onChange={e => setEditProduct(p => p && ({ ...p, availability: e.target.value as CommerceAvailability }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="available_in_australia">Available in Australia</option>
                    <option value="coming_next_container">Coming next container</option>
                    <option value="made_to_order">Made to order</option>
                    <option value="ask_availability">Ask about availability</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
                <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
                  <select value={editProduct.sourceType} onChange={e => setEditProduct(p => p && ({ ...p, sourceType: e.target.value as SourceType }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="other">Source type</option>
                    <option value="china_container">China container</option>
                    <option value="local_supplier">Local supplier</option>
                    <option value="workshop_stock">Workshop stock</option>
                    <option value="custom_made_to_order">Custom made to order</option>
                  </select>
                  <input value={editProduct.leadTimeText} onChange={e => setEditProduct(p => p && ({ ...p, leadTimeText: e.target.value }))} placeholder="Public lead-time text" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
                  <input value={editProduct.containerEtaText} onChange={e => setEditProduct(p => p && ({ ...p, containerEtaText: e.target.value }))} placeholder="Public container ETA text" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input type="date" value={editProduct.containerEtaDate} onChange={e => setEditProduct(p => p && ({ ...p, containerEtaDate: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                </div>
                {editProduct.store && (
                  <div style={{ display: 'grid', gap: '0.45rem', border: '1px solid #333', borderRadius: '6px', padding: '0.6rem', background: '#101010' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Shop Details</div>
                      <div style={{ color: '#777', fontSize: '0.68rem', marginTop: '0.15rem', lineHeight: 1.35 }}>Item specs are shown on the product page. Postage specs are the packed box/carton details used for shipping estimates.</div>
                    </div>
                    <div className="admin-form-grid admin-form-grid--three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' }}>
                      <select value={editProduct.productType} onChange={e => setEditProduct(p => p && ({ ...p, productType: e.target.value as ShopProductType }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                        <option value="stock">Stock item</option>
                        <option value="service">Service item</option>
                      </select>
                      <select value={editProduct.fulfilmentType} onChange={e => setEditProduct(p => p && ({ ...p, fulfilmentType: e.target.value as ShopFulfilmentType }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                        <option value="ship">Ship</option>
                        <option value="pickup">Pickup</option>
                        <option value="install">Install</option>
                        <option value="quote_required">Quote required</option>
                      </select>
                      <select value={editProduct.shippingSize} onChange={e => setEditProduct(p => p && ({ ...p, shippingSize: e.target.value as ShopShippingSize }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="oversized">Oversized</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gap: '0.4rem', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '0.55rem', background: '#151515' }}>
                      <div>
                        <div style={{ color: '#eee', fontWeight: 700, fontSize: '0.73rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Item specs shown on product page</div>
                        <div style={{ color: '#777', fontSize: '0.66rem', marginTop: '0.12rem', lineHeight: 1.35 }}>Use the actual item size and item weight before packaging.</div>
                      </div>
                      <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
                        <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                          Item weight (kg)
                          <input value={editProduct.weight} onChange={e => setEditProduct(p => p && ({ ...p, weight: e.target.value }))} placeholder="Actual item weight" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        </label>
                        <div className="admin-form-grid admin-form-grid--three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' }}>
                          <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                            Item L (cm)
                            <input value={editProduct.dimensionLength} onChange={e => setEditProduct(p => p && ({ ...p, dimensionLength: e.target.value }))} placeholder="Length" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                          </label>
                          <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                            Item W (cm)
                            <input value={editProduct.dimensionWidth} onChange={e => setEditProduct(p => p && ({ ...p, dimensionWidth: e.target.value }))} placeholder="Width" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                          </label>
                          <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                            Item H (cm)
                            <input value={editProduct.dimensionHeight} onChange={e => setEditProduct(p => p && ({ ...p, dimensionHeight: e.target.value }))} placeholder="Height" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
                      <input value={editProduct.pickupLocation} onChange={e => setEditProduct(p => p && ({ ...p, pickupLocation: e.target.value }))} placeholder="Pickup location" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.78rem' }}>
                        <input type="checkbox" checked={editProduct.requiresInstallation} onChange={e => setEditProduct(p => p && ({ ...p, requiresInstallation: e.target.checked }))} />
                        Requires installation
                      </label>
                    </div>
                    <div style={{ display: 'grid', gap: '0.4rem', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '0.55rem', background: '#151515' }}>
                      <div>
                        <div style={{ color: '#eee', fontWeight: 700, fontSize: '0.73rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Postage / packed box specs</div>
                        <div style={{ color: '#777', fontSize: '0.66rem', marginTop: '0.12rem', lineHeight: 1.35 }}>Use the boxed/carton size and packed weight. These can be bigger and heavier than the item.</div>
                      </div>
                    <div className="admin-form-grid admin-form-grid--four" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.4rem' }}>
                        <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                          Boxed weight (kg)
                          <input value={editProduct.packedWeightKg} onChange={e => setEditProduct(p => p && ({ ...p, packedWeightKg: e.target.value }))} placeholder="Packed weight" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        </label>
                        <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                          Boxed L (cm)
                          <input value={editProduct.packedLengthCm} onChange={e => setEditProduct(p => p && ({ ...p, packedLengthCm: e.target.value }))} placeholder="Box length" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        </label>
                        <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                          Boxed W (cm)
                          <input value={editProduct.packedWidthCm} onChange={e => setEditProduct(p => p && ({ ...p, packedWidthCm: e.target.value }))} placeholder="Box width" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        </label>
                        <label style={{ display: 'grid', gap: '0.2rem', color: '#aaa', fontSize: '0.66rem' }}>
                          Boxed H (cm)
                          <input value={editProduct.packedHeightCm} onChange={e => setEditProduct(p => p && ({ ...p, packedHeightCm: e.target.value }))} placeholder="Box height" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        </label>
                      </div>
                      <select value={editProduct.shippingDataStatus} onChange={e => setEditProduct(p => p && ({ ...p, shippingDataStatus: e.target.value as ShopShippingDataStatus }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                        <option value="estimated">Estimated shipping data</option>
                        <option value="confirmed">Confirmed shipping data</option>
                      </select>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: '0.55rem', alignItems: 'center', border: '1px solid #333', borderRadius: '6px', padding: '0.45rem', background: '#101010' }}>
                  <ProductImagePreview src={editProduct.heroImage} title={`${editProduct.title} hero`} />
                  <div style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
                    <div style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 700 }}>Hero Image</div>
                    <input value={editProduct.heroImage} onChange={e => setEditProduct(p => p && ({ ...p, heroImage: e.target.value }))} placeholder="Hero image URL or path" style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem', color: '#ddd', fontSize: '0.78rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.onSale} onChange={e => setEditProduct(p => p && ({ ...p, onSale: e.target.checked }))} />
                    On sale
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.featured} onChange={e => setEditProduct(p => p && ({ ...p, featured: e.target.checked }))} />
                    Featured
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.purchasableOnline} onChange={e => setEditProduct(p => p && ({ ...p, purchasableOnline: e.target.checked }))} />
                    Online purchase
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.depositEnabled} onChange={e => setEditProduct(p => p && ({ ...p, depositEnabled: e.target.checked }))} />
                    Deposit enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.fullPaymentEnabled} onChange={e => setEditProduct(p => p && ({ ...p, fullPaymentEnabled: e.target.checked }))} />
                    Full payment enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} title="Internal planning flag. Turn this on when this product can be included in a future China container order.">
                    <input type="checkbox" checked={editProduct.containerEligible} onChange={e => setEditProduct(p => p && ({ ...p, containerEligible: e.target.checked }))} />
                    Can reorder in China container
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem', border: '1px solid #333', borderRadius: '6px', padding: '0.6rem', background: '#101010' }}>
                  <input value={editProduct.internalStockEstimate} onChange={e => setEditProduct(p => p && ({ ...p, internalStockEstimate: e.target.value }))} placeholder="Internal stock estimate" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input value={editProduct.targetAustraliaStock} onChange={e => setEditProduct(p => p && ({ ...p, targetAustraliaStock: e.target.value }))} placeholder="Target Australia stock" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input value={editProduct.containerReorderQuantity} onChange={e => setEditProduct(p => p && ({ ...p, containerReorderQuantity: e.target.value }))} placeholder="Container reorder quantity" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input value={editProduct.minimumComfortStock} onChange={e => setEditProduct(p => p && ({ ...p, minimumComfortStock: e.target.value }))} placeholder="Minimum comfort stock" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input type="datetime-local" value={editProduct.lastStockCheckedAt} onChange={e => setEditProduct(p => p && ({ ...p, lastStockCheckedAt: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input value={editProduct.lastStockCheckedBy} onChange={e => setEditProduct(p => p && ({ ...p, lastStockCheckedBy: e.target.value }))} placeholder="Last stock checked by" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <input value={editProduct.usualContainerLeadTimeDays} onChange={e => setEditProduct(p => p && ({ ...p, usualContainerLeadTimeDays: e.target.value }))} placeholder="Usual container lead time days" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                </div>
                <textarea value={editProduct.supplierNotes} onChange={e => setEditProduct(p => p && ({ ...p, supplierNotes: e.target.value }))} placeholder="Private supplier or order notes" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
                <div style={{ display: 'grid', gap: '0.35rem', border: '1px solid #333', borderRadius: '6px', padding: '0.6rem', background: '#101010' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Quick Photo Upload</div>
                      <div style={{ color: '#777', fontSize: '0.68rem', marginTop: '0.12rem', lineHeight: 1.35 }}>Upload straight into this product, then the photo is added to the gallery below.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => editProductFileRef.current?.click()}
                      disabled={mediaLoading}
                      style={{ background: mediaLoading ? '#333' : '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.52rem 0.75rem', cursor: mediaLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      Add Photo
                    </button>
                  </div>
                  <input
                    ref={editProductFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    style={{ display: 'none' }}
                    onChange={uploadEditProductMedia}
                  />
                  {editProductMediaStatus && (
                    <div style={{ color: editProductMediaStatus.toLowerCase().includes('fail') || editProductMediaStatus.toLowerCase().includes('error') ? '#fb923c' : '#8f8', fontSize: '0.74rem', lineHeight: 1.35 }}>
                      {editProductMediaStatus}
                    </div>
                  )}
                </div>
                <ProductGalleryEditor
                  heroImage={editProduct.heroImage}
                  galleryText={editProduct.galleryText}
                  onGalleryTextChange={galleryText => setEditProduct(p => p && ({ ...p, galleryText }))}
                  onHeroImageChange={heroImage => setEditProduct(p => p && ({ ...p, heroImage }))}
                />
                {!editProduct.store && (
                  <>
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
                  </>
                )}
                <textarea value={editProduct.notes} onChange={e => setEditProduct(p => p && ({ ...p, notes: e.target.value }))} placeholder="Optional notes for copy/spec changes" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
                {productEditStatus && (
                  <div style={{
                    border: productEditStatus.toLowerCase().includes('queued') ? '1px solid #14532d' : '1px solid #7c2d12',
                    background: productEditStatus.toLowerCase().includes('queued') ? '#052e16' : '#2a1410',
                    color: productEditStatus.toLowerCase().includes('queued') ? '#86efac' : '#fed7aa',
                    borderRadius: '6px',
                    padding: '0.55rem',
                    fontSize: '0.76rem',
                    lineHeight: 1.4,
                  }}>
                    {productEditStatus}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <button onClick={() => {
                    setEditProduct(null);
                    setProductEditStatus('');
                    setEditProductMediaStatus('');
                  }} style={{ background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: '6px', padding: '0.55rem', cursor: 'pointer', fontWeight: 700 }}>
                    Cancel
                  </button>
                  <button onClick={queueStructuredEdit} disabled={loading} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.55rem', cursor: 'pointer', fontWeight: 700 }}>
                    Queue Edit
                  </button>
                </div>
              </div>
            )}
            {!editProduct && showNewProductForm && <div className="admin-new-product-form" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.85rem', display: 'grid', gap: '0.5rem', alignContent: 'start', background: '#141414' }}>
              <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNewProductMode('business');
                    setNewProduct(prev => ({ ...EMPTY_PRODUCT_FORM, ...prev, mode: 'business', category: ['slide-on', 'caravan', 'expedition'].includes(prev.category) ? prev.category : 'slide-on' }));
                  }}
                  style={{ background: newProduct.mode === 'business' ? '#E8540A' : '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.5rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  Camper / Caravan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewProductMode('shop');
                    setNewProductStatus('');
                    setNewProduct(prev => ({
                      ...EMPTY_PRODUCT_FORM,
                      ...prev,
                      mode: 'shop',
                      category: prev.mode === 'shop' ? prev.category : '',
                      productType: prev.productType ?? 'stock',
                      fulfilmentType: prev.mode === 'shop' ? prev.fulfilmentType : 'pickup',
                      shippingSize: prev.shippingSize ?? 'medium',
                      pickupLocation: prev.pickupLocation || DEFAULT_PICKUP_LOCATION,
                    }));
                  }}
                  style={{ background: newProduct.mode === 'shop' ? '#E8540A' : '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.5rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  Shop Item
                </button>
              </div>
              <input value={newProduct.title} onChange={e => setNewProduct(p => ({ ...p, title: e.target.value }))} placeholder={newProduct.mode === 'shop' ? 'Shop item title' : 'Product title'} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {newProduct.mode === 'business' ? (
                  <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="slide-on">Slide-on</option>
                    <option value="caravan">Caravan</option>
                    <option value="expedition">Expedition</option>
                  </select>
                ) : (
                  <input value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} placeholder="Shop category, e.g. Air Systems" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                )}
                <input value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} placeholder="$72,000" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              </div>
              <input value={newProduct.tagline} onChange={e => setNewProduct(p => ({ ...p, tagline: e.target.value }))} placeholder={newProduct.mode === 'shop' ? 'Short shop description' : 'Short tagline'} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              {newProduct.mode === 'business' ? (
                <textarea value={newProduct.keySpecs} onChange={e => setNewProduct(p => ({ ...p, keySpecs: e.target.value }))} placeholder="Key specs, one per line" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
              ) : (
                <div className="admin-shop-details" style={{ display: 'grid', gap: '0.45rem', border: '1px solid #333', borderRadius: '6px', padding: '0.6rem', background: '#101010' }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Shop Details</div>
                    <div style={{ color: '#777', fontSize: '0.68rem', marginTop: '0.15rem', lineHeight: 1.35 }}>Keep this simple. The owner only needs enough detail to create a clean shop entry.</div>
                  </div>
                  <div className="admin-form-grid admin-form-grid--three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' }}>
                    <select value={newProduct.productType} onChange={e => setNewProduct(p => ({ ...p, productType: e.target.value as ShopProductType }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                      <option value="stock">Stock item</option>
                      <option value="service">Service item</option>
                    </select>
                    <select value={newProduct.fulfilmentType} onChange={e => setNewProduct(p => ({ ...p, fulfilmentType: e.target.value as ShopFulfilmentType }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                      <option value="ship">Ship</option>
                      <option value="pickup">Pickup</option>
                      <option value="install">Install</option>
                      <option value="quote_required">Quote required</option>
                    </select>
                    <select value={newProduct.shippingSize} onChange={e => setNewProduct(p => ({ ...p, shippingSize: e.target.value as ShopShippingSize }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="oversized">Oversized</option>
                    </select>
                  </div>
                  <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
                    <select value={newProduct.availability} onChange={e => setNewProduct(p => ({ ...p, availability: e.target.value as CommerceAvailability }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                      <option value="available_in_australia">Available in Australia</option>
                      <option value="coming_next_container">Coming next container</option>
                      <option value="made_to_order">Made to order</option>
                      <option value="ask_availability">Ask about availability</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                    <select value={newProduct.sourceType} onChange={e => setNewProduct(p => ({ ...p, sourceType: e.target.value as SourceType }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                      <option value="other">Source type</option>
                      <option value="china_container">China container</option>
                      <option value="local_supplier">Local supplier</option>
                      <option value="workshop_stock">Workshop stock</option>
                      <option value="custom_made_to_order">Custom made to order</option>
                    </select>
                    <input value={newProduct.leadTimeText} onChange={e => setNewProduct(p => ({ ...p, leadTimeText: e.target.value }))} placeholder="Public lead-time text" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input value={newProduct.containerEtaText} onChange={e => setNewProduct(p => ({ ...p, containerEtaText: e.target.value }))} placeholder="Public container ETA text" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <input type="date" value={newProduct.containerEtaDate} onChange={e => setNewProduct(p => ({ ...p, containerEtaDate: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.78rem' }}>
                      <input type="checkbox" checked={newProduct.purchasableOnline} onChange={e => setNewProduct(p => ({ ...p, purchasableOnline: e.target.checked }))} />
                      Online purchase
                    </label>
                  </div>
                  {newProduct.productType === 'stock' && (
                    <>
                      <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        <input value={newProduct.weight} onChange={e => setNewProduct(p => ({ ...p, weight: e.target.value }))} placeholder="Weight kg" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        <div className="admin-form-grid admin-form-grid--three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' }}>
                          <input value={newProduct.dimensionLength} onChange={e => setNewProduct(p => ({ ...p, dimensionLength: e.target.value }))} placeholder="L cm" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                          <input value={newProduct.dimensionWidth} onChange={e => setNewProduct(p => ({ ...p, dimensionWidth: e.target.value }))} placeholder="W cm" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                          <input value={newProduct.dimensionHeight} onChange={e => setNewProduct(p => ({ ...p, dimensionHeight: e.target.value }))} placeholder="H cm" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        </div>
                      </div>
                      <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
                        <input value={newProduct.pickupLocation} readOnly style={{ background: '#1a1a1a', border: '1px solid #444', color: '#aaa', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.78rem' }}>
                          <input type="checkbox" checked={newProduct.requiresInstallation} onChange={e => setNewProduct(p => ({ ...p, requiresInstallation: e.target.checked }))} />
                          Requires installation
                        </label>
                      </div>
                      <div className="admin-form-grid admin-form-grid--four" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.4rem' }}>
                        <input value={newProduct.packedWeightKg} onChange={e => setNewProduct(p => ({ ...p, packedWeightKg: e.target.value }))} placeholder="Packed weight kg" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        <input value={newProduct.packedLengthCm} onChange={e => setNewProduct(p => ({ ...p, packedLengthCm: e.target.value }))} placeholder="Packed L cm" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        <input value={newProduct.packedWidthCm} onChange={e => setNewProduct(p => ({ ...p, packedWidthCm: e.target.value }))} placeholder="Packed W cm" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                        <input value={newProduct.packedHeightCm} onChange={e => setNewProduct(p => ({ ...p, packedHeightCm: e.target.value }))} placeholder="Packed H cm" inputMode="decimal" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                      </div>
                      <select value={newProduct.shippingDataStatus} onChange={e => setNewProduct(p => ({ ...p, shippingDataStatus: e.target.value as ShopShippingDataStatus }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                        <option value="estimated">Estimated shipping data</option>
                        <option value="confirmed">Confirmed shipping data</option>
                      </select>
                    </>
                  )}
                </div>
              )}
              <textarea value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder={newProduct.mode === 'shop' ? 'Item description' : 'Product description'} rows={5} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4, minHeight: '6rem' }} />
              <div style={{ display: 'grid', gap: '0.45rem', border: '1px solid #333', borderRadius: '6px', padding: '0.55rem', background: '#101010' }}>
                <div className="admin-form-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Product Photos</div>
                    <div style={{ color: '#777', fontSize: '0.68rem', marginTop: '0.15rem' }}>{newProduct.title.trim() ? `Uploads will be saved under ${slugifyTitle(newProduct.title)}` : 'Enter the product title first, then upload photos.'}</div>
                  </div>
                  <label
                    htmlFor="newProductPhotoUpload"
                    aria-disabled={mediaLoading || !newProduct.title.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '2.6rem',
                      background: mediaLoading || !newProduct.title.trim() ? '#222' : '#E8540A',
                      color: mediaLoading || !newProduct.title.trim() ? '#666' : '#fff',
                      border: `1px solid ${mediaLoading || !newProduct.title.trim() ? '#444' : '#E8540A'}`,
                      borderRadius: '8px',
                      padding: '0.55rem 0.8rem',
                      cursor: mediaLoading || !newProduct.title.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      touchAction: 'manipulation',
                      userSelect: 'none',
                      pointerEvents: mediaLoading || !newProduct.title.trim() ? 'none' : 'auto',
                    }}
                  >
                    Upload Photos
                    <input
                      id="newProductPhotoUpload"
                      ref={newProductFileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={mediaLoading || !newProduct.title.trim()}
                      style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        padding: 0,
                        margin: '-1px',
                        overflow: 'hidden',
                        clip: 'rect(0, 0, 0, 0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      }}
                      onChange={uploadNewProductMedia}
                    />
                  </label>
                </div>
                {newProductMediaStatus && <div style={{ color: newProductMediaStatus.includes('failed') || newProductMediaStatus.includes('Enter') ? '#fb923c' : '#aaa', fontSize: '0.7rem' }}>{newProductMediaStatus}</div>}
                {newProduct.heroImage && (
                  <div className="admin-form-grid admin-form-grid--image" style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.5rem', alignItems: 'center' }}>
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
                {newProduct.mode === 'business' && (
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
                )}
              </div>
              {newProductStatus && (
                <div style={{
                  background: newProductStatus.toLowerCase().includes('queued') ? '#052e16' : '#2a1410',
                  border: newProductStatus.toLowerCase().includes('queued') ? '1px solid #14532d' : '1px solid #7c2d12',
                  color: newProductStatus.toLowerCase().includes('queued') ? '#86efac' : '#fed7aa',
                  borderRadius: '6px',
                  padding: '0.55rem',
                  fontSize: '0.76rem',
                  lineHeight: 1.4,
                }}>
                  {newProductStatus}
                </div>
              )}
              <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <button type="button" onClick={() => setShowNewProductForm(false)} style={{ background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: '6px', padding: '0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                  Cancel
                </button>
                <button type="button" onClick={queueNewProduct} disabled={loading} style={{ background: loading ? '#7c3a10' : '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem', cursor: loading ? 'wait' : 'pointer', fontWeight: 700 }}>
                  {loading ? 'Queueing...' : newProduct.mode === 'shop' ? 'Queue Shop Item' : 'Queue Product Draft'}
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
                          {order.orderSource && (
                            <span style={{ border: '1px solid #1d4ed8', color: '#93c5fd', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>
                              {order.orderSource === 'stripe_checkout' ? 'Stripe checkout' : order.orderSource}
                            </span>
                          )}
                          {order.shippingMethod && (
                            <span style={{ border: '1px solid #7c3aed', color: '#c4b5fd', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>
                              {SHIPPING_METHOD_LABELS[order.shippingMethod] ?? order.shippingMethod}
                            </span>
                          )}
                          {order.paymentType && (
                            <span style={{ border: '1px solid #256d3d', color: '#bbf7d0', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>
                              {order.paymentType === 'deposit' ? 'Deposit' : 'Full payment'}
                            </span>
                          )}
                          {order.purchaseKind && (
                            <span style={{ border: '1px solid #444', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>{order.purchaseKind}</span>
                          )}
                          {order.depositPaid && <span style={{ border: '1px solid #1a3a1a', color: '#8f8', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>Deposit paid</span>}
                          {typeof order.amountPaidCents === 'number' && (
                            <span style={{ border: '1px solid #444', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>
                              Paid {moneyFromCents(order.amountPaidCents, order.currency ?? 'AUD')}
                            </span>
                          )}
                          {order.paymentStatus && (
                            <span style={{ border: '1px solid #444', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>
                              {order.paymentStatus}
                            </span>
                          )}
                          {order.shippingStatus && (
                            <span style={{ border: '1px solid #444', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>
                              {order.shippingStatus}
                            </span>
                          )}
                          {order.nextActionDate && <span style={{ border: '1px solid #63301f', color: '#fb923c', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>Next: {order.nextActionDate}</span>}
                          {order.expectedArrivalDate && <span style={{ border: '1px solid #444', borderRadius: '999px', padding: '0.16rem 0.42rem' }}>ETA: {order.expectedArrivalDate}</span>}
                        </div>
                        <div style={{ color: '#777', fontSize: '0.72rem' }}>
                          {[order.customerPhone, order.customerEmail].filter(Boolean).join(' · ') || 'No contact details saved'}
                        </div>
                        {(order.shippingName || order.shippingAddressLine1 || order.shippingCity || order.shippingPostcode) && (
                          <div style={{ color: '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>
                            Delivery: {[order.shippingName, order.shippingAddressLine1, order.shippingAddressLine2, [order.shippingCity, order.shippingState, order.shippingPostcode].filter(Boolean).join(' '), order.shippingCountry].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {order.trackingNumber && (
                          <div style={{ color: '#93c5fd', fontSize: '0.72rem' }}>
                            Tracking: {order.trackingNumber}
                          </div>
                        )}
                        {order.shippingBlockReason && (
                          <div style={{ color: '#fb923c', fontSize: '0.72rem' }}>
                            Shipping blocked: {order.shippingBlockReason}
                          </div>
                        )}
                        {order.notes && <div style={{ color: '#ccc', fontSize: '0.76rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{order.notes}</div>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => createShippingLabel(order)}
                            disabled={shippingLabelSavingId === order.id}
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.38rem 0.55rem', cursor: shippingLabelSavingId === order.id ? 'wait' : 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                          >
                            {shippingLabelSavingId === order.id ? 'Creating...' : 'Create shipping label'}
                          </button>
                          {order.shippingLabelUrl && (
                            <button
                              type="button"
                              onClick={() => window.open(order.shippingLabelUrl, '_blank', 'noopener,noreferrer')}
                              style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.38rem 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              Print label
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem', display: 'grid', gap: '1rem', alignContent: 'start' }}>
            <section style={{ border: '1px solid #333', borderRadius: '8px', background: '#111', padding: '1rem', display: 'grid', gap: '0.8rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>Payment Settings</div>
                <div style={{ color: '#888', fontSize: '0.78rem', marginTop: '0.2rem', lineHeight: 1.45 }}>
                  Controls camper and caravan deposit checkout. The product page display and Stripe checkout use this same setting.
                </div>
              </div>

              {paymentSettingsStatus && (
                <div style={{ color: paymentSettingsStatus.startsWith('Enter') || paymentSettingsStatus.startsWith('Add') ? '#fb923c' : '#8f8', fontSize: '0.78rem', lineHeight: 1.4 }}>
                  {paymentSettingsStatus}
                </div>
              )}

              <label style={{ display: 'grid', gap: '0.3rem', color: '#ddd', fontSize: '0.78rem', fontWeight: 700 }}>
                Vehicle deposit percentage
                <input
                  value={paymentDepositPercent}
                  onChange={e => setPaymentDepositPercent(e.target.value)}
                  inputMode="decimal"
                  placeholder="33.333"
                  style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.58rem', fontSize: '0.86rem' }}
                />
                <span style={{ color: '#777', fontSize: '0.7rem', fontWeight: 400 }}>
                  Current saved setting: {formatDepositPercentInput(paymentSettings.vehicleDepositPercent)}%. Enter 33.333 for one third of the product price.
                </span>
              </label>

              <label style={{ display: 'grid', gap: '0.3rem', color: '#ddd', fontSize: '0.78rem', fontWeight: 700 }}>
                Deposit popup heading
                <input
                  value={paymentNoticeTitle}
                  onChange={e => setPaymentNoticeTitle(e.target.value)}
                  style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.58rem', fontSize: '0.86rem' }}
                />
              </label>

              <label style={{ display: 'grid', gap: '0.3rem', color: '#ddd', fontSize: '0.78rem', fontWeight: 700 }}>
                Deposit popup legal notice
                <textarea
                  value={paymentNoticeBody}
                  onChange={e => setPaymentNoticeBody(e.target.value)}
                  rows={7}
                  style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.58rem', fontSize: '0.82rem', lineHeight: 1.45 }}
                />
                <span style={{ color: '#777', fontSize: '0.7rem', fontWeight: 400 }}>
                  One line becomes one bullet in the buyer confirmation popup. Keep this factual and avoid saying consumer rights are excluded.
                </span>
              </label>

              <button
                type="button"
                onClick={queuePaymentSettingsUpdate}
                style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.7rem', cursor: 'pointer', fontWeight: 800 }}
              >
                Queue Payment Settings Update
              </button>
            </section>
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
                <optgroup label="Camper and caravan products">
                  {businessProducts.map(product => (
                    <option key={product.slug} value={mediaTargetValue('products', product.slug)}>{product.title}</option>
                  ))}
                </optgroup>
                <optgroup label="Shop items">
                  {shopCatalogueProducts.map(product => (
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
          <div data-testid="enquiries-scroll-container" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '1rem', borderBottom: '1px solid #333', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
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
            <div data-testid="enquiries-attention" style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #333', background: '#151515', display: 'grid', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.55rem', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>Needs Attention</div>
                  <div style={{ color: leadReminders.total ? '#fb923c' : '#8f8', fontSize: '0.74rem', marginTop: '0.15rem' }}>
                    {leadReminders.total ? `${leadReminders.total} reminder${leadReminders.total === 1 ? '' : 's'} across recent enquiries.` : 'No recent lead reminders.'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  {leadReminders.total > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLeadReminders(prev => !prev)}
                      aria-expanded={showLeadReminders}
                      style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                    >
                      {showLeadReminders ? 'Hide Reminders' : `Show Reminders (${leadReminders.total})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={enableBrowserLeadReminders}
                    disabled={browserRemindersEnabled}
                    style={{ background: browserRemindersEnabled ? '#102416' : '#222', border: browserRemindersEnabled ? '1px solid #1a3a1a' : '1px solid #444', color: browserRemindersEnabled ? '#8f8' : '#fff', borderRadius: '6px', padding: '0.42rem 0.55rem', cursor: browserRemindersEnabled ? 'default' : 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                  >
                    {browserRemindersEnabled ? 'Browser Alerts On' : 'Enable Browser Alerts'}
                  </button>
                </div>
              </div>
              {browserReminderStatus && (
                <div style={{ color: '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>
                  {browserReminderStatus}{browserReminderCandidates.length ? ` High-value reminders ready: ${browserReminderCandidates.length}.` : ''}
                </div>
              )}
              {showLeadReminders && leadReminders.total > 0 && (
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
            <div data-testid="enquiries-records" style={{ padding: '0.75rem', display: 'grid', gap: '0.65rem', alignContent: 'start' }}>
              {enquiriesStatus && <p style={{ color: '#fb923c', fontSize: '0.85rem', lineHeight: 1.45 }}>{enquiriesStatus}</p>}
              {enquiriesLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading enquiries...</p>}
              {!enquiriesLoading && enquiries.length > 0 && (
                <div style={{ position: 'sticky', top: '73px', zIndex: 4, display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0.35rem 0', background: '#111' }}>
                  {[
                    ['active', `Active ${queueCounts.active}`],
                    ['needs-response', `Needs response ${queueCounts.needsResponse}`],
                    ['follow-up-due', `Follow-up due ${queueCounts.followUpDue}`],
                    ['hot', `Hot ${queueCounts.hot}`],
                    ['all', `All ${queueCounts.all}`],
                    ['archived', `Archived ${queueCounts.archived}`],
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
                  id={`enquiry-${enquiry.id}`}
                  data-testid={`enquiry-card-${enquiry.id}`}
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
                      {isArchivedEnquiry(enquiry) && (
                        <div style={{ color: '#bbb', border: '1px solid #555', borderRadius: '999px', padding: '0.18rem 0.45rem', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>Archived</div>
                      )}
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
                  {(enquiry.fit_check_summary || enquiry.vehicle_make_model_year || enquiry.tray_type || enquiry.tray_length || enquiry.gvm_upgrade_status || enquiry.travellers || enquiry.travel_style || enquiry.towing_requirement || enquiry.budget_range || enquiry.timeframe || enquiry.main_questions || enquiry.vehicle_details || enquiry.budget_notes || enquiry.timeline || enquiry.source_note) && (
                    <div style={{ color: '#aaa', fontSize: '0.74rem', lineHeight: 1.45, display: 'grid', gap: '0.1rem' }}>
                      {enquiry.fitment_context && <div>Fitment context: {enquiry.fitment_context}</div>}
                      {enquiry.fit_check_summary && <div>Fit check: {enquiry.fit_check_summary}</div>}
                      {enquiry.vehicle_make_model_year && <div>Vehicle: {enquiry.vehicle_make_model_year}</div>}
                      {enquiry.tray_type && <div>Tray/tub type: {enquiry.tray_type}</div>}
                      {enquiry.tray_length && <div>Tray length: {enquiry.tray_length}</div>}
                      {enquiry.gvm_upgrade_status && <div>GVM upgrade: {enquiry.gvm_upgrade_status}</div>}
                      {enquiry.travellers && <div>Travellers: {enquiry.travellers}</div>}
                      {enquiry.travel_style && <div>Travel style: {enquiry.travel_style}</div>}
                      {enquiry.towing_requirement && <div>Towing requirement: {enquiry.towing_requirement}</div>}
                      {enquiry.budget_range && <div>Budget: {enquiry.budget_range}</div>}
                      {enquiry.timeframe && <div>Timeframe: {enquiry.timeframe}</div>}
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
                      <button
                        type="button"
                        data-testid={`archive-enquiry-${enquiry.id}`}
                        onClick={() => saveLeadStatus(enquiry, { archivedAt: isArchivedEnquiry(enquiry) ? '' : new Date().toISOString() })}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: isArchivedEnquiry(enquiry) ? '#12331f' : '#222', border: isArchivedEnquiry(enquiry) ? '1px solid #256d3d' : '1px solid #555', color: isArchivedEnquiry(enquiry) ? '#bbf7d0' : '#ddd', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: leadSaving === enquiry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}
                      >
                        {isArchivedEnquiry(enquiry) ? 'Restore' : 'Archive'}
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
                  const enquiryLink = lead.sourceEnquiryId ? `/admin#enquiry-${encodeURIComponent(lead.sourceEnquiryId)}` : '';
                  const cardStyle = { background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.75rem', display: 'grid', gap: '0.35rem', textDecoration: 'none', color: 'inherit', cursor: enquiryLink ? 'pointer' : 'default' } as const;
                  const content = (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                        <div style={{ color: '#fff', fontWeight: 800 }}>{customer?.name || customer?.email || customer?.phone || 'Unmatched customer'}</div>
                        <span style={{ color: '#fb923c', border: '1px solid #7c2d12', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase' }}>{lead.status || 'new'}</span>
                      </div>
                      <div style={{ color: '#aaa', fontSize: '0.76rem', lineHeight: 1.45 }}>Product: {lead.productInterest || 'Not specified'} · Score: {typeof lead.score === 'number' ? lead.score : 0}</div>
                      {lead.nextFollowUpDate && <div style={{ color: '#fb923c', fontSize: '0.74rem' }}>Next follow-up: {lead.nextFollowUpDate}</div>}
                      {lead.notes && <div style={{ color: '#888', fontSize: '0.74rem', lineHeight: 1.45 }}>{lead.notes}</div>}
                      <div style={{ color: '#666', fontSize: '0.68rem' }}>Source: {lead.source || 'unknown'} · Enquiry: {lead.sourceEnquiryId || 'none'} · Updated: {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : 'Not recorded'}</div>
                    </>
                  );
                  return (
                    enquiryLink ? (
                      <a
                        key={lead.id}
                        href={enquiryLink}
                        aria-label={`Open enquiry for ${customer?.name || customer?.email || customer?.phone || 'this lead'}`}
                        style={cardStyle}
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={lead.id} style={cardStyle}>
                        {content}
                      </div>
                    )
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

        {activeTab === 'google' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
            <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 900, fontSize: '1rem' }}>Connect Gmail and Drive</div>
                  <div style={{ color: '#888', fontSize: '0.78rem', marginTop: '0.25rem' }}>Owner Copilot only reads approved metadata and sends nothing.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={loadGoogleStatus} disabled={googleLoading} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem 0.65rem', cursor: googleLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>Refresh</button>
                  <button type="button" onClick={connectGoogle} disabled={googleLoading || googleStatus?.configured === false || googleStatus?.state === 'connected'} style={{ background: googleStatus?.state === 'connected' || googleStatus?.configured === false ? '#333' : '#E8540A', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.58rem 0.8rem', cursor: googleStatus?.state === 'connected' || googleStatus?.configured === false ? 'not-allowed' : 'pointer', fontWeight: 900, fontSize: '0.8rem' }}>{googleStatus?.state === 'connected' ? 'Google Connected' : 'Connect Google'}</button>
                  <button type="button" onClick={disconnectGoogle} disabled={googleLoading || googleStatus?.state !== 'connected'} style={{ background: googleStatus?.state === 'connected' ? '#7f1d1d' : '#333', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.48rem 0.65rem', cursor: googleStatus?.state === 'connected' ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '0.76rem' }}>Disconnect</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' }}>
                <div style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.65rem' }}>
                  <div style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Status</div>
                  <div style={{ color: googleStatus?.state === 'connected' ? '#86efac' : '#fb923c', fontWeight: 900, marginTop: '0.2rem' }}>{(googleStatus?.state || 'unknown').replace(/_/g, ' ')}</div>
                </div>
                <div style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.65rem' }}>
                  <div style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Connected</div>
                  <div style={{ color: '#fff', fontWeight: 800, marginTop: '0.2rem' }}>{googleStatus?.connectedEmail || (googleStatus?.connectedAt ? 'Owner account' : 'Not connected')}</div>
                </div>
                <div style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.65rem' }}>
                  <div style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Token expiry</div>
                  <div style={{ color: '#fff', fontWeight: 800, marginTop: '0.2rem' }}>{googleStatus?.expiresAt ? new Date(googleStatus.expiresAt).toLocaleString() : 'No token'}</div>
                </div>
                <div style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.65rem' }}>
                  <div style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Review queue</div>
                  <div style={{ color: '#fff', fontWeight: 800, marginTop: '0.2rem' }}>{pendingGmailSuggestions + pendingDriveSuggestions} suggestions</div>
                </div>
              </div>
              {googleMessage && <div style={{ color: isAdminWarningStatus(googleMessage) ? '#fb923c' : '#aaa', fontSize: '0.78rem' }}>{googleMessage}</div>}
              {Boolean(googleStatus?.missing?.length) && (
                <div style={{ color: '#fb923c', fontSize: '0.78rem', lineHeight: 1.45 }}>Missing env vars: {googleStatus?.missing.join(', ')}</div>
              )}
              <div style={{ display: 'grid', gap: '0.35rem', color: '#aaa', fontSize: '0.76rem', lineHeight: 1.45 }}>
                <div><strong style={{ color: '#fff' }}>Redirect URI:</strong> {googleStatus?.redirectUri || 'Unavailable'}</div>
                <div><strong style={{ color: '#fff' }}>Scopes:</strong> {googleStatus?.scopes?.join(', ') || 'Unavailable'}</div>
              </div>
            </div>

            <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.75rem' }}>
              <div style={{ color: '#fff', fontWeight: 800 }}>What should Owner Copilot read?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  <label style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 800 }}>Gmail search</label>
                  <input
                    value={googleSettings.gmailQuery}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, gmailQuery: e.target.value }))}
                    placeholder="newer_than:30d"
                    style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem' }}
                  />
                  <label style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 800 }}>Ignore senders</label>
                  <textarea
                    value={googleIgnoredSendersText}
                    onChange={e => setGoogleIgnoredSendersText(e.target.value)}
                    placeholder="one email per line"
                    rows={4}
                    style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', lineHeight: 1.4 }}
                  />
                  <label style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 800 }}>Gmail result limit</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={googleSettings.gmailMaxResults}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, gmailMaxResults: Number(e.target.value) }))}
                    style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem' }}
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  <label style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 800 }}>Approved Drive folder IDs</label>
                  <textarea
                    value={googleDriveFoldersText}
                    onChange={e => setGoogleDriveFoldersText(e.target.value)}
                    placeholder="one folder ID per line"
                    rows={6}
                    style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', lineHeight: 1.4 }}
                  />
                  <label style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 800 }}>Drive result limit per folder</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={googleSettings.driveMaxResults}
                    onChange={e => setGoogleSettings(prev => ({ ...prev, driveMaxResults: Number(e.target.value) }))}
                    style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem' }}
                  />
                  <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', color: '#aaa', fontSize: '0.74rem' }}>
                    <input type="checkbox" checked={googleSettings.summarizeDriveFiles} onChange={e => setGoogleSettings(prev => ({ ...prev, summarizeDriveFiles: e.target.checked }))} />
                    Allow future Drive file summaries after owner approval
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={saveGoogleSettings} disabled={googleLoading} style={{ background: '#2563eb', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.55rem 0.75rem', cursor: googleLoading ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Save Settings</button>
                <button type="button" onClick={() => checkGoogleSync('gmail')} disabled={googleLoading || googleStatus?.state !== 'connected'} style={{ background: googleStatus?.state === 'connected' ? '#E8540A' : '#333', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.55rem 0.75rem', cursor: googleStatus?.state === 'connected' ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '0.78rem' }}>Sync Gmail</button>
                <button type="button" onClick={() => checkGoogleSync('drive')} disabled={googleLoading || googleStatus?.state !== 'connected'} style={{ background: googleStatus?.state === 'connected' ? '#E8540A' : '#333', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.55rem 0.75rem', cursor: googleStatus?.state === 'connected' ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '0.78rem' }}>Sync Drive</button>
                <button type="button" onClick={() => setActiveTab('matches')} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem 0.75rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Review Matches</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                {(['gmail', 'drive'] as const).map(kind => {
                  const check = googleSyncChecks[kind];
                  return (
                    <div key={kind} style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.75rem', display: 'grid', gap: '0.35rem' }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{kind === 'gmail' ? 'Gmail sync' : 'Drive sync'}</div>
                      <div style={{ color: check?.ready ? '#86efac' : '#aaa', fontSize: '0.76rem', lineHeight: 1.45 }}>{check?.message || 'Not synced this session.'}</div>
                      {typeof check?.synced === 'number' && <div style={{ color: '#888', fontSize: '0.72rem' }}>Saved {check.synced} record{check.synced === 1 ? '' : 's'}{typeof check.skipped === 'number' ? ` · skipped ${check.skipped}` : ''}</div>}
                      {Boolean(check?.requiredOwnerInputs?.length) && <div style={{ color: '#fb923c', fontSize: '0.72rem', lineHeight: 1.4 }}>{check?.requiredOwnerInputs?.join(' ')}</div>}
                      {check?.error && <div style={{ color: '#fb923c', fontSize: '0.72rem' }}>{check.error}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.45rem' }}>
              <div style={{ color: '#fff', fontWeight: 800 }}>Owner Setup Checklist</div>
              <ul style={{ margin: '0 0 0 1rem', padding: 0, color: '#aaa', fontSize: '0.76rem', lineHeight: 1.5 }}>
                {(googleStatus?.setupChecklist || [
                  'Load Google status to see the current setup checklist.',
                ]).map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
            <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 800 }}>Gmail and Drive Match Review</div>
                  <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>{pendingGmailSuggestions} Gmail suggestions · {pendingDriveSuggestions} Drive suggestions</div>
                </div>
                <button type="button" onClick={loadMatchRecords} disabled={matchesLoading} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: matchesLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>Refresh</button>
              </div>
              {matchesStatus && <div style={{ color: isAdminWarningStatus(matchesStatus) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{matchesStatus}</div>}
              <div style={{ color: '#888', fontSize: '0.74rem', lineHeight: 1.45 }}>Live Google sync is still gated by owner consent. These panels are ready for synced records and can also review manually inserted/mock records.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                <div style={{ color: '#fff', fontWeight: 800 }}>Gmail Threads</div>
                {gmailThreads.length === 0 ? (
                  <div style={{ color: '#777', fontSize: '0.78rem' }}>No Gmail thread records yet.</div>
                ) : (
                  gmailThreads.map(thread => (
                    <div key={thread.id} style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.65rem', display: 'grid', gap: '0.45rem' }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{thread.subject || thread.id}</div>
                      <div style={{ color: '#aaa', fontSize: '0.74rem', lineHeight: 1.45 }}>{thread.fromEmail || 'Unknown sender'} · {thread.productInterest || 'No product'} · {thread.receivedAt ? new Date(thread.receivedAt).toLocaleString() : 'No date'}</div>
                      {thread.snippet && <div style={{ color: '#888', fontSize: '0.74rem', lineHeight: 1.45 }}>{thread.snippet}</div>}
                      {thread.matchDecision ? (
                        <div style={{ color: '#86efac', fontSize: '0.74rem' }}>Decision: {thread.matchDecision} {thread.linkedTargetId ? `· ${thread.linkedTargetType}:${thread.linkedTargetId}` : ''}</div>
                      ) : (thread.suggestions?.length || 0) === 0 ? (
                        <div style={{ color: '#777', fontSize: '0.74rem' }}>No safe match suggestion.</div>
                      ) : (
                        thread.suggestions?.map(suggestion => (
                          <div key={`${suggestion.targetType}-${suggestion.targetId}`} style={{ borderTop: '1px solid #303030', paddingTop: '0.45rem', display: 'grid', gap: '0.35rem' }}>
                            <div style={{ color: '#fff', fontSize: '0.74rem', fontWeight: 800 }}>{matchTargetLabel(suggestion)} · {suggestion.confidence}% · {suggestion.decision.replace(/_/g, ' ')}</div>
                            <div style={{ color: '#888', fontSize: '0.7rem', lineHeight: 1.4 }}>{suggestion.reasons.join(' ')}</div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => updateExternalMatch('gmail', thread.id, suggestion, 'approved')} disabled={matchesLoading || suggestion.decision === 'possible_only'} style={{ background: suggestion.decision === 'possible_only' ? '#333' : '#166534', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.32rem 0.48rem', cursor: suggestion.decision === 'possible_only' ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.68rem' }}>Approve</button>
                              <button type="button" onClick={() => updateExternalMatch('gmail', thread.id, suggestion, 'pinned')} disabled={matchesLoading} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.32rem 0.48rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.68rem' }}>Pin</button>
                              <button type="button" onClick={() => updateExternalMatch('gmail', thread.id, suggestion, 'rejected')} disabled={matchesLoading} style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.32rem 0.48rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.68rem' }}>Reject</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ))
                )}
              </div>

              <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                <div style={{ color: '#fff', fontWeight: 800 }}>Drive Files</div>
                {driveFiles.length === 0 ? (
                  <div style={{ color: '#777', fontSize: '0.78rem' }}>No Drive file records yet.</div>
                ) : (
                  driveFiles.map(file => (
                    <div key={file.id} style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.65rem', display: 'grid', gap: '0.45rem' }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{file.webViewLink ? <a href={file.webViewLink} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{file.name || file.id}</a> : file.name || file.id}</div>
                      <div style={{ color: '#aaa', fontSize: '0.74rem', lineHeight: 1.45 }}>{file.folderName || 'No folder'} · {file.productInterest || 'No product'} · {file.modifiedAt ? new Date(file.modifiedAt).toLocaleString() : 'No date'}</div>
                      {file.description && <div style={{ color: '#888', fontSize: '0.74rem', lineHeight: 1.45 }}>{file.description}</div>}
                      {file.matchDecision ? (
                        <div style={{ color: '#86efac', fontSize: '0.74rem' }}>Decision: {file.matchDecision} {file.linkedTargetId ? `· ${file.linkedTargetType}:${file.linkedTargetId}` : ''}</div>
                      ) : (file.suggestions?.length || 0) === 0 ? (
                        <div style={{ color: '#777', fontSize: '0.74rem' }}>No safe match suggestion.</div>
                      ) : (
                        file.suggestions?.map(suggestion => (
                          <div key={`${suggestion.targetType}-${suggestion.targetId}`} style={{ borderTop: '1px solid #303030', paddingTop: '0.45rem', display: 'grid', gap: '0.35rem' }}>
                            <div style={{ color: '#fff', fontSize: '0.74rem', fontWeight: 800 }}>{matchTargetLabel(suggestion)} · {suggestion.confidence}% · {suggestion.decision.replace(/_/g, ' ')}</div>
                            <div style={{ color: '#888', fontSize: '0.7rem', lineHeight: 1.4 }}>{suggestion.reasons.join(' ')}</div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => updateExternalMatch('drive', file.id, suggestion, 'approved')} disabled={matchesLoading || suggestion.decision === 'possible_only'} style={{ background: suggestion.decision === 'possible_only' ? '#333' : '#166534', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.32rem 0.48rem', cursor: suggestion.decision === 'possible_only' ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.68rem' }}>Approve</button>
                              <button type="button" onClick={() => updateExternalMatch('drive', file.id, suggestion, 'pinned')} disabled={matchesLoading} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.32rem 0.48rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.68rem' }}>Pin</button>
                              <button type="button" onClick={() => updateExternalMatch('drive', file.id, suggestion, 'rejected')} disabled={matchesLoading} style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.32rem 0.48rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.68rem' }}>Reject</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
            <div style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800 }}>Weekly Owner Reports</div>
                <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>{weeklyReports.length} saved reports</div>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <button type="button" onClick={loadWeeklyReports} disabled={reportsLoading} style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: reportsLoading ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>Refresh</button>
                <button type="button" onClick={generateWeeklyReport} disabled={reportsLoading} style={{ background: '#E8540A', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: reportsLoading ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.76rem' }}>Generate</button>
              </div>
            </div>
            {reportsStatus && <div style={{ color: isAdminWarningStatus(reportsStatus) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{reportsStatus}</div>}
            {weeklyReports.length === 0 && !reportsLoading ? (
              <div style={{ color: '#777', fontSize: '0.82rem' }}>No weekly reports generated yet.</div>
            ) : (
              weeklyReports.map(report => (
                <div key={report.id} style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                    <div style={{ color: '#fff', fontWeight: 900 }}>{report.periodStart} to {report.periodEnd}</div>
                    <div style={{ color: '#777', fontSize: '0.7rem' }}>{report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'No date'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem' }}>
                    {report.sections.map(section => (
                      <div key={section.title} style={{ background: '#161616', border: '1px solid #303030', borderRadius: '6px', padding: '0.6rem' }}>
                        <div style={{ color: '#888', fontSize: '0.66rem', textTransform: 'uppercase', fontWeight: 800 }}>{section.title}</div>
                        <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 900, marginTop: '0.1rem' }}>{section.value}</div>
                        <div style={{ color: '#777', fontSize: '0.68rem', lineHeight: 1.35 }}>{section.detail}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.3rem' }}>Recommended actions</div>
                    <ul style={{ margin: '0 0 0 1rem', padding: 0, color: '#aaa', fontSize: '0.76rem', lineHeight: 1.5 }}>
                      {report.recommendations.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </div>
              ))
            )}
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
        <div className="admin-order-modal" style={{ width: 'min(780px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
          <div className="admin-form-header" style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #333', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
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
            <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input value={orderForm.customerName} onChange={e => setOrderForm(p => p && ({ ...p, customerName: e.target.value }))} placeholder="Customer name" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }} />
              <input value={orderForm.customerPhone} onChange={e => setOrderForm(p => p && ({ ...p, customerPhone: e.target.value }))} placeholder="Phone" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }} />
            </div>
            <input value={orderForm.customerEmail} onChange={e => setOrderForm(p => p && ({ ...p, customerEmail: e.target.value }))} placeholder="Email" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.52rem', fontSize: '0.82rem' }} />
            <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '0.75rem', background: '#101010', display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Shipping / delivery</div>
              <input value={orderForm.shippingName ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingName: e.target.value }))} placeholder="Delivery name" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
              <input value={orderForm.shippingAddressLine1 ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingAddressLine1: e.target.value }))} placeholder="Address line 1" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
              <input value={orderForm.shippingAddressLine2 ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingAddressLine2: e.target.value }))} placeholder="Address line 2" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
              <div className="admin-form-grid admin-form-grid--four" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.7fr 0.6fr 0.6fr', gap: '0.4rem' }}>
                <input value={orderForm.shippingCity ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingCity: e.target.value }))} placeholder="City / suburb" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
                <input value={orderForm.shippingState ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingState: e.target.value }))} placeholder="State" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
                <input value={orderForm.shippingPostcode ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingPostcode: e.target.value }))} placeholder="Postcode" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
                <input value={orderForm.shippingCountry ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingCountry: e.target.value }))} placeholder="Country" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
              </div>
              <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <select value={orderForm.shippingMethod ?? 'australia_post'} onChange={e => setOrderForm(p => p && ({ ...p, shippingMethod: e.target.value as ShippingMethod }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }}>
                  <option value="australia_post">Australia Post</option>
                  <option value="brisbane_local_delivery">Brisbane ute delivery</option>
                  <option value="pickup">Pickup only</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={((orderForm.shippingChargeCents ?? 0) / 100).toFixed(2)}
                  onChange={e => {
                    const next = Number.parseFloat(e.target.value);
                    setOrderForm(p => p && ({ ...p, shippingChargeCents: Number.isFinite(next) ? Math.round(next * 100) : 0 }));
                  }}
                  placeholder="Shipping / delivery charge"
                  style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }}
                />
              </div>
              <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <input value={orderForm.shippingCarrier ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingCarrier: e.target.value }))} placeholder="Carrier" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
                <input value={orderForm.shippingService ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, shippingService: e.target.value }))} placeholder="Service" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
              </div>
              <input value={orderForm.trackingNumber ?? ''} onChange={e => setOrderForm(p => p && ({ ...p, trackingNumber: e.target.value }))} placeholder="Tracking number or reference" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }} />
              <select value={orderForm.shippingStatus ?? 'pending'} onChange={e => setOrderForm(p => p && ({ ...p, shippingStatus: e.target.value }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.48rem', fontSize: '0.8rem' }}>
                <option value="pending">Pending</option>
                <option value="ready">Ready</option>
                <option value="label_created">Label created</option>
                <option value="in_transit">In transit</option>
                <option value="delivered">Delivered</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="admin-form-grid admin-form-grid--two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
            <div className="admin-form-grid admin-form-grid--three" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
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
                <li>Click Analyse with AI on a product needing attention to get a grounded diagnosis, ranked actions, evidence, and owner-confirmation items.</li>
                <li>AI product recommendations do not change the website automatically. Confirm facts first, then use Products, Media, Homepage, Admin Chat, or Pending to make approved changes.</li>
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
                <li>Use Archive for test, old, duplicate, or low-value enquiries that should leave active queues without being deleted.</li>
                <li>Use the Archived filter to find archived enquiries. Click Restore if the enquiry needs to return to active follow-up.</li>
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
