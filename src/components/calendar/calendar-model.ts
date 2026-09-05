/**
 * Client-side vocabulary for the calendar. The event shape, kinds and colours
 * come from the same pure modules the functions use, so the grid, the
 * assistant and the scheduled job never disagree about what a kind means.
 */
import {
  ALL_EVENT_KINDS,
  EVENT_KIND_META,
  type AdminCalendarEvent,
  type CalendarEventKind,
} from '../../../netlify/functions/calendar-events-core.ts';

export { ALL_EVENT_KINDS, EVENT_KIND_META };
export type { AdminCalendarEvent, CalendarEventKind };

export type CalendarView = 'day' | 'week' | 'month' | 'schedule';

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Day', week: 'Week', month: 'Month', schedule: 'Schedule',
};

export const VIEW_SHORTCUTS: Record<CalendarView, string> = { day: 'D', week: 'W', month: 'M', schedule: 'A' };

/** Kinds the GM can pick when creating from the grid. */
export const CREATABLE_KINDS: ReadonlyArray<{ value: 'meeting' | 'reminder' | 'task' | 'customer_visit'; label: string }> = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'task', label: 'Task' },
  { value: 'customer_visit', label: 'Customer visit' },
];

/** Record-owned kinds that can be dragged. Mirrors WRITE_TARGETS on the server. */
export const MOVABLE_RECORD_KINDS = new Set<CalendarEventKind>([
  'customer_visit', 'expected_handover', 'expected_arrival', 'factory_order', 'next_action', 'follow_up', 'task',
]);

/** Record-owned kinds that can hold a time of day. */
export const TIMED_RECORD_KINDS = new Set<CalendarEventKind>(['customer_visit', 'expected_handover', 'task']);

export const PHONE_QUERY = '(max-width: 619px)';
export const WIDE_QUERY = '(min-width: 900px)';

export const HIDDEN_KINDS_KEY = 'beyondrv.calendar.hiddenKinds';

const pad = (value: number) => String(value).padStart(2, '0');

export function toDay(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toWallTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toWall(date: Date) {
  return `${toDay(date)}T${toWallTime(date)}`;
}

/** Parses a wall-clock string as local time, which is how the grid draws it. */
export function parseWall(value: string) {
  const [day, time = '00:00'] = value.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export function addDays(day: string, days: number) {
  const date = parseWall(day);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

/** "10am", "2:30pm": Google's compact time. */
export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${pad(m)}${suffix}` : `${hour}${suffix}`;
}

export function formatWhen(event: Pick<AdminCalendarEvent, 'start' | 'end' | 'allDay' | 'date'>) {
  const day = parseWall(event.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  if (event.allDay) {
    if (event.end && event.end !== event.start) {
      const endDay = parseWall(event.end).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
      return `${day} – ${endDay}`;
    }
    return day;
  }
  return `${day} · ${formatTime(event.start.slice(11))} – ${formatTime(event.end.slice(11))}`;
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function loadHiddenKinds(): Set<CalendarEventKind> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KINDS_KEY);
    const list = raw ? JSON.parse(raw) as unknown : [];
    return new Set((Array.isArray(list) ? list : []).filter((kind): kind is CalendarEventKind => ALL_EVENT_KINDS.includes(kind as CalendarEventKind)));
  } catch {
    return new Set();
  }
}

export function saveHiddenKinds(kinds: Set<CalendarEventKind>) {
  try {
    window.localStorage.setItem(HIDDEN_KINDS_KEY, JSON.stringify([...kinds]));
  } catch {
    // Private mode or storage disabled: the choice lasts for the session only.
  }
}

/** Matches the search box against everything a person might remember about an event. */
export function matchesSearch(event: AdminCalendarEvent, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [event.title, event.detail, event.recordId, EVENT_KIND_META[event.kind].label]
    .some((field) => field.toLowerCase().includes(needle));
}

export interface AnchorRect { top: number; left: number; width: number; height: number }

export function rectOf(element: Element | null | undefined): AnchorRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function rectAt(x: number, y: number): AnchorRect {
  return { top: y, left: x, width: 1, height: 1 };
}
