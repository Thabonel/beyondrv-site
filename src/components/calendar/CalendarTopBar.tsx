/** Google's top bar: menu, wordmark, Today, arrows, the period, search, view. */
import React from 'react';
import { VIEW_LABELS, VIEW_SHORTCUTS, type CalendarView } from './calendar-model';

interface Props {
  title: string;
  view: CalendarView;
  search: string;
  loading?: boolean;
  onToggleSidebar: () => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSearch: (value: string) => void;
  onView: (view: CalendarView) => void;
  onRefresh: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export default function CalendarTopBar({ title, view, search, loading, onToggleSidebar, onToday, onPrev, onNext, onSearch, onView, onRefresh, searchRef }: Props) {
  return (
    <header className="gcal-topbar" data-testid="calendar-topbar">
      <button type="button" className="gcal-icon-btn" aria-label="Main menu" onClick={onToggleSidebar}>
        <span className="gcal-hamburger" aria-hidden="true"><i /><i /><i /></span>
      </button>
      <span className="gcal-wordmark">
        <span className="gcal-wordmark__logo" aria-hidden="true">{new Date().getDate()}</span>
        Calendar
      </span>
      <button type="button" className="gcal-btn" onClick={onToday} data-testid="calendar-today">Today</button>
      <span className="gcal-arrows">
        <button type="button" className="gcal-icon-btn" aria-label="Previous period" onClick={onPrev}>‹</button>
        <button type="button" className="gcal-icon-btn" aria-label="Next period" onClick={onNext}>›</button>
      </span>
      <h2 className="gcal-title" data-testid="calendar-title">{title}</h2>
      <span className="gcal-spacer" />
      <label className="gcal-search">
        <span aria-hidden="true">🔍</span>
        <input
          ref={searchRef}
          type="search"
          placeholder="Search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          aria-label="Search the calendar"
          data-testid="calendar-search"
        />
      </label>
      <button type="button" className="gcal-icon-btn" aria-label="Refresh" onClick={onRefresh} title="Refresh">
        <span className={loading ? 'gcal-spin' : ''} aria-hidden="true">↻</span>
      </button>
      <select
        className="gcal-view"
        value={view}
        onChange={(event) => onView(event.target.value as CalendarView)}
        aria-label="Calendar view"
        data-testid="calendar-view"
      >
        {(Object.keys(VIEW_LABELS) as CalendarView[]).map((value) => (
          <option key={value} value={value}>{VIEW_LABELS[value]}  ({VIEW_SHORTCUTS[value]})</option>
        ))}
      </select>
    </header>
  );
}
