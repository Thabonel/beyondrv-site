/**
 * What one key may see on one day.
 *
 * A crew member gets their own jobs and the shape of the day in the yard. A
 * gm key gets the whole calendar, because that is Alex's own phone link.
 */
import type { Handler } from '@netlify/functions';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { buildCalendarEvents, calendarClashes } from './calendar-events-core';
import { toAdminCalendarEvent, type CompanyCalendarEvent } from './calendar-store-core';
import { listCalendarEvents } from './admin-calendar-events';
import { crewJobsFor, DAY_NOTE_STORE, dayNoteKey, isIsoDate, toYardItems } from './crew-core';
import { authenticateCrew, json, refusal } from './crew-auth';
import { OWNER_COPILOT_TASK_STORE } from './owner-copilot-core';
import { listJsonStore } from './owner-copilot-store-utils';
import catalogue from './product-catalogue.json';

const ORDER_STORE = 'customer-orders';
const ENQUIRY_STORE = 'customer-enquiries';

function brisbaneToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  connectBlobStore(event);

  let auth;
  try {
    auth = await authenticateCrew(event);
  } catch (error) {
    console.warn('crew-day: could not check the key', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
  if (!auth.ok) return refusal(auth.statusCode);
  const { member } = auth;

  const today = brisbaneToday();
  const date = isIsoDate(event.queryStringParameters?.date) ? event.queryStringParameters!.date! : today;

  try {
    const [orders, enquiries, tasks, stored] = await Promise.all([
      listJsonStore(ORDER_STORE).catch(() => [] as Record<string, unknown>[]),
      listJsonStore(ENQUIRY_STORE).catch(() => [] as Record<string, unknown>[]),
      listJsonStore(OWNER_COPILOT_TASK_STORE).catch(() => [] as Record<string, unknown>[]),
      listCalendarEvents(addDays(date, -1), addDays(date, 1)).catch(() => [] as CompanyCalendarEvent[]),
    ]);
    const events = [
      ...buildCalendarEvents({ orders, enquiries, tasks, products: catalogue as unknown as Record<string, unknown>[] }),
      ...stored.map(toAdminCalendarEvent),
    ];

    if (member.scope === 'gm') {
      // Alex's own phone link: the calendar as the admin page builds it, for a
      // range rather than a day, so the week and month views have something to
      // draw.
      const wide = [
        ...buildCalendarEvents({ orders, enquiries, tasks, products: catalogue as unknown as Record<string, unknown>[] }),
        ...(await listCalendarEvents(addDays(date, -90), addDays(date, 400)).catch(() => [] as CompanyCalendarEvent[])).map(toAdminCalendarEvent),
      ];
      return json(200, {
        scope: 'gm',
        name: member.name,
        today,
        date,
        calendar: { events: wide, clashes: calendarClashes(wide) },
      });
    }

    let note = '';
    try {
      const record = await getBlobStore(DAY_NOTE_STORE).get(dayNoteKey(member.id, date), { type: 'json' }) as { note?: string } | null;
      note = typeof record?.note === 'string' ? record.note : '';
    } catch {
      note = '';
    }

    return json(200, {
      scope: 'crew',
      name: member.name,
      today,
      date,
      jobs: crewJobsFor(tasks, member.id, date, today),
      yard: toYardItems(events as unknown as Record<string, unknown>[], date),
      note,
    });
  } catch (error) {
    console.warn('crew-day: failed', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
