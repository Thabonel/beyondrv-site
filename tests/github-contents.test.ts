import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommitBody } from '../netlify/functions/github-contents.ts';

test('content is base64 encoded for the contents API', () => {
  const body = buildCommitBody('{"reviews":[]}', null, 'msg', 'main');

  assert.equal(Buffer.from(body.content as string, 'base64').toString('utf8'), '{"reviews":[]}');
});

// Without the sha, GitHub treats the write as a create and rejects it for an
// existing file. With a stale sha it rejects the write, which is what stops one
// reviewer silently overwriting another.
test('an existing file carries its sha, a new file does not', () => {
  assert.equal(buildCommitBody('x', 'abc123', 'msg', 'main').sha, 'abc123');
  assert.equal('sha' in buildCommitBody('x', null, 'msg', 'main'), false);
});

test('utf8 content survives the round trip', () => {
  const body = buildCommitBody('Björn — 3350kg', null, 'msg', 'main');

  assert.equal(Buffer.from(body.content as string, 'base64').toString('utf8'), 'Björn — 3350kg');
});

test('the branch and message are passed through unchanged', () => {
  const body = buildCommitBody('x', null, 'data: publish 24 Ford vehicles', 'feature-branch');

  assert.equal(body.branch, 'feature-branch');
  assert.equal(body.message, 'data: publish 24 Ford vehicles');
});
