import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarEventKey,
  inRange,
  isDuplicate,
  toAdminCalendarEvent,
  validateEvent,
  type CompanyCalendarEvent,
} from '../netlify/functions/calendar-store-core.ts';

const actor = 'owner';
const now = '2026-09-05T00:00:00.000Z';

function stored(overrides: Partial<CompanyCalendarEvent> = {}): CompanyCalendarEvent {
  return {
    id: 'cal-1', title: 'Supplier call', kind: 'meeting', start: '2026-09-10T14:00', end: '2026-09-10T15:00',
    allDay: false, notes: '', location: '', source: 'gm', links: {}, assigneeIds: [], createdBy: actor, createdAt: now, updatedAt: now,
    ...overrides,
  };
}

test('a timed event needs a title, a known kind and a wall-clock start', () => {
  assert.equal(validateEvent({ kind: 'meeting', start: '2026-09-10T14:00' }, { actor }).ok, false);
  assert.match((validateEvent({ title: 'x', kind: 'party', start: '2026-09-10T14:00' }, { actor }) as { error: string }).error, /kind must be/);
  assert.match((validateEvent({ title: 'x', kind: 'meeting', start: '2pm Thursday' }, { actor }) as { error: string }).error, /YYYY-MM-DDTHH:MM/);
});

test('a timed event with no end is drawn for an hour', () => {
  const result = validateEvent({ title: 'Supplier call', kind: 'meeting', start: '2026-09-10T14:00' }, { actor, now });
  assert.equal(result.ok, true);
  const event = (result as { event: CompanyCalendarEvent }).event;
  assert.equal(event.end, '2026-09-10T15:00');
  assert.equal(event.allDay, false);
  assert.equal(event.source, 'gm');
  assert.match(event.id, /^cal-/);
});

test('an all-day event is a date, and its end defaults to the same day', () => {
  const result = validateEvent({ title: 'Rego due', kind: 'reminder', allDay: true, start: '2026-09-10' }, { actor, now });
  assert.equal(result.ok, true);
  assert.deepEqual([(result as any).event.start, (result as any).event.end], ['2026-09-10', '2026-09-10']);
});

test('an end before the start is refused', () => {
  const result = validateEvent({ title: 'x', kind: 'meeting', start: '2026-09-10T14:00', end: '2026-09-10T13:00' }, { actor });
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /end is before the start/);
});

test('an update keeps every field it was not given, and never changes who created it', () => {
  const existing = stored({ createdBy: 'gmail-calendar-sync', source: 'ai', notes: 'from an email' });
  const result = validateEvent({ start: '2026-09-11T09:00', end: '2026-09-11T10:00' }, { actor, existing, now: '2026-09-06T00:00:00.000Z' });
  assert.equal(result.ok, true);
  const event = (result as { event: CompanyCalendarEvent }).event;
  assert.equal(event.title, 'Supplier call');
  assert.equal(event.notes, 'from an email');
  assert.equal(event.source, 'ai');
  assert.equal(event.createdBy, 'gmail-calendar-sync');
  assert.equal(event.createdAt, now);
  assert.equal(event.updatedAt, '2026-09-06T00:00:00.000Z');
});

test('turning a timed event all-day keeps its day rather than failing on the old end', () => {
  const result = validateEvent({ allDay: true, start: '2026-09-10' }, { actor, existing: stored() });
  assert.equal(result.ok, true);
  assert.equal((result as any).event.end, '2026-09-10');
});

test('notes are capped and an unknown source falls back to the GM', () => {
  const result = validateEvent({ title: 'x', kind: 'meeting', start: '2026-09-10T14:00', notes: 'n'.repeat(5000), source: 'robot' }, { actor });
  assert.equal((result as any).event.notes.length, 4000);
  assert.equal((result as any).event.source, 'gm');
});

test('links keep only known keys and sourceEmail needs a message id', () => {
  const result = validateEvent({
    title: 'x', kind: 'meeting', start: '2026-09-10T14:00',
    links: { orderId: 'o1', productSlug: 'advent-2450', random: 'no' },
    sourceEmail: { threadId: 't1', subject: 'hi' },
  }, { actor });
  assert.deepEqual((result as any).event.links, { orderId: 'o1', productSlug: 'advent-2450' });
  assert.equal((result as any).event.sourceEmail, undefined);
});

test('the same email cannot add the same kind of event twice', () => {
  const existing = [stored({ sourceEmail: { threadId: 't', messageId: 'm1', subject: 's', from: 'a@b.c', excerpt: '' } })];
  assert.equal(isDuplicate({ title: 'Different words', kind: 'meeting', start: '2026-10-01T09:00', sourceEmail: { messageId: 'm1' } }, existing), true);
  assert.equal(isDuplicate({ title: 'Different words', kind: 'reminder', start: '2026-10-01T09:00', sourceEmail: { messageId: 'm1' } }, existing), false,
    'the same email can legitimately yield a meeting and a reminder');
});

test('the same item worded twice within a day is a duplicate; a week apart is not', () => {
  const existing = [stored({ title: 'Container ETA: Advent 2450', kind: 'container_eta', start: '2026-09-18', end: '2026-09-18', allDay: true })];
  assert.equal(isDuplicate({ title: 'container eta advent 2450', kind: 'container_eta', start: '2026-09-19' }, existing), true);
  assert.equal(isDuplicate({ title: 'Container ETA: Advent 2450', kind: 'container_eta', start: '2026-09-25' }, existing), false);
});

test('a dismissed event still blocks its own re-creation', () => {
  const existing = [stored({ dismissedAt: now, sourceEmail: { threadId: 't', messageId: 'm1', subject: 's', from: 'a@b.c', excerpt: '' } })];
  assert.equal(isDuplicate({ title: 'Supplier call', kind: 'meeting', start: '2026-09-10T14:00', sourceEmail: { messageId: 'm1' } }, existing), true);
});

test('a stored event projects onto the grid with its product link and source', () => {
  const event = toAdminCalendarEvent(stored({
    kind: 'container_eta', source: 'ai', allDay: true, start: '2026-09-18', end: '2026-09-18',
    links: { productSlug: 'advent-2450' },
    sourceEmail: { threadId: 't', messageId: 'm', subject: 'Shipping update', from: 'li@factory.cn', excerpt: '' },
  }));
  assert.equal(event.id, 'calendar:cal-1');
  assert.equal(event.date, '2026-09-18');
  assert.equal(event.productSlug, 'advent-2450');
  assert.equal(event.source, 'ai');
  assert.equal(event.recordType, 'calendar');
  assert.match(event.detail, /Shipping update/);
});

test('range checks include an event that overlaps either edge', () => {
  const event = stored({ start: '2026-09-09T16:00', end: '2026-09-11T10:00' });
  assert.equal(inRange(event, '2026-09-10', '2026-09-10'), true);
  assert.equal(inRange(event, '2026-09-12', '2026-09-20'), false);
  assert.equal(inRange(event, '2026-09-01', '2026-09-08'), false);
});

test('store keys are namespaced so a listing can tell events from anything else', () => {
  assert.equal(calendarEventKey('cal-1'), 'events/cal-1.json');
});

test('a handover can live in the store when its order is not yet known', () => {
  const result = validateEvent({ title: 'Handover: someone', kind: 'expected_handover', allDay: true, start: '2026-09-20' }, { actor });
  assert.equal(result.ok, true);
});

test('a meeting keeps its owners on its own record, and an update does not lose them', () => {
  const created = validateEvent({ title: 'Supplier call', kind: 'meeting', start: '2026-09-10T14:00', assigneeIds: ['crew-li', 'crew-oscar'] }, { actor, now });
  assert.equal(created.ok, true);
  assert.deepEqual((created as any).event.assigneeIds, ['crew-li', 'crew-oscar']);

  // Editing the time must not silently drop who is on it.
  const moved = validateEvent({ start: '2026-09-10T15:00' }, { actor, existing: (created as any).event });
  assert.deepEqual((moved as any).event.assigneeIds, ['crew-li', 'crew-oscar']);

  const cleared = validateEvent({ assigneeIds: [] }, { actor, existing: (created as any).event });
  assert.deepEqual((cleared as any).event.assigneeIds, []);
});

test('a stored event carries its owners onto the grid', () => {
  const event = toAdminCalendarEvent(stored({ assigneeIds: ['crew-li'] } as Partial<CompanyCalendarEvent>));
  assert.deepEqual(event.assigneeIds, ['crew-li']);
  assert.equal(toAdminCalendarEvent(stored()).assigneeIds, undefined);
});
