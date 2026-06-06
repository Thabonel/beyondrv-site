import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { newOwnerCopilotId, OWNER_COPILOT_TIMELINE_STORE, timelineKey } from './owner-copilot-core';

const VALID_EVENT_TYPES = new Set([
  'website_enquiry',
  'email_received',
  'email_sent',
  'note_added',
  'task_created',
  'task_completed',
  'file_matched',
  'quote_requested',
  'quote_sent',
  'call_logged',
  'status_changed',
  'ai_summary_generated',
  'ai_draft_created',
]);

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function listEvents() {
  const store = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
  const { blobs } = await store.list();
  const events = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }));
  return events
    .filter((event): event is Record<string, unknown> => Boolean(event?.id))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
  } catch (error) {
    console.warn('admin-owner-copilot-timeline: timeline store unavailable', {
      store: OWNER_COPILOT_TIMELINE_STORE,
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
    const leadId = clean(event.queryStringParameters?.leadId, 240);
    const customerId = clean(event.queryStringParameters?.customerId, 240);
    const events = (await listEvents()).filter((item) => {
      if (leadId && item.relatedLeadId !== leadId) return false;
      if (customerId && item.relatedCustomerId !== customerId) return false;
      return true;
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const eventType = clean(body.eventType, 80);
  const summary = clean(body.summary, 600);
  if (!VALID_EVENT_TYPES.has(eventType)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid timeline event type' }) };
  }
  if (!summary) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing timeline summary' }) };
  }

  const now = new Date().toISOString();
  const timelineEvent = {
    id: newOwnerCopilotId('timeline'),
    eventType,
    summary,
    relatedLeadId: clean(body.relatedLeadId, 240),
    relatedCustomerId: clean(body.relatedCustomerId, 240),
    relatedTaskId: clean(body.relatedTaskId, 240),
    relatedThreadId: clean(body.relatedThreadId, 240),
    relatedDriveFileId: clean(body.relatedDriveFileId, 240),
    source: clean(body.source, 80) || 'admin',
    aiGenerated: Boolean(body.aiGenerated),
    createdAt: now,
  };
  await store.setJSON(timelineKey(timelineEvent.id), timelineEvent);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, event: timelineEvent }),
  };
};
