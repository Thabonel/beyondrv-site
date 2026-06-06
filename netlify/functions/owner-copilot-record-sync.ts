import { getBlobStore, safeBlobStoreError } from './blob-store';
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

export interface OwnerCopilotSyncInput {
  id?: string;
  sourceEnquiryId?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  productInterest?: string;
  status?: string;
  score?: number;
  nextFollowUpDate?: string;
  notes?: string;
  source?: string;
  submittedAt?: string;
}

export interface OwnerCopilotSyncResult {
  customer: Record<string, unknown>;
  lead: Record<string, unknown>;
  matchedCustomer: boolean;
}

export function normalizeEmail(value = '') {
  return value.trim().toLowerCase();
}

export function normalizePhone(value = '') {
  return value.replace(/\D/g, '');
}

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validStatus(value = '') {
  return [
    'new',
    'contacted',
    'waiting_on_customer',
    'waiting_on_byondrv',
    'quote_requested',
    'quote_sent',
    'warm',
    'hot',
    'won',
    'lost',
    'dormant',
  ].includes(value);
}

export function findMatchingCustomer(
  customers: Record<string, unknown>[],
  input: Pick<OwnerCopilotSyncInput, 'email' | 'phone' | 'name'>
) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const name = clean(input.name, 180).toLowerCase();

  return customers.find((customer) => {
    const customerEmail = normalizeEmail(typeof customer.email === 'string' ? customer.email : '');
    const customerPhone = normalizePhone(typeof customer.phone === 'string' ? customer.phone : '');
    const customerName = clean(customer.name, 180).toLowerCase();
    if (email && customerEmail && email === customerEmail) return true;
    if (phone && customerPhone && phone === customerPhone) return true;
    return Boolean(name && customerName && name === customerName && (email || phone));
  }) ?? null;
}

async function listCustomers() {
  const store = getBlobStore(OWNER_COPILOT_CUSTOMER_STORE);
  const { blobs } = await store.list();
  const customers = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }));
  return customers.filter((customer): customer is Record<string, unknown> => Boolean(customer?.id));
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
      actor: 'system',
      detail,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('owner-copilot-record-sync: audit append failed', { action, targetType, targetId, error: safeBlobStoreError(error) });
  }
}

async function appendTimeline(summary: string, relatedLeadId = '', relatedCustomerId = '', source = 'owner-copilot-record-sync') {
  try {
    const store = getBlobStore(OWNER_COPILOT_TIMELINE_STORE);
    const id = newOwnerCopilotId('timeline');
    await store.setJSON(timelineKey(id), {
      id,
      eventType: 'website_enquiry',
      summary,
      relatedLeadId,
      relatedCustomerId,
      source,
      aiGenerated: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('owner-copilot-record-sync: timeline append failed', { relatedLeadId, relatedCustomerId, error: safeBlobStoreError(error) });
  }
}

export async function syncEnquiryToOwnerCopilotRecords(input: OwnerCopilotSyncInput): Promise<OwnerCopilotSyncResult> {
  const now = new Date().toISOString();
  const customers = await listCustomers();
  const matchedCustomer = findMatchingCustomer(customers, input);
  const customerStore = getBlobStore(OWNER_COPILOT_CUSTOMER_STORE);
  const leadStore = getBlobStore(OWNER_COPILOT_LEAD_STORE);

  const customerId = typeof matchedCustomer?.id === 'string' ? matchedCustomer.id : newOwnerCopilotId('customer');
  const customer = {
    ...matchedCustomer,
    id: customerId,
    name: clean(input.name, 180) || matchedCustomer?.name || '',
    email: normalizeEmail(input.email) || matchedCustomer?.email || '',
    phone: clean(input.phone, 80) || matchedCustomer?.phone || '',
    notes: clean(input.notes || input.message, 3000) || matchedCustomer?.notes || '',
    source: clean(input.source, 80) || matchedCustomer?.source || 'enquiry-sync',
    createdAt: typeof matchedCustomer?.createdAt === 'string' ? matchedCustomer.createdAt : (input.submittedAt || now),
    updatedAt: now,
  };

  const leadId = clean(input.id || input.sourceEnquiryId, 240) || newOwnerCopilotId('lead');
  let existingLead: Record<string, unknown> | null = null;
  try {
    existingLead = await leadStore.get(leadRecordKey(leadId), { type: 'json' }) as Record<string, unknown> | null;
  } catch {
    existingLead = null;
  }

  const status = validStatus(clean(input.status, 40)) ? clean(input.status, 40) : 'new';
  const lead = {
    ...existingLead,
    id: leadId,
    customerId,
    sourceEnquiryId: clean(input.sourceEnquiryId || input.id, 240),
    productInterest: clean(input.productInterest, 240) || existingLead?.productInterest || '',
    status,
    score: Number.isFinite(input.score) ? input.score : existingLead?.score ?? 0,
    nextFollowUpDate: clean(input.nextFollowUpDate, 40) || existingLead?.nextFollowUpDate || '',
    notes: clean(input.notes || input.message, 3000) || existingLead?.notes || '',
    source: clean(input.source, 80) || existingLead?.source || 'enquiry-sync',
    createdAt: typeof existingLead?.createdAt === 'string' ? existingLead.createdAt : (input.submittedAt || now),
    updatedAt: now,
  };

  await customerStore.setJSON(customerKey(customerId), customer);
  await leadStore.setJSON(leadRecordKey(leadId), lead);
  await appendAudit(matchedCustomer ? 'customer_matched' : 'customer_created', 'customer', customerId, { source: lead.source, leadId });
  await appendAudit(existingLead ? 'lead_updated' : 'lead_created', 'lead', leadId, { source: lead.source, customerId });
  if (!existingLead) {
    await appendTimeline(`Lead record created for ${lead.productInterest || 'customer enquiry'}.`, leadId, customerId, String(lead.source || 'enquiry-sync'));
  }

  return { customer, lead, matchedCustomer: Boolean(matchedCustomer) };
}
