import { getStore } from '@netlify/blobs';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const STORE_NAME = 'customer-enquiries';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const { blobs } = await store.list();
  const recent = blobs
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 50);

  const enquiries = await Promise.all(
    recent.map(async (blob) => {
      const data = await store.get(blob.key, { type: 'json', consistency: 'strong' });
      return data;
    })
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enquiries }),
  };
};
