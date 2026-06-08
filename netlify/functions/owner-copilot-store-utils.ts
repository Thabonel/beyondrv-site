import { getBlobStore, safeBlobStoreError } from './blob-store';
import {
  auditLogKey,
  newOwnerCopilotId,
  OWNER_COPILOT_AUDIT_STORE,
  OWNER_COPILOT_TIMELINE_STORE,
  timelineKey,
} from './owner-copilot-core';

export function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function listJsonStore(storeName: string) {
  const store = getBlobStore(storeName);
  const { blobs } = await store.list();
  const records = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }));
  return records.filter((record): record is Record<string, unknown> => Boolean(record?.id));
}

export async function appendOwnerAudit(action: string, targetType: string, targetId: string, detail: Record<string, unknown>) {
  try {
    const store = getBlobStore(OWNER_COPILOT_AUDIT_STORE);
    const id = newOwnerCopilotId('audit');
    await store.setJSON(auditLogKey(id), {
      id,
      action,
      targetType,
      targetId,
      actor: 'owner',
      detail,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('owner-copilot-store-utils: audit append failed', { action, targetType, targetId, error: safeBlobStoreError(error) });
  }
}

export async function appendOwnerTimeline(
  eventType: string,
  summary: string,
  detail: {
    relatedLeadId?: string;
    relatedCustomerId?: string;
    relatedThreadId?: string;
    relatedDriveFileId?: string;
    source?: string;
    aiGenerated?: boolean;
  } = {}
) {
  try {
    const store = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
    const id = newOwnerCopilotId('timeline');
    await store.setJSON(timelineKey(id), {
      id,
      eventType,
      summary,
      relatedLeadId: detail.relatedLeadId || '',
      relatedCustomerId: detail.relatedCustomerId || '',
      relatedThreadId: detail.relatedThreadId || '',
      relatedDriveFileId: detail.relatedDriveFileId || '',
      source: detail.source || 'owner-copilot',
      aiGenerated: Boolean(detail.aiGenerated),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('owner-copilot-store-utils: timeline append failed', { eventType, error: safeBlobStoreError(error) });
  }
}
