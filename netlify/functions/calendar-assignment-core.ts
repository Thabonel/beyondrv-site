/**
 * Who is doing a thing, kept apart from when the thing is.
 *
 * A task carries its own owners, because a task is a record with a field to
 * put them in. Everything else on the calendar is projected from an order, an
 * enquiry or a product, and none of those has anywhere to record which of Li
 * or Oscar is handling it. Six such fields on orders would be six fields
 * meaning the same thing.
 *
 * So an assignment is its own small record, keyed by the event's stable id.
 * It says nothing about a date, so it cannot create a second copy of one.
 *
 * A job can belong to more than one person: two people fit a tray, and both
 * need it on their phone.
 */

export const ASSIGNMENT_STORE = 'calendar-assignments';

export function assignmentKey(eventId: string) {
  return `assignments/${encodeURIComponent(eventId)}.json`;
}

export interface CalendarAssignment {
  eventId: string;
  assigneeIds: string[];
  updatedAt: string;
}

/** A task owns its assignees; anything else is looked up by event id. */
export function assignmentTarget(kind: string, recordId: string) {
  return kind === 'task'
    ? { store: 'task' as const, id: recordId }
    : { store: 'assignment' as const, id: `${kind}:${recordId}` };
}

/**
 * Reads whichever shape a record has. Tasks written before this change carry a
 * single `assigneeId`, and there is no migration step: both are read, so an
 * old task keeps working and is rewritten as a list the next time it is
 * touched.
 */
export function readAssignees(record: Record<string, unknown> | null | undefined): string[] {
  if (!record) return [];
  const many = record.assigneeIds;
  if (Array.isArray(many)) {
    return [...new Set(many.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map((id) => id.trim()))];
  }
  const one = record.assigneeId;
  return typeof one === 'string' && one.trim() ? [one.trim()] : [];
}

export function cleanAssignees(value: unknown, max = 20): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value] : [];
  return [...new Set(list
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim().slice(0, 240))
    .filter(Boolean))].slice(0, max);
}

/**
 * Puts the owners back onto the events that have some. Tasks already carry
 * theirs from the record, so they are left alone.
 */
export function applyAssignments<T extends { id: string; kind: string; assigneeIds?: string[] }>(
  events: T[],
  assignments: ReadonlyArray<Record<string, unknown>>,
): T[] {
  if (!assignments.length) return events;
  const byEvent = new Map<string, string[]>();
  for (const row of assignments) {
    const eventId = typeof row.eventId === 'string' ? row.eventId : '';
    const assignees = readAssignees(row);
    if (eventId && assignees.length) byEvent.set(eventId, assignees);
  }
  for (const event of events) {
    if (event.kind === 'task' || event.assigneeIds?.length) continue;
    const assignees = byEvent.get(event.id);
    if (assignees) event.assigneeIds = assignees;
  }
  return events;
}

/** Whether a given person is on the hook for this event. */
export function isAssignedTo(event: { assigneeIds?: string[] }, crewId: string) {
  return Boolean(crewId) && Boolean(event.assigneeIds?.includes(crewId));
}
