/**
 * Moves a record-owned date from the calendar. The new date and time are
 * written onto the order, lead status or task that owns them; nothing is kept
 * in a calendar table, so the record and the grid cannot disagree.
 */
import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { decideMove, decideNewTask, moveWarning } from './calendar-write-core';
import { newOwnerCopilotId, OWNER_COPILOT_TASK_STORE, taskKey } from './owner-copilot-core';
import { ASSIGNMENT_STORE, assignmentKey, assignmentTarget, cleanAssignees } from './calendar-assignment-core';

const ORDER_STORE = 'customer-orders';
const LEAD_STATUS_STORE = 'customer-lead-status';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function orderKey(id: string) {
  return `orders/${encodeURIComponent(id)}.json`;
}

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
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
    // Creating: a slot on the grid makes a task.
    if (body.action === 'create_task') {
      const decision = decideNewTask(body);
      if (!decision.ok) return json(400, { error: decision.error });

      const store = getBlobStore(OWNER_COPILOT_TASK_STORE);
      const id = newOwnerCopilotId('task');
      const now = new Date().toISOString();
      await store.setJSON(taskKey(id), {
        id,
        title: decision.title,
        dueDate: decision.dueDate,
        dueTime: decision.dueTime,
        assigneeIds: decision.assigneeIds,
        status: 'open',
        priority: 'medium',
        source: 'calendar',
        notes: '',
        createdAt: now,
        updatedAt: now,
        createdBy: actor.displayName || actor.id || 'admin',
      });
      return json(200, { ok: true, id, message: `Task "${decision.title}" created for ${decision.dueDate}.` });
    }

    // Putting names on anything, or taking them off. A task keeps its owners
    // on the record; every other kind gets an assignment record, because an
    // order has nowhere to say who is handling a visit.
    if (body.action === 'assign') {
      const recordId = typeof body.recordId === 'string' ? body.recordId.trim().slice(0, 240) : '';
      const kind = typeof body.kind === 'string' ? body.kind.trim() : 'task';
      const assigneeIds = cleanAssignees(body.assigneeIds);
      if (!recordId) return json(400, { error: 'recordId is required.' });
      const now = new Date().toISOString();
      const target = assignmentTarget(kind, recordId);

      if (target.store === 'task') {
        const store = getBlobStore(OWNER_COPILOT_TASK_STORE);
        const existing = await store.get(taskKey(target.id), { type: 'json' }) as Record<string, unknown> | null;
        if (!existing) return json(404, { error: `No task found with id ${target.id}.` });
        const { assigneeId: _legacy, ...rest } = existing;
        await store.setJSON(taskKey(target.id), { ...rest, assigneeIds, updatedAt: now });
      } else {
        const store = getBlobStore(ASSIGNMENT_STORE);
        if (assigneeIds.length) await store.setJSON(assignmentKey(target.id), { eventId: target.id, assigneeIds, updatedAt: now });
        else await store.delete(assignmentKey(target.id)).catch(() => undefined);
      }
      const count = assigneeIds.length;
      return json(200, { ok: true, message: count ? `Given to ${count} ${count === 1 ? 'person' : 'people'}.` : 'Taken back.' });
    }

    // Giving an existing job to someone, or taking it back.
    if (body.action === 'assign_task') {
      const recordId = typeof body.recordId === 'string' ? body.recordId.trim().slice(0, 240) : '';
      const assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId.trim().slice(0, 240) : '';
      if (!recordId) return json(400, { error: 'recordId is required.' });
      const store = getBlobStore(OWNER_COPILOT_TASK_STORE);
      const existing = await store.get(taskKey(recordId), { type: 'json' }) as Record<string, unknown> | null;
      if (!existing) return json(404, { error: `No task found with id ${recordId}.` });
      await store.setJSON(taskKey(recordId), { ...existing, assigneeId, updatedAt: new Date().toISOString() });
      return json(200, { ok: true, message: assigneeId ? 'Job handed over.' : 'Job taken back.' });
    }

    // Moving: write the new date onto the record that owns it.
    const decision = decideMove(body);
    if (!decision.ok) return json(400, { error: decision.error });
    const { kind, recordId, date, time, target } = decision;
    const timeFields = target.timeField ? { [target.timeField]: time } : {};
    const updatedAt = new Date().toISOString();

    if (target.store === 'orders') {
      const store = getBlobStore(ORDER_STORE);
      // Orders are keyed two ways in this codebase; read whichever exists.
      const keys = [orderKey(recordId), recordId];
      let key = '';
      let existing: Record<string, unknown> | null = null;
      for (const candidate of keys) {
        existing = await store.get(candidate, { type: 'json' }) as Record<string, unknown> | null;
        if (existing) { key = candidate; break; }
      }
      if (!existing) return json(404, { error: `No order found with id ${recordId}.` });
      const status = typeof existing.status === 'string' ? existing.status : '';
      await store.setJSON(key, { ...existing, [target.field]: date, ...timeFields, updatedAt });
      return json(200, { ok: true, message: `Moved ${target.label} to ${date}${time ? ` ${time}` : ''}.`, warning: moveWarning(kind, status) });
    }

    if (target.store === 'leads') {
      const store = getBlobStore(LEAD_STATUS_STORE);
      const key = leadKey(recordId);
      const existing = await store.get(key, { type: 'json' }) as Record<string, unknown> | null;
      // A lead may have no status record yet; the follow-up date creates one.
      await store.setJSON(key, { ...(existing ?? {}), enquiryId: recordId, [target.field]: date, updatedAt });
      return json(200, { ok: true, message: `Moved ${target.label} to ${date}.` });
    }

    const store = getBlobStore(OWNER_COPILOT_TASK_STORE);
    const key = taskKey(recordId);
    const existing = await store.get(key, { type: 'json' }) as Record<string, unknown> | null;
    if (!existing) return json(404, { error: `No task found with id ${recordId}.` });
    await store.setJSON(key, { ...existing, [target.field]: date, ...timeFields, updatedAt });
    return json(200, { ok: true, message: `Moved ${target.label} to ${date}${time ? ` ${time}` : ''}.` });
  } catch (error) {
    console.warn('admin-calendar-write: failed', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
