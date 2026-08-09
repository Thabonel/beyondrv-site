import assert from 'node:assert/strict';
import test from 'node:test';
import { safeAdminReturnTo } from '../netlify/functions/admin-login-core.ts';

test('admin login retains the requested GM workspace after sign-in', () => {
  assert.equal(safeAdminReturnTo('/admin/?view=gm'), '/admin/?view=gm');
});

test('admin login rejects external or non-admin return addresses', () => {
  assert.equal(safeAdminReturnTo('https://example.com/admin/?view=gm'), '/admin/');
  assert.equal(safeAdminReturnTo('//example.com/admin/'), '/admin/');
  assert.equal(safeAdminReturnTo('/shop/?view=gm'), '/admin/');
  assert.equal(safeAdminReturnTo(undefined), '/admin/');
});
