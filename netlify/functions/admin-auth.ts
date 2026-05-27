import type { HandlerEvent } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'brv_admin_auth';
const TOKEN_VERSION = 'v1';

function getExpectedPassword() {
  return process.env.ADMIN_PASSWORD ?? '';
}

function getCookieSecret() {
  return process.env.ADMIN_COOKIE_SECRET || getExpectedPassword();
}

function sign(value: string) {
  return createHmac('sha256', getCookieSecret()).update(value).digest('base64url');
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
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

export function isAdminAuthorized(event: HandlerEvent) {
  const expected = getExpectedPassword();
  if (!expected) return false;

  const headerPassword =
    event.headers['x-admin-password'] ??
    event.headers['X-Admin-Password'];

  if (headerPassword === expected) return true;
  const headerToken =
    event.headers['x-admin-token'] ??
    event.headers['X-Admin-Token'];

  if (typeof headerToken === 'string' && isValidAdminToken(headerToken)) return true;

  const cookies = parseCookies(event.headers.cookie);
  return isValidAdminToken(cookies[COOKIE_NAME]);
}

export function createAdminToken() {
  const issuedAt = Date.now().toString();
  return `${TOKEN_VERSION}.${issuedAt}.${sign(`${TOKEN_VERSION}.${issuedAt}`)}`;
}

export function isValidAdminToken(token = '') {
  const [version, issuedAt, signature] = token.split('.');
  if (version !== TOKEN_VERSION || !issuedAt || !signature) return false;
  const timestamp = Number(issuedAt);
  if (!Number.isFinite(timestamp)) return false;
  if (timestamp > Date.now() + 5 * 60 * 1000) return false;
  if (Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
  return constantTimeEqual(signature, sign(`${version}.${issuedAt}`));
}

export function unauthorizedResponse() {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Unauthorized' }),
  };
}
