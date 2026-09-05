/**
 * The four things a phone link can change: add a job, tick one off, move one,
 * and leave a note on the day.
 *
 * Ownership is checked against the id the key resolved to, never against
 * anything the request says. A crew member cannot touch a job that is not
 * theirs even if they know its id.
 */
import type { Handler } from '@netlify/functions';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { authenticateCrew, json, refusal } from './crew-auth';
import { DAY_NOTE_STORE, dayNoteKey, decideCrewWrite, mayActOnTask } from './crew-core';
import { CALENDAR_EVENT_STORE, calendarEventKey, isDuplicate, validateEvent, type CompanyCalendarEvent } from './calendar-store-core';
import catalogue from './product-catalogue.json';
import { newOwnerCopilotId, OWNER_COPILOT_TASK_STORE, taskKey } from './owner-copilot-core';

const NOT_YOURS = 'That job is not on your list.';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  connectBlobStore(event);

  let auth;
  try {
    auth = await authenticateCrew(event);
  } catch (error) {
    console.warn('crew-write: could not check the key', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
  if (!auth.ok) return refusal(auth.statusCode);
  const { member } = auth;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Could not read that.' });
  }

  const decision = decideCrewWrite(body);
  if (!decision.ok) return json(400, { error: decision.error });

  try {
    const tasks = getBlobStore(OWNER_COPILOT_TASK_STORE);
    const now = new Date().toISOString();

    if (decision.action === 'add_task') {
      const id = newOwnerCopilotId('task');
      await tasks.setJSON(taskKey(id), {
        id,
        title: decision.title,
        dueDate: decision.date,
        dueTime: '',
        // Assigned to the person who added it, so it comes back to their phone.
        assigneeId: member.id,
        status: 'open',
        priority: 'medium',
        source: 'crew',
        notes: '',
        createdAt: now,
        updatedAt: now,
        createdBy: member.name,
      });
      return json(200, { ok: true, id, message: `Added "${decision.title}".` });
    }

    if (decision.action === 'set_note') {
      await getBlobStore(DAY_NOTE_STORE).setJSON(dayNoteKey(member.id, decision.date), {
        crewId: member.id,
        crewName: member.name,
        date: decision.date,
        note: decision.note,
        updatedAt: now,
      });
      return json(200, { ok: true, message: 'Note saved.' });
    }

    if (decision.action === 'report_container') {
      const product = (catalogue as Array<Record<string, unknown>>)
        .find((item) => typeof item.slug === 'string' && item.slug === decision.productSlug);
      if (!product) return json(404, { error: 'That vehicle is not on the list.' });
      const title = `Container ETA: ${typeof product.title === 'string' ? product.title : decision.productSlug}`;

      const store = getBlobStore(CALENDAR_EVENT_STORE);
      const { blobs } = await store.list({ prefix: 'events/' });
      const existingEvents = (await Promise.all(blobs.map(async (blob) => {
        try { return await store.get(blob.key, { type: 'json' }) as CompanyCalendarEvent | null; } catch { return null; }
      }))).filter((item): item is CompanyCalendarEvent => Boolean(item?.id));

      // A second report for the same vehicle replaces the first: the latest
      // word from the person tracking it is the one worth keeping, and two
      // reports a day apart are not two containers.
      const previous = existingEvents.find((event) =>
        event.kind === 'container_eta' && event.source === 'crew' && event.links?.productSlug === decision.productSlug && !event.dismissedAt);

      const result = validateEvent({
        title,
        kind: 'container_eta',
        allDay: true,
        start: decision.date,
        end: decision.date,
        notes: `Reported by ${member.name}${decision.note ? `: ${decision.note}` : ''}`,
        source: 'crew',
        links: { productSlug: decision.productSlug },
      }, { actor: member.name, existing: previous ?? null });
      if (!result.ok) return json(400, { error: result.error });

      await store.setJSON(calendarEventKey(result.event.id), result.event);
      return json(200, {
        ok: true,
        message: previous
          ? `Updated: ${title.replace('Container ETA: ', '')} now ${decision.date}.`
          : `Thanks. ${title.replace('Container ETA: ', '')} is due ${decision.date}.`,
      });
    }

    const existing = await tasks.get(taskKey(decision.taskId), { type: 'json' }) as Record<string, unknown> | null;
    // The same answer whether the job belongs to someone else or does not
    // exist, so a link cannot be used to find out what other jobs there are.
    if (!mayActOnTask(member, existing)) return json(404, { error: NOT_YOURS });

    if (decision.action === 'complete_task') {
      const done = String(existing!.status ?? 'open') === 'open';
      await tasks.setJSON(taskKey(decision.taskId), {
        ...existing,
        status: done ? 'completed' : 'open',
        completedAt: done ? now : '',
        updatedAt: now,
      });
      return json(200, { ok: true, message: done ? 'Ticked off.' : 'Put back on the list.' });
    }

    await tasks.setJSON(taskKey(decision.taskId), { ...existing, dueDate: decision.date, updatedAt: now });
    return json(200, { ok: true, message: `Moved to ${decision.date}.` });
  } catch (error) {
    console.warn('crew-write: failed', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
