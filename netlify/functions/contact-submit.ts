import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';

const STORE_NAME = 'customer-enquiries';
const RESEND_API = 'https://api.resend.com/emails';
const DEFAULT_TO_EMAIL = 'beyondcaravans@gmail.com';
const DEFAULT_FROM_EMAIL = 'Beyond RV Website <enquiries@beyondrv.com.au>';

interface EnquiryPayload {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  callback_date?: string;
  callback_time?: string;
  product_interest?: string;
  enquiry_intent?: string;
  referral_source_self_reported?: string;
  referral_source_other?: string;
  referral_partner?: string;
  referral_entry_page?: string;
  referral_first_touch?: string;
  referral_utm_source?: string;
  referral_utm_campaign?: string;
  botField?: string;
}

function clean(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function field(label: string, value?: string) {
  return value ? `${label}: ${value}` : '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function providerRejectReason(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown; name?: unknown };
    const message = [parsed.message, parsed.error, parsed.name]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ');
    if (message) return `Email provider rejected the message (${status}): ${message.slice(0, 240)}`;
  } catch {}

  const text = body.replace(/\s+/g, ' ').trim();
  return text
    ? `Email provider rejected the message (${status}): ${text.slice(0, 240)}`
    : `Email provider rejected the message (${status})`;
}

async function sendEmail(enquiry: Required<Pick<EnquiryPayload, 'name' | 'email' | 'phone' | 'message'>> & EnquiryPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' };

  const to = process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const subject = `New Beyond RV enquiry from ${enquiry.name}`;
  const lines = [
    field('Name', enquiry.name),
    field('Email', enquiry.email),
    field('Phone', enquiry.phone),
    field('Product interest', enquiry.product_interest),
    field('Intent', enquiry.enquiry_intent),
    field('Preferred callback date', enquiry.callback_date),
    field('Preferred callback time', enquiry.callback_time),
    field('Heard about us', enquiry.referral_source_self_reported),
    field('Heard about us detail', enquiry.referral_source_other),
    field('Referral partner', enquiry.referral_partner),
    field('Entry page', enquiry.referral_entry_page),
    field('First touch', enquiry.referral_first_touch),
    field('UTM source', enquiry.referral_utm_source),
    field('UTM campaign', enquiry.referral_utm_campaign),
    '',
    'Message:',
    enquiry.message,
  ].filter(line => line !== '');

  const html = `
    <h2>New Beyond RV enquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(enquiry.name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(enquiry.email)}">${escapeHtml(enquiry.email)}</a></p>
    <p><strong>Phone:</strong> <a href="tel:${escapeHtml(enquiry.phone)}">${escapeHtml(enquiry.phone)}</a></p>
    <p><strong>Product:</strong> ${escapeHtml(enquiry.product_interest ?? 'Not specified')}</p>
    <p><strong>Callback:</strong> ${escapeHtml([enquiry.callback_date, enquiry.callback_time].filter(Boolean).join(' ') || 'Not specified')}</p>
    <p><strong>Heard about us:</strong> ${escapeHtml(enquiry.referral_source_self_reported ?? 'Not specified')}${enquiry.referral_source_other ? ` - ${escapeHtml(enquiry.referral_source_other)}` : ''}</p>
    <h3>Message</h3>
    <p>${escapeHtml(enquiry.message).replace(/\n/g, '<br>')}</p>
  `;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: enquiry.email,
      subject,
      text: lines.join('\n'),
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[contact-submit] email failed:', body);
    return { sent: false, reason: providerRejectReason(res.status, body) };
  }

  return { sent: true };
}

async function backupEnquiry(id: string, record: Record<string, unknown>, blobRuntimeSource: string) {
  try {
    const store = getBlobStore(STORE_NAME);
    await store.setJSON(id, record);
    return { backedUp: true };
  } catch (err) {
    console.error('[contact-submit] enquiry backup unavailable:', {
      store: STORE_NAME,
      enquiryId: id,
      blobRuntimeSource,
      error: safeBlobStoreError(err),
    });
    return { backedUp: false };
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const blobRuntimeSource = connectBlobStore(event);

  let body: EnquiryPayload;
  try {
    body = JSON.parse(event.body ?? '{}') as EnquiryPayload;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (clean(body.botField, 100)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, spam: true }) };
  }

  const enquiry = {
    name: clean(body.name, 120),
    email: clean(body.email, 180),
    phone: clean(body.phone, 80),
    message: clean(body.message, 4000),
    callback_date: clean(body.callback_date, 40),
    callback_time: clean(body.callback_time, 40),
    product_interest: clean(body.product_interest, 160),
    enquiry_intent: clean(body.enquiry_intent, 80),
    referral_source_self_reported: clean(body.referral_source_self_reported, 120),
    referral_source_other: clean(body.referral_source_other, 180),
    referral_partner: clean(body.referral_partner, 120),
    referral_entry_page: clean(body.referral_entry_page, 300),
    referral_first_touch: clean(body.referral_first_touch, 80),
    referral_utm_source: clean(body.referral_utm_source, 120),
    referral_utm_campaign: clean(body.referral_utm_campaign, 160),
  };

  const missing = [
    !enquiry.name && 'name',
    !enquiry.email && 'email',
    enquiry.email && !isValidEmail(enquiry.email) && 'valid email',
    !enquiry.phone && 'phone',
    !enquiry.message && 'message',
    !enquiry.referral_source_self_reported && 'how you heard about us',
    enquiry.referral_source_self_reported === 'Other' && !enquiry.referral_source_other && 'other referral detail',
  ].filter(Boolean);

  if (missing.length) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
    };
  }

  const submittedAt = new Date().toISOString();
  const id = `${submittedAt}-${randomUUID()}`;
  const record = {
    ...enquiry,
    id,
    submittedAt,
    userAgent: event.headers['user-agent'] ?? '',
    ip: event.headers['x-nf-client-connection-ip'] ?? event.headers['client-ip'] ?? '',
  };

  const [storeResult, emailResult] = await Promise.allSettled([
    backupEnquiry(id, record, blobRuntimeSource),
    sendEmail(enquiry),
  ]);

  if (storeResult.status === 'rejected') {
    console.error('[contact-submit] enquiry backup failed:', storeResult.reason);
  }

  if (emailResult.status === 'rejected' || !emailResult.value.sent) {
    const reason = emailResult.status === 'rejected'
      ? 'Email delivery failed'
      : emailResult.value.reason ?? 'Email delivery failed';
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        id,
        error: `${reason}. Please call 0430 863 819 if the enquiry is urgent.`,
        enquiryBackedUp: storeResult.status === 'fulfilled' && storeResult.value.backedUp,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      id,
      emailSent: true,
      enquiryBackedUp: storeResult.status === 'fulfilled' && storeResult.value.backedUp,
    }),
  };
};
