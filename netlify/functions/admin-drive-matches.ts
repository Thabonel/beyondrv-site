import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  driveFileKey,
  newOwnerCopilotId,
  OWNER_COPILOT_CUSTOMER_STORE,
  OWNER_COPILOT_DRIVE_FILE_STORE,
  OWNER_COPILOT_LEAD_STORE,
} from './owner-copilot-core';
import { scoreDriveFileMatches } from './owner-copilot-matching-core';
import { appendOwnerAudit, appendOwnerTimeline, clean, listJsonStore } from './owner-copilot-store-utils';

const VALID_DECISIONS = new Set(['approved', 'rejected', 'pinned']);

async function loadSuggestions(file: Record<string, unknown>) {
  const [customers, leads] = await Promise.all([
    listJsonStore(OWNER_COPILOT_CUSTOMER_STORE),
    listJsonStore(OWNER_COPILOT_LEAD_STORE),
  ]);
  return scoreDriveFileMatches({
    id: String(file.id || ''),
    name: clean(file.name, 240),
    description: clean(file.description, 1000),
    folderName: clean(file.folderName, 240),
    customerEmail: clean(file.customerEmail, 240),
    customerPhone: clean(file.customerPhone, 80),
    productInterest: clean(file.productInterest, 240),
  }, customers as never, leads as never);
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  try {
    const store = getBlobStore(OWNER_COPILOT_DRIVE_FILE_STORE);

    if (event.httpMethod === 'GET') {
      const files = (await listJsonStore(OWNER_COPILOT_DRIVE_FILE_STORE))
        .sort((a, b) => String(b.updatedAt || b.modifiedAt || '').localeCompare(String(a.updatedAt || a.modifiedAt || '')));
      const withSuggestions = await Promise.all(files.map(async file => ({
        ...file,
        suggestions: Array.isArray(file.suggestions) && file.matchDecision ? file.suggestions : await loadSuggestions(file),
      })));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: withSuggestions }),
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
      const id = clean(body.id, 240) || clean(body.fileId, 240) || newOwnerCopilotId('drive_file');
      const existing = await store.get(driveFileKey(id), { type: 'json' }) as Record<string, unknown> | null;
      const file = {
        ...existing,
        id,
        fileId: id,
        name: clean(body.name, 240),
        mimeType: clean(body.mimeType, 160),
        webViewLink: clean(body.webViewLink, 500),
        folderId: clean(body.folderId, 240),
        folderName: clean(body.folderName, 240),
        description: clean(body.description, 1500),
        customerEmail: clean(body.customerEmail, 240).toLowerCase(),
        customerPhone: clean(body.customerPhone, 80),
        productInterest: clean(body.productInterest, 240),
        modifiedAt: clean(body.modifiedAt, 80) || now,
        source: clean(body.source, 80) || 'manual_mock',
        matchDecision: existing?.matchDecision || '',
        linkedTargetType: existing?.linkedTargetType || '',
        linkedTargetId: existing?.linkedTargetId || '',
        createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
        updatedAt: now,
      };
      const suggestions = await loadSuggestions(file);
      const saved = { ...file, suggestions };
      await store.setJSON(driveFileKey(id), saved);
      await appendOwnerAudit(existing ? 'drive_file_updated' : 'drive_file_created', 'drive_file', id, { source: saved.source, suggestions: suggestions.length });
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, file: saved }) };
    }

    const id = clean(body.id, 240);
    const decision = clean(body.decision, 40);
    const targetType = clean(body.targetType, 40);
    const targetId = clean(body.targetId, 240);
    if (!id || !VALID_DECISIONS.has(decision) || !['lead', 'customer'].includes(targetType) || !targetId) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Provide id, decision, targetType, and targetId.' }) };
    }
    const existing = await store.get(driveFileKey(id), { type: 'json' }) as Record<string, unknown> | null;
    if (!existing) return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Drive file not found.' }) };
    const updated: Record<string, unknown> = {
      ...existing,
      matchDecision: decision,
      linkedTargetType: decision === 'rejected' ? '' : targetType,
      linkedTargetId: decision === 'rejected' ? '' : targetId,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(driveFileKey(id), updated);
    await appendOwnerAudit(`drive_match_${decision}`, 'drive_file', id, { targetType, targetId });
    if (decision !== 'rejected') {
      await appendOwnerTimeline('file_matched', `Drive file ${decision}: ${String(updated.name || id)}`, {
        relatedLeadId: targetType === 'lead' ? targetId : '',
        relatedCustomerId: targetType === 'customer' ? targetId : '',
        relatedDriveFileId: id,
        source: 'admin-drive-matches',
      });
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, file: updated }) };
  } catch (error) {
    console.warn('admin-drive-matches: unavailable', { error: safeBlobStoreError(error) });
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: blobStoreUserMessage(error) }) };
  }
};
