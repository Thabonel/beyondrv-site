/**
 * Moving an event on the calendar has to move the date on the record that owns
 * it. There is no calendar store for these: the calendar is a projection, so a
 * drag that wrote anywhere else would create a second version of the truth,
 * which is the failure this whole feature exists to prevent.
 *
 * Not every date can be dragged, and the reason is the data rather than
 * caution. A container ETA lives on the product content file and reaches the
 * site through the Pending review queue, so it cannot be written from a drag
 * the way an order field can. The rules live here so the calendar and the
 * endpoint cannot disagree about what is movable.
 *
 * Meetings and reminders are not here either. They live in the calendar's own
 * store and are moved through admin-calendar-events.
 */

import { isIsoDate, isWallTime } from './calendar-events-core.ts';

export type WritableKind =
  | 'customer_visit' | 'expected_handover' | 'expected_arrival'
  | 'factory_order' | 'next_action' | 'follow_up' | 'task';

export interface WriteTarget {
  store: 'orders' | 'leads' | 'tasks';
  field: string;
  /** Where the time of day goes, for the kinds that can hold one. */
  timeField?: string;
  /** A promise to a customer. The UI confirms before moving one of these. */
  commitment: boolean;
  label: string;
}

export const WRITE_TARGETS: Record<WritableKind, WriteTarget> = {
  customer_visit:    { store: 'orders', field: 'customerVisitDate',    timeField: 'customerVisitTime',    commitment: true,  label: 'customer visit' },
  expected_handover: { store: 'orders', field: 'expectedHandoverDate', timeField: 'expectedHandoverTime', commitment: true,  label: 'handover' },
  expected_arrival:  { store: 'orders', field: 'expectedArrivalDate',  commitment: false, label: 'expected arrival' },
  factory_order:     { store: 'orders', field: 'factoryOrderDate',     commitment: false, label: 'factory order' },
  next_action:       { store: 'orders', field: 'nextActionDate',       commitment: false, label: 'next action' },
  follow_up:         { store: 'leads',  field: 'nextFollowUpDate',     commitment: false, label: 'lead follow-up' },
  task:              { store: 'tasks',  field: 'dueDate',              timeField: 'dueTime',              commitment: false, label: 'task' },
};

/** Container ETAs are not in WRITE_TARGETS, so this is the single source of that answer. */
export function isMovableKind(kind: string): kind is WritableKind {
  return Object.prototype.hasOwnProperty.call(WRITE_TARGETS, kind);
}

export function immovableReason(kind: string): string {
  if (kind === 'container_eta') {
    return 'A container ETA lives on the product file and reaches the site through Pending review, '
      + 'so it cannot be moved from the calendar. Change it in Products, then preview and deploy.';
  }
  if (kind === 'meeting' || kind === 'reminder') {
    return `A ${kind} is moved through the calendar events endpoint, not as a record date.`;
  }
  return `"${kind}" is not a date this calendar can move.`;
}

export { isIsoDate };

export interface MoveRequest {
  kind?: unknown;
  recordId?: unknown;
  date?: unknown;
  /** "HH:MM" to set a time, "" or absent to make the date all-day. */
  time?: unknown;
}

export type MoveDecision =
  | { ok: true; kind: WritableKind; recordId: string; date: string; time: string; target: WriteTarget }
  | { ok: false; error: string };

/**
 * Validation kept out of the handler so the rules can be tested without
 * constructing a Netlify event, matching the other core modules here.
 */
export function decideMove(body: MoveRequest): MoveDecision {
  const kind = typeof body.kind === 'string' ? body.kind.trim() : '';
  const recordId = typeof body.recordId === 'string' ? body.recordId.trim().slice(0, 240) : '';
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const time = typeof body.time === 'string' ? body.time.trim() : '';

  if (!recordId) return { ok: false, error: 'recordId is required.' };
  if (!kind) return { ok: false, error: 'kind is required.' };
  if (!isMovableKind(kind)) return { ok: false, error: immovableReason(kind) };
  if (!isIsoDate(date)) return { ok: false, error: `"${date}" is not a YYYY-MM-DD date.` };
  if (time && !isWallTime(time)) return { ok: false, error: `"${time}" is not an HH:MM time.` };

  const target = WRITE_TARGETS[kind];
  // A kind with nowhere to keep a time stays all-day; the time is dropped
  // rather than refused, so dragging an arrival into the hour grid still moves
  // the day.
  return { ok: true, kind, recordId, date, time: target.timeField ? time : '', target };
}

export interface NewTaskRequest {
  title?: unknown;
  date?: unknown;
  time?: unknown;
}

export type TaskDecision =
  | { ok: true; title: string; dueDate: string; dueTime: string }
  | { ok: false; error: string };

/**
 * Creating a task from the grid: the one record-owned thing a day genuinely
 * creates. An order or an enquiry comes from a customer, not from a gesture.
 */
export function decideNewTask(body: NewTaskRequest): TaskDecision {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';
  const dueDate = typeof body.date === 'string' ? body.date.trim() : '';
  const dueTime = typeof body.time === 'string' ? body.time.trim() : '';
  if (!title) return { ok: false, error: 'A task needs a title.' };
  if (!isIsoDate(dueDate)) return { ok: false, error: `"${dueDate}" is not a YYYY-MM-DD date.` };
  if (dueTime && !isWallTime(dueTime)) return { ok: false, error: `"${dueTime}" is not an HH:MM time.` };
  return { ok: true, title, dueDate, dueTime };
}

/** Warns when a visit is moved onto a vehicle that is not marked as here. */
export const ARRIVED_STATUSES = new Set([
  'arrived_mutdapilly', 'local_fitout', 'ready_for_handover', 'delivered',
]);

export function moveWarning(kind: WritableKind, orderStatus: string): string {
  if (kind !== 'customer_visit') return '';
  if (ARRIVED_STATUSES.has(orderStatus)) return '';
  return `The order status is "${orderStatus.replace(/_/g, ' ')}", so the vehicle is not marked as here. `
    + 'Confirm it has landed before the customer travels.';
}
