import type { Handler, HandlerResponse } from '@netlify/functions';
import { createAdminToken } from './admin-auth';

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

function loginPageResponse(error = ''): HandlerResponse {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
    body: loginPage(error),
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

function loginPage(error = '') {
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
    </style>
  </head>
  <body>
    <form method="POST" action="/.netlify/functions/admin-login">
      <img src="/images/site/admin-logo.png" alt="Beyond RV" />
      <h1>Admin Login</h1>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
      <p>${error}</p>
      <button type="submit">Sign In</button>
    </form>
  </body>
</html>`;
}

export const handler: Handler = async (event) => {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected) {
    return htmlResponse(500, loginPage('Admin password is not configured.'));
  }

  if (event.httpMethod === 'GET') {
    return loginPageResponse();
  }

  if (event.httpMethod !== 'POST') {
    return textResponse(405, 'Method Not Allowed');
  }

  const params = new URLSearchParams(event.body ?? '');
  const password = params.get('password') ?? '';

  if (password !== expected) {
    return loginPageResponse('Incorrect password.');
  }

  const token = createAdminToken();
  return successResponse(
    '/admin/',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`
  );
};
