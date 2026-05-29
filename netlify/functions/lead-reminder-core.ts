import { getBlobStore, safeBlobStoreError } from './blob-store';

export const ENQUIRY_STORE = 'customer-enquiries';
export const LEAD_STATUS_STORE = 'customer-lead-status';
export const REMINDER_EMAIL_LOG_STORE = 'customer-lead-reminder-email-logs';
export const DEFAULT_TIMEZONE = 'Australia/Brisbane';

export interface EnquiryRecord {
  id: string;
  submittedAt?: string;
  received_at?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source_type?: string;
  manual_entry?: boolean;
  product_interest?: string;
  callback_date?: string;
}

export interface LeadStatusRecord {
  enquiryId: string;
  status?: string;
  priority?: string;
  notes?: string;
  nextFollowUpDate?: string;
  firstResponseAt?: string;
  lastContactedAt?: string;
  updatedAt?: string;
}

export interface LeadRecord extends EnquiryRecord {
  leadStatus: LeadStatusRecord;
}

export interface LeadReminderItem {
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

export interface LeadReminderSummary {
  newUnreplied: LeadReminderItem[];
  hotLeads: LeadReminderItem[];
  followUpsDueToday: LeadReminderItem[];
  overdueFollowUps: LeadReminderItem[];
  quotedNeedsFollowUp: LeadReminderItem[];
  manualMissingFollowUp: LeadReminderItem[];
  total: number;
}

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

export function todayKey(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value?: string, now = new Date()) {
  const date = parseDate(value);
  return date ? (now.getTime() - date.getTime()) / 86_400_000 : 0;
}

function normalStatus(value?: string) {
  return clean(value, 'new').toLowerCase();
}

function normalPriority(value?: string) {
  return clean(value, 'warm').toLowerCase();
}

function isClosed(status?: string) {
  return ['won', 'lost', 'spam'].includes(normalStatus(status));
}

function isRepliedOrBeyond(status?: string) {
  return ['contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled', 'won', 'lost'].includes(normalStatus(status));
}

function item(enquiry: LeadRecord, type: string, reason: string): LeadReminderItem {
  return {
    id: `${enquiry.id}:${type}`,
    enquiryId: enquiry.id,
    type,
    customerName: clean(enquiry.name, 'Unnamed lead'),
    productInterest: clean(enquiry.product_interest, 'General enquiry'),
    submittedAt: clean(enquiry.received_at || enquiry.submittedAt, ''),
    status: normalStatus(enquiry.leadStatus.status),
    priority: normalPriority(enquiry.leadStatus.priority),
    nextFollowUpDate: clean(enquiry.leadStatus.nextFollowUpDate || enquiry.callback_date, ''),
    reason,
  };
}

export function mergeLeadStatus(enquiry: EnquiryRecord, status?: LeadStatusRecord | null): LeadRecord {
  return {
    ...enquiry,
    source_type: clean(enquiry.source_type, 'website_form'),
    leadStatus: status ?? {
      enquiryId: enquiry.id,
      status: 'new',
      priority: 'warm',
      notes: '',
      nextFollowUpDate: enquiry.callback_date ?? '',
      firstResponseAt: '',
      lastContactedAt: '',
      updatedAt: enquiry.submittedAt ?? '',
    },
  };
}

export function calculateLeadReminders(leads: LeadRecord[], now = new Date(), timezone = DEFAULT_TIMEZONE): LeadReminderSummary {
  const today = todayKey(now, timezone);
  const summary: LeadReminderSummary = {
    newUnreplied: [],
    hotLeads: [],
    followUpsDueToday: [],
    overdueFollowUps: [],
    quotedNeedsFollowUp: [],
    manualMissingFollowUp: [],
    total: 0,
  };

  for (const lead of leads) {
    const status = normalStatus(lead.leadStatus.status);
    const priority = normalPriority(lead.leadStatus.priority);
    const followUpDate = clean(lead.leadStatus.nextFollowUpDate || lead.callback_date, '');
    const hasFirstResponse = Boolean(lead.leadStatus.firstResponseAt);

    if (status === 'new' && !hasFirstResponse) {
      summary.newUnreplied.push(item(lead, 'new-unreplied', 'New enquiry has not been replied to.'));
    }

    if (priority === 'hot' && !isRepliedOrBeyond(status) && !hasFirstResponse) {
      summary.hotLeads.push(item(lead, 'hot-unreplied', 'Hot lead needs a reply.'));
    }

    if (followUpDate === today && !isClosed(status)) {
      summary.followUpsDueToday.push(item(lead, 'follow-up-due-today', 'Follow-up is due today.'));
    }

    if (followUpDate && followUpDate < today && !isClosed(status)) {
      summary.overdueFollowUps.push(item(lead, 'follow-up-overdue', 'Follow-up is overdue.'));
    }

    if (status === 'quoted' && daysSince(lead.leadStatus.lastContactedAt || lead.leadStatus.updatedAt, now) >= 3) {
      summary.quotedNeedsFollowUp.push(item(lead, 'quoted-needs-follow-up', 'Quoted lead has not been contacted recently.'));
    }

    if (['phone_call', 'manual_email'].includes(clean(lead.source_type, 'website_form')) && !followUpDate && !isClosed(status)) {
      summary.manualMissingFollowUp.push(item(lead, 'manual-missing-follow-up', 'Manual lead is missing a follow-up date.'));
    }
  }

  summary.total = Object.values(summary)
    .filter(Array.isArray)
    .reduce((count, section) => count + section.length, 0);

  return summary;
}

async function getAllJson<T>(storeName: string) {
  const store = getBlobStore(storeName);
  const { blobs } = await store.list();
  const records = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as T | null;
    } catch {
      return null;
    }
  }));
  return records.filter(Boolean) as T[];
}

async function getLeadStatuses(enquiries: EnquiryRecord[]) {
  const store = getBlobStore(LEAD_STATUS_STORE);
  const entries = await Promise.all(enquiries.map(async (enquiry) => {
    try {
      const status = await store.get(leadKey(enquiry.id), { type: 'json' }) as LeadStatusRecord | null;
      return [enquiry.id, status] as const;
    } catch {
      return [enquiry.id, null] as const;
    }
  }));
  return new Map(entries);
}

export async function loadLeadRecords() {
  const enquiries = (await getAllJson<EnquiryRecord>(ENQUIRY_STORE)).filter(enquiry => enquiry.id);
  const statuses = await getLeadStatuses(enquiries);
  return enquiries.map(enquiry => mergeLeadStatus(enquiry, statuses.get(enquiry.id)));
}

export async function loadLeadReminderSummary() {
  const leads = await loadLeadRecords();
  return calculateLeadReminders(leads);
}

export function safeLeadReminderError(error: unknown) {
  return safeBlobStoreError(error);
}
