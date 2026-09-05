import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideMove, decideNewTask, immovableReason, isMovableKind, moveWarning, WRITE_TARGETS,
} from '../netlify/functions/calendar-write-core.ts';

test('a container ETA cannot be dragged, and says why', () => {
  assert.equal(isMovableKind('container_eta'), false);
  const decision = decideMove({ kind: 'container_eta', recordId: 'p1', date: '2026-09-20' });
  assert.equal(decision.ok, false);
  assert.match((decision as { error: string }).error, /Pending review/);
});

test('every movable kind writes to a real field on a real store', () => {
  for (const [kind, target] of Object.entries(WRITE_TARGETS)) {
    assert.ok(['orders', 'leads', 'tasks'].includes(target.store), `${kind} store`);
    assert.ok(target.field.length > 0, `${kind} field`);
  }
});

test('only visits and handovers are treated as commitments', () => {
  const commitments = Object.entries(WRITE_TARGETS).filter(([, t]) => t.commitment).map(([k]) => k).sort();
  assert.deepEqual(commitments, ['customer_visit', 'expected_handover']);
});

test('a move needs a record, a kind and a real date', () => {
  assert.equal(decideMove({ kind: 'task', date: '2026-09-10' }).ok, false);
  assert.equal(decideMove({ recordId: 't1', date: '2026-09-10' }).ok, false);
  assert.equal(decideMove({ kind: 'task', recordId: 't1', date: 'Friday' }).ok, false);
  assert.equal(decideMove({ kind: 'task', recordId: 't1', date: '2026-09-10' }).ok, true);
});

test('moving a visit onto a vehicle that is not here returns a warning', () => {
  assert.match(moveWarning('customer_visit', 'in_transit'), /not marked as here/);
  assert.equal(moveWarning('customer_visit', 'arrived_mutdapilly'), '');
  assert.equal(moveWarning('task', 'in_transit'), '', 'only a visit carries this risk');
});

test('a new task needs a title and a real date', () => {
  assert.equal(decideNewTask({ title: '  ', date: '2026-09-10' }).ok, false);
  assert.equal(decideNewTask({ title: 'Ring the agent', date: 'soon' }).ok, false);
  const ok = decideNewTask({ title: '  Ring the agent  ', date: '2026-09-10' });
  assert.deepEqual(ok, { ok: true, title: 'Ring the agent', dueDate: '2026-09-10', dueTime: '', assigneeIds: [] });
});

test('an unknown kind is refused rather than guessed at', () => {
  assert.match(immovableReason('nonsense'), /not a date this calendar can move/);
});

test('a move with a time keeps it for kinds that can hold one and drops it for the rest', () => {
  const visit = decideMove({ kind: 'customer_visit', recordId: 'o1', date: '2026-09-10', time: '10:00' });
  assert.equal(visit.ok, true);
  assert.equal((visit as any).time, '10:00');
  assert.equal((visit as any).target.timeField, 'customerVisitTime');
  const arrival = decideMove({ kind: 'expected_arrival', recordId: 'o1', date: '2026-09-10', time: '10:00' });
  assert.equal(arrival.ok, true);
  assert.equal((arrival as any).time, '', 'an arrival has nowhere to keep a time, so the day still moves');
});

test('a malformed time is refused rather than written', () => {
  assert.equal(decideMove({ kind: 'task', recordId: 't1', date: '2026-09-10', time: '10am' }).ok, false);
  assert.equal(decideNewTask({ title: 'x', date: '2026-09-10', time: '25:00' }).ok, false);
  assert.deepEqual(decideNewTask({ title: 'x', date: '2026-09-10', time: '09:15' }), { ok: true, title: 'x', dueDate: '2026-09-10', dueTime: '09:15', assigneeIds: [] });
});

test('meetings and reminders are not record dates, and the reason says where they move', () => {
  assert.match(immovableReason('meeting'), /calendar events endpoint/);
});

test('a new task can be given to several people, and defaults to nobody', () => {
  assert.deepEqual(decideNewTask({ title: 'Fit the tray', date: '2026-09-10', assigneeIds: ['crew-li', 'crew-oscar'] }),
    { ok: true, title: 'Fit the tray', dueDate: '2026-09-10', dueTime: '', assigneeIds: ['crew-li', 'crew-oscar'] });
  assert.deepEqual((decideNewTask({ title: 'x', date: '2026-09-10' }) as { assigneeIds: string[] }).assigneeIds, [],
    'nobody picked means it is the GM\'s own');
  assert.deepEqual((decideNewTask({ title: 'x', date: '2026-09-10', assigneeIds: ['crew-li', 'crew-li', '  '] }) as { assigneeIds: string[] }).assigneeIds,
    ['crew-li'], 'the same person twice is still one person');
});
