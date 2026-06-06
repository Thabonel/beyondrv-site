import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  newOwnerCopilotId,
  OWNER_COPILOT_TASK_STORE,
  OWNER_COPILOT_TIMELINE_STORE,
  taskKey,
  timelineKey,
} from './owner-copilot-core';

const VALID_STATUSES = new Set(['open', 'completed', 'snoozed', 'cancelled']);
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function listTasks() {
  const store = getBlobStore(OWNER_COPILOT_TASK_STORE);
  const { blobs } = await store.list();
  const tasks = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }));
  return tasks
    .filter((task): task is Record<string, unknown> => Boolean(task?.id))
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(OWNER_COPILOT_TASK_STORE);
  } catch (error) {
    console.warn('admin-owner-copilot-tasks: task store unavailable', {
      store: OWNER_COPILOT_TASK_STORE,
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
    const status = clean(event.queryStringParameters?.status, 40);
    const relatedLeadId = clean(event.queryStringParameters?.leadId, 240);
    const tasks = (await listTasks()).filter((task) => {
      if (status && task.status !== status) return false;
      if (relatedLeadId && task.relatedLeadId !== relatedLeadId) return false;
      return true;
    });
    const today = todayDate();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks,
        summary: {
          open: tasks.filter(task => task.status === 'open').length,
          dueToday: tasks.filter(task => task.status === 'open' && task.dueDate === today).length,
          overdue: tasks.filter(task => task.status === 'open' && typeof task.dueDate === 'string' && task.dueDate < today).length,
        },
      }),
    };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (event.httpMethod === 'POST') {
    const title = clean(body.title, 180);
    if (!title) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing task title' }) };
    }
    const priority = clean(body.priority, 20) || 'medium';
    if (!VALID_PRIORITIES.has(priority)) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid task priority' }) };
    }

    const now = new Date().toISOString();
    const task = {
      id: newOwnerCopilotId('task'),
      title,
      relatedLeadId: clean(body.relatedLeadId, 240),
      relatedCustomerId: clean(body.relatedCustomerId, 240),
      relatedThreadId: clean(body.relatedThreadId, 240),
      relatedDriveFileId: clean(body.relatedDriveFileId, 240),
      dueDate: clean(body.dueDate, 40),
      priority,
      status: 'open',
      source: clean(body.source, 80) || 'manual',
      notes: clean(body.notes, 2000),
      createdBy: 'owner',
      createdAt: now,
      updatedAt: now,
      completedAt: '',
    };
    await store.setJSON(taskKey(task.id), task);
    if (task.relatedLeadId || task.relatedCustomerId) {
      try {
        const timelineStore = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
        const timelineId = newOwnerCopilotId('timeline');
        await timelineStore.setJSON(timelineKey(timelineId), {
          id: timelineId,
          eventType: 'task_created',
          summary: `Task created: ${task.title}`,
          relatedLeadId: task.relatedLeadId,
          relatedCustomerId: task.relatedCustomerId,
          relatedTaskId: task.id,
          source: 'admin-owner-copilot-tasks',
          aiGenerated: false,
          createdAt: now,
        });
      } catch (timelineError) {
        console.warn('admin-owner-copilot-tasks: task created but timeline append failed', {
          taskId: task.id,
          error: safeBlobStoreError(timelineError),
        });
      }
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, task }) };
  }

  const taskId = clean(body.id, 240);
  if (!taskId) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing task id' }) };
  }
  const existing = await store.get(taskKey(taskId), { type: 'json' }) as Record<string, unknown> | null;
  if (!existing) {
    return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Task not found' }) };
  }
  const status = clean(body.status, 40) || String(existing.status || 'open');
  const priority = clean(body.priority, 20) || String(existing.priority || 'medium');
  if (!VALID_STATUSES.has(status)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid task status' }) };
  }
  if (!VALID_PRIORITIES.has(priority)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid task priority' }) };
  }
  const now = new Date().toISOString();
  const task: Record<string, unknown> = {
    ...existing,
    title: clean(body.title, 180) || existing.title,
    dueDate: clean(body.dueDate, 40) || existing.dueDate,
    priority,
    status,
    notes: clean(body.notes, 2000) || existing.notes,
    updatedAt: now,
    completedAt: status === 'completed' ? now : existing.completedAt || '',
  };
  await store.setJSON(taskKey(taskId), task);
  if (status === 'completed') {
    try {
      const timelineStore = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
      const timelineId = newOwnerCopilotId('timeline');
      await timelineStore.setJSON(timelineKey(timelineId), {
        id: timelineId,
        eventType: 'task_completed',
        summary: `Task completed: ${String(task.title || 'Untitled task')}`,
        relatedLeadId: typeof task.relatedLeadId === 'string' ? task.relatedLeadId : '',
        relatedCustomerId: typeof task.relatedCustomerId === 'string' ? task.relatedCustomerId : '',
        relatedTaskId: taskId,
        source: 'admin-owner-copilot-tasks',
        aiGenerated: false,
        createdAt: now,
      });
    } catch (timelineError) {
      console.warn('admin-owner-copilot-tasks: task completed but timeline append failed', {
        taskId,
        error: safeBlobStoreError(timelineError),
      });
    }
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, task }) };
};
