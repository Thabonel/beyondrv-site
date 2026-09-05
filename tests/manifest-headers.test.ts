import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const netlifyToml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/my-day.webmanifest', import.meta.url), 'utf8'));

test('a .webmanifest is served as manifest+json', () => {
  // Netlify sends an unknown extension as application/octet-stream, and the
  // site sets X-Content-Type-Options: nosniff, so the browser is told not to
  // guess. Chrome on Android then refuses the manifest and the install prompt
  // with it. iOS uses the apple-mobile-web-app meta tags, which is why an
  // iPhone installed it while Android would not.
  const index = netlifyToml.indexOf('for = "/*.webmanifest"');
  assert.notEqual(index, -1, 'no header rule for .webmanifest');
  const next = netlifyToml.indexOf('[[headers]]', index);
  const rule = netlifyToml.slice(index, next === -1 ? undefined : next);
  assert.match(rule, /Content-Type\s*=\s*"application\/manifest\+json/);
});

test('nosniff is still set, so the content type has to be right', () => {
  assert.match(netlifyToml, /X-Content-Type-Options\s*=\s*"nosniff"/);
});

test('the phone manifest omits start_url and keeps its icons', () => {
  // Without start_url the launch URL is the document URL, fragment included,
  // which is how the installed icon carries its key on an iPhone.
  assert.equal(manifest.start_url, undefined);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/my-day/');
  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  assert.ok(purposes.includes('maskable'), 'Android needs a maskable icon');
  assert.ok(purposes.includes('any'));
});
