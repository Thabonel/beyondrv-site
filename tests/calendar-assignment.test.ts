import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAssignments,
  assignmentKey,
  assignmentTarget,
  cleanAssignees,
  isAssignedTo,
  readAssignees,
} from '../netlify/functions/calendar-assignment-core.ts';

test('a task keeps its owners on the record; anything else gets an assignment record', () => {
  assert.deepEqual(assignmentTarget('task', 't1'), { store: 'task', id: 't1' });
  assert.deepEqual(assignmentTarget('expected_handover', 'o1'), { store: 'assignment', id: 'expected_handover:o1' });
  assert.equal(assignmentKey('expected_handover:o1'), 'assignments/expected_handover%3Ao1.json');
});

test('a record written before this change is read as a list, so nothing needs migrating', () => {
  assert.deepEqual(readAssignees({ assigneeId: 'crew-li' }), ['crew-li']);
  assert.deepEqual(readAssignees({ assigneeIds: ['crew-li', 'crew-oscar'] }), ['crew-li', 'crew-oscar']);
  assert.deepEqual(readAssignees({ assigneeIds: ['crew-li', 'crew-li', '', 7] as unknown[] }), ['crew-li']);
  assert.deepEqual(readAssignees({}), []);
  assert.deepEqual(readAssignees(null), []);
});

test('a list of people is de-duplicated, trimmed and capped', () => {
  assert.deepEqual(cleanAssignees([' crew-li ', 'crew-li', '', 'crew-oscar']), ['crew-li', 'crew-oscar']);
  assert.deepEqual(cleanAssignees('crew-li'), ['crew-li'], 'one name is still a list');
  assert.equal(cleanAssignees(Array.from({ length: 50 }, (_, i) => `crew-${i}`)).length, 20);
  assert.deepEqual(cleanAssignees(undefined), []);
});

test('assignments land on the events they name, and never overwrite a task', () => {
  const events = [
    { id: 'expected_handover:o1', kind: 'expected_handover' },
    { id: 'task:t1', kind: 'task', assigneeIds: ['crew-li'] },
    { id: 'customer_visit:o2', kind: 'customer_visit' },
  ];
  applyAssignments(events, [
    { eventId: 'expected_handover:o1', assigneeIds: ['crew-li', 'crew-oscar'] },
    { eventId: 'task:t1', assigneeIds: ['crew-nobody'] },
  ]);
  assert.deepEqual(events[0].assigneeIds, ['crew-li', 'crew-oscar']);
  assert.deepEqual(events[1].assigneeIds, ['crew-li'], 'the task record is the authority on its own owners');
  assert.equal(events[2].assigneeIds, undefined);
});

test('an empty assignment list changes nothing', () => {
  const events = [{ id: 'a', kind: 'meeting' }];
  assert.deepEqual(applyAssignments(events, []), [{ id: 'a', kind: 'meeting' }]);
});

test('whether someone is on an item', () => {
  assert.equal(isAssignedTo({ assigneeIds: ['crew-li', 'crew-oscar'] }, 'crew-oscar'), true);
  assert.equal(isAssignedTo({ assigneeIds: ['crew-li'] }, 'crew-oscar'), false);
  assert.equal(isAssignedTo({}, 'crew-li'), false);
  assert.equal(isAssignedTo({ assigneeIds: ['crew-li'] }, ''), false);
});
