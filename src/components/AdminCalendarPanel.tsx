/**
 * Loads the company calendar. The events come from the dashboard endpoint,
 * which already reads every record they are projected from, so this adds no new
 * data access and cannot disagree with what the dashboard shows.
 */
import React, { useCallback, useEffect, useState } from 'react';
import AdminCalendar, { type AdminCalendarEvent } from './AdminCalendar';
import './admin-calendar.css';

interface CalendarPayload {
  events: AdminCalendarEvent[];
  clashes: string[];
}

export default function AdminCalendarPanel() {
  const [payload, setPayload] = useState<CalendarPayload>({ events: [], clashes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/.netlify/functions/admin-dashboard?range=90', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Calendar unavailable (${response.status})`);
      const data = await response.json();
      const calendar = data?.calendar;
      setPayload({
        events: Array.isArray(calendar?.events) ? calendar.events : [],
        clashes: Array.isArray(calendar?.clashes) ? calendar.clashes : [],
      });
    } catch (err) {
      // An empty calendar and a failed one look identical, so say which it is.
      setError(err instanceof Error ? err.message : 'Could not load the calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AdminCalendar
      events={payload.events}
      clashes={payload.clashes}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    />
  );
}
