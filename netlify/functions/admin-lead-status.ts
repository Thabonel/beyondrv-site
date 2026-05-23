import { getStore } from '@netlify/blobs';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const STORE_NAME = 'customer-lead-status';
const VALID_STATUSES = new Set(['new', 'contacted', 'quoted', 'won', 'lost', 'spam']);

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (event.httpMethod === 'GET') {
    const enquiryId = clean(event.queryStringParameters?.enquiryId, 240);
    if (!enquiryId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing enquiryId' }),
      };
    }

    const leadStatus = await store.get(leadKey(enquiryId), { type: 'json', consistency: 'strong' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadStatus: leadStatus ?? {
          enquiryId,
          status: 'new',
          notes: '',
          nextFollowUpDate: '',
          updatedAt: '',
        },
      }),
    };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  }

  const enquiryId = clean(body.enquiryId, 240);
  const status = clean(body.status, 40);
  const notes = clean(body.notes, 4000);
  const nextFollowUpDate = clean(body.nextFollowUpDate, 40);

  if (!enquiryId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing enquiryId' }),
    };
  }

  if (!VALID_STATUSES.has(status)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid lead status' }),
    };
  }

  const leadStatus = {
    enquiryId,
    status,
    notes,
    nextFollowUpDate,
    updatedAt: new Date().toISOString(),
  };

  await store.setJSON(leadKey(enquiryId), leadStatus);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, leadStatus }),
  };
};
