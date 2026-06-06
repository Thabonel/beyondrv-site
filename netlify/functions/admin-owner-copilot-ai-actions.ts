import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  aiActionKey,
  auditLogKey,
  newOwnerCopilotId,
  OWNER_COPILOT_AI_ACTION_STORE,
  OWNER_COPILOT_AUDIT_STORE,
  OWNER_COPILOT_TIMELINE_STORE,
  timelineKey,
} from './owner-copilot-core';

const VALID_APPROVAL_STATES = new Set(['draft', 'edited', 'approved', 'rejected', 'copied', 'sent_manually']);

function clean(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function listActions() {
  const store = getBlobStore(OWNER_COPILOT_AI_ACTION_STORE);
  const { blobs } = await store.list();
  const actions = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }));
  return actions
    .filter((action): action is Record<string, unknown> => Boolean(action?.id))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function appendAudit(action: string, targetId: string, detail: Record<string, unknown>) {
  try {
    const store = getBlobStore(OWNER_COPILOT_AUDIT_STORE);
    const id = newOwnerCopilotId('audit');
    await store.setJSON(auditLogKey(id), {
      id,
      action,
      targetType: 'ai_action',
      targetId,
      actor: 'owner',
      detail,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('admin-owner-copilot-ai-actions: audit append failed', { targetId, error: safeBlobStoreError(error) });
  }
}

async function appendTimeline(aiAction: Record<string, unknown>, summary: string) {
  try {
    const store = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
    const id = newOwnerCopilotId('timeline');
    await store.setJSON(timelineKey(id), {
      id,
      eventType: 'ai_draft_created',
      summary,
      relatedLeadId: typeof aiAction.relatedLeadId === 'string' ? aiAction.relatedLeadId : '',
      relatedCustomerId: typeof aiAction.relatedCustomerId === 'string' ? aiAction.relatedCustomerId : '',
      source: 'admin-owner-copilot-ai-actions',
      aiGenerated: true,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('admin-owner-copilot-ai-actions: timeline append failed', { aiActionId: aiAction.id, error: safeBlobStoreError(error) });
  }
}

export const handler: Handler = async (event) => {
  if (!['GET', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(OWNER_COPILOT_AI_ACTION_STORE);
  } catch (error) {
    console.warn('admin-owner-copilot-ai-actions: store unavailable', {
      store: OWNER_COPILOT_AI_ACTION_STORE,
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
    const approvalState = clean(event.queryStringParameters?.approvalState, 40);
    const actions = (await listActions()).filter((action) => {
      if (leadId && action.relatedLeadId !== leadId) return false;
      if (approvalState && action.approvalState !== approvalState) return false;
      return true;
    });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions }) };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const id = clean(body.id, 240);
  const approvalState = clean(body.approvalState, 40);
  if (!id) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing AI action id.' }) };
  if (!VALID_APPROVAL_STATES.has(approvalState)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid approval state.' }) };
  }

  const existing = await store.get(aiActionKey(id), { type: 'json' }) as Record<string, unknown> | null;
  if (!existing) return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'AI action not found.' }) };

  const previousState = typeof existing.approvalState === 'string' ? existing.approvalState : 'draft';
  const output = clean(body.output, 12000);
  const updatedAt = new Date().toISOString();
  const action = {
    ...existing,
    approvalState,
    output: output || existing.output,
    reviewedBy: 'owner',
    reviewedAt: ['approved', 'rejected', 'copied', 'sent_manually'].includes(approvalState) ? updatedAt : existing.reviewedAt || '',
    updatedAt,
  };

  await store.setJSON(aiActionKey(id), action);
  await appendAudit('ai_action_state_changed', id, { previousState, approvalState });
  await appendTimeline(action, `AI draft state changed from ${previousState} to ${approvalState}.`);

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, action }) };
};
