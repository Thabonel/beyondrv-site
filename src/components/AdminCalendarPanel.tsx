/**
 * Loads the calendar from its two sources and owns every write.
 *
 * Record-owned dates come from the dashboard endpoint, which already reads
 * every record they are projected from, so the calendar cannot disagree with
 * the dashboard. The calendar's own events come from admin-calendar-events.
 * Clashes are computed over the merged list, so a container date the AI read
 * in an email is compared against a visit the same way a product's ETA is.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminCalendar, { type CalendarActions } from './AdminCalendar';
import type { StoredDetail } from './calendar/EventDetail';
import type { CrewOption, OrderOption } from './calendar/EventForm';
import { addDays, toDay, type AdminCalendarEvent } from './calendar/calendar-model';
import { calendarClashes, sortCalendarEvents } from '../../netlify/functions/calendar-events-core.ts';
import { toAdminCalendarEvent, type CompanyCalendarEvent } from '../../netlify/functions/calendar-store-core.ts';
import './admin-calendar.css';

const DASHBOARD = '/.netlify/functions/admin-dashboard?range=90';
const EVENTS = '/.netlify/functions/admin-calendar-events';
const WRITE = '/.netlify/functions/admin-calendar-write';
const ORDERS = '/.netlify/functions/admin-orders';
const CREW = '/.netlify/functions/admin-crew';

/**
 * Netlify Blobs guarantees a read of a key you just wrote, but a *listing* is
 * eventually consistent: the new blob may be missing from the next list call.
 * The calendar creates a thing then immediately re-lists, so without this the
 * new item silently fails to appear, and creating it again produces two.
 *
 * So a freshly written event is held here and merged into whatever the
 * listing returns, until the listing has caught up and can speak for itself.
 */
function mergePending(listed: CompanyCalendarEvent[], pending: CompanyCalendarEvent[]) {
  if (!pending.length) return listed;
  const seen = new Set(listed.map((event) => event.id));
  return [...listed, ...pending.filter((event) => !seen.has(event.id))];
}

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
  const pending = useRef<CompanyCalendarEvent[]>([]);
  const [crew, setCrew] = useState<CrewOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Who a job can be given to. A failure here is not worth an error banner:
  // the calendar still works, the picker just offers nobody.
  useEffect(() => {
    void call<{ crew?: Array<{ id: string; name: string; revokedAt: string }> }>(CREW)
      .then((data) => setCrew((data.crew ?? []).filter((person) => !person.revokedAt).map((person) => ({ id: person.id, name: person.name }))))
      .catch(() => setCrew([]));
  }, []);

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
      const listed = Array.isArray(events.value?.events) ? events.value.events! : [];
      setStored(mergePending(listed, pending.current));
      // Once the listing knows about it, stop holding it.
      const listedIds = new Set(listed.map((event) => event.id));
      pending.current = pending.current.filter((event) => !listedIds.has(event.id));
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
    createStoreEvent: async (body) => {
      const result = await call<{ message?: string; event?: CompanyCalendarEvent }>(EVENTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // Show it straight away rather than waiting for the listing to notice.
      if (result.event?.id) {
        pending.current = [...pending.current.filter((event) => event.id !== result.event!.id), result.event];
        setStored((current) => mergePending(current, [result.event!]));
      }
      return result;
    },
    updateStoreEvent: (id, body) => post(EVENTS, 'PATCH', { id, ...body }),
    deleteStoreEvent: (id) => post(EVENTS, 'DELETE', { id }),
    moveRecord: (kind, recordId, date, time) => post(WRITE, 'POST', { kind, recordId, date, time }),
    createTask: (title, date, time, assigneeIds) => post(WRITE, 'POST', { action: 'create_task', title, date, time, assigneeIds }),
    assign: (kind, recordId, eventId, assigneeIds) => post(WRITE, 'POST', { action: 'assign', kind, recordId, eventId, assigneeIds }),
    crew,
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
  }), [load, crew]);

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
