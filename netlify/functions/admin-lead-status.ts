import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';

const STORE_NAME = 'customer-lead-status';
const VALID_STATUSES = new Set(['new', 'contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled', 'won', 'lost', 'spam']);
const VALID_PRIORITIES = new Set(['hot', 'warm', 'info-only', 'spam-low-quality']);
const VALID_OUTCOME_REASONS = new Set(['', 'too-expensive', 'wrong-vehicle', 'no-payload', 'bought-elsewhere', 'just-researching', 'no-response', 'timing-not-right', 'other']);

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
  const blobRuntimeSource = connectBlobStore(event);

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(STORE_NAME);
  } catch (error) {
    console.warn('admin-lead-status: lead status store unavailable', {
      store: STORE_NAME,
      blobRuntimeSource,
      error: safeBlobStoreError(error),
    });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }

  if (event.httpMethod === 'GET') {
    const enquiryId = clean(event.queryStringParameters?.enquiryId, 240);
    if (!enquiryId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing enquiryId' }),
      };
    }

    const leadStatus = await store.get(leadKey(enquiryId), { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadStatus: leadStatus ?? {
          enquiryId,
          status: 'new',
          notes: '',
          nextFollowUpDate: '',
          priority: 'warm',
          outcomeReason: '',
          firstResponseAt: '',
          lastContactedAt: '',
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
  const priority = clean(body.priority, 40);
  const outcomeReason = clean(body.outcomeReason, 80);
  const firstResponseAt = clean(body.firstResponseAt, 80);
  const lastContactedAt = clean(body.lastContactedAt, 80);

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

  if (priority && !VALID_PRIORITIES.has(priority)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid lead priority' }),
    };
  }

  if (!VALID_OUTCOME_REASONS.has(outcomeReason)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid outcome reason' }),
    };
  }

  let existing: Record<string, unknown> | null = null;
  try {
    existing = await store.get(leadKey(enquiryId), { type: 'json' }) as Record<string, unknown> | null;
  } catch {
    existing = null;
  }

  const leadStatus = {
    ...existing,
    enquiryId,
    status,
    notes,
    nextFollowUpDate,
    priority: priority || (typeof existing?.priority === 'string' ? existing.priority : 'warm'),
    outcomeReason,
    firstResponseAt: firstResponseAt || (typeof existing?.firstResponseAt === 'string' ? existing.firstResponseAt : ''),
    lastContactedAt: lastContactedAt || (typeof existing?.lastContactedAt === 'string' ? existing.lastContactedAt : ''),
    updatedAt: new Date().toISOString(),
  };

  await store.setJSON(leadKey(enquiryId), leadStatus);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, leadStatus }),
  };
};
