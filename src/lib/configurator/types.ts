export type CatalogueReadiness = 'development_seed' | 'owner_review' | 'approved_internal' | 'approved_public';
export type VerificationStatus = 'unverified' | 'price_confirmed_rules_pending' | 'owner_confirmed';
export type SelectionMode = 'single' | 'multiple' | 'quantity';
export type RuleType = 'requires_all' | 'requires_any' | 'excludes' | 'auto_select' | 'auto_remove' | 'warning_when';
export type RuleSeverity = 'hard' | 'warning' | 'information';

export interface ConfiguratorCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ConfiguratorOrderProcess {
  availability: 'made_to_order' | 'available_in_australia' | 'ask_availability';
  buildStartsOn: 'deposit_paid' | 'owner_confirmation' | 'not_applicable';
  productionLocation: string;
  finishingLocation: string;
  customerSummary: string;
}

export interface ConfiguratorVisualBinding {
  optionId: string;
  nodeNames: string[];
  visibleWhenSelected: boolean;
}

export interface ConfiguratorVisualHotspot {
  id: string;
  label: string;
  position: [number, number, number];
}

export interface ConfiguratorVisualAsset {
  status: 'cad_pending' | 'preparing' | 'ready' | 'needs_revision';
  glbUrl: string;
  posterUrl: string;
  assetVersion: string;
  maxBytes: number;
  bindings: ConfiguratorVisualBinding[];
  hotspots: ConfiguratorVisualHotspot[];
}

export interface ConfigurableModel {
  id: string;
  productSlug: string;
  version: string;
  name: string;
  description: string;
  productCategory: 'slide-on' | 'expedition' | 'caravan';
  active: boolean;
  adminVisible: boolean;
  customerVisible: boolean;
  basePriceCents: number;
  priceQualifier: 'exact' | 'from' | 'negotiable' | 'poa';
  priceVerificationStatus: VerificationStatus;
  baseCostCents: number | null;
  baseWeightKg: number | null;
  orderProcess: ConfiguratorOrderProcess;
  visualAsset?: ConfiguratorVisualAsset;
  heroImage?: string;
  standardOptionIds: string[];
  defaultOptionIds: string[];
}

export interface ConfigurationOption {
  id: string;
  legacyId?: string;
  categoryId: string;
  name: string;
  shortDescription: string;
  active: boolean;
  adminVisible: boolean;
  customerVisible: boolean;
  modelIds: string[];
  selectionMode: SelectionMode;
  minQuantity?: number;
  maxQuantity?: number;
  retailPriceDeltaCents: number;
  internalCostDeltaCents: number | null;
  weightDeltaKg: number | null;
  visualBindingId: string | null;
  verificationStatus: VerificationStatus;
  sortOrder: number;
}

export interface ConfigurationRule {
  id: string;
  type: RuleType;
  severity: RuleSeverity;
  whenOptionId: string;
  targetOptionIds: string[];
  autoResolve: boolean;
  ownerOverridable: boolean;
  adminMessage: string;
  publicMessage?: string;
}

export interface ConfiguratorCatalogue {
  schemaVersion: string;
  catalogueVersion: string;
  readiness: CatalogueReadiness;
  publishedAt: string;
  currency: 'AUD';
  taxTreatment: 'gst_inclusive' | 'gst_exclusive';
  notice: string;
  categories: ConfiguratorCategory[];
  models: ConfigurableModel[];
  options: ConfigurationOption[];
  rules: ConfigurationRule[];
}

export interface ConfigurationSelection {
  optionId: string;
  quantity: number;
}

export interface ConfigurationCustomItem {
  id: string;
  description: string;
  kind: 'custom' | 'discount';
  retailPriceCents: number;
  internalCostCents: number | null;
  weightDeltaKg: number | null;
  reason: string;
  visualBrief: string;
  drawingStatus: 'not_started' | 'requested' | 'in_progress' | 'ready_for_review' | 'approved' | 'not_applicable';
}

export interface ConfigurationDrawingVersion {
  id: string;
  customItemId: string;
  version: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  store: string;
  key: string;
  externalUrl: string;
  notes: string;
  status: 'uploaded' | 'in_review' | 'changes_requested' | 'approved' | 'superseded';
  uploadedAt: string;
  uploadedBy: string;
  reviewedAt: string;
  reviewedBy: string;
}

export interface ConfigurationCustomerReview {
  status: 'not_created' | 'pending' | 'viewed' | 'changes_requested' | 'approved' | 'expired' | 'revoked';
  tokenHash: string;
  tokenHint: string;
  createdAt: string;
  expiresAt: string;
  viewedAt: string;
  decidedAt: string;
  decidedByName: string;
  decidedByEmail: string;
  decisionNotes: string;
  configurationUpdatedAt: string;
}

export type ConfigurationProductionStatus = 'not_released' | 'deposit_received' | 'ordered_from_factory' | 'in_china_production' | 'awaiting_shipping' | 'in_transit' | 'arrived_mutdapilly' | 'local_fitout' | 'ready_for_handover' | 'delivered' | 'cancelled';

export interface ConfigurationProductionEvent {
  id: string;
  status: ConfigurationProductionStatus;
  occurredAt: string;
  note: string;
  recordedBy: string;
}

export interface ConfigurationProductionTracking {
  status: ConfigurationProductionStatus;
  orderId: string;
  depositReference: string;
  depositReceivedAt: string;
  expectedArrivalDate: string;
  expectedHandoverDate: string;
  nextActionDate: string;
  events: ConfigurationProductionEvent[];
}

export interface ConfigurationIssue {
  code: string;
  message: string;
  severity: RuleSeverity;
  ruleId?: string;
  optionId?: string;
}

export interface ResolvedConfigurationSelection extends ConfigurationSelection {
  option: ConfigurationOption;
  retailTotalCents: number;
  internalCostTotalCents: number | null;
  weightTotalKg: number | null;
  automaticallySelected: boolean;
}

export interface ConfigurationEvaluation {
  valid: boolean;
  model: ConfigurableModel | null;
  selections: ResolvedConfigurationSelection[];
  errors: ConfigurationIssue[];
  warnings: ConfigurationIssue[];
  information: ConfigurationIssue[];
  appliedRuleIds: string[];
  pricing: {
    basePriceCents: number;
    optionsTotalCents: number;
    customItemsTotalCents: number;
    discountsTotalCents: number;
    configuredTotalCents: number;
    internalCostCents: number | null;
    marginCents: number | null;
    costStatus: 'known' | 'partial' | 'unknown';
  };
  weight: {
    baseWeightKg: number | null;
    optionsDeltaKg: number | null;
    customDeltaKg: number | null;
    configuredWeightKg: number | null;
    status: 'known' | 'partial' | 'unknown';
  };
}

export interface CatalogueValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type ConfigurationStatus = 'draft' | 'ready_for_review' | 'approved' | 'quoted' | 'converted_to_contract' | 'ordered' | 'superseded' | 'archived';

export interface ConfigurationRecord {
  id: string;
  configurationNumber: string;
  revision: number;
  parentConfigurationId: string;
  status: ConfigurationStatus;
  catalogueVersion: string;
  modelId: string;
  customerId: string;
  leadId: string;
  customer: { name: string; email: string; phone: string };
  selectedOptions: ConfigurationSelection[];
  customItems: ConfigurationCustomItem[];
  drawings: ConfigurationDrawingVersion[];
  customerReview: ConfigurationCustomerReview;
  production: ConfigurationProductionTracking;
  acknowledgedWarningIds: string[];
  ownerNotes: string;
  customerNotes: string;
  linkedContractIds: string[];
  linkedOrderIds: string[];
  approvedSnapshotKey: string;
  approvedSnapshotDigest: string;
  approvedAt: string;
  approvedBy: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigurationSnapshot {
  configurationId: string;
  configurationNumber: string;
  revision: number;
  catalogueVersion: string;
  model: ConfigurableModel;
  customer: ConfigurationRecord['customer'];
  customerId: string;
  leadId: string;
  selections: Array<{
    optionId: string;
    name: string;
    categoryId: string;
    quantity: number;
    unitPriceCents: number;
    retailTotalCents: number;
    internalCostTotalCents: number | null;
    weightTotalKg: number | null;
  }>;
  customItems: ConfigurationCustomItem[];
  drawings: ConfigurationDrawingVersion[];
  customerReview: Pick<ConfigurationCustomerReview, 'status' | 'decidedAt' | 'decidedByName' | 'decidedByEmail'>;
  warnings: ConfigurationIssue[];
  pricing: ConfigurationEvaluation['pricing'];
  weight: ConfigurationEvaluation['weight'];
  ownerNotes: string;
  customerNotes: string;
  approvedBy: string;
  approvedAt: string;
  digest: string;
}
