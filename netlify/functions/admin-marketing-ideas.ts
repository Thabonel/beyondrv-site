import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  buildMarketingIdea,
  clean,
  marketingIdeaId,
  marketingIdeaKey,
  OWNER_COPILOT_MARKETING_IDEA_STORE,
} from './owner-copilot-core';
import { appendOwnerAudit, listJsonStore } from './owner-copilot-store-utils';

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  const requiredCapability = event.httpMethod === 'GET' ? 'site:read' : 'site:write';
  if (!hasAdminCapability(actor, requiredCapability)) return forbiddenResponse(requiredCapability);
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
    const id = clean(body.id, 240) || marketingIdeaId(clean(body.title, 180));
    const existing = await store.get(marketingIdeaKey(id), { type: 'json' }) as Record<string, unknown> | null;
    const result = buildMarketingIdea({ ...body, id }, existing, now);
    if ('error' in result) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: result.error }) };
    }
    const { idea } = result;
    await store.setJSON(marketingIdeaKey(id), idea);
    await appendOwnerAudit(existing ? 'marketing_idea_updated' : 'marketing_idea_created', 'marketing_idea', id, { status: idea.status }, actor);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, idea }) };
  } catch (error) {
    console.warn('admin-marketing-ideas: unavailable', { error: safeBlobStoreError(error) });
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: blobStoreUserMessage(error) }) };
  }
};
