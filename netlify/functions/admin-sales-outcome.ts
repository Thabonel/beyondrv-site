import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import { idempotencyKey, normaliseIdempotencyKey, readIdempotencyRecord, writeIdempotencyRecord } from './command-idempotency-core';
import { appendOwnerAudit } from './owner-copilot-store-utils';
import { appendSalesActivity, buildSalesActivityEvent } from './sales-activity-core';
import { applySalesOutcome, type SalesOutcome } from './sales-outcome-core';

const STORE = 'customer-lead-status';
const SCOPE = 'sales:outcome';
function clean(value: unknown, max = 240) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function key(id: string) { return `lead-status/${encodeURIComponent(id)}.json`; }
function json(statusCode: number, body: Record<string, unknown>) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }; }

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'sales:write')) return forbiddenResponse('sales:write');
  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; } catch { return json(400, { error: 'Invalid JSON request.' }); }
  const enquiryId = clean(body.enquiryId);
  const rawKey = normaliseIdempotencyKey(body.idempotencyKey);
  if (!enquiryId || !rawKey) return json(400, { error: 'An enquiry and command id are required.' });
  connectBlobStore(event);
  try {
    const store = getBlobStore(STORE);
    const prior = await readIdempotencyRecord(SCOPE, rawKey);
    if (prior?.targetType === 'lead_status' && prior.targetId === enquiryId) {
      const leadStatus = await store.get(key(enquiryId), { type: 'json' });
      return json(200, { ok: true, idempotentReplay: true, leadStatus });
    }
    const existing = await store.get(key(enquiryId), { type: 'json' }) as Record<string, unknown> | null;
    const result = applySalesOutcome(existing, { outcome: clean(body.outcome, 80) as SalesOutcome, followUpAt: clean(body.followUpAt, 10), lossReason: clean(body.lossReason, 80), note: clean(body.note, 4000) });
    const leadStatus = { ...result.leadStatus, enquiryId };
    await store.setJSON(key(enquiryId), leadStatus);
    await writeIdempotencyRecord(SCOPE, rawKey, { actorUserId: actor.id, targetType: 'lead_status', targetId: enquiryId });
    await Promise.all([
      appendOwnerAudit('sales_outcome_recorded', 'lead_status', enquiryId, { outcome: body.outcome, nextFollowUpDate: result.nextFollowUpDate }, actor),
      appendSalesActivity(buildSalesActivityEvent({ commandId: idempotencyKey(SCOPE, rawKey), activityType: 'sales_outcome_recorded', outcome: clean(body.outcome, 80), enquiryId, source: 'gm_ui', summary: result.summary, metadata: { nextFollowUpDate: result.nextFollowUpDate } }, actor)),
    ]);
    return json(200, { ok: true, leadStatus, summary: result.summary });
  } catch (error) { return json(400, { error: error instanceof Error ? error.message : blobStoreUserMessage(error) }); }
};
