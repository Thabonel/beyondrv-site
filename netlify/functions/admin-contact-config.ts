import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'integrations:manage')) return forbiddenResponse('integrations:manage');

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
