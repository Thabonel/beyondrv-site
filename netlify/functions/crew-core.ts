/**
 * Keys for the people who will not log in.
 *
 * Li and Oscar get a link, not an account. The whole design rests on two
 * decisions, both here:
 *
 * The key travels in the URL fragment, so it is never sent to a server and
 * never lands in an access log. This module therefore only ever sees it in a
 * header, and nothing here should be tempted to read one from a path or a
 * query string.
 *
 * Only the hash of a key is stored. Nobody, this site included, can read a key
 * back, so a leak of the blob store hands over nothing usable. The cost is
 * that a lost link is replaced rather than recovered, which is one tap.
 *
 * Pure: hashing, shapes and scope rules, so what a crew member may touch is
 * tested rather than clicked through.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const CREW_STORE = 'calendar-crew';
export const DAY_NOTE_STORE = 'calendar-day-notes';

export type CrewScope = 'crew' | 'gm';

export interface CrewMember {
  id: string;
  name: string;
  scope: CrewScope;
  /** SHA-256 of the key, hex. The key itself is never stored. */
  keyHash: string;
  keyIssuedAt: string;
  /** Set, and the link is dead. */
  revokedAt: string;
  lastSeenAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function crewKey(id: string) {
  return `crew/${encodeURIComponent(id)}.json`;
}

export function dayNoteKey(crewId: string, date: string) {
  return `notes/${encodeURIComponent(crewId)}/${encodeURIComponent(date)}.json`;
}

export function newCrewId() {
  return `crew-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/** 32 random bytes, base64url: 43 characters, and not worth guessing at. */
export function generateCrewKey() {
  return randomBytes(32).toString('base64url');
}

export function hashCrewKey(key: string) {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Shape check before any store lookup, so nonsense costs nothing. */
export function looksLikeCrewKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/**
 * Compares hashes rather than keys, and in constant time. Hashes are fixed
 * length, so the comparison cannot leak length either.
 */
export function crewKeyMatches(key: string, keyHash: string) {
  if (!looksLikeCrewKey(key) || !/^[0-9a-f]{64}$/.test(keyHash)) return false;
  const a = Buffer.from(hashCrewKey(key), 'hex');
  const b = Buffer.from(keyHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isActiveCrew(member: Pick<CrewMember, 'revokedAt'> | null | undefined) {
  return Boolean(member) && !member!.revokedAt;
}

/** Finds the member a key belongs to. Revoked members never match. */
export function findCrewByKey(members: ReadonlyArray<CrewMember>, key: string): CrewMember | null {
  if (!looksLikeCrewKey(key)) return null;
  for (const member of members) {
    if (isActiveCrew(member) && crewKeyMatches(key, member.keyHash)) return member;
  }
  return null;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export type CrewValidation =
  | { ok: true; name: string; scope: CrewScope }
  | { ok: false; error: string };

export function validateCrewMember(input: Record<string, unknown>): CrewValidation {
  const name = clean(input.name, 120);
  const scopeRaw = clean(input.scope, 10) || 'crew';
  if (!name) return { ok: false, error: 'A person needs a name.' };
  if (scopeRaw !== 'crew' && scopeRaw !== 'gm') return { ok: false, error: 'scope must be crew or gm.' };
  return { ok: true, name, scope: scopeRaw };
}

/**
 * What a crew member is allowed to do to a task.
 *
 * The rule is ownership, checked against the key's own id rather than
 * anything the request claims. A task nobody is assigned belongs to Alex, so
 * it is not theirs to move either.
 */
export function mayActOnTask(member: Pick<CrewMember, 'id' | 'scope'>, task: Record<string, unknown> | null): boolean {
  if (!task) return false;
  if (member.scope === 'gm') return true;
  return typeof task.assigneeId === 'string' && task.assigneeId === member.id;
}

export interface CrewWriteRequest {
  action?: unknown;
  taskId?: unknown;
  title?: unknown;
  date?: unknown;
  note?: unknown;
}

export type CrewWriteDecision =
  | { ok: true; action: 'add_task'; title: string; date: string }
  | { ok: true; action: 'complete_task'; taskId: string }
  | { ok: true; action: 'move_task'; taskId: string; date: string }
  | { ok: true; action: 'set_note'; date: string; note: string }
  | { ok: false; error: string };

export function decideCrewWrite(body: CrewWriteRequest): CrewWriteDecision {
  const action = clean(body.action, 20);
  const taskId = clean(body.taskId, 240);
  const title = clean(body.title, 180);
  const date = clean(body.date, 10);
  const note = clean(body.note, 2000);

  if (action === 'add_task') {
    if (!title) return { ok: false, error: 'Give the job a name.' };
    if (!isIsoDate(date)) return { ok: false, error: `"${date}" is not a date.` };
    return { ok: true, action, title, date };
  }
  if (action === 'complete_task') {
    if (!taskId) return { ok: false, error: 'Which job?' };
    return { ok: true, action, taskId };
  }
  if (action === 'move_task') {
    if (!taskId) return { ok: false, error: 'Which job?' };
    if (!isIsoDate(date)) return { ok: false, error: `"${date}" is not a date.` };
    return { ok: true, action, taskId, date };
  }
  if (action === 'set_note') {
    if (!isIsoDate(date)) return { ok: false, error: `"${date}" is not a date.` };
    return { ok: true, action, date, note };
  }
  return { ok: false, error: `"${action}" is not something this page can do.` };
}

/** What a crew member sees of the yard: the shape of the day, and nothing about money. */
export interface YardItem {
  kind: string;
  title: string;
  time: string;
}

const YARD_KINDS = new Set(['customer_visit', 'expected_handover', 'expected_arrival', 'container_eta']);

/**
 * Strips a calendar event down to what a person in the yard needs: what it is,
 * what it is called, and when. Order status, notes, record ids and anything
 * else the calendar carries are dropped here rather than in the view, so a
 * change to the view cannot start leaking them.
 */
export function toYardItems(events: ReadonlyArray<Record<string, unknown>>, date: string): YardItem[] {
  return events
    .filter((event) => event.date === date && YARD_KINDS.has(String(event.kind)))
    .map((event) => ({
      kind: String(event.kind),
      title: String(event.title ?? '').slice(0, 180),
      time: event.allDay === false && typeof event.start === 'string' ? event.start.slice(11, 16) : '',
    }))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

export interface CrewJob {
  id: string;
  title: string;
  date: string;
  time: string;
  done: boolean;
  overdue: boolean;
}

/**
 * Their jobs for the day being looked at, plus anything they have left
 * overdue, but only when they are looking at today. Browsing back to last
 * Tuesday should show last Tuesday, not today's backlog.
 */
export function crewJobsFor(
  tasks: ReadonlyArray<Record<string, unknown>>,
  crewId: string,
  date: string,
  today: string,
): CrewJob[] {
  const mine = tasks.filter((task) => task.assigneeId === crewId && typeof task.id === 'string');
  const jobs: CrewJob[] = [];
  for (const task of mine) {
    const due = typeof task.dueDate === 'string' ? task.dueDate : '';
    const done = String(task.status ?? 'open') !== 'open';
    const overdue = !done && Boolean(due) && due < today;
    const onThisDay = due === date;
    const showAsOverdue = date === today && overdue;
    if (!onThisDay && !showAsOverdue) continue;
    jobs.push({
      id: String(task.id),
      title: String(task.title ?? 'Job').slice(0, 180),
      date: due,
      time: typeof task.dueTime === 'string' ? task.dueTime : '',
      done,
      overdue: showAsOverdue && !onThisDay,
    });
  }
  return jobs.sort((a, b) =>
    Number(a.done) - Number(b.done)
    || Number(b.overdue) - Number(a.overdue)
    || (a.time || '99:99').localeCompare(b.time || '99:99')
    || a.title.localeCompare(b.title));
}

/**
 * A key is long enough that guessing is hopeless, but a lockout removes the
 * argument and puts a repeated attempt in the audit log.
 */
export const KEY_ATTEMPT_LIMIT = 10;
export const KEY_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
export const KEY_LOCKOUT_MS = 15 * 60 * 1000;

export interface AttemptRecord {
  failures: number[];
  lockedUntil: number;
}

export function registerFailedAttempt(record: AttemptRecord | null, now: number): AttemptRecord {
  const recent = (record?.failures ?? []).filter((at) => now - at < KEY_ATTEMPT_WINDOW_MS);
  recent.push(now);
  return {
    failures: recent.slice(-KEY_ATTEMPT_LIMIT),
    lockedUntil: recent.length >= KEY_ATTEMPT_LIMIT ? now + KEY_LOCKOUT_MS : record?.lockedUntil ?? 0,
  };
}

export function isLockedOut(record: AttemptRecord | null, now: number) {
  return Boolean(record && record.lockedUntil > now);
}

/** Said the same way for an unknown key, a revoked one and a locked-out address. */
export const KEY_REFUSAL = 'This link is not working. Ask Alex to send you a new one.';
