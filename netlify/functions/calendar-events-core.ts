/**
 * One surface for every date the business already holds.
 *
 * The dates were never the problem. Twelve dated fields existed across orders,
 * enquiries, tasks and products, each visible only on its own screen, as a grey
 * pill next to the record it belonged to. Nobody could see them together, so
 * nobody could see a customer flying in on the day a container was still at
 * sea. This projects all of them onto one timeline.
 *
 * Pure on purpose: it takes the records and returns events, so what appears on
 * a given day is tested rather than clicked through.
 *
 * Times are wall-clock strings, never Date objects. A visit at 10:00 in
 * Brisbane is "2026-09-10T10:00" everywhere in this codebase, so a function
 * running in UTC on Netlify cannot shift it.
 */

export type CalendarEventKind =
  | 'customer_visit'
  | 'container_eta'
  | 'expected_arrival'
  | 'expected_handover'
  | 'factory_order'
  | 'next_action'
  | 'follow_up'
  | 'task'
  | 'meeting'
  | 'reminder';

export type CalendarEventSource = 'record' | 'gm' | 'ai' | 'chat';

export interface AdminCalendarEvent {
  id: string;
  kind: CalendarEventKind;
  /** ISO date the event falls on. Always present, even for timed events. */
  date: string;
  /** "YYYY-MM-DD" when allDay, otherwise "YYYY-MM-DDTHH:MM" local wall time. */
  start: string;
  end: string;
  allDay: boolean;
  title: string;
  detail: string;
  /** The record this date belongs to, so the UI can link back to it. */
  recordType: 'order' | 'enquiry' | 'task' | 'product' | 'calendar';
  recordId: string;
  /** Set when the date is one someone promised a customer. */
  isCommitment: boolean;
  source: CalendarEventSource;
  /** For a task: whose job it is. Empty means the GM's own. */
  assigneeId?: string;
  /**
   * The product this date is about, when there is one. A customer visit and a
   * container ETA are only related if they concern the same vehicle: without
   * this, every visit would appear to depend on every container in the yard.
   */
  productSlug?: string;
}

/**
 * Colour is meaning here, so it lives with the kind rather than in the view.
 * The palette is Google Calendar's, because the calendar is meant to read like
 * one, and the GM already knows what those colours feel like.
 */
export const EVENT_KIND_META: Record<CalendarEventKind, { label: string; colour: string; commitment: boolean }> = {
  customer_visit:    { label: 'Customer visit',    colour: '#d50000', commitment: true },
  expected_handover: { label: 'Handover',          colour: '#0b8043', commitment: true },
  container_eta:     { label: 'Container ETA',     colour: '#f4511e', commitment: false },
  expected_arrival:  { label: 'Expected arrival',  colour: '#f6bf26', commitment: false },
  factory_order:     { label: 'Factory order',     colour: '#8e24aa', commitment: false },
  next_action:       { label: 'Next action',       colour: '#039be5', commitment: false },
  follow_up:         { label: 'Lead follow-up',    colour: '#3f51b5', commitment: false },
  task:              { label: 'Task',              colour: '#33b679', commitment: false },
  meeting:           { label: 'Meeting',           colour: '#7986cb', commitment: false },
  reminder:          { label: 'Reminder',          colour: '#616161', commitment: false },
};

export const ALL_EVENT_KINDS = Object.keys(EVENT_KIND_META) as CalendarEventKind[];

/** How long a dated record is drawn for when it has a time but no length. */
export const DEFAULT_DURATION_MINUTES = 60;

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function isWallTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isWallDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

/** Adds minutes to a wall-clock date-time without touching time zones. */
export function addMinutes(wallDateTime: string, minutes: number): string {
  const [date, time] = wallDateTime.split('T');
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const minuteOfDay = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const mm = String(minuteOfDay % 60).padStart(2, '0');
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + dayShift);
  return `${day.toISOString().slice(0, 10)}T${hh}:${mm}`;
}

/** Builds start and end for a record that holds a date and maybe a time. */
export function spanFor(date: string, time: unknown): Pick<AdminCalendarEvent, 'start' | 'end' | 'allDay'> {
  if (isWallTime(time)) {
    const start = `${date}T${time}`;
    return { start, end: addMinutes(start, DEFAULT_DURATION_MINUTES), allDay: false };
  }
  return { start: date, end: date, allDay: true };
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function push(
  events: AdminCalendarEvent[],
  kind: CalendarEventKind,
  date: unknown,
  recordType: AdminCalendarEvent['recordType'],
  recordId: string,
  title: string,
  detail: string,
  productSlug = '',
  time: unknown = '',
) {
  if (!isIsoDate(date) || !recordId) return;
  events.push({
    id: `${kind}:${recordId}`,
    kind,
    date,
    ...spanFor(date, time),
    title,
    detail,
    recordType,
    recordId,
    isCommitment: EVENT_KIND_META[kind].commitment,
    source: 'record',
    ...(productSlug ? { productSlug } : {}),
  });
}

export interface CalendarSources {
  orders?: ReadonlyArray<Record<string, unknown>>;
  enquiries?: ReadonlyArray<Record<string, unknown>>;
  tasks?: ReadonlyArray<Record<string, unknown>>;
  products?: ReadonlyArray<Record<string, unknown>>;
}

export function buildCalendarEvents(sources: CalendarSources): AdminCalendarEvent[] {
  const events: AdminCalendarEvent[] = [];

  for (const order of sources.orders ?? []) {
    const id = text(order.id);
    const who = text(order.customerName, 'Customer');
    const what = text(order.productTitle);
    const suffix = what ? ` · ${what}` : '';
    const status = text(order.status).replace(/_/g, ' ');
    const slug = text(order.productSlug);
    push(events, 'customer_visit', order.customerVisitDate, 'order', id,
      `${who} visiting${suffix}`, `Order status: ${status || 'unknown'}`, slug, order.customerVisitTime);
    push(events, 'expected_handover', order.expectedHandoverDate, 'order', id,
      `Handover${suffix ? ':' + suffix : ''} · ${who}`, `Order status: ${status || 'unknown'}`, '', order.expectedHandoverTime);
    push(events, 'expected_arrival', order.expectedArrivalDate, 'order', id,
      `Arrival due${suffix} · ${who}`, `Order status: ${status || 'unknown'}`, slug);
    push(events, 'factory_order', order.factoryOrderDate, 'order', id,
      `Factory order${suffix}`, who);
    push(events, 'next_action', order.nextActionDate, 'order', id,
      `Next action: ${who}${suffix}`, text(order.notes).slice(0, 140));
  }

  for (const enquiry of sources.enquiries ?? []) {
    const id = text(enquiry.id);
    const who = text(enquiry.name, text(enquiry.customerName, 'Lead'));
    const lead = (enquiry.leadStatus ?? {}) as Record<string, unknown>;
    const date = lead.nextFollowUpDate ?? enquiry.followUpDate ?? lead.followUpDate;
    push(events, 'follow_up', date, 'enquiry', id,
      `Follow up: ${who}`, text(lead.status, 'new'));
  }

  for (const task of sources.tasks ?? []) {
    const id = text(task.id);
    if (text(task.status, 'open') !== 'open') continue;
    const taskEvents = events.length;
    push(events, 'task', task.dueDate, 'task', id,
      text(task.title, 'Task'), text(task.priority, 'medium'), '', task.dueTime);
    const assigneeId = text(task.assigneeId);
    if (assigneeId && events.length > taskEvents) events[events.length - 1].assigneeId = assigneeId;
  }

  for (const product of sources.products ?? []) {
    const slug = text(product.slug);
    push(events, 'container_eta', product.containerEtaDate, 'product', slug,
      `Container ETA: ${text(product.title, slug)}`,
      text(product.containerEtaText, 'Confirm before promising a viewing'), slug);
  }

  return sortCalendarEvents(events);
}

/**
 * Soonest first, then commitments ahead of everything else on the same day:
 * on a crowded day the promise to a customer is the one to read first.
 */
export function sortCalendarEvents(events: AdminCalendarEvent[]): AdminCalendarEvent[] {
  return events.sort((a, b) =>
    a.date.localeCompare(b.date)
    || Number(b.isCommitment) - Number(a.isCommitment)
    || a.start.localeCompare(b.start)
    || a.title.localeCompare(b.title));
}

/**
 * What a customer visit depends on: the vehicle being here.
 *
 * Matched on the product, not on the dates alone. A visit is only threatened by
 * the container carrying that customer's vehicle, and by the arrival date on
 * that customer's own order. Comparing every visit against every container
 * would raise an alarm every time any vehicle anywhere was late, and an alarm
 * that is usually wrong gets ignored, which is how the first one was missed.
 *
 * A container ETA the AI read in a supplier's email carries the same
 * productSlug, so it takes part here too: the calendar's own copy of the ETA
 * and the supplier's latest word can both be compared against the visit.
 */
export function calendarClashes(events: ReadonlyArray<AdminCalendarEvent>): string[] {
  const visits = events.filter((event) => event.kind === 'customer_visit');
  const blockers = events.filter((event) =>
    event.kind === 'container_eta' || event.kind === 'expected_arrival');
  const notes: string[] = [];

  for (const visit of visits) {
    for (const blocker of blockers) {
      const sameVehicle = Boolean(visit.productSlug) && visit.productSlug === blocker.productSlug;
      const sameOrder = blocker.kind === 'expected_arrival' && blocker.recordId === visit.recordId;
      if (!sameVehicle && !sameOrder) continue;
      if (blocker.date <= visit.date) continue;
      const what = blocker.kind === 'container_eta'
        ? (blocker.source === 'ai' ? 'the container, according to an email,' : 'the container')
        : 'the expected arrival';
      notes.push(
        `${visit.title} on ${visit.date}, but ${what} for that vehicle is not due until ${blocker.date}.`);
    }
  }
  return [...new Set(notes)];
}
