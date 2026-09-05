/**
 * The calendar's own events: the things with no order, enquiry, task or
 * product to live on. A supplier call at two, a meeting, a reminder, and every
 * item the AI reads out of the mailbox.
 *
 * Record-owned dates are still projected (see calendar-events-core) and still
 * have one home. This store exists only for dates that had none, so it does not
 * create a second version of any truth the records already hold.
 *
 * Pure: validation and de-duplication, no I/O, so the rules are testable.
 */

import {
  addMinutes,
  DEFAULT_DURATION_MINUTES,
  EVENT_KIND_META,
  isIsoDate,
  isWallDateTime,
  type AdminCalendarEvent,
  type CalendarEventKind,
  type CalendarEventSource,
} from './calendar-events-core.ts';
import { cleanAssignees } from './calendar-assignment-core.ts';

export const CALENDAR_EVENT_STORE = 'company-calendar-events';

export function calendarEventKey(id: string) {
  return `events/${encodeURIComponent(id)}.json`;
}

export function newCalendarEventId() {
  return `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Meetings and reminders are the everyday kinds. The other three let the AI
 * record a visit or a supplier date it read in an email when it cannot tell
 * which order or product the email means; they draw in the same colour as the
 * projected kind, so the GM sees one thing, not two systems.
 */
export const STORE_KINDS = ['meeting', 'reminder', 'customer_visit', 'expected_handover', 'container_eta', 'expected_arrival'] as const;
export type StoreEventKind = typeof STORE_KINDS[number];

export interface CalendarSourceEmail {
  threadId: string;
  messageId: string;
  subject: string;
  from: string;
  excerpt: string;
}

export interface CompanyCalendarEvent {
  id: string;
  title: string;
  kind: StoreEventKind;
  /** "YYYY-MM-DD" when allDay, otherwise "YYYY-MM-DDTHH:MM" local wall time. */
  start: string;
  end: string;
  allDay: boolean;
  notes: string;
  location: string;
  source: Exclude<CalendarEventSource, 'record'>;
  sourceEmail?: CalendarSourceEmail;
  links: { orderId?: string; enquiryId?: string; productSlug?: string };
  /** Who is on it. Empty means the GM's own. */
  assigneeIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Set instead of deleting an AI event, so the same email cannot re-add it. */
  dismissedAt?: string;
}

const LIMITS = { title: 180, notes: 4000, location: 300, id: 240 } as const;

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanLinks(value: unknown): CompanyCalendarEvent['links'] {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const links: CompanyCalendarEvent['links'] = {};
  const orderId = clean(record.orderId, LIMITS.id);
  const enquiryId = clean(record.enquiryId, LIMITS.id);
  const productSlug = clean(record.productSlug, LIMITS.id);
  if (orderId) links.orderId = orderId;
  if (enquiryId) links.enquiryId = enquiryId;
  if (productSlug) links.productSlug = productSlug;
  return links;
}

function cleanSourceEmail(value: unknown): CalendarSourceEmail | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const messageId = clean(record.messageId, LIMITS.id);
  if (!messageId) return undefined;
  return {
    threadId: clean(record.threadId, LIMITS.id),
    messageId,
    subject: clean(record.subject, 500),
    from: clean(record.from, 320),
    excerpt: clean(record.excerpt, 1000),
  };
}

export type EventValidation =
  | { ok: true; event: CompanyCalendarEvent }
  | { ok: false; error: string };

export interface ValidateOptions {
  /** The stored event when this is an update; fields not supplied keep their value. */
  existing?: CompanyCalendarEvent | null;
  actor: string;
  now?: string;
  id?: string;
}

/**
 * One validator for create, update, AI writes and chat writes, so every path
 * into the store agrees on what a well-formed event is.
 */
export function validateEvent(input: Record<string, unknown>, options: ValidateOptions): EventValidation {
  const existing = options.existing ?? null;
  const now = options.now ?? new Date().toISOString();
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);

  const title = has('title') ? clean(input.title, LIMITS.title) : existing?.title ?? '';
  if (!title) return { ok: false, error: 'An event needs a title.' };

  const kind = (has('kind') ? clean(input.kind, 40) : existing?.kind ?? 'meeting') as StoreEventKind;
  if (!STORE_KINDS.includes(kind)) {
    return { ok: false, error: `kind must be one of ${STORE_KINDS.join(', ')}.` };
  }

  const allDay = has('allDay') ? Boolean(input.allDay) : existing?.allDay ?? false;
  const start = has('start') ? clean(input.start, 20) : existing?.start ?? '';
  let end = has('end') ? clean(input.end, 20) : existing?.end ?? '';

  if (allDay) {
    if (!isIsoDate(start)) return { ok: false, error: `"${start}" is not a YYYY-MM-DD date.` };
    // A timed event turned all-day keeps its day; anything else falls back to
    // a single day.
    if (!isIsoDate(end)) { const day = String(end).slice(0, 10); end = isIsoDate(day) ? day : start; }
  } else {
    if (!isWallDateTime(start)) return { ok: false, error: `"${start}" is not a YYYY-MM-DDTHH:MM date-time.` };
    if (!end || !isWallDateTime(end)) end = addMinutes(start, DEFAULT_DURATION_MINUTES);
  }
  if (end < start) return { ok: false, error: 'The end is before the start.' };

  const notes = has('notes') ? clean(input.notes, LIMITS.notes) : existing?.notes ?? '';
  const location = has('location') ? clean(input.location, LIMITS.location) : existing?.location ?? '';
  const sourceRaw = has('source') ? clean(input.source, 10) : existing?.source ?? 'gm';
  const source = (['gm', 'ai', 'chat', 'crew'] as const).find((item) => item === sourceRaw) ?? 'gm';
  const sourceEmail = has('sourceEmail') ? cleanSourceEmail(input.sourceEmail) : existing?.sourceEmail;
  const links = has('links') ? cleanLinks(input.links) : existing?.links ?? {};
  const assigneeIds = has('assigneeIds') ? cleanAssignees(input.assigneeIds) : existing?.assigneeIds ?? [];

  const event: CompanyCalendarEvent = {
    id: existing?.id ?? clean(options.id, LIMITS.id) ?? '',
    title,
    kind,
    start,
    end,
    allDay,
    notes,
    location,
    source,
    ...(sourceEmail ? { sourceEmail } : {}),
    links,
    assigneeIds,
    createdBy: existing?.createdBy ?? options.actor,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(existing?.dismissedAt ? { dismissedAt: existing.dismissedAt } : {}),
  };
  if (!event.id) event.id = newCalendarEventId();
  return { ok: true, event };
}

export function normaliseTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dayOf(value: string) {
  return value.slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.abs(Date.parse(`${dayOf(a)}T00:00:00Z`) - Date.parse(`${dayOf(b)}T00:00:00Z`)) / 86_400_000;
}

/**
 * The same email read twice, or the same item worded twice, must not become
 * two events. Matches on the source message first, then on kind, normalised
 * title and a day either side. Dismissed events still count: the GM removed
 * it once and does not want it back.
 */
export function isDuplicate(
  candidate: Pick<CompanyCalendarEvent, 'title' | 'kind' | 'start'> & { sourceEmail?: { messageId: string } },
  existing: ReadonlyArray<CompanyCalendarEvent>,
) {
  const messageId = candidate.sourceEmail?.messageId;
  const title = normaliseTitle(candidate.title);
  return existing.some((event) =>
    (messageId && event.sourceEmail?.messageId === messageId && event.kind === candidate.kind)
    || (event.kind === candidate.kind && normaliseTitle(event.title) === title && daysBetween(event.start, candidate.start) <= 1));
}

/** Projects a stored event into the shape the grid and the assistant read. */
export function toAdminCalendarEvent(event: CompanyCalendarEvent): AdminCalendarEvent {
  const kind = event.kind as CalendarEventKind;
  return {
    id: `calendar:${event.id}`,
    kind,
    date: dayOf(event.start),
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    title: event.title,
    detail: event.sourceEmail ? `From email: ${event.sourceEmail.subject}` : event.notes.slice(0, 140),
    recordType: 'calendar',
    recordId: event.id,
    isCommitment: EVENT_KIND_META[kind].commitment,
    source: event.source,
    ...(event.assigneeIds?.length ? { assigneeIds: event.assigneeIds } : {}),
    ...(event.links.productSlug ? { productSlug: event.links.productSlug } : {}),
  };
}

export function inRange(event: CompanyCalendarEvent, from: string, to: string) {
  return dayOf(event.end) >= from && dayOf(event.start) <= to;
}
