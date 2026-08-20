export const OWNER_COPILOT_TASK_STORE = 'owner-copilot-tasks';
export const OWNER_COPILOT_TIMELINE_STORE = 'owner-copilot-timeline-events';
export const OWNER_COPILOT_AI_ACTION_STORE = 'owner-copilot-ai-actions';
export const OWNER_COPILOT_AUDIT_STORE = 'owner-copilot-audit-logs';
export const OWNER_COPILOT_CUSTOMER_STORE = 'owner-copilot-customers';
export const OWNER_COPILOT_LEAD_STORE = 'owner-copilot-leads';
export const OWNER_COPILOT_GMAIL_THREAD_STORE = 'owner-copilot-gmail-threads';
export const OWNER_COPILOT_DRIVE_FILE_STORE = 'owner-copilot-drive-files';
export const OWNER_COPILOT_WEEKLY_REPORT_STORE = 'owner-copilot-weekly-reports';
export const OWNER_COPILOT_MARKETING_IDEA_STORE = 'owner-copilot-marketing-ideas';

export type OwnerLeadUrgency = 'hot' | 'warm' | 'cold' | 'waiting_on_customer' | 'waiting_on_byondrv' | 'dormant' | 'won' | 'lost';

export interface OwnerCopilotEnquiry {
  id: string;
  submittedAt?: string;
  received_at?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source_type?: string;
  product_interest?: string;
  callback_date?: string;
  callback_time?: string;
  enquiry_intent?: string;
  main_questions?: string;
  vehicle_details?: string;
  budget_notes?: string;
  timeline?: string;
}

export interface OwnerCopilotLeadStatus {
  enquiryId: string;
  status?: string;
  priority?: string;
  notes?: string;
  nextFollowUpDate?: string;
  firstResponseAt?: string;
  lastContactedAt?: string;
  outcomeReason?: string;
  updatedAt?: string;
}

export interface OwnerLeadIntelligence {
  score: number;
  urgency: OwnerLeadUrgency;
  reasons: string[];
  nextAction: string;
  followUpDueDate: string;
  waitingOn: 'byondrv' | 'customer' | 'none';
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function joinedText(enquiry: OwnerCopilotEnquiry) {
  return [
    enquiry.message,
    enquiry.product_interest,
    enquiry.enquiry_intent,
    enquiry.main_questions,
    enquiry.vehicle_details,
    enquiry.budget_notes,
    enquiry.timeline,
  ].map(text).join(' ').toLowerCase();
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysSince(value?: string, now = new Date()) {
  const date = parseDate(value);
  return date ? Math.floor((now.getTime() - date.getTime()) / 86_400_000) : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function statusValue(status?: string) {
  return text(status || 'new').toLowerCase();
}

function hasAny(content: string, patterns: RegExp[]) {
  return patterns.some(pattern => pattern.test(content));
}

function submittedAt(enquiry: OwnerCopilotEnquiry) {
  return enquiry.received_at || enquiry.submittedAt || '';
}

function inferWaitingOn(status: string, leadStatus?: OwnerCopilotLeadStatus): OwnerLeadIntelligence['waitingOn'] {
  if (['new', 'contacted', 'called', 'qualified', 'quoted', 'follow-up-scheduled'].includes(status) && !leadStatus?.firstResponseAt) {
    return 'byondrv';
  }
  if (['replied', 'follow-up-scheduled'].includes(status) && leadStatus?.firstResponseAt) return 'customer';
  return 'none';
}

export function buildLeadIntelligence(
  enquiry: OwnerCopilotEnquiry,
  leadStatus: OwnerCopilotLeadStatus | null | undefined,
  now = new Date()
): OwnerLeadIntelligence {
  const content = joinedText(enquiry);
  const status = statusValue(leadStatus?.status);
  const reasons: string[] = [];
  let score = 0;

  if (hasAny(content, [/\b(price|pricing|quote|quoted|cost|how much)\b/i])) {
    score += 25;
    reasons.push('Asked about price or a quote.');
  }
  if (hasAny(content, [/\b(available|availability|in stock|stock|ready now)\b/i])) {
    score += 20;
    reasons.push('Asked about availability.');
  }
  if (hasAny(content, [/\b(delivery|lead time|timeframe|when can|how soon|arrival)\b/i])) {
    score += 15;
    reasons.push('Asked about delivery timing.');
  }
  if (hasAny(content, [/\b(finance|payment|deposit|pay|repayment)\b/i])) {
    score += 15;
    reasons.push('Asked about finance or payment.');
  }
  if (hasAny(content, [/\b(payload|gvm|gcm|tow|towing|suitability|fit|ranger|hilux|isuzu|truck|vehicle)\b/i])) {
    score += 15;
    reasons.push('Asked about vehicle suitability.');
  }
  if (hasAny(content, [/\b(call|phone|ring|talk|speak)\b/i]) || enquiry.callback_date || enquiry.callback_time) {
    score += 20;
    reasons.push('Asked for a call or callback.');
  }
  if (text(enquiry.phone)) {
    score += 10;
    reasons.push('Supplied a phone number.');
  }

  const ageDays = daysSince(submittedAt(enquiry), now);
  if (ageDays < 7) {
    score += 10;
    reasons.push('Open enquiry is less than seven days old.');
  }

  const lastContactAge = daysSince(leadStatus?.lastContactedAt || leadStatus?.updatedAt || submittedAt(enquiry), now);
  if (lastContactAge >= 14) {
    score -= 15;
    reasons.push('No recent contact for at least 14 days.');
  }
  if (lastContactAge >= 30) {
    score -= 30;
    reasons.push('No recent contact for at least 30 days.');
  }
  if (leadStatus?.outcomeReason === 'bought-elsewhere') {
    score -= 100;
    reasons.push('Customer bought elsewhere.');
  }
  if (status === 'lost') {
    score -= 80;
    reasons.push('Lead is marked lost.');
  }
  if (status === 'spam') {
    score -= 100;
    reasons.push('Lead is marked spam.');
  }
  if (status === 'won') {
    score = 100;
    reasons.push('Lead is marked won.');
  }

  const finalScore = clampScore(score);
  const waitingOn = inferWaitingOn(status, leadStatus ?? undefined);
  const askedForPurchaseStepRecently = ageDays <= 7 && finalScore >= 45 && reasons.some(reason => /quote|availability|delivery|payment/i.test(reason));
  let urgency: OwnerLeadUrgency = 'cold';

  if (status === 'won') urgency = 'won';
  else if (status === 'lost' || status === 'spam') urgency = 'lost';
  else if (ageDays >= 30 || finalScore < 15) urgency = 'dormant';
  else if (waitingOn === 'byondrv') urgency = 'waiting_on_byondrv';
  else if (waitingOn === 'customer') urgency = 'waiting_on_customer';
  else if (finalScore >= 75 || askedForPurchaseStepRecently) urgency = 'hot';
  else if (finalScore >= 45) urgency = 'warm';

  const baseDate = parseDate(submittedAt(enquiry)) ?? now;
  const followUpDueDate = leadStatus?.nextFollowUpDate || (
    urgency === 'hot' || urgency === 'waiting_on_byondrv'
      ? dateOnly(addDays(now, 1))
      : urgency === 'warm'
        ? dateOnly(addDays(now, 3))
        : status === 'quoted'
          ? dateOnly(addDays(baseDate, 3))
          : ''
  );

  let nextAction = 'Review lead details and decide the next owner action.';
  if (urgency === 'waiting_on_byondrv') nextAction = 'Reply to the customer or create a response draft.';
  else if (urgency === 'waiting_on_customer') nextAction = 'Follow up if the customer has not replied by the due date.';
  else if (urgency === 'hot') nextAction = 'Contact within 24 hours and offer a practical next step.';
  else if (urgency === 'warm') nextAction = 'Send a helpful follow-up within 2-3 days.';
  else if (urgency === 'dormant') nextAction = 'Consider a light reactivation message or archive if no longer useful.';
  else if (urgency === 'won') nextAction = 'Confirm handover/admin tasks are complete.';
  else if (urgency === 'lost') nextAction = 'Keep for history; no active follow-up required.';

  return {
    score: finalScore,
    urgency,
    reasons: reasons.length ? reasons.slice(0, 6) : ['No strong buying signal detected yet.'],
    nextAction,
    followUpDueDate,
    waitingOn,
  };
}

export function taskKey(taskId: string) {
  return `tasks/${encodeURIComponent(taskId)}.json`;
}

export function timelineKey(eventId: string) {
  return `timeline/${encodeURIComponent(eventId)}.json`;
}

export function customerKey(customerId: string) {
  return `customers/${encodeURIComponent(customerId)}.json`;
}

export function leadRecordKey(leadId: string) {
  return `leads/${encodeURIComponent(leadId)}.json`;
}

export function aiActionKey(actionId: string) {
  return `ai-actions/${encodeURIComponent(actionId)}.json`;
}

export function auditLogKey(auditId: string) {
  return `audit/${encodeURIComponent(auditId)}.json`;
}

export function gmailThreadKey(threadId: string) {
  return `gmail-threads/${encodeURIComponent(threadId)}.json`;
}

export function driveFileKey(fileId: string) {
  return `drive-files/${encodeURIComponent(fileId)}.json`;
}

export function weeklyReportKey(reportId: string) {
  return `weekly-reports/${encodeURIComponent(reportId)}.json`;
}

export function marketingIdeaKey(ideaId: string) {
  return `marketing-ideas/${encodeURIComponent(ideaId)}.json`;
}

export function newOwnerCopilotId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const MARKETING_IDEA_STATUSES = ['idea', 'drafted', 'approved', 'rejected', 'published'] as const;
export const MARKETING_IDEA_PRIORITIES = ['high', 'medium', 'low'] as const;

export type MarketingIdeaStatus = (typeof MARKETING_IDEA_STATUSES)[number];
export type MarketingIdeaPriority = (typeof MARKETING_IDEA_PRIORITIES)[number];

export interface MarketingIdeaRecord {
  [key: string]: unknown;
  id: string;
  title: string;
  audience: string;
  sourceQuestion: string;
  recommendation: string;
  evidence: string;
  priority: string;
  status: string;
  relatedLeadId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dashboard insights are regenerated on every request and carry no identifier, so
 * the title is the only stable handle. Deriving the id from it makes re-saving the
 * same insight an update rather than a duplicate.
 */
function titleFingerprint(title: string) {
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function marketingIdeaId(title: string) {
  const trimmed = clean(title, 200);
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  // A title of punctuation alone leaves no slug, so fall back to a fingerprint
  // rather than letting every such title collide on one key.
  return `marketing_idea_${slug || titleFingerprint(trimmed)}`;
}

export function buildMarketingIdea(
  body: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  now: string,
): { idea: MarketingIdeaRecord } | { error: string } {
  const title = clean(body.title, 180) || clean(existing?.title, 180);
  if (!title) return { error: 'Missing marketing idea title.' };

  const status = clean(body.status, 40) || clean(existing?.status, 40) || 'idea';
  if (!(MARKETING_IDEA_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Invalid marketing idea status.' };
  }

  const priority = clean(body.priority, 20) || clean(existing?.priority, 20);
  if (priority && !(MARKETING_IDEA_PRIORITIES as readonly string[]).includes(priority)) {
    return { error: 'Invalid marketing idea priority.' };
  }

  return {
    idea: {
      ...existing,
      id: clean(body.id, 240) || clean(existing?.id, 240) || marketingIdeaId(title),
      title,
      audience: clean(body.audience, 180) || clean(existing?.audience, 180),
      sourceQuestion: clean(body.sourceQuestion, 600) || clean(existing?.sourceQuestion, 600),
      recommendation: clean(body.recommendation, 1000) || clean(existing?.recommendation, 1000),
      evidence: clean(body.evidence, 400) || clean(existing?.evidence, 400),
      priority,
      status,
      relatedLeadId: clean(body.relatedLeadId, 240) || clean(existing?.relatedLeadId, 240),
      createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
      updatedAt: now,
    },
  };
}
