/**
 * The calendar's own events: meetings, reminders, and what the AI read in the
 * mailbox. Record-owned dates are not here; they move through
 * admin-calendar-write so they keep one home.
 */
import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  CALENDAR_EVENT_STORE,
  calendarEventKey,
  inRange,
  validateEvent,
  type CompanyCalendarEvent,
} from './calendar-store-core';
import { appendOwnerAudit } from './owner-copilot-store-utils';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function listCalendarEvents(from = '', to = '', includeDismissed = false): Promise<CompanyCalendarEvent[]> {
  const store = getBlobStore(CALENDAR_EVENT_STORE);
  const { blobs } = await store.list({ prefix: 'events/' });
  const events = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as CompanyCalendarEvent | null;
    } catch {
      return null;
    }
  }));
  return events
    .filter((event): event is CompanyCalendarEvent => Boolean(event?.id && event.start))
    .filter((event) => includeDismissed || !event.dismissedAt)
    .filter((event) => !from || !to || inRange(event, from, to))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export const handler: Handler = async (event) => {
  const method = event.httpMethod;
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return { statusCode: 405, body: 'Method Not Allowed' };

  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  const capability = method === 'GET' ? 'sales:read' : 'sales:write';
  if (!hasAdminCapability(actor, capability)) return forbiddenResponse(capability);

  connectBlobStore(event);
  const actorName = actor.displayName || actor.id || 'admin';

  try {
    if (method === 'GET') {
      const from = clean(event.queryStringParameters?.from, 10);
      const to = clean(event.queryStringParameters?.to, 10);
      return json(200, { events: await listCalendarEvents(from, to) });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    } catch {
      return json(400, { error: 'Invalid request' });
    }

    const store = getBlobStore(CALENDAR_EVENT_STORE);

    if (method === 'POST') {
      const result = validateEvent(body, { actor: actorName });
      if (!result.ok) return json(400, { error: result.error });
      await store.setJSON(calendarEventKey(result.event.id), result.event);
      await appendOwnerAudit('calendar_event_created', 'calendar_event', result.event.id, { title: result.event.title, start: result.event.start }, actor);
      return json(200, { ok: true, event: result.event, message: `Saved "${result.event.title}".` });
    }

    const id = clean(body.id);
    if (!id) return json(400, { error: 'id is required.' });
    const existing = await store.get(calendarEventKey(id), { type: 'json' }) as CompanyCalendarEvent | null;
    if (!existing) return json(404, { error: `No calendar event with id ${id}.` });

    if (method === 'PATCH') {
      const { id: _ignored, ...changes } = body;
      const result = validateEvent(changes, { actor: actorName, existing });
      if (!result.ok) return json(400, { error: result.error });
      await store.setJSON(calendarEventKey(id), result.event);
      await appendOwnerAudit('calendar_event_updated', 'calendar_event', id, { changes: Object.keys(changes) }, actor);
      return json(200, { ok: true, event: result.event, message: `Updated "${result.event.title}".` });
    }

    // DELETE. An AI event is dismissed rather than removed, so the email that
    // produced it cannot put it back on the next run.
    if (existing.source === 'ai') {
      const dismissed = { ...existing, dismissedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await store.setJSON(calendarEventKey(id), dismissed);
      await appendOwnerAudit('calendar_event_dismissed', 'calendar_event', id, { title: existing.title }, actor);
      return json(200, { ok: true, dismissed: true, message: `Dismissed "${existing.title}".` });
    }
    await store.delete(calendarEventKey(id));
    await appendOwnerAudit('calendar_event_deleted', 'calendar_event', id, { title: existing.title }, actor);
    return json(200, { ok: true, message: `Deleted "${existing.title}".` });
  } catch (error) {
    console.warn('admin-calendar-events: failed', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
