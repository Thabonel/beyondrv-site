import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { syncEnquiryToOwnerCopilotRecords } from './owner-copilot-record-sync';

const ENQUIRY_STORE = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';
const VALID_SOURCE_TYPES = new Set(['manual_email', 'phone_call', 'facebook', 'instagram', 'referral', 'walk_in', 'other']);
const VALID_PRIORITIES = new Set(['hot', 'warm', 'info-only', 'spam-low-quality']);

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

function parseReceivedAt(value: string) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  }

  const sourceType = clean(body.source_type, 40);
  const name = clean(body.customer_name, 120);
  const email = clean(body.customer_email, 180);
  const phone = clean(body.customer_phone, 80);
  const productInterest = clean(body.product_interest, 180);
  const enquiryIntent = clean(body.enquiry_intent, 80);
  const notes = clean(body.notes, 4000);
  const receivedAt = parseReceivedAt(clean(body.received_at, 80));
  const priority = clean(body.priority, 40);
  const nextFollowUpDate = clean(body.nextFollowUpDate, 40);

  if (!VALID_SOURCE_TYPES.has(sourceType)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid source type' }),
    };
  }

  if (!name && !email && !phone) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Add at least a customer name, email, or phone number.' }),
    };
  }

  if (priority && !VALID_PRIORITIES.has(priority)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid lead priority' }),
    };
  }

  const submittedAt = new Date().toISOString();
  const id = `manual-${submittedAt}-${randomUUID()}`;
  const emailBody = clean(body.email_body, 8000);
  const conversationSummary = clean(body.conversation_summary, 8000);

  if (sourceType === 'manual_email' && !emailBody) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Paste the email body before saving.' }),
    };
  }

  if (sourceType !== 'manual_email' && !conversationSummary) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Add a conversation summary before saving.' }),
    };
  }

  const record = {
    id,
    source_type: sourceType,
    submittedAt,
    received_at: receivedAt,
    name,
    email,
    phone,
    message: sourceType === 'manual_email' ? emailBody : conversationSummary,
    email_subject: clean(body.email_subject, 240),
    email_body: emailBody,
    conversation_summary: conversationSummary,
    main_questions: clean(body.main_questions, 4000),
    vehicle_details: clean(body.vehicle_details, 1000),
    budget_notes: clean(body.budget_notes, 1000),
    timeline: clean(body.timeline, 1000),
    product_interest: productInterest,
    enquiry_intent: enquiryIntent,
    source_note: clean(body.source_note, 1000),
    manual_entry: true,
    createdBy: 'admin',
  };

  try {
    const enquiryStore = getBlobStore(ENQUIRY_STORE);
    const statusStore = getBlobStore(LEAD_STATUS_STORE);
    await enquiryStore.setJSON(id, record);

    if (priority || notes || nextFollowUpDate) {
      await statusStore.setJSON(leadKey(id), {
        enquiryId: id,
        status: 'new',
        priority: priority || 'warm',
        notes,
        nextFollowUpDate,
        outcomeReason: '',
        firstResponseAt: '',
        lastContactedAt: '',
        updatedAt: submittedAt,
      });
    }

    try {
      await syncEnquiryToOwnerCopilotRecords({
        id,
        sourceEnquiryId: id,
        name,
        email,
        phone,
        message: record.message,
        productInterest,
        status: 'new',
        nextFollowUpDate,
        notes: notes || record.source_note || record.conversation_summary || record.email_subject,
        source: 'manual-enquiry',
        submittedAt,
      });
    } catch (syncError) {
      console.warn('admin-manual-enquiry: owner copilot record sync failed', {
        enquiryId: id,
        error: safeBlobStoreError(syncError),
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, enquiry: record }),
    };
  } catch (error) {
    console.warn('admin-manual-enquiry: enquiry store unavailable', {
      store: ENQUIRY_STORE,
      blobRuntimeSource,
      error: safeBlobStoreError(error),
    });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
};
