import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VIDEO_UPLOAD_DATE,
  normalizeVideoUploadDate
} from '../src/lib/structuredData.js';

test('video upload date defaults to a timezone-aware datetime', () => {
  assert.equal(normalizeVideoUploadDate(), DEFAULT_VIDEO_UPLOAD_DATE);
});

test('video upload date converts a date-only value to Brisbane time', () => {
  assert.equal(normalizeVideoUploadDate('2026-05-28'), '2026-05-28T00:00:00+10:00');
});

test('video upload date adds the Brisbane offset to a local datetime', () => {
  assert.equal(normalizeVideoUploadDate('2026-05-28T09:30:00'), '2026-05-28T09:30:00+10:00');
});

test('video upload date preserves an existing timezone', () => {
  assert.equal(normalizeVideoUploadDate('2026-05-28T01:30:00Z'), '2026-05-28T01:30:00Z');
});

test('video upload date rejects malformed values', () => {
  assert.equal(normalizeVideoUploadDate('not-a-date'), DEFAULT_VIDEO_UPLOAD_DATE);
  assert.equal(normalizeVideoUploadDate('2026-13-40'), DEFAULT_VIDEO_UPLOAD_DATE);
});
