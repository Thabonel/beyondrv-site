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
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';

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

/** Monday to Saturday, 8 til 5. Sunday is handled separately below. */
const BUSINESS_HOURS = [{ daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '08:00', endTime: '17:00' }];

/**
 * Two shaded bands, drawn as background events.
 *
 * Lunch is midday to one, Monday to Saturday. Sunday is not closed: the company
 * works and receives customers when it is needed, so it is shaded as available
 * by arrangement rather than left dimmed like a day nobody works.
 */
const BACKGROUND_BANDS = [
  { daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '12:00', endTime: '13:00', display: 'background', color: '#e8eaed' },
  { daysOfWeek: [0], startTime: '08:00', endTime: '17:00', display: 'background', color: '#e6f4ea' },
];

type CalendarViewName = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listMonth';

/**
 * Week and day show the full working day as an hour grid. The dated records
 * themselves are all-day and sit in the row above the grid; the hours below are
 * the shape of the day, so the GM can see where a visit or a handover lands
 * against the hours the workshop is actually open.
 */
const VIEW_OPTIONS: ReadonlyArray<readonly [CalendarViewName, string]> = [
  ['dayGridMonth', 'Month'],
  ['timeGridWeek', 'Week'],
  ['timeGridDay', 'Day'],
  ['listMonth', 'List'],
];

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
  const [chosenView, setChosenView] = useState<CalendarViewName | null>(null);
  const view: CalendarViewName = chosenView ?? (wideScreen ? 'dayGridMonth' : 'listMonth');
  const setView = (next: CalendarViewName) => setChosenView(next);
  const [hidden, setHidden] = useState<Set<CalendarEventKind>>(new Set());
  const [selected, setSelected] = useState<AdminCalendarEvent | null>(null);
  const [status, setStatus] = useState('');

  // A container ETA lives on the product file and ships through Pending review,
  // so it cannot be written from a drag. Everything else owns its date directly.
  const MOVABLE = new Set<CalendarEventKind>([
    'customer_visit', 'expected_handover', 'expected_arrival',
    'factory_order', 'next_action', 'follow_up', 'task',
  ]);

  const visible = useMemo(
    () => events.filter((event) => !hidden.has(event.kind)),
    [events, hidden],
  );

  const fcEvents = useMemo(() => visible.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.date,
    allDay: true,
    backgroundColor: KIND_META[event.kind]?.colour ?? '#5f6368',
    borderColor: KIND_META[event.kind]?.colour ?? '#5f6368',
    textColor: '#fff',
    editable: MOVABLE.has(event.kind),
    extendedProps: { original: event },
  })), [visible]);

  const fcEventSources = useMemo(() => [...fcEvents, ...BACKGROUND_BANDS], [fcEvents]);
  const isTimeGrid = view === 'timeGridWeek' || view === 'timeGridDay';

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

  async function write(payload: Record<string, unknown>) {
    const response = await fetch('/.netlify/functions/admin-calendar-write', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Save failed (${response.status})`);
    return data as { message?: string; warning?: string };
  }

  /** Dragging an event moves the date on the record that owns it. */
  async function handleEventDrop(info: EventDropArg) {
    const original = info.event.extendedProps.original as AdminCalendarEvent | undefined;
    const date = info.event.startStr?.slice(0, 10);
    if (!original || !date) { info.revert(); return; }
    if (!MOVABLE.has(original.kind)) {
      info.revert();
      setStatus('A container ETA is changed in Products and deployed through Pending, not moved here.');
      return;
    }
    try {
      const result = await write({ kind: original.kind, recordId: original.recordId, date });
      setStatus([result.message, result.warning].filter(Boolean).join(' '));
      onRefresh?.();
    } catch (err) {
      // Put it back where it was: a half-saved calendar is worse than no move.
      info.revert();
      setStatus(err instanceof Error ? err.message : 'Could not move that date.');
    }
  }

  /** Dragging empty space creates a task, the one thing a day genuinely creates. */
  async function handleSelect(info: DateSelectArg) {
    const date = info.startStr.slice(0, 10);
    const title = window.prompt(`New task for ${date}`)?.trim();
    calendarRef.current?.getApi()?.unselect();
    if (!title) return;
    try {
      const result = await write({ action: 'create_task', title, date });
      setStatus(result.message ?? 'Task created.');
      onRefresh?.();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not create that task.');
    }
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
    <div
      data-testid="admin-calendar"
      className="admin-calendar-sheet"
      style={{ background: '#fff', borderRadius: '12px', display: 'grid', gap: '0.7rem', padding: '1rem' }}
    >
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#202124', fontSize: '1.05rem', fontWeight: 700 }}>Company Calendar</div>
          <div style={{ color: '#5f6368', fontSize: '0.76rem', marginTop: '0.18rem' }}>
            Every dated commitment in one place: visits, containers, handovers, follow-ups and tasks
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {VIEW_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              style={{
                background: view === value ? '#E8540A' : '#fff',
                border: `1px solid ${view === value ? '#E8540A' : '#dadce0'}`, borderRadius: '6px',
                color: view === value ? '#fff' : '#3c4043',
                cursor: 'pointer', fontSize: '0.74rem', padding: '0.35rem 0.7rem',
              }}
            >{label}</button>
          ))}
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: '6px', color: '#3c4043', cursor: 'pointer', fontSize: '0.74rem', padding: '0.35rem 0.7rem' }}
            >Refresh</button>
          )}
        </div>
      </div>

      {clashes.length > 0 && (
        <div data-testid="calendar-clashes" style={{ background: '#fce8e6', border: '1px solid #d93025', borderRadius: '8px', padding: '0.7rem 0.85rem' }}>
          <div style={{ color: '#c5221f', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Dates that disagree
          </div>
          {clashes.map((clash) => (
            <div key={clash} style={{ color: '#3c4043', fontSize: '0.78rem', marginTop: '0.25rem' }}>{clash}</div>
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
                alignItems: 'center', background: on ? KIND_META[kind].colour : '#fff',
                border: `1px solid ${on ? KIND_META[kind].colour : '#dadce0'}`,
                borderRadius: '999px', color: on ? '#fff' : '#5f6368', cursor: 'pointer',
                display: 'flex', fontSize: '0.68rem', gap: '0.35rem', padding: '0.2rem 0.6rem',
              }}
            >
              <span style={{ background: on ? '#fff' : KIND_META[kind].colour, borderRadius: '50%', display: 'inline-block', height: '7px', opacity: on ? 0.9 : 0.6, width: '7px' }} />
              {KIND_META[kind].label}
              <span style={{ opacity: 0.75 }}>{counts.get(kind) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {error && <div style={{ color: '#d93025', fontSize: '0.8rem' }}>{error}</div>}
      {status && (
        <div data-testid="calendar-status" style={{ background: '#e8f0fe', border: '1px solid #d2e3fc', borderRadius: '6px', color: '#174ea6', fontSize: '0.76rem', padding: '0.5rem 0.7rem' }}>
          {status}
        </div>
      )}
      {loading && !events.length && <div style={{ color: '#5f6368', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>Loading calendar...</div>}

      <div className="admin-calendar-surface" style={{ background: '#fff' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={wideScreen
            ? { left: 'prev,next today', center: 'title', right: '' }
            : { left: 'prev,next', center: 'title', right: '' }}
          events={fcEventSources}
          eventClick={handleEventClick}
          editable
          selectable
          selectMirror
          eventDrop={(info) => { void handleEventDrop(info); }}
          select={(info) => { void handleSelect(info); }}
          dayMaxEvents={wideScreen ? 4 : 2}
          height="auto"
          firstDay={1}
          noEventsText="Nothing scheduled in this period"
          eventDisplay="block"
          businessHours={BUSINESS_HOURS}
          // The whole 24 hours exist, because a ship clears at 3am and a handover
          // can run late. The view opens on the working day and scrolls to the
          // rest, rather than pretending the other hours are not there.
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
          allDaySlot
          allDayText="All day"
          nowIndicator
          // Month and list size to their content. The hour grid gets a fixed
          // height instead, because that is what makes it scroll: at "auto" it
          // would render all 24 hours down the page and never scroll at all.
          height={isTimeGrid ? (wideScreen ? 640 : 460) : 'auto'}
        />
      </div>

      <div style={{ color: '#5f6368', display: 'flex', flexWrap: 'wrap', fontSize: '0.68rem', gap: '0.9rem' }}>
        <span><span style={{ background: '#fff', border: '1px solid #dadce0', display: 'inline-block', height: '9px', marginRight: '0.3rem', verticalAlign: '-1px', width: '14px' }} />Open 8am–5pm, Monday to Saturday</span>
        <span><span style={{ background: '#e8eaed', display: 'inline-block', height: '9px', marginRight: '0.3rem', verticalAlign: '-1px', width: '14px' }} />Lunch 12–1</span>
        <span><span style={{ background: '#e6f4ea', display: 'inline-block', height: '9px', marginRight: '0.3rem', verticalAlign: '-1px', width: '14px' }} />Sunday, by arrangement</span>
        <span>Week and day open at 8am; scroll for the rest of the 24 hours.</span>
      </div>

      {selected && (
        <div style={{ background: '#f8f9fa', borderLeft: `4px solid ${KIND_META[selected.kind].colour}`, border: '1px solid #dadce0', borderRadius: '8px', padding: '0.8rem 0.9rem' }}>
          <div style={{ alignItems: 'start', display: 'flex', gap: '0.6rem', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: KIND_META[selected.kind].colour, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {KIND_META[selected.kind].label}{selected.isCommitment ? ' · commitment to a customer' : ''}
              </div>
              <div style={{ color: '#202124', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem' }}>{selected.title}</div>
              <div style={{ color: '#5f6368', fontSize: '0.78rem', marginTop: '0.2rem' }}>{selected.date}{selected.detail ? ` · ${selected.detail}` : ''}</div>
              <div style={{ color: '#80868b', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                Change this date on the {selected.recordType} it belongs to: {selected.recordId}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: '6px', color: '#5f6368', cursor: 'pointer', fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
