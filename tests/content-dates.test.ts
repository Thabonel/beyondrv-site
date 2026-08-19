import assert from 'node:assert/strict';
import test from 'node:test';
import matter from 'gray-matter';
import { toIsoDateString } from '../src/lib/contentDates.ts';

test('a Date from YAML 1.1 frontmatter becomes an ISO string', () => {
  const parsed = matter('---\narchivedAt: 2026-08-18T00:42:18.388Z\n---\n').data;

  // gray-matter (js-yaml, YAML 1.1) reads a bare ISO scalar as a Date.
  assert.ok(parsed.archivedAt instanceof Date);
  assert.equal(toIsoDateString(parsed.archivedAt), '2026-08-18T00:42:18.388Z');
});

test('an already-quoted timestamp passes through untouched', () => {
  const parsed = matter('---\narchivedAt: "2026-08-18T00:42:18.388Z"\n---\n').data;

  assert.equal(typeof parsed.archivedAt, 'string');
  assert.equal(toIsoDateString(parsed.archivedAt), '2026-08-18T00:42:18.388Z');
});

test('absent and non-date values are left alone for zod to judge', () => {
  assert.equal(toIsoDateString(undefined), undefined);
  assert.equal(toIsoDateString('coming soon'), 'coming soon');
  assert.equal(toIsoDateString(42), 42);
});
