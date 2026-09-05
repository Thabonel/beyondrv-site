import type { Page } from '@playwright/test';
import { emptyDashboard } from './dashboard-fixture';

/**
 * The calendar's two sources are mocked so the grid can be exercised without
 * functions: the dashboard supplies record-owned dates, admin-calendar-events
 * supplies the calendar's own store and remembers what the test creates.
 */

export function isoToday(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const today = isoToday();

const projected = [
  {
    id: 'customer_visit:o1', kind: 'customer_visit', date: today, start: `${today}T10:00`, end: `${today}T11:00`, allDay: false,
    title: 'Tasmanian customer visiting · Advent 2450', detail: 'Order status: in transit', recordType: 'order', recordId: 'o1',
    isCommitment: true, source: 'record', productSlug: 'advent-2450',
  },
  {
    id: 'container_eta:advent-2450', kind: 'container_eta', date: isoToday(5), start: isoToday(5), end: isoToday(5), allDay: true,
    title: 'Container ETA: Advent 2450', detail: 'Li says week 38', recordType: 'product', recordId: 'advent-2450',
    isCommitment: false, source: 'record', productSlug: 'advent-2450',
  },
];

export async function mockCalendar(page: Page) {
  const stored: Array<Record<string, unknown>> = [{
    id: 'cal-ai-1', title: 'Call with Li about the container', kind: 'meeting', start: `${today}T14:00`, end: `${today}T14:30`,
    allDay: false, notes: 'supplier proposed a call', location: '', source: 'ai',
    sourceEmail: { threadId: 't1', messageId: 'm1', subject: 'Shipping update', from: 'li@factory.cn', excerpt: 'Can we talk at 2pm?' },
    links: { productSlug: 'advent-2450' }, createdBy: 'gmail-calendar-sync', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  }];
  const writes: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];

  await page.route('**/.netlify/functions/admin-dashboard?range=90', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ...emptyDashboard, calendar: { events: projected, clashes: [] } }),
  }));
  await page.route('**/.netlify/functions/admin-calendar-events**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: stored }) });
      return;
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    writes.push({ method: request.method(), url: request.url(), body });
    if (request.method() === 'POST') {
      const event = { id: `cal-${stored.length + 1}`, notes: '', location: '', links: {}, assigneeIds: [], source: 'gm', createdBy: 'owner', createdAt: today, updatedAt: today, ...body };
      stored.push(event);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, event, message: `Saved "${String(body.title)}".` }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, message: 'Done.' }) });
  });
  await page.route('**/.netlify/functions/admin-crew', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ crew: [
      { id: 'crew-li', name: 'Li', scope: 'crew', keyIssuedAt: '', revokedAt: '', lastSeenAt: '' },
      { id: 'crew-oscar', name: 'Oscar', scope: 'crew', keyIssuedAt: '', revokedAt: '', lastSeenAt: '' },
      { id: 'crew-gone', name: 'Someone who left', scope: 'crew', keyIssuedAt: '', revokedAt: '2026-09-01T00:00:00.000Z', lastSeenAt: '' },
    ] }),
  }));
  await page.route('**/.netlify/functions/admin-orders', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ orders: [
      { id: 'o1', customerName: 'Tasmanian customer', productTitle: 'Advent 2450', status: 'in_transit' },
      { id: 'o2', customerName: 'Ben', productTitle: 'Sunpatch 15', status: 'ready_for_handover' },
    ] }),
  }));
  await page.route('**/.netlify/functions/admin-calendar-write', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push({ method: 'POST', url: route.request().url(), body });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, message: 'Moved customer visit.' }) });
  });
  return { writes, stored };
}

