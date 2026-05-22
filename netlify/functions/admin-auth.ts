import type { HandlerEvent } from '@netlify/functions';

const COOKIE_NAME = 'brv_admin_auth';

function getExpectedPassword() {
  return process.env.ADMIN_PASSWORD ?? '';
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

  const cookies = parseCookies(event.headers.cookie);
  return cookies[COOKIE_NAME] === expected;
}

export function unauthorizedResponse() {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Unauthorized' }),
  };
}
