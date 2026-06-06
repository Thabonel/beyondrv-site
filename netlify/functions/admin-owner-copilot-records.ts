import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  auditLogKey,
  customerKey,
  leadRecordKey,
  newOwnerCopilotId,
  OWNER_COPILOT_AUDIT_STORE,
  OWNER_COPILOT_CUSTOMER_STORE,
  OWNER_COPILOT_LEAD_STORE,
  OWNER_COPILOT_TIMELINE_STORE,
  timelineKey,
} from './owner-copilot-core';
import { syncEnquiryToOwnerCopilotRecords } from './owner-copilot-record-sync';

const VALID_LEAD_STATUSES = new Set(['new', 'contacted', 'waiting_on_customer', 'waiting_on_byondrv', 'quote_requested', 'quote_sent', 'warm', 'hot', 'won', 'lost', 'dormant']);

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function listStore(storeName: string) {
  const store = getBlobStore(storeName);
  const { blobs } = await store.list();
  const records = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }));
  return records.filter((record): record is Record<string, unknown> => Boolean(record?.id));
}

async function appendAudit(action: string, targetType: string, targetId: string, detail: Record<string, unknown>) {
  try {
    const store = getBlobStore(OWNER_COPILOT_AUDIT_STORE);
    const id = newOwnerCopilotId('audit');
    await store.setJSON(auditLogKey(id), {
      id,
      action,
      targetType,
      targetId,
      actor: 'owner',
      detail,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('admin-owner-copilot-records: audit append failed', { action, targetType, targetId, error: safeBlobStoreError(error) });
  }
}

async function appendTimeline(eventType: string, summary: string, relatedLeadId = '', relatedCustomerId = '') {
  try {
    const store = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
    const id = newOwnerCopilotId('timeline');
    await store.setJSON(timelineKey(id), {
      id,
      eventType,
      summary,
      relatedLeadId,
      relatedCustomerId,
      source: 'admin-owner-copilot-records',
      aiGenerated: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('admin-owner-copilot-records: timeline append failed', { eventType, relatedLeadId, relatedCustomerId, error: safeBlobStoreError(error) });
  }
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  try {
    getBlobStore(OWNER_COPILOT_CUSTOMER_STORE);
    getBlobStore(OWNER_COPILOT_LEAD_STORE);
  } catch (error) {
    console.warn('admin-owner-copilot-records: store unavailable', {
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
    const type = clean(event.queryStringParameters?.type, 40);
    if (type === 'customers') {
      const customers = (await listStore(OWNER_COPILOT_CUSTOMER_STORE))
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customers }) };
    }
    if (type === 'leads') {
      const leads = (await listStore(OWNER_COPILOT_LEAD_STORE))
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads }) };
    }
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Use type=customers or type=leads.' }) };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const type = clean(body.type, 40);
  const now = new Date().toISOString();

  if (type === 'enquiry') {
    try {
      const result = await syncEnquiryToOwnerCopilotRecords({
        id: clean(body.id, 240),
        sourceEnquiryId: clean(body.sourceEnquiryId, 240),
        name: clean(body.name, 180),
        email: clean(body.email, 240),
        phone: clean(body.phone, 80),
        message: clean(body.message, 4000),
        productInterest: clean(body.productInterest, 240),
        status: clean(body.status, 40),
        nextFollowUpDate: clean(body.nextFollowUpDate, 40),
        notes: clean(body.notes, 3000),
        source: clean(body.source, 80) || 'admin-enquiry-sync',
        submittedAt: clean(body.submittedAt, 80),
      });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, ...result }),
      };
    } catch (error) {
      console.warn('admin-owner-copilot-records: enquiry sync failed', {
        blobRuntimeSource,
        error: safeBlobStoreError(error),
      });
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: blobStoreUserMessage(error) }),
      };
    }
  }

  if (type === 'customer') {
    const name = clean(body.name, 180);
    const email = clean(body.email, 240).toLowerCase();
    const phone = clean(body.phone, 80);
    if (!name && !email && !phone) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Add a customer name, email, or phone.' }) };
    }
    const store = getBlobStore(OWNER_COPILOT_CUSTOMER_STORE);
    const id = clean(body.id, 240) || newOwnerCopilotId('customer');
    const existing = await store.get(customerKey(id), { type: 'json' }) as Record<string, unknown> | null;
    const customer = {
      ...existing,
      id,
      name,
      email,
      phone,
      notes: clean(body.notes, 3000),
      source: clean(body.source, 80) || 'admin',
      createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
      updatedAt: now,
    };
    await store.setJSON(customerKey(id), customer);
    await appendAudit(existing ? 'customer_updated' : 'customer_created', 'customer', id, { source: customer.source });
    await appendTimeline(existing ? 'note_added' : 'note_added', existing ? `Customer updated: ${name || email || phone}` : `Customer created: ${name || email || phone}`, '', id);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, customer }) };
  }

  if (type === 'lead') {
    const customerId = clean(body.customerId, 240);
    const productInterest = clean(body.productInterest, 240);
    const status = clean(body.status, 40) || 'new';
    if (!VALID_LEAD_STATUSES.has(status)) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid lead status.' }) };
    }
    const store = getBlobStore(OWNER_COPILOT_LEAD_STORE);
    const id = clean(body.id, 240) || clean(body.sourceEnquiryId, 240) || newOwnerCopilotId('lead');
    const existing = await store.get(leadRecordKey(id), { type: 'json' }) as Record<string, unknown> | null;
    const lead = {
      ...existing,
      id,
      customerId,
      sourceEnquiryId: clean(body.sourceEnquiryId, 240),
      productInterest,
      status,
      score: Number.isFinite(Number(body.score)) ? Number(body.score) : existing?.score ?? 0,
      nextFollowUpDate: clean(body.nextFollowUpDate, 40),
      notes: clean(body.notes, 3000),
      source: clean(body.source, 80) || 'admin',
      createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
      updatedAt: now,
    };
    await store.setJSON(leadRecordKey(id), lead);
    await appendAudit(existing ? 'lead_updated' : 'lead_created', 'lead', id, { status, customerId });
    await appendTimeline(existing ? 'status_changed' : 'website_enquiry', existing ? `Lead updated: ${status}` : `Lead record created for ${productInterest || 'customer enquiry'}.`, id, customerId);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, lead }) };
  }

  return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Use type=customer or type=lead.' }) };
};
