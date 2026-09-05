/** Create, the mini month, and the list of calendars, as Google lays them out. */
import React from 'react';
import MiniMonth from './MiniMonth';
import CrewPanel from './CrewPanel';
import { ALL_EVENT_KINDS, EVENT_KIND_META, type CalendarEventKind } from './calendar-model';

interface Props {
  month: string;
  selected: string;
  today: string;
  hidden: Set<CalendarEventKind>;
  counts: Map<CalendarEventKind, number>;
  onCreate: () => void;
  onSelectDay: (day: string) => void;
  onToggleKind: (kind: CalendarEventKind) => void;
}

export default function CalendarSidebar({ month, selected, today, hidden, counts, onCreate, onSelectDay, onToggleKind }: Props) {
  return (
    <aside className="gcal-sidebar" data-testid="calendar-sidebar">
      <button type="button" className="gcal-create" onClick={onCreate} data-testid="calendar-create">
        <span className="gcal-create__plus" aria-hidden="true">+</span> Create
      </button>
      <MiniMonth month={month} selected={selected} today={today} onSelect={onSelectDay} onMonthChange={onSelectDay} />
      <div className="gcal-calendars">
        <div className="gcal-calendars__title">My calendars</div>
        {ALL_EVENT_KINDS.map((kind) => {
          const on = !hidden.has(kind);
          const colour = EVENT_KIND_META[kind].colour;
          return (
            <label key={kind} className="gcal-calendars__row">
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggleKind(kind)}
                style={{ accentColor: colour }}
                aria-label={EVENT_KIND_META[kind].label}
              />
              <span className="gcal-calendars__swatch" style={{ background: on ? colour : 'transparent', borderColor: colour }} />
              <span className="gcal-calendars__label">{EVENT_KIND_META[kind].label}</span>
              <span className="gcal-calendars__count">{counts.get(kind) ?? 0}</span>
            </label>
          );
        })}
      </div>
      <CrewPanel />
      <div className="gcal-legend">
        <div><span className="gcal-legend__swatch" style={{ background: '#fff', border: '1px solid #dadce0' }} />Open 8am–5pm, Mon–Sat</div>
        <div><span className="gcal-legend__swatch" style={{ background: '#eceff1' }} />Lunch 12–1</div>
        <div><span className="gcal-legend__swatch" style={{ background: '#e8f5e9' }} />Sunday, by arrangement</div>
      </div>
    </aside>
  );
}
