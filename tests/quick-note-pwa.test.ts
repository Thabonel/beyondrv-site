import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

test('every manifest in public is linked by a page, so no superseded one is left behind', () => {
  // gm-call-note.webmanifest outlived the move to manifest.json by a month.
  // Nothing referenced it, so nothing failed, and it stayed there advertising
  // an older icon set to anyone who found it.
  const manifests = readdirSync(file('public'), { withFileTypes: true })
    .filter(entry => entry.isFile() && /(^manifest\.json$|\.webmanifest$)/.test(entry.name))
    .map(entry => entry.name);
  assert.ok(manifests.length > 0, 'no manifests found at all');
  const linked = new Set(
    readdirSync(file('src/pages'), { recursive: true, encoding: 'utf8' })
      .filter(name => name.endsWith('.astro'))
      .flatMap(name => [...readFileSync(file(`src/pages/${name}`), 'utf8')
        .matchAll(/<link\s+rel="manifest"\s+href="\/([^"]+)"/g)].map(match => match[1])),
  );
  for (const name of manifests) assert.ok(linked.has(name), `public/${name} is not linked by any page`);
});
