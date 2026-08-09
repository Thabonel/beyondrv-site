import type { Handler } from '@netlify/functions';

const COOKIE_NAME = 'brv_admin_auth';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  return {
    statusCode: 303,
    headers: {
      'Cache-Control': 'no-store',
      'Location': '/.netlify/functions/admin-login',
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
    body: '',
  };
};
