import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crewJobsFor,
  crewKeyMatches,
  decideCrewWrite,
  findCrewByKey,
  generateCrewKey,
  hashCrewKey,
  isLockedOut,
  KEY_ATTEMPT_LIMIT,
  looksLikeCrewKey,
  mayActOnTask,
  registerFailedAttempt,
  toYardItems,
  validateCrewMember,
  type CrewMember,
} from '../netlify/functions/crew-core.ts';

const now = '2026-09-05T00:00:00.000Z';

function member(overrides: Partial<CrewMember> = {}): CrewMember {
  const key = generateCrewKey();
  return {
    id: 'crew-1', name: 'Li', scope: 'crew', keyHash: hashCrewKey(key), keyIssuedAt: now,
    revokedAt: '', lastSeenAt: '', createdBy: 'alex', createdAt: now, updatedAt: now, ...overrides,
  };
}

test('a key is 43 base64url characters and never repeats', () => {
  const keys = new Set(Array.from({ length: 200 }, () => generateCrewKey()));
  assert.equal(keys.size, 200);
  for (const key of keys) assert.equal(looksLikeCrewKey(key), true);
});

test('anything that is not a key is rejected on shape, before any lookup', () => {
  for (const value of ['', 'short', 'a'.repeat(44), 'has spaces in it'.padEnd(43, 'x'), 'a/b+c'.padEnd(43, 'x'), null, 42]) {
    assert.equal(looksLikeCrewKey(value), false, String(value));
  }
});

test('a key matches only its own hash', () => {
  const key = generateCrewKey();
  const other = generateCrewKey();
  const hash = hashCrewKey(key);
  assert.equal(crewKeyMatches(key, hash), true);
  assert.equal(crewKeyMatches(other, hash), false);
  assert.equal(crewKeyMatches(key, 'not a hash'), false, 'a malformed stored hash never matches');
});

test('the key itself is never recoverable from what is stored', () => {
  const key = generateCrewKey();
  const stored = member({ keyHash: hashCrewKey(key) });
  assert.equal(JSON.stringify(stored).includes(key), false);
  assert.match(stored.keyHash, /^[0-9a-f]{64}$/);
});

test('a revoked person no longer matches their own key', () => {
  const key = generateCrewKey();
  const live = member({ keyHash: hashCrewKey(key) });
  assert.equal(findCrewByKey([live], key)?.id, 'crew-1');
  assert.equal(findCrewByKey([{ ...live, revokedAt: now }], key), null);
});

test('reissuing kills the old key and nobody else is affected', () => {
  const oldKey = generateCrewKey();
  const newKey = generateCrewKey();
  const oscarKey = generateCrewKey();
  const li = member({ id: 'crew-li', keyHash: hashCrewKey(oldKey) });
  const oscar = member({ id: 'crew-oscar', name: 'Oscar', keyHash: hashCrewKey(oscarKey) });
  const after = [{ ...li, keyHash: hashCrewKey(newKey) }, oscar];
  assert.equal(findCrewByKey(after, oldKey), null);
  assert.equal(findCrewByKey(after, newKey)?.id, 'crew-li');
  assert.equal(findCrewByKey(after, oscarKey)?.id, 'crew-oscar');
});

test('a person needs a name and a known scope', () => {
  assert.equal(validateCrewMember({ name: '  ' }).ok, false);
  assert.match((validateCrewMember({ name: 'Li', scope: 'admin' }) as { error: string }).error, /crew or gm/);
  assert.deepEqual(validateCrewMember({ name: '  Li  ' }), { ok: true, name: 'Li', scope: 'crew' });
});

test('a crew member may act only on a task assigned to them', () => {
  const li = { id: 'crew-li', scope: 'crew' as const };
  assert.equal(mayActOnTask(li, { id: 't1', assigneeId: 'crew-li' }), true);
  assert.equal(mayActOnTask(li, { id: 't2', assigneeId: 'crew-oscar' }), false);
  assert.equal(mayActOnTask(li, { id: 't3' }), false, 'an unassigned task belongs to Alex');
  assert.equal(mayActOnTask(li, null), false);
  assert.equal(mayActOnTask({ id: 'crew-alex', scope: 'gm' }, { id: 't3' }), true);
});

test('the yard shows what and when, and nothing about money or order state', () => {
  const events = [
    { date: '2026-09-05', kind: 'customer_visit', title: 'Tasmanian customer visiting · Advent 2450', allDay: false, start: '2026-09-05T10:00', detail: 'Order status: in transit', recordId: 'o1' },
    { date: '2026-09-05', kind: 'container_eta', title: 'Container ETA: Advent 2450', allDay: true, start: '2026-09-05', detail: 'Li says week 38' },
    { date: '2026-09-05', kind: 'next_action', title: 'Next action: chase deposit', allDay: true, start: '2026-09-05' },
    { date: '2026-09-06', kind: 'customer_visit', title: 'Tomorrow', allDay: true, start: '2026-09-06' },
  ];
  const items = toYardItems(events, '2026-09-05');
  assert.deepEqual(items.map((item) => item.kind), ['customer_visit', 'container_eta'],
    'a next action is Alex\'s business, and another day is another day');
  assert.equal(items[0].time, '10:00');
  const serialised = JSON.stringify(items);
  for (const leak of ['Order status', 'in transit', 'o1', 'week 38', 'detail', 'recordId']) {
    assert.equal(serialised.includes(leak), false, `${leak} must not reach the yard list`);
  }
});

test('their jobs are their own, for the day being looked at', () => {
  const tasks = [
    { id: 't1', title: 'Fit the tray', assigneeId: 'crew-li', dueDate: '2026-09-05', status: 'open' },
    { id: 't2', title: 'Oscar\'s job', assigneeId: 'crew-oscar', dueDate: '2026-09-05', status: 'open' },
    { id: 't3', title: 'Unassigned', dueDate: '2026-09-05', status: 'open' },
    { id: 't4', title: 'Another day', assigneeId: 'crew-li', dueDate: '2026-09-08', status: 'open' },
  ];
  const jobs = crewJobsFor(tasks, 'crew-li', '2026-09-05', '2026-09-05');
  assert.deepEqual(jobs.map((job) => job.id), ['t1']);
});

test('an overdue job follows them to today, but does not appear on a day in the past', () => {
  const tasks = [{ id: 't1', title: 'Late', assigneeId: 'crew-li', dueDate: '2026-09-01', status: 'open' }];
  const onToday = crewJobsFor(tasks, 'crew-li', '2026-09-05', '2026-09-05');
  assert.deepEqual(onToday.map((job) => [job.id, job.overdue]), [['t1', true]]);
  assert.deepEqual(crewJobsFor(tasks, 'crew-li', '2026-09-03', '2026-09-05'), [],
    'browsing back to Wednesday shows Wednesday, not today\'s backlog');
  assert.equal(crewJobsFor(tasks, 'crew-li', '2026-09-01', '2026-09-05')[0].overdue, false,
    'on its own day it is simply the job');
});

test('done jobs sort below open ones and are still shown', () => {
  const tasks = [
    { id: 'done', title: 'Finished', assigneeId: 'crew-li', dueDate: '2026-09-05', status: 'completed' },
    { id: 'open', title: 'To do', assigneeId: 'crew-li', dueDate: '2026-09-05', status: 'open', dueTime: '09:00' },
  ];
  const jobs = crewJobsFor(tasks, 'crew-li', '2026-09-05', '2026-09-05');
  assert.deepEqual(jobs.map((job) => [job.id, job.done]), [['open', false], ['done', true]]);
});

test('a write has to be one of the four things this page can do', () => {
  assert.equal(decideCrewWrite({ action: 'delete_order', taskId: 't1' }).ok, false);
  assert.equal(decideCrewWrite({ action: 'add_task', title: 'x' }).ok, false, 'a job needs a day');
  assert.equal(decideCrewWrite({ action: 'add_task', title: '  ', date: '2026-09-05' }).ok, false);
  assert.deepEqual(decideCrewWrite({ action: 'add_task', title: ' Fit the tray ', date: '2026-09-05' }),
    { ok: true, action: 'add_task', title: 'Fit the tray', date: '2026-09-05' });
  assert.deepEqual(decideCrewWrite({ action: 'complete_task', taskId: 't1' }), { ok: true, action: 'complete_task', taskId: 't1' });
  assert.equal(decideCrewWrite({ action: 'move_task', taskId: 't1', date: 'Friday' }).ok, false);
  assert.deepEqual(decideCrewWrite({ action: 'set_note', date: '2026-09-05', note: ' waiting on parts ' }),
    { ok: true, action: 'set_note', date: '2026-09-05', note: 'waiting on parts' });
});

test('repeated bad keys lock the address out, and a quiet gap clears the count', () => {
  const start = Date.parse('2026-09-05T10:00:00Z');
  let record = null as ReturnType<typeof registerFailedAttempt> | null;
  for (let i = 0; i < KEY_ATTEMPT_LIMIT - 1; i += 1) record = registerFailedAttempt(record, start + i * 1000);
  assert.equal(isLockedOut(record, start), false);
  record = registerFailedAttempt(record, start + KEY_ATTEMPT_LIMIT * 1000);
  assert.equal(isLockedOut(record, start + KEY_ATTEMPT_LIMIT * 1000), true);

  const later = start + 60 * 60 * 1000;
  assert.equal(isLockedOut(record, later), false, 'the lockout expires');
  const afterGap = registerFailedAttempt(record, later);
  assert.equal(afterGap.failures.length, 1, 'attempts outside the window are forgotten');
});
