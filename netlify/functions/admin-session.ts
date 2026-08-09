import type { Handler } from '@netlify/functions';
import {
  getAdminActor,
  getAdminCapabilities,
  unauthorizedResponse,
} from './admin-auth';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      actor,
      capabilities: getAdminCapabilities(actor),
    }),
  };
};
