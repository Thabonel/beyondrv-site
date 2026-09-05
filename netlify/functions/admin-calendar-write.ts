import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { decideMove, decideNewTask, moveWarning } from './calendar-write-core';

const ORDER_STORE = 'customer-orders';
const LEAD_STATUS_STORE = 'customer-lead-status';
const TASK_STORE = 'owner-copilot-tasks';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (!['POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };

  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'sales:write')) return forbiddenResponse('sales:write');

  connectBlobStore(event);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid request' });
  }

  try {
    // Creating: dragging empty space makes a task.
    if (body.action === 'create_task') {
      const decision = decideNewTask(body);
      if (!decision.ok) return json(400, { error: decision.error });

      const store = getBlobStore(TASK_STORE);
      const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      await store.setJSON(id, {
        id,
        title: decision.title,
        dueDate: decision.dueDate,
        status: 'open',
        priority: 'medium',
        source: 'calendar',
        createdAt: now,
        updatedAt: now,
        createdBy: actor.displayName || actor.id || 'admin',
      });
      return json(200, { ok: true, id, message: `Task "${decision.title}" created for ${decision.dueDate}.` });
    }

    // Moving: write the new date onto the record that owns it.
    const decision = decideMove(body);
    if (!decision.ok) return json(400, { error: decision.error });
    const { kind, recordId, date, target } = decision;

    if (target.store === 'orders') {
      const store = getBlobStore(ORDER_STORE);
      const existing = await store.get(recordId, { type: 'json' }) as Record<string, unknown> | null;
      if (!existing) return json(404, { error: `No order found with id ${recordId}.` });
      const status = typeof existing.status === 'string' ? existing.status : '';
      await store.setJSON(recordId, { ...existing, [target.field]: date, updatedAt: new Date().toISOString() });
      return json(200, { ok: true, message: `Moved ${target.label} to ${date}.`, warning: moveWarning(kind, status) });
    }

    if (target.store === 'leads') {
      const store = getBlobStore(LEAD_STATUS_STORE);
      const existing = await store.get(recordId, { type: 'json' }) as Record<string, unknown> | null;
      // A lead may have no status record yet; the follow-up date creates one.
      await store.setJSON(recordId, {
        ...(existing ?? {}),
        enquiryId: recordId,
        [target.field]: date,
        updatedAt: new Date().toISOString(),
      });
      return json(200, { ok: true, message: `Moved ${target.label} to ${date}.` });
    }

    const store = getBlobStore(TASK_STORE);
    const existing = await store.get(recordId, { type: 'json' }) as Record<string, unknown> | null;
    if (!existing) return json(404, { error: `No task found with id ${recordId}.` });
    await store.setJSON(recordId, { ...existing, [target.field]: date, updatedAt: new Date().toISOString() });
    return json(200, { ok: true, message: `Moved ${target.label} to ${date}.` });
  } catch (error) {
    console.warn('admin-calendar-write: failed', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
