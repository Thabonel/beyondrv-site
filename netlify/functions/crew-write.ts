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
