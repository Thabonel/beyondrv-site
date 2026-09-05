/**
 * The company on one timeline.
 *
 * Adapted from the FullCalendar wrapper in the wheels-wins project. Two things
 * changed for this business. Every date here is all-day: a container ETA, a
 * handover and a follow-up are days, not appointments, so the time grid and its
 * slot machinery are gone. And editing is off, because moving a date here has
 * to move it on the record that owns it, and each date type means something
 * different when it moves — a container ETA is a supplier's claim, a handover
 * is a promise to a customer. Until each of those has a rule, dragging would
 * quietly change commitments.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg } from '@fullcalendar/core';

export type CalendarEventKind =
  | 'customer_visit' | 'container_eta' | 'expected_arrival' | 'expected_handover'
  | 'factory_order' | 'next_action' | 'follow_up' | 'task';

export interface AdminCalendarEvent {
  id: string;
  kind: CalendarEventKind;
  date: string;
  title: string;
  detail: string;
  recordType: 'order' | 'enquiry' | 'task' | 'product';
  recordId: string;
  isCommitment: boolean;
}

const KIND_META: Record<CalendarEventKind, { label: string; colour: string }> = {
  customer_visit:    { label: 'Customer visit',   colour: '#f87171' },
  expected_handover: { label: 'Handover',         colour: '#4ade80' },
  container_eta:     { label: 'Container ETA',    colour: '#fb923c' },
  expected_arrival:  { label: 'Expected arrival', colour: '#fbbf24' },
  factory_order:     { label: 'Factory order',    colour: '#a78bfa' },
  next_action:       { label: 'Next action',      colour: '#60a5fa' },
  follow_up:         { label: 'Lead follow-up',   colour: '#38bdf8' },
  task:              { label: 'Task',             colour: '#c4a87a' },
};

const ALL_KINDS = Object.keys(KIND_META) as CalendarEventKind[];

interface Props {
  events: AdminCalendarEvent[];
  clashes?: string[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

export default function AdminCalendar({ events, clashes = [], loading, error, onRefresh }: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  // The GM works on a folding phone: roughly 340px folded, roughly double that
  // open, and it changes while the app is running. A month grid is unreadable
  // at 340px and fine at 700px, so the view follows the width until the GM
  // picks one, after which their choice sticks.
  const [wideScreen, setWideScreen] = useState(true);
  const [chosenView, setChosenView] = useState<'dayGridMonth' | 'listMonth' | null>(null);
  const view = chosenView ?? (wideScreen ? 'dayGridMonth' : 'listMonth');
  const setView = (next: 'dayGridMonth' | 'listMonth') => setChosenView(next);
  const [hidden, setHidden] = useState<Set<CalendarEventKind>>(new Set());
  const [selected, setSelected] = useState<AdminCalendarEvent | null>(null);

  const visible = useMemo(
    () => events.filter((event) => !hidden.has(event.kind)),
    [events, hidden],
  );

  const fcEvents = useMemo(() => visible.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.date,
    allDay: true,
    backgroundColor: 'transparent',
    borderColor: KIND_META[event.kind]?.colour ?? '#888',
    textColor: '#eee',
    extendedProps: { original: event },
  })), [visible]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 620px)');
    const sync = () => setWideScreen(query.matches);
    sync();
    // addEventListener over addListener: the fold fires this mid-session.
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    calendarRef.current?.getApi()?.changeView(view);
    // The month grid needs to re-measure after a fold changes the width.
    calendarRef.current?.getApi()?.updateSize();
  }, [view, wideScreen]);

  function toggleKind(kind: CalendarEventKind) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function handleEventClick(info: EventClickArg) {
    const original = info.event.extendedProps.original as AdminCalendarEvent | undefined;
    if (original) setSelected(original);
  }

  const counts = useMemo(() => {
    const map = new Map<CalendarEventKind, number>();
    for (const event of events) map.set(event.kind, (map.get(event.kind) ?? 0) + 1);
    return map;
  }, [events]);

  return (
    <div data-testid="admin-calendar" style={{ display: 'grid', gap: '0.7rem' }}>
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800 }}>Company Calendar</div>
          <div style={{ color: '#888', fontSize: '0.74rem', marginTop: '0.18rem' }}>
            Every dated commitment in one place: visits, containers, handovers, follow-ups and tasks
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {([['dayGridMonth', 'Month'], ['listMonth', 'List']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              style={{
                background: view === value ? '#E8540A' : '#1a1a1a',
                border: '1px solid #333', borderRadius: '6px',
                color: view === value ? '#fff' : '#aaa',
                cursor: 'pointer', fontSize: '0.74rem', padding: '0.35rem 0.7rem',
              }}
            >{label}</button>
          ))}
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#aaa', cursor: 'pointer', fontSize: '0.74rem', padding: '0.35rem 0.7rem' }}
            >Refresh</button>
          )}
        </div>
      </div>

      {clashes.length > 0 && (
        <div data-testid="calendar-clashes" style={{ background: '#3a1010', border: '1px solid #f87171', borderRadius: '8px', padding: '0.7rem 0.85rem' }}>
          <div style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Dates that disagree
          </div>
          {clashes.map((clash) => (
            <div key={clash} style={{ color: '#ddd', fontSize: '0.78rem', marginTop: '0.25rem' }}>{clash}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {ALL_KINDS.map((kind) => {
          const on = !hidden.has(kind);
          return (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              aria-pressed={on}
              style={{
                alignItems: 'center', background: on ? '#1f1f1f' : '#141414',
                border: `1px solid ${on ? KIND_META[kind].colour : '#333'}`,
                borderRadius: '999px', color: on ? '#eee' : '#666', cursor: 'pointer',
                display: 'flex', fontSize: '0.68rem', gap: '0.35rem', padding: '0.2rem 0.6rem',
              }}
            >
              <span style={{ background: KIND_META[kind].colour, borderRadius: '50%', display: 'inline-block', height: '7px', opacity: on ? 1 : 0.35, width: '7px' }} />
              {KIND_META[kind].label}
              <span style={{ color: '#777' }}>{counts.get(kind) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</div>}
      {loading && !events.length && <div style={{ color: '#777', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>Loading calendar...</div>}

      <div className="admin-calendar-surface" style={{ background: '#111', border: '1px solid #262626', borderRadius: '10px', padding: '0.6rem' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={wideScreen
            ? { left: 'prev,next today', center: 'title', right: '' }
            : { left: 'prev,next', center: 'title', right: '' }}
          events={fcEvents}
          eventClick={handleEventClick}
          editable={false}
          selectable={false}
          dayMaxEvents={wideScreen ? 4 : 2}
          height="auto"
          firstDay={1}
          noEventsText="Nothing scheduled in this period"
          eventDisplay="block"
        />
      </div>

      {selected && (
        <div style={{ background: '#151515', border: `1px solid ${KIND_META[selected.kind].colour}`, borderRadius: '8px', padding: '0.8rem 0.9rem' }}>
          <div style={{ alignItems: 'start', display: 'flex', gap: '0.6rem', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: KIND_META[selected.kind].colour, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {KIND_META[selected.kind].label}{selected.isCommitment ? ' · commitment to a customer' : ''}
              </div>
              <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem' }}>{selected.title}</div>
              <div style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.2rem' }}>{selected.date}{selected.detail ? ` · ${selected.detail}` : ''}</div>
              <div style={{ color: '#777', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                Change this date on the {selected.recordType} it belongs to: {selected.recordId}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'transparent', border: '1px solid #333', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
