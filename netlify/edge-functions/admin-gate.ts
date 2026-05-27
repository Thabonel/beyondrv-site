const COOKIE_NAME = 'brv_admin_auth';
const TOKEN_VERSION = 'v1';

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
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

async function isValidToken(token: string, secret: string) {
  const [version, issuedAt, signature] = token.split('.');
  if (version !== TOKEN_VERSION || !issuedAt || !signature) return false;
  const timestamp = Number(issuedAt);
  if (!Number.isFinite(timestamp)) return false;
  if (timestamp > Date.now() + 5 * 60 * 1000) return false;
  if (Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
  return signature === await sign(`${version}.${issuedAt}`, secret);
}

export default async function adminGate(request: Request) {
  const expected = Netlify.env.get('ADMIN_PASSWORD');
  const secret = Netlify.env.get('ADMIN_COOKIE_SECRET') || expected;
  const cookies = parseCookies(request.headers.get('cookie') ?? '');
  const isAllowed = Boolean(expected && secret) && await isValidToken(cookies[COOKIE_NAME] ?? '', secret ?? '');

  if (isAllowed) {
    return;
  }

  const url = new URL(request.url);
  url.pathname = '/.netlify/functions/admin-login';
  url.search = '';
  return Response.redirect(url, 302);
}

export const config = {
  path: ['/admin', '/admin/', '/admin/analytics', '/admin/analytics/'],
};
