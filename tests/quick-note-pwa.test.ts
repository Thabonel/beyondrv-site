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

test('the sales workspace installs standalone and its manifest is reachable without signing in', () => {
  const manifest = JSON.parse(readFileSync(file('public/sales-workspace.webmanifest'), 'utf8')) as {
    id?: string; start_url?: string; scope?: string; display?: string; icons?: Array<{ src?: string; purpose?: string }>;
  };
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/admin/');
  assert.equal(manifest.id, '/admin/', 'a distinct id keeps this separate from the call logger');
  // Sign-in lives at /.netlify/functions/admin-login, outside /admin/. A scope
  // of /admin/ would push the sign-in round trip out of the installed app.
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons?.some(icon => icon.purpose === 'maskable'), 'Android needs a maskable icon');

  // The admin gate matches /admin, /admin/ and /admin/*. A manifest under any
  // of those would be answered with a redirect to sign in, and the install
  // would fail with nothing to explain why.
  const gate = readFileSync(file('netlify/edge-functions/admin-gate.ts'), 'utf8');
  const paths = [...gate.matchAll(/'(\/admin[^']*)'/g)].map(match => match[1]);
  assert.ok(paths.length > 0, 'could not read the gate paths');
  for (const path of paths) {
    const prefix = path.replace(/\*$/, '');
    assert.equal('/sales-workspace.webmanifest'.startsWith(prefix) && prefix !== '/', false, `manifest sits behind the gate rule ${path}`);
  }

  const page = readFileSync(file('src/pages/admin.astro'), 'utf8');
  for (const tag of [
    '<link rel="manifest" href="/sales-workspace.webmanifest" />',
    'apple-mobile-web-app-capable',
    'apple-mobile-web-app-title" content="Workspace"',
    'viewport-fit=cover',
  ]) assert.match(page, new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
