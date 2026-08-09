export const VOICE_CAPTURE_STORE = 'gm-voice-captures';

export interface VoiceMoneyMention {
  amountText: string;
  meaning: string;
  sourceExcerpt: string;
}

export interface VoiceProposal {
  summary: string;
  customerName: string;
  productInterest: string;
  followUpDate: string;
  followUpReason: string;
  appointmentDateTime: string;
  moneyMentions: VoiceMoneyMention[];
  discussedItems: string[];
  unresolvedItems: string[];
  requiresAgreementReview: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface VoiceCaptureRecord {
  id: string;
  actorUserId: string;
  status: 'needs_confirmation' | 'applied' | 'discarded';
  transcript: string;
  proposal: VoiceProposal;
  idempotencyKey: string;
  createdAt: string;
  confirmedAt: string;
  appliedAt: string;
  savedEnquiryId: string;
  savedCustomerId: string;
}

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanList(value: unknown, maxItems = 12, maxLength = 240) {
  return Array.isArray(value)
    ? value.map(item => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function dateOnly(value: unknown) {
  const candidate = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

export function voiceCaptureKey(id: string) {
  return `captures/${encodeURIComponent(clean(id, 240))}.json`;
}

export function createVoiceCaptureId(now = new Date()) {
  return `voice_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normaliseVoiceProposal(input: unknown): VoiceProposal {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const moneyMentions = Array.isArray(value.moneyMentions)
    ? value.moneyMentions.map(item => {
      const mention = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        amountText: clean(mention.amountText, 120),
        meaning: clean(mention.meaning, 240),
        sourceExcerpt: clean(mention.sourceExcerpt, 360),
      };
    }).filter(mention => mention.amountText || mention.meaning).slice(0, 8)
    : [];
  const confidence = clean(value.confidence, 12);
  return {
    summary: clean(value.summary, 2400),
    customerName: clean(value.customerName, 180),
    productInterest: clean(value.productInterest, 240),
    followUpDate: dateOnly(value.followUpDate),
    followUpReason: clean(value.followUpReason, 500),
    appointmentDateTime: clean(value.appointmentDateTime, 80),
    moneyMentions,
    discussedItems: cleanList(value.discussedItems),
    unresolvedItems: cleanList(value.unresolvedItems),
    requiresAgreementReview: value.requiresAgreementReview === true,
    confidence: confidence === 'high' || confidence === 'low' ? confidence : 'medium',
  };
}

export function voiceCaptureSummary(proposal: VoiceProposal) {
  const parts = [proposal.summary];
  if (proposal.followUpDate) parts.push(`Follow-up: ${proposal.followUpDate}${proposal.followUpReason ? ` — ${proposal.followUpReason}` : ''}.`);
  if (proposal.appointmentDateTime) parts.push(`Appointment discussed: ${proposal.appointmentDateTime}.`);
  if (proposal.unresolvedItems.length) parts.push(`Still to confirm: ${proposal.unresolvedItems.join('; ')}.`);
  return parts.filter(Boolean).join('\n\n').slice(0, 4000);
}
