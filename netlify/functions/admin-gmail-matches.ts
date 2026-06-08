import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  gmailThreadKey,
  newOwnerCopilotId,
  OWNER_COPILOT_CUSTOMER_STORE,
  OWNER_COPILOT_GMAIL_THREAD_STORE,
  OWNER_COPILOT_LEAD_STORE,
} from './owner-copilot-core';
import { scoreGmailThreadMatches } from './owner-copilot-matching-core';
import { appendOwnerAudit, appendOwnerTimeline, clean, listJsonStore } from './owner-copilot-store-utils';

const VALID_DECISIONS = new Set(['approved', 'rejected', 'pinned']);

async function loadSuggestions(thread: Record<string, unknown>) {
  const [customers, leads] = await Promise.all([
    listJsonStore(OWNER_COPILOT_CUSTOMER_STORE),
    listJsonStore(OWNER_COPILOT_LEAD_STORE),
  ]);
  return scoreGmailThreadMatches({
    id: String(thread.id || ''),
    fromEmail: clean(thread.fromEmail, 240),
    toEmail: clean(thread.toEmail, 240),
    replyToEmail: clean(thread.replyToEmail, 240),
    phone: clean(thread.phone, 80),
    subject: clean(thread.subject, 240),
    snippet: clean(thread.snippet, 600),
    productInterest: clean(thread.productInterest, 240),
  }, customers as never, leads as never);
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  try {
    const store = getBlobStore(OWNER_COPILOT_GMAIL_THREAD_STORE);

    if (event.httpMethod === 'GET') {
      const threads = (await listJsonStore(OWNER_COPILOT_GMAIL_THREAD_STORE))
        .sort((a, b) => String(b.updatedAt || b.receivedAt || '').localeCompare(String(a.updatedAt || a.receivedAt || '')));
      const withSuggestions = await Promise.all(threads.map(async thread => ({
        ...thread,
        suggestions: Array.isArray(thread.suggestions) && thread.matchDecision ? thread.suggestions : await loadSuggestions(thread),
      })));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads: withSuggestions }),
      };
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    } catch {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) };
    }

    if (event.httpMethod === 'POST') {
      const now = new Date().toISOString();
      const id = clean(body.id, 240) || clean(body.threadId, 240) || newOwnerCopilotId('gmail_thread');
      const existing = await store.get(gmailThreadKey(id), { type: 'json' }) as Record<string, unknown> | null;
      const thread = {
        ...existing,
        id,
        threadId: id,
        fromEmail: clean(body.fromEmail, 240).toLowerCase(),
        toEmail: clean(body.toEmail, 240).toLowerCase(),
        replyToEmail: clean(body.replyToEmail, 240).toLowerCase(),
        phone: clean(body.phone, 80),
        subject: clean(body.subject, 240),
        snippet: clean(body.snippet, 800),
        productInterest: clean(body.productInterest, 240),
        receivedAt: clean(body.receivedAt, 80) || now,
        source: clean(body.source, 80) || 'manual_mock',
        matchDecision: existing?.matchDecision || '',
        linkedTargetType: existing?.linkedTargetType || '',
        linkedTargetId: existing?.linkedTargetId || '',
        createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
        updatedAt: now,
      };
      const suggestions = await loadSuggestions(thread);
      const saved = { ...thread, suggestions };
      await store.setJSON(gmailThreadKey(id), saved);
      await appendOwnerAudit(existing ? 'gmail_thread_updated' : 'gmail_thread_created', 'gmail_thread', id, { source: saved.source, suggestions: suggestions.length });
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, thread: saved }) };
    }

    const id = clean(body.id, 240);
    const decision = clean(body.decision, 40);
    const targetType = clean(body.targetType, 40);
    const targetId = clean(body.targetId, 240);
    if (!id || !VALID_DECISIONS.has(decision) || !['lead', 'customer'].includes(targetType) || !targetId) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Provide id, decision, targetType, and targetId.' }) };
    }
    const existing = await store.get(gmailThreadKey(id), { type: 'json' }) as Record<string, unknown> | null;
    if (!existing) return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Gmail thread not found.' }) };
    const updated: Record<string, unknown> = {
      ...existing,
      matchDecision: decision,
      linkedTargetType: decision === 'rejected' ? '' : targetType,
      linkedTargetId: decision === 'rejected' ? '' : targetId,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(gmailThreadKey(id), updated);
    await appendOwnerAudit(`gmail_match_${decision}`, 'gmail_thread', id, { targetType, targetId });
    if (decision !== 'rejected') {
      await appendOwnerTimeline('email_received', `Gmail thread ${decision}: ${String(updated.subject || id)}`, {
        relatedLeadId: targetType === 'lead' ? targetId : '',
        relatedCustomerId: targetType === 'customer' ? targetId : '',
        relatedThreadId: id,
        source: 'admin-gmail-matches',
      });
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, thread: updated }) };
  } catch (error) {
    console.warn('admin-gmail-matches: unavailable', { error: safeBlobStoreError(error) });
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: blobStoreUserMessage(error) }) };
  }
};
