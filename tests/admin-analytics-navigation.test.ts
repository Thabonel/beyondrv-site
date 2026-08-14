import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('analytics navigation is protected in the permanent admin shell and mobile menu', () => {
  const adminPage = read('src/pages/admin.astro');
  const adminPanel = read('src/components/AdminPanel.tsx');
  const analyticsPage = read('src/pages/admin/analytics.astro');

  assert.match(adminPage, /data-persistent-admin-navigation/);
  assert.match(adminPage, /href="\/admin\/analytics\/"[^>]*>Analytics<\/a>/);
  assert.equal(adminPanel.match(/href="\/admin\/analytics\/"/g)?.length, 2);
  assert.match(adminPanel, /aria-label="Open analytics dashboard"/);
  assert.match(adminPanel, />\s*Analytics dashboard\s*<\/a>/);
  assert.match(analyticsPage, /href="\/admin"[^>]*>Admin<\/a>/);
});
