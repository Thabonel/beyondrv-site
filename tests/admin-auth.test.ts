import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createHmac } from 'node:crypto';
import type { HandlerEvent } from '@netlify/functions';
import {
  authenticateAdminCredentials,
  createAdminToken,
  getActorFromAdminToken,
  getAdminActor,
  getConfiguredAdminAccounts,
  hasAdminCapability,
} from '../netlify/functions/admin-auth.ts';
import { isValidAdminGateToken } from '../netlify/edge-functions/admin-gate.ts';

const managedEnvironmentKeys = [
  'ADMIN_PASSWORD',
  'ADMIN_COOKIE_SECRET',
  'ADMIN_GM_PASSWORD',
  'ADMIN_GM_NAME',
  'ADMIN_OWNER_PASSWORD',
  'ADMIN_OWNER_NAME',
  'ADMIN_SITE_ADMIN_PASSWORD',
  'ADMIN_SITE_ADMIN_NAME',
  'ADMIN_SESSION_VALID_AFTER',
  'ADMIN_GM_SESSION_VALID_AFTER',
  'ADMIN_OWNER_SESSION_VALID_AFTER',
  'ADMIN_SITE_ADMIN_SESSION_VALID_AFTER',
  'ADMIN_LEGACY_SESSION_VALID_AFTER',
] as const;

const originalEnvironment = Object.fromEntries(managedEnvironmentKeys.map(key => [key, process.env[key]]));

function event(input: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    httpMethod: 'GET',
    headers: {},
    body: null,
    isBase64Encoded: false,
    path: '/.netlify/functions/example',
    rawUrl: 'https://beyondrv.com.au/.netlify/functions/example',
    rawQuery: '',
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    multiValueHeaders: {},
    ...input,
  } as HandlerEvent;
}

beforeEach(() => {
  for (const key of managedEnvironmentKeys) delete process.env[key];
  process.env.ADMIN_COOKIE_SECRET = 'test-cookie-secret-with-enough-entropy';
});

afterEach(() => {
  for (const key of managedEnvironmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('individual credentials create actor-aware sessions with role capabilities', () => {
  process.env.ADMIN_GM_PASSWORD = 'gm-secret';
  process.env.ADMIN_GM_NAME = 'Workshop GM';
  process.env.ADMIN_OWNER_PASSWORD = 'owner-secret';

  assert.deepEqual(getConfiguredAdminAccounts().map(account => ({ id: account.id, role: account.role })), [
    { id: 'gm', role: 'gm' },
    { id: 'owner', role: 'owner' },
  ]);

  const actor = authenticateAdminCredentials('gm', 'gm-secret');
  assert.ok(actor);
  assert.equal(actor.displayName, 'Workshop GM');
  assert.equal(hasAdminCapability(actor, 'agreements:write'), true);
  assert.equal(hasAdminCapability(actor, 'site:write'), false);

  const token = createAdminToken(actor);
  const decoded = getActorFromAdminToken(token);
  assert.deepEqual(decoded, actor);
});

test('blank user is accepted only when one individual password matches', () => {
  process.env.ADMIN_GM_PASSWORD = 'gm-secret';
  process.env.ADMIN_OWNER_PASSWORD = 'owner-secret';
  assert.equal(authenticateAdminCredentials('', 'gm-secret')?.id, 'gm');

  process.env.ADMIN_OWNER_PASSWORD = 'gm-secret';
  assert.equal(authenticateAdminCredentials('', 'gm-secret'), null);
});

test('legacy admin password remains available during migration', () => {
  process.env.ADMIN_PASSWORD = 'legacy-secret';
  const actor = authenticateAdminCredentials('', 'legacy-secret');
  assert.ok(actor);
  assert.equal(actor.role, 'legacy_admin');
  assert.equal(hasAdminCapability(actor, 'site:write'), true);
});

test('legacy v1 cookies remain valid until their existing eight-hour expiry', () => {
  process.env.ADMIN_PASSWORD = 'legacy-secret';
  const issuedAt = Date.now().toString();
  const signature = createHmac('sha256', process.env.ADMIN_COOKIE_SECRET!)
    .update(`v1.${issuedAt}`)
    .digest('base64url');
  const actor = getActorFromAdminToken(`v1.${issuedAt}.${signature}`);
  assert.equal(actor?.role, 'legacy_admin');
});

test('unsafe cookie-authenticated requests reject cross-origin mutations', () => {
  process.env.ADMIN_GM_PASSWORD = 'gm-secret';
  const actor = authenticateAdminCredentials('gm', 'gm-secret');
  assert.ok(actor);
  const token = createAdminToken(actor);

  const allowed = getAdminActor(event({
    httpMethod: 'POST',
    headers: {
      host: 'beyondrv.com.au',
      origin: 'https://beyondrv.com.au',
      cookie: `brv_admin_auth=${encodeURIComponent(token)}`,
    },
  }));
  assert.equal(allowed?.id, 'gm');

  const blocked = getAdminActor(event({
    httpMethod: 'POST',
    headers: {
      host: 'beyondrv.com.au',
      origin: 'https://example.com',
      cookie: `brv_admin_auth=${encodeURIComponent(token)}`,
    },
  }));
  assert.equal(blocked, null);
});

test('site administrator can inspect sales but cannot make commercial commitments', () => {
  process.env.ADMIN_SITE_ADMIN_PASSWORD = 'site-secret';
  const actor = authenticateAdminCredentials('site-admin', 'site-secret');
  assert.ok(actor);
  assert.equal(hasAdminCapability(actor, 'sales:read'), true);
  assert.equal(hasAdminCapability(actor, 'site:write'), true);
  assert.equal(hasAdminCapability(actor, 'agreements:approve'), false);
  assert.equal(hasAdminCapability(actor, 'deposits:verify'), false);
  assert.equal(hasAdminCapability(actor, 'builds:release'), false);
});

test('global and role-specific session cutoffs revoke existing sessions', () => {
  process.env.ADMIN_GM_PASSWORD = 'gm-secret';
  process.env.ADMIN_OWNER_PASSWORD = 'owner-secret';
  const gm = authenticateAdminCredentials('gm', 'gm-secret');
  const owner = authenticateAdminCredentials('owner', 'owner-secret');
  assert.ok(gm);
  assert.ok(owner);
  const gmToken = createAdminToken(gm);
  const ownerToken = createAdminToken(owner);

  process.env.ADMIN_GM_SESSION_VALID_AFTER = new Date(Date.now() + 1_000).toISOString();
  assert.equal(getActorFromAdminToken(gmToken), null);
  assert.equal(getActorFromAdminToken(ownerToken)?.id, 'owner');

  process.env.ADMIN_SESSION_VALID_AFTER = String(Date.now() + 1_000);
  assert.equal(getActorFromAdminToken(ownerToken), null);
});

test('admin edge gate accepts actor tokens and applies the same role cutoff', async () => {
  process.env.ADMIN_GM_PASSWORD = 'gm-secret';
  const gm = authenticateAdminCredentials('gm', 'gm-secret');
  assert.ok(gm);
  const token = createAdminToken(gm);
  const environmentValues: Record<string, string> = {};
  const environment = (key: string) => environmentValues[key];

  assert.equal(await isValidAdminGateToken(token, process.env.ADMIN_COOKIE_SECRET!, environment), true);
  environmentValues.ADMIN_GM_SESSION_VALID_AFTER = new Date(Date.now() + 1_000).toISOString();
  assert.equal(await isValidAdminGateToken(token, process.env.ADMIN_COOKIE_SECRET!, environment), false);
});
