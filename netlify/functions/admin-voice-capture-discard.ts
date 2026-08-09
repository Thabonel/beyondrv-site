import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import { appendOwnerAudit } from './owner-copilot-store-utils';
import { VOICE_CAPTURE_STORE, voiceCaptureKey, type VoiceCaptureRecord } from './voice-capture-core';

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'sales:write')) return forbiddenResponse('sales:write');
  let body: { captureId?: unknown };
  try { body = JSON.parse(event.body || '{}') as { captureId?: unknown }; } catch { return json(400, { error: 'Invalid discard request.' }); }
  const captureId = typeof body.captureId === 'string' ? body.captureId.trim().slice(0, 240) : '';
  if (!captureId) return json(400, { error: 'Call capture not found.' });
  connectBlobStore(event);
  try {
    const store = getBlobStore(VOICE_CAPTURE_STORE);
    const capture = await store.get(voiceCaptureKey(captureId), { type: 'json' }) as VoiceCaptureRecord | null;
    if (!capture) return json(404, { error: 'Call capture not found.' });
    if (capture.actorUserId !== actor.id && actor.role !== 'owner' && actor.role !== 'legacy_admin') return json(403, { error: 'You can only discard your own voice capture.' });
    if (capture.status === 'applied') return json(409, { error: 'A saved call note cannot be discarded here.' });
    if (capture.status !== 'discarded') {
      // No note has been applied. Remove the transcript and proposal immediately;
      // retaining neither is the safest interpretation of the GM's discard action.
      const discarded = { ...capture, status: 'discarded' as const, transcript: '', proposal: { ...capture.proposal, summary: '', customerName: '', productInterest: '', followUpDate: '', followUpReason: '', appointmentDateTime: '', moneyMentions: [], discussedItems: [], unresolvedItems: [], requiresAgreementReview: false } };
      await store.setJSON(voiceCaptureKey(capture.id), discarded);
      await appendOwnerAudit('voice_capture_discarded', 'voice_capture', capture.id, {}, actor);
    }
    return json(200, { ok: true });
  } catch (error) {
    return json(503, { error: error instanceof Error ? error.message : blobStoreUserMessage(error) });
  }
};
