import type { HandlerEvent } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'brv_admin_auth';
const LEGACY_TOKEN_VERSION = 'v1';
const ACTOR_TOKEN_VERSION = 'v2';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export type AdminRole = 'gm' | 'owner' | 'site_admin' | 'legacy_admin';

export type AdminCapability =
  | 'sales:read'
  | 'sales:write'
  | 'agreements:read'
  | 'agreements:write'
  | 'agreements:approve'
  | 'agreements:send'
  | 'agreements:record_acceptance'
  | 'configurations:read'
  | 'configurations:write'
  | 'configurations:approve'
  | 'deposits:verify'
  | 'builds:read'
  | 'builds:release'
  | 'site:read'
  | 'site:write'
  | 'vehicles:review'
  | 'integrations:manage'
  | 'audit:read';

export interface AdminActor {
  id: string;
  displayName: string;
  role: AdminRole;
  legacy: boolean;
}

interface ConfiguredAdminAccount extends AdminActor {
  password: string;
}

interface AdminTokenPayload {
  issuedAt: number;
  actorId: string;
  displayName: string;
  role: AdminRole;
}

const ALL_CAPABILITIES: AdminCapability[] = [
  'sales:read',
  'sales:write',
  'agreements:read',
  'agreements:write',
  'agreements:approve',
  'agreements:send',
  'agreements:record_acceptance',
  'configurations:read',
  'configurations:write',
  'configurations:approve',
  'deposits:verify',
  'builds:read',
  'builds:release',
  'site:read',
  'site:write',
  'vehicles:review',
  'integrations:manage',
  'audit:read',
];

const ROLE_CAPABILITIES: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  gm: new Set([
    'sales:read',
    'sales:write',
    'agreements:read',
    'agreements:write',
    'agreements:approve',
    'agreements:send',
    'agreements:record_acceptance',
    'configurations:read',
    'configurations:write',
    'configurations:approve',
    'deposits:verify',
    'builds:read',
    'builds:release',
    'vehicles:review',
  ]),
  owner: new Set(ALL_CAPABILITIES),
  site_admin: new Set([
    'sales:read',
    'agreements:read',
    'configurations:read',
    'builds:read',
    'site:read',
    'site:write',
    'integrations:manage',
    'audit:read',
  ]),
  legacy_admin: new Set(ALL_CAPABILITIES),
};

function cleanIdentifier(value: unknown, fallback: string) {
  const cleaned = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 80)
    : '';
  return cleaned || fallback;
}

function cleanDisplayName(value: unknown, fallback: string) {
  const cleaned = typeof value === 'string' ? value.trim().slice(0, 120) : '';
  return cleaned || fallback;
}

function legacyActor(): AdminActor {
  return {
    id: 'legacy-admin',
    displayName: cleanDisplayName(process.env.ADMIN_LEGACY_NAME, 'Legacy administrator'),
    role: 'legacy_admin',
    legacy: true,
  };
}

export function getConfiguredAdminAccounts(): ConfiguredAdminAccount[] {
  const candidates: Array<{
    id: string;
    defaultName: string;
    role: Exclude<AdminRole, 'legacy_admin'>;
    password?: string;
    configuredName?: string;
  }> = [
    {
      id: 'gm',
      defaultName: 'General Manager',
      role: 'gm',
      password: process.env.ADMIN_GM_PASSWORD,
      configuredName: process.env.ADMIN_GM_NAME,
    },
    {
      id: 'owner',
      defaultName: 'Owner',
      role: 'owner',
      password: process.env.ADMIN_OWNER_PASSWORD,
      configuredName: process.env.ADMIN_OWNER_NAME,
    },
    {
      id: 'site-admin',
      defaultName: 'Site Administrator',
      role: 'site_admin',
      password: process.env.ADMIN_SITE_ADMIN_PASSWORD,
      configuredName: process.env.ADMIN_SITE_ADMIN_NAME,
    },
  ];

  return candidates
    .filter((candidate): candidate is typeof candidate & { password: string } => Boolean(candidate.password))
    .map(candidate => ({
      id: cleanIdentifier(candidate.id, candidate.id),
      displayName: cleanDisplayName(candidate.configuredName, candidate.defaultName),
      role: candidate.role,
      legacy: false,
      password: candidate.password,
    }));
}

function getExpectedLegacyPassword() {
  return process.env.ADMIN_PASSWORD ?? '';
}

function getCookieSecrets() {
  return Array.from(new Set([
    process.env.ADMIN_COOKIE_SECRET,
    getExpectedLegacyPassword(),
    process.env.ADMIN_GM_PASSWORD,
    process.env.ADMIN_OWNER_PASSWORD,
    process.env.ADMIN_SITE_ADMIN_PASSWORD,
  ].filter(Boolean))) as string[];
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

function accountActor(account: ConfiguredAdminAccount): AdminActor {
  return {
    id: account.id,
    displayName: account.displayName,
    role: account.role,
    legacy: false,
  };
}

export function authenticateAdminCredentials(identifier: string, password: string): AdminActor | null {
  if (!password) return null;
  const requestedId = cleanIdentifier(identifier, '');
  const accounts = getConfiguredAdminAccounts();
  const eligibleAccounts = requestedId
    ? accounts.filter(account => account.id === requestedId || account.role === requestedId.replace(/-/g, '_'))
    : accounts;
  const matches = eligibleAccounts.filter(account => constantTimeEqual(password, account.password));
  if (matches.length === 1) return accountActor(matches[0]);

  const legacyPassword = getExpectedLegacyPassword();
  if ((!requestedId || requestedId === 'legacy-admin' || requestedId === 'admin') && legacyPassword && constantTimeEqual(password, legacyPassword)) {
    return legacyActor();
  }
  return null;
}

function encodeActorPayload(payload: AdminTokenPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeActorPayload(encoded: string): AdminTokenPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<AdminTokenPayload>;
    const role = ['gm', 'owner', 'site_admin', 'legacy_admin'].includes(String(parsed.role))
      ? parsed.role as AdminRole
      : null;
    if (!role || !Number.isFinite(parsed.issuedAt)) return null;
    const actorId = cleanIdentifier(parsed.actorId, '');
    if (!actorId) return null;
    return {
      issuedAt: Number(parsed.issuedAt),
      actorId,
      displayName: cleanDisplayName(parsed.displayName, actorId),
      role,
    };
  } catch {
    return null;
  }
}

function timestampIsValid(timestamp: number) {
  if (timestamp > Date.now() + 5 * 60 * 1000) return false;
  return Date.now() - timestamp <= SESSION_MAX_AGE_MS;
}

function parseSessionValidAfter(value: string | undefined) {
  if (!value?.trim()) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionIsNotRevoked(timestamp: number, role: AdminRole) {
  const roleEnvironmentKey = role === 'legacy_admin'
    ? 'ADMIN_LEGACY_SESSION_VALID_AFTER'
    : `ADMIN_${role.toUpperCase()}_SESSION_VALID_AFTER`;
  const validAfter = Math.max(
    parseSessionValidAfter(process.env.ADMIN_SESSION_VALID_AFTER),
    parseSessionValidAfter(process.env[roleEnvironmentKey])
  );
  return timestamp >= validAfter;
}

export function createAdminToken(actor: AdminActor = legacyActor()) {
  const secret = getCookieSecrets()[0];
  if (!secret) return '';
  const encoded = encodeActorPayload({
    issuedAt: Date.now(),
    actorId: actor.id,
    displayName: actor.displayName,
    role: actor.role,
  });
  return `${ACTOR_TOKEN_VERSION}.${encoded}.${sign(`${ACTOR_TOKEN_VERSION}.${encoded}`, secret)}`;
}

export function getActorFromAdminToken(token = ''): AdminActor | null {
  const [version, value, signature] = token.split('.');
  if (!value || !signature) return null;

  if (version === LEGACY_TOKEN_VERSION) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || !timestampIsValid(timestamp) || !sessionIsNotRevoked(timestamp, 'legacy_admin')) return null;
    const valid = getCookieSecrets().some(secret => constantTimeEqual(signature, sign(`${version}.${value}`, secret)));
    return valid ? legacyActor() : null;
  }

  if (version !== ACTOR_TOKEN_VERSION) return null;
  const payload = decodeActorPayload(value);
  if (!payload || !timestampIsValid(payload.issuedAt) || !sessionIsNotRevoked(payload.issuedAt, payload.role)) return null;
  const valid = getCookieSecrets().some(secret => constantTimeEqual(signature, sign(`${version}.${value}`, secret)));
  if (!valid) return null;
  return {
    id: payload.actorId,
    displayName: payload.displayName,
    role: payload.role,
    legacy: payload.role === 'legacy_admin',
  };
}

export function isValidAdminToken(token = '') {
  return Boolean(getActorFromAdminToken(token));
}

function actorFromPasswordHeader(event: HandlerEvent) {
  const headerPassword = event.headers['x-admin-password'] ?? event.headers['X-Admin-Password'];
  if (typeof headerPassword !== 'string') return null;
  const headerUser = event.headers['x-admin-user'] ?? event.headers['X-Admin-User'] ?? '';
  return authenticateAdminCredentials(typeof headerUser === 'string' ? headerUser : '', headerPassword);
}

export function getAdminActor(event: HandlerEvent): AdminActor | null {
  const passwordActor = actorFromPasswordHeader(event);
  if (passwordActor) return passwordActor;

  const headerToken = event.headers['x-admin-token'] ?? event.headers['X-Admin-Token'];
  if (typeof headerToken === 'string') {
    const actor = getActorFromAdminToken(headerToken);
    if (actor) return actor;
  }

  const cookies = parseCookies(event.headers.cookie);
  if (!isTrustedCookieAuthRequest(event)) return null;
  return getActorFromAdminToken(cookies[COOKIE_NAME]);
}

export function isAdminAuthorized(event: HandlerEvent) {
  return Boolean(getAdminActor(event));
}

export function hasAdminCapability(actor: AdminActor, capability: AdminCapability) {
  return ROLE_CAPABILITIES[actor.role].has(capability);
}

export function getAdminCapabilities(actor: AdminActor) {
  return Array.from(ROLE_CAPABILITIES[actor.role]);
}

export function getAuthorizedAdminActor(event: HandlerEvent, capability: AdminCapability) {
  const actor = getAdminActor(event);
  return actor && hasAdminCapability(actor, capability) ? actor : null;
}

export function unauthorizedResponse() {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Unauthorized' }),
  };
}

export function forbiddenResponse(capability?: AdminCapability) {
  return {
    statusCode: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Forbidden',
      ...(capability ? { requiredCapability: capability } : {}),
    }),
  };
}

function isUnsafeMethod(method = 'GET') {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function sameOrigin(candidate: string | undefined, host: string | undefined) {
  if (!candidate || !host) return true;
  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}

function isTrustedCookieAuthRequest(event: HandlerEvent) {
  if (!isUnsafeMethod(event.httpMethod)) return true;
  const host = event.headers.host ?? event.headers.Host;
  const origin = event.headers.origin ?? event.headers.Origin;
  const referer = event.headers.referer ?? event.headers.Referer;
  return sameOrigin(origin, host) && sameOrigin(referer, host);
}
