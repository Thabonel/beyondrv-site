import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeJsonForHtml } from '../src/lib/safeJson.ts';

test('HTML-significant JSON data cannot terminate a script data element', () => {
  const serialized = serializeJsonForHtml({ title: '</script><script>alert(1)</script>', ampersand: '&' });
  assert.equal(serialized.includes('</script>'), false);
  assert.equal(serialized.includes('<script>'), false);
  assert.equal(serialized.includes('&'), false);
  assert.deepEqual(JSON.parse(serialized), { title: '</script><script>alert(1)</script>', ampersand: '&' });
});

test('Unicode line and paragraph separators are escaped and round-trip', () => {
  const value = { text: `line\u2028paragraph\u2029end` };
  const serialized = serializeJsonForHtml(value);
  assert.equal(serialized.includes('\u2028'), false);
  assert.equal(serialized.includes('\u2029'), false);
  assert.deepEqual(JSON.parse(serialized), value);
});
