const COOKIE_NAME = 'brv_admin_auth';
const LEGACY_TOKEN_VERSION = 'v1';
const ACTOR_TOKEN_VERSION = 'v2';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const ADMIN_ROLES = ['gm', 'owner', 'site_admin', 'legacy_admin'] as const;
type AdminRole = typeof ADMIN_ROLES[number];

function parseCookies(header = '') {
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1);
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }
  return cookies;
}

function base64Url(bytes: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return base64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function parseSessionValidAfter(value: string | undefined) {
  if (!value?.trim()) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionIsNotRevoked(timestamp: number, role: AdminRole, environment: (key: string) => string | undefined) {
  const roleEnvironmentKey = role === 'legacy_admin'
    ? 'ADMIN_LEGACY_SESSION_VALID_AFTER'
    : `ADMIN_${role.toUpperCase()}_SESSION_VALID_AFTER`;
  const validAfter = Math.max(
    parseSessionValidAfter(environment('ADMIN_SESSION_VALID_AFTER')),
    parseSessionValidAfter(environment(roleEnvironmentKey))
  );
  return timestamp >= validAfter;
}

function timestampIsValid(timestamp: number) {
  if (!Number.isFinite(timestamp)) return false;
  if (timestamp > Date.now() + 5 * 60 * 1000) return false;
  return Date.now() - timestamp <= SESSION_MAX_AGE_MS;
}

function decodeActorPayload(encoded: string) {
  try {
    const standard = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { issuedAt?: unknown; role?: unknown };
    const role = ADMIN_ROLES.includes(String(payload.role) as AdminRole) ? payload.role as AdminRole : null;
    const issuedAt = Number(payload.issuedAt);
    return role && Number.isFinite(issuedAt) ? { role, issuedAt } : null;
  } catch {
    return null;
  }
}

export async function isValidAdminGateToken(
  token: string,
  secret: string,
  environment: (key: string) => string | undefined = () => undefined
) {
  if (!token || token.length > 4096 || !secret) return false;
  const [version, value, signature, ...extra] = token.split('.');
  if (!value || !signature || extra.length > 0) return false;
  if (signature !== await sign(`${version}.${value}`, secret)) return false;

  if (version === LEGACY_TOKEN_VERSION) {
    const issuedAt = Number(value);
    return timestampIsValid(issuedAt) && sessionIsNotRevoked(issuedAt, 'legacy_admin', environment);
  }

  if (version !== ACTOR_TOKEN_VERSION) return false;
  const payload = decodeActorPayload(value);
  return Boolean(
    payload &&
    timestampIsValid(payload.issuedAt) &&
    sessionIsNotRevoked(payload.issuedAt, payload.role, environment)
  );
}

export default async function adminGate(request: Request) {
  try {
    const environment = (key: string) => globalThis.Netlify?.env?.get(key);
    const cookies = parseCookies(request.headers.get('cookie') ?? '');
    const token = cookies[COOKIE_NAME] ?? '';
    const secrets = Array.from(new Set([
      environment('ADMIN_COOKIE_SECRET'),
      environment('ADMIN_PASSWORD'),
      environment('ADMIN_GM_PASSWORD'),
      environment('ADMIN_OWNER_PASSWORD'),
      environment('ADMIN_SITE_ADMIN_PASSWORD'),
    ].filter(Boolean))) as string[];
    let isAllowed = false;
    for (const candidate of secrets) {
      if (await isValidAdminGateToken(token, candidate, environment)) {
        isAllowed = true;
        break;
      }
    }

    if (isAllowed) {
      return;
    }
  } catch (error) {
    console.warn('admin-gate: auth check failed, redirecting to login', error);
  }

  const url = new URL(request.url);
  url.pathname = '/.netlify/functions/admin-login';
  url.search = '';
  return Response.redirect(url, 302);
}

export const config = {
  path: ['/admin', '/admin/', '/admin/*'],
};
