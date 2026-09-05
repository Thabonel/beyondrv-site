/**
 * The company on one timeline, laid out the way Google Calendar is so nobody
 * needs telling how it works.
 *
 * Two kinds of event share the grid. Record-owned dates (visits, handovers,
 * arrivals, follow-ups, tasks, container ETAs) are projected from the records
 * that hold them, and dragging one writes the new date back onto that record.
 * The calendar's own events (meetings, reminders, and what the AI read in the
 * mailbox) live in their own store. The grid does not care which is which; the
 * write path does.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, DatesSetArg, EventChangeArg, EventClickArg, EventContentArg, DayHeaderContentArg } from '@fullcalendar/core';
import CalendarTopBar from './calendar/CalendarTopBar';
import CalendarSidebar from './calendar/CalendarSidebar';
import EventDetail, { type StoredDetail } from './calendar/EventDetail';
import EventForm, { type CrewOption, type EventFormValues, type OrderOption } from './calendar/EventForm';
import Popover from './calendar/Popover';
import Snackbar, { type SnackbarState } from './calendar/Snackbar';
import {
  addDays,
  EVENT_KIND_META,
  formatTime,
  isTypingTarget,
  loadHiddenKinds,
  matchesSearch,
  MOVABLE_RECORD_KINDS,
  ORDER_DATE_KINDS,
  parseWall,
  PHONE_QUERY,
  rectAt,
  rectOf,
  saveHiddenKinds,
  toDay,
  toWall,
  toWallTime,
  WIDE_QUERY,
  type AdminCalendarEvent,
  type AnchorRect,
  type CalendarEventKind,
  type CalendarView,
} from './calendar/calendar-model';

export interface WriteResult { message?: string; warning?: string }

export interface CalendarActions {
  createStoreEvent: (body: Record<string, unknown>) => Promise<WriteResult>;
  updateStoreEvent: (id: string, body: Record<string, unknown>) => Promise<WriteResult>;
  deleteStoreEvent: (id: string) => Promise<WriteResult>;
  moveRecord: (kind: string, recordId: string, date: string, time: string) => Promise<WriteResult>;
  createTask: (title: string, date: string, time: string, assigneeIds: string[]) => Promise<WriteResult>;
  assign: (kind: string, recordId: string, eventId: string, assigneeIds: string[]) => Promise<WriteResult>;
  loadOrders: () => Promise<OrderOption[]>;
  crew: CrewOption[];
  refresh: () => Promise<void>;
}

interface Props {
  events: AdminCalendarEvent[];
  storedDetails: Record<string, StoredDetail>;
  clashes?: string[];
  loading?: boolean;
  error?: string;
  actions: CalendarActions;
}

/** Monday to Saturday, 8 til 5. Sunday is handled by the shaded band below. */
const BUSINESS_HOURS = [{ daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '08:00', endTime: '17:00' }];

/**
 * Lunch is shaded. Sunday is not closed: the company works and receives
 * customers when it is needed, so its hours are tinted as available by
 * arrangement rather than dimmed like a day nobody works.
 */
const BACKGROUND_BANDS = [
  { daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '12:00', endTime: '13:00', display: 'background', color: '#eceff1', classNames: ['gcal-band-lunch'] },
  { daysOfWeek: [0], startTime: '08:00', endTime: '17:00', display: 'background', color: '#e8f5e9', classNames: ['gcal-band-sunday'] },
];

function fcViewFor(view: CalendarView, phone: boolean) {
  if (view === 'day') return 'timeGridDay';
  if (view === 'week') return phone ? 'timeGridThreeDay' : 'timeGridWeek';
  if (view === 'month') return 'dayGridMonth';
  return 'listMonth';
}

function nextWholeHour(now: Date) {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  const hour = date.getHours();
  if (hour < 8 || hour >= 17) date.setHours(8, 0, 0, 0);
  return date;
}

function emptyForm(date: string, startTime = '', endTime = ''): EventFormValues {
  return { title: '', kind: 'meeting', date, startTime, endTime, allDay: !startTime, notes: '', orderId: '', assigneeIds: [] };
}

function formFromEvent(event: AdminCalendarEvent, stored?: StoredDetail): EventFormValues {
  return {
    title: event.title,
    kind: event.kind,
    date: event.date,
    startTime: event.allDay ? '' : event.start.slice(11),
    endTime: event.allDay ? '' : event.end.slice(11),
    allDay: event.allDay,
    notes: stored?.notes ?? '',
    orderId: '',
    assigneeIds: event.assigneeIds ?? [],
  };
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

type FormState = { mode: 'create' | 'edit'; anchor: AnchorRect; values: EventFormValues; event?: AdminCalendarEvent | null };
type DetailState = { event: AdminCalendarEvent; anchor: AnchorRect };

export default function AdminCalendar({ events, storedDetails, clashes = [], loading, error, actions }: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const today = toDay(new Date());

  // The GM works on a folding phone: roughly 340px folded, roughly double that
  // open, and it changes while the app is running. The layout follows the width
  // until the GM picks a view, after which their choice sticks.
  const [phone, setPhone] = useState(false);
  const [wide, setWide] = useState(true);
  const [chosenView, setChosenView] = useState<CalendarView | null>(null);
  const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
  const view: CalendarView = chosenView ?? (phone ? 'schedule' : 'week');
  const sidebarOpen = sidebarChoice ?? wide;

  const [title, setTitle] = useState('');
  const [cursor, setCursor] = useState(today);
  const [hidden, setHidden] = useState<Set<CalendarEventKind>>(new Set());
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [snack, setSnack] = useState<SnackbarState | null>(null);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [clashesOpen, setClashesOpen] = useState(true);

  useEffect(() => {
    setHidden(loadHiddenKinds());
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const phoneQuery = window.matchMedia(PHONE_QUERY);
    const wideQuery = window.matchMedia(WIDE_QUERY);
    const sync = () => { setPhone(phoneQuery.matches); setWide(wideQuery.matches); };
    sync();
    // addEventListener over addListener: the fold fires this mid-session.
    phoneQuery.addEventListener('change', sync);
    wideQuery.addEventListener('change', sync);
    return () => { phoneQuery.removeEventListener('change', sync); wideQuery.removeEventListener('change', sync); };
  }, []);

  const api = () => calendarRef.current?.getApi();

  useEffect(() => {
    const calendar = api();
    if (!calendar) return;
    const target = fcViewFor(view, phone);
    if (calendar.view.type !== target) calendar.changeView(target);
    // Re-measure after a fold changes the width or the sidebar toggles.
    window.setTimeout(() => api()?.updateSize(), 0);
  }, [view, phone, sidebarOpen]);

  const visible = useMemo(
    () => events.filter((event) => !hidden.has(event.kind)),
    [events, hidden],
  );

  const searchResults = useMemo(
    () => (search.trim() ? events.filter((event) => matchesSearch(event, search)) : []),
    [events, search],
  );

  const counts = useMemo(() => {
    const map = new Map<CalendarEventKind, number>();
    for (const event of events) map.set(event.kind, (map.get(event.kind) ?? 0) + 1);
    return map;
  }, [events]);

  const fcEvents = useMemo(() => visible.map((event) => {
    const isStore = event.recordType === 'calendar';
    const colour = EVENT_KIND_META[event.kind].colour;
    // FullCalendar's all-day end is exclusive, so a one-day event has no end
    // and a multi-day event ends the day after its last day.
    const end = event.allDay ? (event.end !== event.start ? addDays(event.end, 1) : undefined) : event.end;
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end,
      allDay: event.allDay,
      backgroundColor: colour,
      borderColor: colour,
      textColor: '#fff',
      editable: isStore || MOVABLE_RECORD_KINDS.has(event.kind),
      durationEditable: isStore,
      classNames: [`gcal-kind-${event.kind}`, event.source === 'ai' ? 'gcal-ai' : '', event.isCommitment ? 'gcal-commit' : ''].filter(Boolean),
      extendedProps: { original: event },
    };
  }), [visible]);

  const fcSources = useMemo(() => [...fcEvents, ...BACKGROUND_BANDS], [fcEvents]);

  const closeSnack = useCallback(() => setSnack(null), []);
  const closeForm = useCallback(() => setForm(null), []);
  const closeDetail = useCallback(() => setDetail(null), []);

  function toggleKind(kind: CalendarEventKind) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      saveHiddenKinds(next);
      return next;
    });
  }

  function goto(day: string) {
    api()?.gotoDate(day);
    setCursor(day);
  }

  async function loadOrders() {
    if (orders.length) return;
    try { setOrders(await actions.loadOrders()); } catch (err) {
      setSnack({ message: err instanceof Error ? err.message : 'Could not load orders.', tone: 'error' });
    }
  }

  function openCreate(anchor: AnchorRect, date: string, startTime = '', endTime = '') {
    setDetail(null);
    setForm({ mode: 'create', anchor, values: emptyForm(date, startTime, endTime) });
  }

  function createFromButton() {
    const start = nextWholeHour(new Date());
    const end = new Date(start.getTime() + 3_600_000);
    const anchor = rectOf(document.querySelector('[data-testid="calendar-create"]')) ?? rectAt(window.innerWidth / 2, 120);
    openCreate(anchor, toDay(start), toWallTime(start), toWallTime(end));
  }

  /** A click or drag on empty grid opens quick-create for that slot. */
  function handleSelect(info: DateSelectArg) {
    const anchor = info.jsEvent ? rectAt(info.jsEvent.clientX, info.jsEvent.clientY) : rectAt(window.innerWidth / 2, 200);
    if (info.allDay) {
      openCreate(anchor, toDay(info.start));
    } else {
      // A bare click selects one 15-minute slot; a meeting is an hour by default.
      const end = info.end.getTime() - info.start.getTime() <= 15 * 60_000
        ? new Date(info.start.getTime() + 3_600_000)
        : info.end;
      openCreate(anchor, toDay(info.start), toWallTime(info.start), toWallTime(end));
    }
    api()?.unselect();
  }

  /** Google's touch: a double click on a day in Month opens that day. */
  function handleDateClick(info: { jsEvent: MouseEvent; date: Date }) {
    if (info.jsEvent.detail !== 2) return;
    setChosenView('day');
    goto(toDay(info.date));
  }

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.stopPropagation();
    const original = info.event.extendedProps.original as AdminCalendarEvent | undefined;
    if (!original) return;
    setForm(null);
    setDetail({ event: original, anchor: rectOf(info.el) ?? rectAt(info.jsEvent.clientX, info.jsEvent.clientY) });
  }

  async function writeMove(original: AdminCalendarEvent, start: Date, end: Date | null, allDay: boolean) {
    if (original.recordType === 'calendar') {
      const body = allDay
        ? { start: toDay(start), end: end ? addDays(toDay(end), -1) : toDay(start), allDay: true }
        : { start: toWall(start), end: end ? toWall(end) : '', allDay: false };
      return actions.updateStoreEvent(original.recordId, body);
    }
    return actions.moveRecord(original.kind, original.recordId, toDay(start), allDay ? '' : toWallTime(start));
  }

  /**
   * eventChange fires for a move and for a resize, so one path writes both.
   * A failed write reverts the drag: a grid showing a date the record does not
   * hold is worse than a move that failed loudly.
   */
  async function handleEventChange(info: EventChangeArg) {
    const original = info.event.extendedProps.original as AdminCalendarEvent | undefined;
    const start = info.event.start;
    if (!original || !start) { info.revert(); return; }
    if (original.recordType !== 'calendar' && !MOVABLE_RECORD_KINDS.has(original.kind)) {
      info.revert();
      setSnack({ message: 'A container ETA is changed in Products and deployed through Pending, not moved here.', tone: 'error' });
      return;
    }
    const previous = { start: info.oldEvent.start, end: info.oldEvent.end, allDay: info.oldEvent.allDay };
    try {
      const result = await writeMove(original, start, info.event.end, info.event.allDay);
      setSnack({
        message: [result.message ?? 'Moved.', result.warning].filter(Boolean).join(' '),
        undo: previous.start ? async () => {
          try {
            await writeMove(original, previous.start as Date, previous.end, previous.allDay);
            await actions.refresh();
          } catch (err) {
            setSnack({ message: err instanceof Error ? err.message : 'Could not undo.', tone: 'error' });
          }
        } : undefined,
      });
      await actions.refresh();
    } catch (err) {
      info.revert();
      setSnack({ message: err instanceof Error ? err.message : 'Could not move that.', tone: 'error' });
    }
  }

  async function submitForm(values: EventFormValues) {
    if (!form) return;
    const start = values.allDay ? values.date : `${values.date}T${values.startTime || '08:00'}`;
    const end = values.allDay ? values.date : values.endTime ? `${values.date}T${values.endTime}` : '';
    let result: WriteResult;

    if (form.mode === 'edit' && form.event) {
      if (form.event.recordType === 'calendar') {
        result = await actions.updateStoreEvent(form.event.recordId, { title: values.title, start, end, allDay: values.allDay, notes: values.notes });
      } else if (MOVABLE_RECORD_KINDS.has(form.event.kind)) {
        result = await actions.moveRecord(form.event.kind, form.event.recordId, values.date, values.allDay ? '' : values.startTime);
      } else {
        // A container ETA cannot move, but it can still be given to someone.
        result = { message: '' };
      }
      // Who is on it can change at the same time as when it is, and works for
      // every kind, including the ones whose date is set elsewhere.
      if (sameSet(values.assigneeIds, form.values.assigneeIds) === false) {
        const assigned = await actions.assign(form.event.kind, form.event.recordId, form.event.id, values.assigneeIds);
        result = { message: [result.message, assigned.message].filter(Boolean).join(' '), warning: result.warning };
      }
    } else if (values.kind === 'task') {
      result = await actions.createTask(values.title, values.date, values.allDay ? '' : values.startTime, values.assigneeIds);
    } else if (ORDER_DATE_KINDS.has(values.kind)) {
      // A visit or a handover is a date on an order; write it there.
      result = await actions.moveRecord(values.kind, values.orderId, values.date, values.allDay ? '' : values.startTime);
    } else {
      result = await actions.createStoreEvent({ title: values.title, kind: values.kind, start, end, allDay: values.allDay, notes: values.notes, source: 'gm' });
    }
    setForm(null);
    setSnack({ message: [result.message ?? 'Saved.', result.warning].filter(Boolean).join(' ') });
    await actions.refresh();
  }

  async function deleteSelected() {
    if (!detail || detail.event.recordType !== 'calendar') return;
    const { event } = detail;
    setDetail(null);
    try {
      const result = await actions.deleteStoreEvent(event.recordId);
      setSnack({ message: result.message ?? 'Removed.' });
      await actions.refresh();
    } catch (err) {
      setSnack({ message: err instanceof Error ? err.message : 'Could not remove that.', tone: 'error' });
    }
  }

  function editSelected() {
    if (!detail) return;
    const stored = storedDetails[detail.event.recordId];
    setForm({ mode: 'edit', anchor: detail.anchor, values: formFromEvent(detail.event, stored), event: detail.event });
    setDetail(null);
  }

  // Google's keys: t today, d/w/m/a views, j/k move, c create, / search.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (form || detail) return;
      const key = event.key.toLowerCase();
      const views: Record<string, CalendarView> = { d: 'day', w: 'week', m: 'month', a: 'schedule' };
      if (views[key]) { setChosenView(views[key]); event.preventDefault(); return; }
      if (key === 't') { goto(today); event.preventDefault(); return; }
      if (key === 'j' || key === 'n') { api()?.next(); event.preventDefault(); return; }
      if (key === 'k' || key === 'p') { api()?.prev(); event.preventDefault(); return; }
      if (key === 'c') { createFromButton(); event.preventDefault(); return; }
      if (key === '/') { searchRef.current?.focus(); event.preventDefault(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, detail, today]);

  function handleDatesSet(info: DatesSetArg) {
    setTitle(info.view.title);
    // The mini month follows the middle of what is shown, so a week that
    // straddles two months highlights the month most of it is in.
    const middle = new Date((info.view.currentStart.getTime() + info.view.currentEnd.getTime()) / 2);
    setCursor(toDay(middle));
  }

  /** Google's column header: a small weekday over a large date, today circled. */
  function renderDayHeader(arg: DayHeaderContentArg) {
    if (arg.view.type === 'dayGridMonth' || arg.view.type.startsWith('list')) {
      return <span className="gcal-dow">{arg.text}</span>;
    }
    return (
      <span className={`gcal-dayhead${arg.isToday ? ' is-today' : ''}`}>
        <span className="gcal-dow">{arg.date.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
        <span className="gcal-dom">{arg.date.getDate()}</span>
      </span>
    );
  }

  function renderEvent(arg: EventContentArg) {
    const original = arg.event.extendedProps.original as AdminCalendarEvent | undefined;
    if (!original) return undefined;
    const time = !original.allDay && !arg.view.type.startsWith('list') ? formatTime(original.start.slice(11)) : '';
    const isMonth = arg.view.type === 'dayGridMonth';
    return (
      <span className="gcal-event">
        {original.isCommitment && <span className="gcal-event__dot" aria-hidden="true" />}
        {isMonth && time && <span className="gcal-event__time">{time}</span>}
        <span className="gcal-event__title">{original.title}</span>
        {!isMonth && time && <span className="gcal-event__time"> {time}</span>}
        {original.source === 'ai' && <span className="gcal-event__ai" title="Added by AI from the mailbox" aria-label="Added by AI">✦</span>}
      </span>
    );
  }

  return (
    <div className={`gcal${phone ? ' is-phone' : ''}${sidebarOpen ? ' has-sidebar' : ''}`} data-testid="admin-calendar">
      <CalendarTopBar
        title={title}
        view={view}
        search={search}
        loading={loading}
        searchRef={searchRef}
        onToggleSidebar={() => setSidebarChoice(!sidebarOpen)}
        onToday={() => goto(today)}
        onPrev={() => api()?.prev()}
        onNext={() => api()?.next()}
        onSearch={setSearch}
        onView={setChosenView}
        onRefresh={() => void actions.refresh()}
      />

      <div className="gcal-body">
        {sidebarOpen && (
          <>
            {phone && <div className="gcal-scrim" onClick={() => setSidebarChoice(false)} />}
            <CalendarSidebar
              month={cursor}
              selected={cursor}
              today={today}
              hidden={hidden}
              counts={counts}
              onCreate={createFromButton}
              onSelectDay={(day) => { goto(day); if (phone) setSidebarChoice(false); }}
              onToggleKind={toggleKind}
            />
          </>
        )}

        <main className="gcal-main">
          {error && <div className="gcal-banner is-error" role="alert">{error}</div>}
          {clashes.length > 0 && (
            <div className="gcal-banner is-warning" data-testid="calendar-clashes">
              <button type="button" className="gcal-banner__toggle" onClick={() => setClashesOpen((open) => !open)} aria-expanded={clashesOpen}>
                ⚠ {clashes.length} date{clashes.length === 1 ? '' : 's'} that disagree
              </button>
              {clashesOpen && clashes.map((clash) => <div key={clash} className="gcal-banner__row">{clash}</div>)}
            </div>
          )}

          {search.trim() ? (
            <div className="gcal-results" data-testid="calendar-results">
              {searchResults.length === 0 && <div className="gcal-muted" style={{ padding: '2rem', textAlign: 'center' }}>Nothing matches “{search}”.</div>}
              {searchResults.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="gcal-results__row"
                  onClick={(e) => setDetail({ event, anchor: rectOf(e.currentTarget) ?? rectAt(e.clientX, e.clientY) })}
                >
                  <span className="gcal-results__date">{parseWall(event.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="gcal-results__swatch" style={{ background: EVENT_KIND_META[event.kind].colour }} />
                  <span className="gcal-results__title">{event.title}</span>
                  <span className="gcal-muted">{event.allDay ? 'All day' : formatTime(event.start.slice(11))}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="gcal-grid" data-testid="calendar-grid">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView={fcViewFor(view, phone)}
                views={{
                  timeGridThreeDay: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3 days' },
                  listMonth: { listDayFormat: { weekday: 'short', day: 'numeric', month: 'short' }, listDaySideFormat: false },
                }}
                headerToolbar={false}
                events={fcSources}
                datesSet={handleDatesSet}
                eventClick={handleEventClick}
                eventChange={(info) => { void handleEventChange(info); }}
                dateClick={handleDateClick}
                select={handleSelect}
                dayHeaderContent={renderDayHeader}
                eventContent={renderEvent}
                editable
                selectable
                selectMirror
                dayMaxEvents={3}
                businessHours={BUSINESS_HOURS}
                height="100%"
                firstDay={1}
                noEventsText="Nothing scheduled in this period"
                allDaySlot
                allDayText="All day"
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                slotDuration="00:15:00"
                slotLabelInterval="01:00:00"
                slotLabelFormat={{ hour: 'numeric', meridiem: 'short' }}
                // A quarter before eight, so the 8am label sits fully inside
                // the scroller rather than clipped on its top edge.
                scrollTime="07:45:00"
                scrollTimeReset
                expandRows={false}
                stickyHeaderDates
                nowIndicator
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
                displayEventTime={false}
                eventDisplay="block"
                moreLinkClick="popover"
                longPressDelay={350}
              />
              {loading && !events.length && <div className="gcal-loading">Loading calendar…</div>}
            </div>
          )}
        </main>
      </div>

      {detail && (
        <Popover anchor={detail.anchor} onClose={closeDetail} label="Event details" width={420} testId="event-popover">
          <EventDetail
            event={detail.event}
            assigneeNames={(detail.event.assigneeIds ?? []).map((id) => actions.crew.find((person) => person.id === id)?.name ?? 'someone')}
            stored={storedDetails[detail.event.recordId]}
            onEdit={editSelected}
            onDelete={() => void deleteSelected()}
            onClose={closeDetail}
          />
        </Popover>
      )}

      {form && (
        <Popover anchor={form.anchor} onClose={closeForm} label={form.mode === 'edit' ? 'Edit event' : 'New event'} width={440} testId="event-form-popover">
          <EventForm
            mode={form.mode}
            initial={form.values}
            event={form.event}
            orders={orders}
            crew={actions.crew}
            onLoadOrders={() => void loadOrders()}
            onSubmit={submitForm}
            onCancel={closeForm}
          />
        </Popover>
      )}

      <Snackbar state={snack} onClose={closeSnack} />
    </div>
  );
}
