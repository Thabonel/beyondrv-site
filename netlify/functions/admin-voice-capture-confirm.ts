import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import { appendOwnerAudit } from './owner-copilot-store-utils';
import { syncEnquiryToOwnerCopilotRecords } from './owner-copilot-record-sync';
import { appendSalesActivity, buildSalesActivityEvent } from './sales-activity-core';
import { VOICE_CAPTURE_STORE, normaliseVoiceProposal, voiceCaptureKey, voiceCaptureSummary, type VoiceCaptureRecord } from './voice-capture-core';
import { CALENDAR_EVENT_STORE, calendarEventKey, validateEvent } from './calendar-store-core';
import { matchOrderForCustomer } from './order-date-core';
import { ORDER_STORE, writeOrderDate } from './order-date-write';
import { listJsonStore } from './owner-copilot-store-utils';

/**
 * A visit or handover agreed on the phone reaches the calendar the moment the
 * note is confirmed. If the customer can be matched to one order, the date is
 * written onto that order; otherwise it goes on the calendar as its own
 * event, linked to the call note, for someone to attach to the right order.
 */
async function placeAppointment(proposal: ReturnType<typeof normaliseVoiceProposal>, clues: { email: string; phone: string }, enquiryId: string, captureId: string) {
  if (!proposal.appointmentDate) return null;
  const kind = proposal.appointmentKind || 'customer_visit';
  const orders = await listJsonStore(ORDER_STORE).catch(() => [] as Record<string, unknown>[]);
  const order = matchOrderForCustomer(orders, { email: clues.email, phone: clues.phone, name: proposal.customerName, productInterest: proposal.productInterest });
  if (order && typeof order.id === 'string') {
    const result = await writeOrderDate({ kind, orderId: order.id, date: proposal.appointmentDate, time: proposal.appointmentTime, source: 'voice-capture', reason: `call note ${captureId}` });
    if (result.ok) return { placed: 'order' as const, orderId: order.id, message: result.message, warning: result.warning };
  }
  const start = proposal.appointmentTime ? `${proposal.appointmentDate}T${proposal.appointmentTime}` : proposal.appointmentDate;
  const validated = validateEvent({
    title: `${kind === 'expected_handover' ? 'Handover' : 'Visit'}: ${proposal.customerName || 'customer'}${proposal.productInterest ? ` · ${proposal.productInterest}` : ''}`,
    kind, start, allDay: !proposal.appointmentTime,
    notes: `Agreed on a call (note ${captureId}). No order matched this customer yet; attach it to the order when there is one.`,
    source: 'ai', links: { enquiryId },
  }, { actor: 'voice-capture' });
  if (!validated.ok) return null;
  await getBlobStore(CALENDAR_EVENT_STORE).setJSON(calendarEventKey(validated.event.id), validated.event);
  return { placed: 'calendar' as const, eventId: validated.event.id, message: `${validated.event.title} added to the calendar; no order matched yet.` };
}

const ENQUIRY_STORE = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';
function json(statusCode: number, body: Record<string, unknown>) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }; }
function clean(value: unknown, max = 4000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function leadKey(id: string) { return `lead-status/${encodeURIComponent(id)}.json`; }

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'sales:write')) return forbiddenResponse('sales:write');
  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; } catch { return json(400, { error: 'Invalid confirmation request.' }); }
  const captureId = clean(body.captureId, 240);
  if (!captureId) return json(400, { error: 'Call capture not found.' });
  connectBlobStore(event);
  try {
    const captureStore = getBlobStore(VOICE_CAPTURE_STORE);
    const capture = await captureStore.get(voiceCaptureKey(captureId), { type: 'json' }) as VoiceCaptureRecord | null;
    if (!capture) return json(404, { error: 'Call capture not found.' });
    if (capture.actorUserId !== actor.id && actor.role !== 'owner' && actor.role !== 'legacy_admin') return json(403, { error: 'You can only confirm your own voice capture.' });
    if (capture.status === 'applied') return json(200, { ok: true, capture, idempotentReplay: true });
    const proposal = normaliseVoiceProposal({
      ...capture.proposal,
      summary: clean(body.summary, 2400) || capture.proposal.summary,
      customerName: clean(body.customerName, 180) || capture.proposal.customerName,
      productInterest: clean(body.productInterest, 240) || capture.proposal.productInterest,
      followUpDate: clean(body.followUpDate, 10),
      followUpReason: clean(body.followUpReason, 500) || capture.proposal.followUpReason,
      // The GM can correct or clear what the call fixed before it is placed.
      appointmentKind: typeof body.appointmentKind === 'string' ? body.appointmentKind : capture.proposal.appointmentKind,
      appointmentDate: typeof body.appointmentDate === 'string' ? body.appointmentDate : capture.proposal.appointmentDate,
      appointmentTime: typeof body.appointmentTime === 'string' ? body.appointmentTime : capture.proposal.appointmentTime,
    });
    if (!proposal.summary) return json(400, { error: 'Add a short confirmed call summary before saving.' });
    const phone = clean(body.customerPhone, 80);
    const email = clean(body.customerEmail, 180);
    const now = new Date().toISOString();
    // A deterministic record ID makes a retry safe even if a browser loses the
    // success response after the note has been written.
    const enquiryId = `voice-${capture.id}`;
    const callNote = voiceCaptureSummary(proposal);
    const enquiry = { id: enquiryId, source_type: 'phone_call', submittedAt: now, received_at: now, name: proposal.customerName, email, phone, message: callNote, conversation_summary: callNote, product_interest: proposal.productInterest, manual_entry: true, voice_capture_id: capture.id, createdBy: actor.id };
    await getBlobStore(ENQUIRY_STORE).setJSON(enquiryId, enquiry);
    if (proposal.followUpDate) await getBlobStore(LEAD_STATUS_STORE).setJSON(leadKey(enquiryId), { enquiryId, status: 'new', priority: 'warm', notes: proposal.followUpReason, nextFollowUpDate: proposal.followUpDate, outcomeReason: '', firstResponseAt: '', lastContactedAt: now, updatedAt: now });
    let customerId = '';
    if (phone || email) {
      const synced = await syncEnquiryToOwnerCopilotRecords({ id: enquiryId, sourceEnquiryId: enquiryId, name: proposal.customerName, email, phone, message: callNote, productInterest: proposal.productInterest, nextFollowUpDate: proposal.followUpDate, notes: callNote, source: 'voice-capture', submittedAt: now });
      customerId = clean(synced.customer.id, 240);
    }
    const calendar = await placeAppointment(proposal, { email, phone }, enquiryId, capture.id).catch(() => null);
    const applied = { ...capture, status: 'applied' as const, proposal, confirmedAt: now, appliedAt: now, savedEnquiryId: enquiryId, savedCustomerId: customerId, calendar };
    await captureStore.setJSON(voiceCaptureKey(capture.id), applied);
    await Promise.all([
      appendOwnerAudit('voice_capture_confirmed', 'voice_capture', capture.id, { enquiryId, customerId, hasFollowUp: Boolean(proposal.followUpDate), moneyMentionCount: proposal.moneyMentions.length }, actor),
      appendSalesActivity(buildSalesActivityEvent({ commandId: capture.id, activityType: 'customer_call_summarised', customerId, enquiryId, source: 'voice_capture', sourceReference: capture.id, summary: proposal.summary, metadata: { followUpDate: proposal.followUpDate, appointmentDateTime: proposal.appointmentDateTime, requiresAgreementReview: proposal.requiresAgreementReview, moneyMentions: proposal.moneyMentions } }, actor)),
    ]);
    return json(200, { ok: true, capture: applied, result: { enquiryId, customerId, followUpDate: proposal.followUpDate, calendar, message: `Call note saved.${calendar ? ` ${calendar.message}${'warning' in calendar && calendar.warning ? ` ${calendar.warning}` : ''}` : ''} Any prices, agreement changes, deposits, and production decisions still require the normal reviewed workflow.` } });
  } catch (error) { return json(503, { error: error instanceof Error ? error.message : blobStoreUserMessage(error) }); }
};
