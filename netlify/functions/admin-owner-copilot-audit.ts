import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { OWNER_COPILOT_AUDIT_STORE } from './owner-copilot-core';

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function listAuditLogs() {
  const store = getBlobStore(OWNER_COPILOT_AUDIT_STORE);
  const { blobs } = await store.list();
  const logs = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }));
  return logs
    .filter((log): log is Record<string, unknown> => Boolean(log?.id))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  try {
    const targetType = clean(event.queryStringParameters?.targetType, 80);
    const targetId = clean(event.queryStringParameters?.targetId, 240);
    const logs = (await listAuditLogs())
      .filter((log) => {
        if (targetType && log.targetType !== targetType) return false;
        if (targetId && log.targetId !== targetId) return false;
        return true;
      })
      .slice(0, 100);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs }),
    };
  } catch (error) {
    console.warn('admin-owner-copilot-audit: store unavailable', {
      store: OWNER_COPILOT_AUDIT_STORE,
      blobRuntimeSource,
      error: safeBlobStoreError(error),
    });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
};
