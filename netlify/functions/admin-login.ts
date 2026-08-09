import type { Handler, HandlerResponse } from '@netlify/functions';
import { authenticateAdminCredentials, createAdminToken, getConfiguredAdminAccounts } from './admin-auth';
import { safeAdminReturnTo } from './admin-login-core';
import { isRateLimited } from './security-utils';

const COOKIE_NAME = 'brv_admin_auth';

function htmlResponse(statusCode: number, body: string): HandlerResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html' },
    body,
  };
}

function textResponse(statusCode: number, body: string): HandlerResponse {
  return { statusCode, body };
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function loginPageResponse(error = '', returnTo = '/admin/'): HandlerResponse {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
    body: loginPage(error, returnTo),
  };
}

function successResponse(location: string, cookie: string): HandlerResponse {
  return {
    statusCode: 303,
    headers: {
      'Cache-Control': 'no-store',
      'Location': location,
      'Set-Cookie': cookie,
    },
    body: '',
  };
}

function loginPage(error = '', returnTo = '/admin/') {
  const individualAccountsConfigured = getConfiguredAdminAccounts().length > 0;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Beyond RV Admin Login</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        min-height: 100vh; margin: 0; display: grid; place-items: center;
        background: #0a0a0a; color: #fff;
        font-family: Outfit, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      form {
        width: min(100% - 2rem, 360px); padding: 1.5rem;
        background: #111; border: 1px solid #333; border-radius: 8px;
      }
      img { height: 44px; margin-bottom: 1.5rem; }
      h1 { font-size: 1.1rem; margin: 0 0 1rem; }
      label { display: block; color: #aaa; font-size: 0.85rem; margin-bottom: 0.4rem; }
      input {
        width: 100%; background: #1a1a1a; border: 1px solid #444; color: #fff;
        border-radius: 6px; padding: 0.75rem; font-size: 1rem;
      }
      button {
        width: 100%; margin-top: 1rem; background: #E8540A; border: 0; color: #fff;
        border-radius: 6px; padding: 0.75rem; font-weight: 700; cursor: pointer;
      }
      p { color: #f87171; font-size: 0.85rem; min-height: 1.2rem; }
      .hint { color: #999; font-size: 0.78rem; line-height: 1.45; min-height: 0; margin: 0.5rem 0 1rem; }
    </style>
  </head>
  <body>
    <form method="POST" action="/.netlify/functions/admin-login">
      <input type="hidden" name="returnTo" value="${escapeHtmlAttribute(returnTo)}" />
      <img src="/images/site/admin-logo.png" alt="Beyond RV" />
      <h1>Admin Login</h1>
      <label for="user">User</label>
      <input id="user" name="user" type="text" autocomplete="username" placeholder="${individualAccountsConfigured ? 'gm, owner, or site-admin' : 'Optional for current admin password'}" />
      <p class="hint">${individualAccountsConfigured ? 'Use your assigned Beyond RV user and password.' : 'Individual user accounts are not configured yet. The current admin password remains available during migration.'}</p>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
      <p>${error}</p>
      <button type="submit">Sign In</button>
    </form>
  </body>
</html>`;
}

export const handler: Handler = async (event) => {
  const hasLegacyPassword = Boolean(process.env.ADMIN_PASSWORD);
  const hasIndividualAccounts = getConfiguredAdminAccounts().length > 0;
  if (!hasLegacyPassword && !hasIndividualAccounts) {
    return htmlResponse(500, loginPage('Admin users are not configured.'));
  }

  if (event.httpMethod === 'GET') {
    return loginPageResponse('', safeAdminReturnTo(event.queryStringParameters?.returnTo));
  }

  if (event.httpMethod !== 'POST') {
    return textResponse(405, 'Method Not Allowed');
  }

  if (await isRateLimited(event, 'admin-login', 10, 15 * 60)) {
    return {
      ...loginPageResponse('Too many sign-in attempts. Please wait 15 minutes and try again.'),
      statusCode: 429,
      headers: {
        ...loginPageResponse().headers,
        'Retry-After': '900',
      },
    };
  }

  const params = new URLSearchParams(event.body ?? '');
  const returnTo = safeAdminReturnTo(params.get('returnTo'));
  const user = params.get('user') ?? '';
  const password = params.get('password') ?? '';
  const actor = authenticateAdminCredentials(user, password);

  if (!actor) {
    return loginPageResponse('Incorrect user or password.', returnTo);
  }

  const token = createAdminToken(actor);
  if (!token) return htmlResponse(500, loginPage('Admin session signing is not configured.'));
  return successResponse(
    returnTo,
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`
  );
};
