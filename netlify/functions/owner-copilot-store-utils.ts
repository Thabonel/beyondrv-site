import { getBlobStore, safeBlobStoreError } from './blob-store';
import {
  auditLogKey,
  newOwnerCopilotId,
  OWNER_COPILOT_AUDIT_STORE,
  OWNER_COPILOT_TIMELINE_STORE,
  timelineKey,
} from './owner-copilot-core';
import type { AdminActor } from './admin-auth';

export { clean } from './owner-copilot-core';

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

function auditActor(actor?: Pick<AdminActor, 'id' | 'displayName' | 'role'> | string) {
  if (typeof actor === 'string') return { id: actor || 'legacy-admin', displayName: actor || 'Legacy administrator', role: 'legacy_admin' };
  return actor
    ? { id: actor.id, displayName: actor.displayName, role: actor.role }
    : { id: 'legacy-admin', displayName: 'Legacy administrator', role: 'legacy_admin' };
}

export async function appendOwnerAudit(
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown>,
  actor?: Pick<AdminActor, 'id' | 'displayName' | 'role'> | string,
) {
  try {
    const store = getBlobStore(OWNER_COPILOT_AUDIT_STORE);
    const id = newOwnerCopilotId('audit');
    const resolvedActor = auditActor(actor);
    await store.setJSON(auditLogKey(id), {
      id,
      action,
      targetType,
      targetId,
      actor: resolvedActor.id,
      actorDisplayName: resolvedActor.displayName,
      actorRole: resolvedActor.role,
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
