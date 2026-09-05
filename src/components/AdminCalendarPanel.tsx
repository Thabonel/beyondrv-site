/**
 * Loads the calendar from its two sources and owns every write.
 *
 * Record-owned dates come from the dashboard endpoint, which already reads
 * every record they are projected from, so the calendar cannot disagree with
 * the dashboard. The calendar's own events come from admin-calendar-events.
 * Clashes are computed over the merged list, so a container date the AI read
 * in an email is compared against a visit the same way a product's ETA is.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCalendar, { type CalendarActions } from './AdminCalendar';
import type { StoredDetail } from './calendar/EventDetail';
import type { OrderOption } from './calendar/EventForm';
import { addDays, toDay, type AdminCalendarEvent } from './calendar/calendar-model';
import { calendarClashes, sortCalendarEvents } from '../../netlify/functions/calendar-events-core.ts';
import { toAdminCalendarEvent, type CompanyCalendarEvent } from '../../netlify/functions/calendar-store-core.ts';
import './admin-calendar.css';

const DASHBOARD = '/.netlify/functions/admin-dashboard?range=90';
const EVENTS = '/.netlify/functions/admin-calendar-events';
const WRITE = '/.netlify/functions/admin-calendar-write';
const ORDERS = '/.netlify/functions/admin-orders';

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

function post(url: string, method: string, body: Record<string, unknown>) {
  return call<{ message?: string; warning?: string }>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export default function AdminCalendarPanel() {
  const [projected, setProjected] = useState<AdminCalendarEvent[]>([]);
  const [stored, setStored] = useState<CompanyCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const today = toDay(new Date());
    const results = await Promise.allSettled([
      call<{ calendar?: { events?: AdminCalendarEvent[] } }>(DASHBOARD),
      call<{ events?: CompanyCalendarEvent[] }>(`${EVENTS}?from=${addDays(today, -90)}&to=${addDays(today, 400)}`),
    ]);
    const [dashboard, events] = results;
    if (dashboard.status === 'fulfilled') {
      setProjected(Array.isArray(dashboard.value?.calendar?.events) ? dashboard.value.calendar!.events! : []);
    }
    if (events.status === 'fulfilled') {
      setStored(Array.isArray(events.value?.events) ? events.value.events! : []);
    }
    // An empty calendar and a failed one look identical, so say which it is.
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length) setError(failures.map((failure) => failure.reason instanceof Error ? failure.reason.message : 'Could not load the calendar').join(' '));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const events = useMemo(
    () => sortCalendarEvents([...projected, ...stored.map(toAdminCalendarEvent)]),
    [projected, stored],
  );
  const clashes = useMemo(() => calendarClashes(events), [events]);
  const storedDetails = useMemo(() => {
    const map: Record<string, StoredDetail> = {};
    for (const event of stored) {
      map[event.id] = { notes: event.notes, location: event.location, sourceEmail: event.sourceEmail, links: event.links };
    }
    return map;
  }, [stored]);

  const actions = useMemo<CalendarActions>(() => ({
    createStoreEvent: (body) => post(EVENTS, 'POST', body),
    updateStoreEvent: (id, body) => post(EVENTS, 'PATCH', { id, ...body }),
    deleteStoreEvent: (id) => post(EVENTS, 'DELETE', { id }),
    moveRecord: (kind, recordId, date, time) => post(WRITE, 'POST', { kind, recordId, date, time }),
    createTask: (title, date, time) => post(WRITE, 'POST', { action: 'create_task', title, date, time }),
    loadOrders: async () => {
      const data = await call<{ orders?: Array<Record<string, unknown>> }>(ORDERS);
      return (data.orders ?? [])
        .filter((order) => typeof order.id === 'string')
        .map((order): OrderOption => ({
          id: order.id as string,
          label: [order.customerName, order.productTitle].filter(Boolean).join(' · ') || (order.id as string),
        }));
    },
    refresh: load,
  }), [load]);

  return (
    <AdminCalendar
      events={events}
      storedDetails={storedDetails}
      clashes={clashes}
      loading={loading}
      error={error}
      actions={actions}
    />
  );
}
