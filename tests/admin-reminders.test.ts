import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_REMINDERS, activeReminders, type AdminReminder } from '../src/lib/adminReminders.ts';

const sample: AdminReminder[] = [
  { id: 'card', title: 'Replace the card', detail: 'Expires soon.', dueDate: '2027-07-01', leadDays: 120 },
];

test('a reminder stays hidden until its lead window opens', () => {
  // 121 days before 2027-07-01
  assert.deepEqual(activeReminders(new Date('2027-03-01T00:00:00Z'), sample), []);
});

test('a reminder appears once inside its lead window', () => {
  const shown = activeReminders(new Date('2027-05-01T00:00:00Z'), sample);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].id, 'card');
});

test('a reminder keeps showing after its due date rather than vanishing', () => {
  const shown = activeReminders(new Date('2028-01-01T00:00:00Z'), sample);
  assert.equal(shown.length, 1);
});

test('reminders are ordered by how soon they are due', () => {
  const many: AdminReminder[] = [
    { id: 'later',  title: 'Later',  detail: '', dueDate: '2027-12-01', leadDays: 3650 },
    { id: 'sooner', title: 'Sooner', detail: '', dueDate: '2027-02-01', leadDays: 3650 },
  ];
  assert.deepEqual(activeReminders(new Date('2026-08-19T00:00:00Z'), many).map((r) => r.id), ['sooner', 'later']);
});

test('the shipped reminders are well formed', () => {
  assert.ok(ADMIN_REMINDERS.length > 0, 'expected at least one shipped reminder');
  for (const r of ADMIN_REMINDERS) {
    assert.ok(r.id && r.title && r.detail, `${r.id}: missing text`);
    assert.ok(!Number.isNaN(Date.parse(r.dueDate)), `${r.id}: unparseable dueDate`);
    assert.ok(r.leadDays > 0, `${r.id}: leadDays must be positive`);
  }
});
