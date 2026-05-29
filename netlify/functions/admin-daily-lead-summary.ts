import type { Handler } from '@netlify/functions';
import { connectBlobStore, getBlobStore } from './blob-store';
import {
  DEFAULT_TIMEZONE,
  REMINDER_EMAIL_LOG_STORE,
  loadLeadReminderSummary,
  safeLeadReminderError,
  todayKey,
  type LeadReminderItem,
} from './lead-reminder-core';

export const config = {
  schedule: '0 22 * * *',
};

const RESEND_API = 'https://api.resend.com/emails';
const DEFAULT_TO_EMAIL = 'beyondcaravans@gmail.com';
const DEFAULT_FROM_EMAIL = 'Beyond RV Website <enquiries@beyondrv.com.au>';

function logKey(date: string) {
  return `daily-summary/${date}.json`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function itemLine(item: LeadReminderItem) {
  return [
    item.customerName,
    item.productInterest,
    `enquiry: ${item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-AU') : 'unknown date'}`,
    `status: ${item.status}`,
    `priority: ${item.priority}`,
    item.nextFollowUpDate ? `follow-up: ${item.nextFollowUpDate}` : '',
    item.reason,
  ].filter(Boolean).join(' | ');
}

function textSection(title: string, items: LeadReminderItem[]) {
  if (!items.length) return '';
  return `${title}\n${items.map(item => `- ${itemLine(item)}`).join('\n')}`;
}

function htmlSection(title: string, items: LeadReminderItem[]) {
  if (!items.length) return '';
  return `
    <h3>${escapeHtml(title)}</h3>
    <ul>
      ${items.map(item => `<li>${escapeHtml(itemLine(item))}</li>`).join('')}
    </ul>
  `;
}

async function sendSummaryEmail(text: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' };

  const to = process.env.LEAD_REMINDER_TO_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'Beyond RV lead reminders for today',
      text,
      html,
    }),
  });

  const body = await res.text();
  if (!res.ok) return { sent: false, reason: `Email provider rejected summary with ${res.status}: ${body.slice(0, 180)}` };
  return { sent: true };
}

export const handler: Handler = async (event) => {
  const blobRuntimeSource = connectBlobStore(event);
  const date = todayKey(new Date(), process.env.LEAD_REMINDER_TIMEZONE || DEFAULT_TIMEZONE);

  try {
    const logStore = getBlobStore(REMINDER_EMAIL_LOG_STORE);
    const existing = await logStore.get(logKey(date), { type: 'json' });
    if (existing) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, skipped: true, reason: 'Daily lead summary already sent.' }),
      };
    }

    const summary = await loadLeadReminderSummary();
    if (summary.total === 0) {
      await logStore.setJSON(logKey(date), { date, status: 'skipped', reason: 'No leads needing attention.', createdAt: new Date().toISOString() });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, skipped: true, reason: 'No leads needing attention.' }),
      };
    }

    const sections = [
      ['New unreplied enquiries', summary.newUnreplied],
      ['Hot leads', summary.hotLeads],
      ['Follow-ups due today', summary.followUpsDueToday],
      ['Overdue follow-ups', summary.overdueFollowUps],
      ['Quoted leads needing follow-up', summary.quotedNeedsFollowUp],
      ['Manual leads missing follow-up dates', summary.manualMissingFollowUp],
    ] as const;
    const text = [
      'Beyond RV lead reminders for today',
      '',
      ...sections.map(([title, items]) => textSection(title, items)).filter(Boolean),
      '',
      'Open Admin > Enquiries to update lead status, notes, and follow-up dates.',
    ].join('\n\n');
    const html = `
      <h2>Beyond RV lead reminders for today</h2>
      ${sections.map(([title, items]) => htmlSection(title, items)).join('')}
      <p>Open Admin &gt; Enquiries to update lead status, notes, and follow-up dates.</p>
    `;

    const result = await sendSummaryEmail(text, html);
    await logStore.setJSON(logKey(date), {
      date,
      status: result.sent ? 'sent' : 'failed',
      reason: result.reason ?? '',
      total: summary.total,
      createdAt: new Date().toISOString(),
    });

    if (!result.sent) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: result.reason }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, sent: true, total: summary.total }),
    };
  } catch (error) {
    console.warn('admin-daily-lead-summary: failed', {
      blobRuntimeSource,
      error: safeLeadReminderError(error),
    });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Daily lead summary failed. Check function logs.' }),
    };
  }
};
