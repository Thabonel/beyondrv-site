import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  marketingIdeaKey,
  newOwnerCopilotId,
  OWNER_COPILOT_MARKETING_IDEA_STORE,
} from './owner-copilot-core';
import { appendOwnerAudit, clean, listJsonStore } from './owner-copilot-store-utils';

const VALID_STATUSES = new Set(['idea', 'drafted', 'approved', 'rejected', 'published']);

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  try {
    const store = getBlobStore(OWNER_COPILOT_MARKETING_IDEA_STORE);
    if (event.httpMethod === 'GET') {
      const ideas = (await listJsonStore(OWNER_COPILOT_MARKETING_IDEA_STORE))
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ideas }) };
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    } catch {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) };
    }

    const now = new Date().toISOString();
    const id = clean(body.id, 240) || newOwnerCopilotId('marketing_idea');
    const existing = await store.get(marketingIdeaKey(id), { type: 'json' }) as Record<string, unknown> | null;
    const title = clean(body.title, 180) || String(existing?.title || '');
    if (!title) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing marketing idea title.' }) };
    const status = clean(body.status, 40) || String(existing?.status || 'idea');
    if (!VALID_STATUSES.has(status)) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid marketing idea status.' }) };
    const idea = {
      ...existing,
      id,
      title,
      audience: clean(body.audience, 180) || existing?.audience || '',
      sourceQuestion: clean(body.sourceQuestion, 600) || existing?.sourceQuestion || '',
      recommendation: clean(body.recommendation, 1000) || existing?.recommendation || '',
      status,
      relatedLeadId: clean(body.relatedLeadId, 240) || existing?.relatedLeadId || '',
      createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
      updatedAt: now,
    };
    await store.setJSON(marketingIdeaKey(id), idea);
    await appendOwnerAudit(existing ? 'marketing_idea_updated' : 'marketing_idea_created', 'marketing_idea', id, { status });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, idea }) };
  } catch (error) {
    console.warn('admin-marketing-ideas: unavailable', { error: safeBlobStoreError(error) });
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: blobStoreUserMessage(error) }) };
  }
};
