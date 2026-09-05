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
 */

export type CalendarEventKind =
  | 'customer_visit'
  | 'container_eta'
  | 'expected_arrival'
  | 'expected_handover'
  | 'factory_order'
  | 'next_action'
  | 'follow_up'
  | 'task';

export interface AdminCalendarEvent {
  id: string;
  kind: CalendarEventKind;
  /** ISO date, all-day. None of these are appointments with a time. */
  date: string;
  title: string;
  detail: string;
  /** The record this date belongs to, so the UI can link back to it. */
  recordType: 'order' | 'enquiry' | 'task' | 'product';
  recordId: string;
  /** Set when the date is one someone promised a customer. */
  isCommitment: boolean;
}

/** Colour is meaning here, so it lives with the kind rather than in the view. */
export const EVENT_KIND_META: Record<CalendarEventKind, { label: string; colour: string; commitment: boolean }> = {
  customer_visit:    { label: 'Customer visit',    colour: '#f87171', commitment: true },
  expected_handover: { label: 'Handover',          colour: '#4ade80', commitment: true },
  container_eta:     { label: 'Container ETA',     colour: '#fb923c', commitment: false },
  expected_arrival:  { label: 'Expected arrival',  colour: '#fbbf24', commitment: false },
  factory_order:     { label: 'Factory order',     colour: '#a78bfa', commitment: false },
  next_action:       { label: 'Next action',       colour: '#60a5fa', commitment: false },
  follow_up:         { label: 'Lead follow-up',    colour: '#38bdf8', commitment: false },
  task:              { label: 'Task',              colour: '#c4a87a', commitment: false },
};

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
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
) {
  if (!isIsoDate(date) || !recordId) return;
  events.push({
    id: `${kind}:${recordId}`,
    kind,
    date,
    title,
    detail,
    recordType,
    recordId,
    isCommitment: EVENT_KIND_META[kind].commitment,
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
    push(events, 'customer_visit', order.customerVisitDate, 'order', id,
      `${who} visiting${suffix}`, `Order status: ${status || 'unknown'}`);
    push(events, 'expected_handover', order.expectedHandoverDate, 'order', id,
      `Handover${suffix ? ':' + suffix : ''} · ${who}`, `Order status: ${status || 'unknown'}`);
    push(events, 'expected_arrival', order.expectedArrivalDate, 'order', id,
      `Arrival due${suffix} · ${who}`, `Order status: ${status || 'unknown'}`);
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
    push(events, 'task', task.dueDate, 'task', id,
      text(task.title, 'Task'), text(task.priority, 'medium'));
  }

  for (const product of sources.products ?? []) {
    const slug = text(product.slug);
    push(events, 'container_eta', product.containerEtaDate, 'product', slug,
      `Container ETA: ${text(product.title, slug)}`,
      text(product.containerEtaText, 'Confirm before promising a viewing'));
  }

  // Soonest first, then commitments ahead of everything else on the same day:
  // on a crowded day the promise to a customer is the one to read first.
  return events.sort((a, b) =>
    a.date.localeCompare(b.date)
    || Number(b.isCommitment) - Number(a.isCommitment)
    || a.title.localeCompare(b.title));
}

/**
 * A visit and a container ETA on the same order that disagree. Surfaced on the
 * calendar as well as the dashboard, because the whole point of one timeline is
 * that a clash is visible without anyone going looking for it.
 */
export function calendarClashes(events: ReadonlyArray<AdminCalendarEvent>): string[] {
  const visits = events.filter((event) => event.kind === 'customer_visit');
  const etas = events.filter((event) => event.kind === 'container_eta');
  const notes: string[] = [];
  for (const visit of visits) {
    for (const eta of etas) {
      if (eta.date > visit.date) {
        notes.push(`${visit.title} on ${visit.date}, but a container ETA falls later on ${eta.date}.`);
      }
    }
  }
  return notes;
}
