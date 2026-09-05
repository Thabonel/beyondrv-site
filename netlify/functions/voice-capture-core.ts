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
  /** When the call fixed a visit or a handover: what, which day, what time. */
  appointmentKind: '' | 'customer_visit' | 'expected_handover';
  appointmentDate: string;
  appointmentTime: string;
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

// Android Chrome correctly reports its recording as e.g. "audio/webm;codecs=opus".
// The codec parameter describes the same WebM file.
export function normaliseAudioMimeType(value: unknown) {
  return clean(value, 160).split(';', 1)[0].trim().toLowerCase();
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

function timeOnly(value: unknown) {
  const candidate = clean(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate) ? candidate : '';
}

function appointmentKindOf(value: unknown): VoiceProposal['appointmentKind'] {
  const kind = clean(value, 40);
  return kind === 'customer_visit' || kind === 'expected_handover' ? kind : '';
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
    appointmentKind: appointmentKindOf(value.appointmentKind),
    appointmentDate: dateOnly(value.appointmentDate),
    appointmentTime: timeOnly(value.appointmentTime),
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
  if (proposal.appointmentDate) {
    const what = proposal.appointmentKind === 'expected_handover' ? 'Handover' : 'Visit';
    parts.push(`${what} agreed: ${proposal.appointmentDate}${proposal.appointmentTime ? ` ${proposal.appointmentTime}` : ''}.`);
  } else if (proposal.appointmentDateTime) {
    parts.push(`Appointment discussed: ${proposal.appointmentDateTime}.`);
  }
  if (proposal.unresolvedItems.length) parts.push(`Still to confirm: ${proposal.unresolvedItems.join('; ')}.`);
  return parts.filter(Boolean).join('\n\n').slice(0, 4000);
}
