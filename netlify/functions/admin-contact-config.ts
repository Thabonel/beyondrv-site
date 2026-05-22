import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const toEmail = process.env.CONTACT_TO_EMAIL ?? 'beyondcaravans@gmail.com';
  const fromEmail = process.env.CONTACT_FROM_EMAIL ?? '';
  const hasResendKey = Boolean(process.env.RESEND_API_KEY);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toEmail,
      fromEmail,
      hasResendKey,
      ready: hasResendKey && Boolean(fromEmail),
      missing: [
        !hasResendKey && 'RESEND_API_KEY',
        !fromEmail && 'CONTACT_FROM_EMAIL',
      ].filter(Boolean),
    }),
  };
};
