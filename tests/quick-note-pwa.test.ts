import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const file = (path: string) => new URL(path, root);

test('Log Customer Call has standalone install metadata and required icon assets', () => {
  const manifest = JSON.parse(readFileSync(file('public/manifest.json'), 'utf8')) as { display?: string; start_url?: string; icons?: Array<{ src?: string; purpose?: string }> };
  const page = readFileSync(file('src/pages/admin/quick-note.astro'), 'utf8');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/admin/quick-note/');
  assert.deepEqual(manifest.icons?.map(icon => icon.src), ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png']);
  assert.equal(manifest.icons?.[2]?.purpose, 'maskable');
  for (const asset of ['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/icon-maskable-512.png', 'public/apple-touch-icon.png', 'public/favicon.ico']) assert.equal(existsSync(file(asset)), true, asset);
  for (const tag of ['<link rel="manifest" href="/manifest.json" />', 'mobile-web-app-capable', 'apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-touch-icon', 'viewport-fit=cover']) assert.match(page, new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
