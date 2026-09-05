/** The small month in the sidebar. Monday first, today filled, six rows always. */
import React from 'react';
import { addDays, parseWall, toDay } from './calendar-model';

interface Props {
  month: string;        // any day in the month to show, YYYY-MM-DD
  selected: string;     // YYYY-MM-DD
  today: string;
  onSelect: (day: string) => void;
  onMonthChange: (day: string) => void;
}

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MiniMonth({ month, selected, today, onSelect, onMonthChange }: Props) {
  const first = parseWall(month.slice(0, 7) + '-01');
  const title = first.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  // Monday-first offset: getDay() is 0 for Sunday.
  const offset = (first.getDay() + 6) % 7;
  const gridStart = addDays(toDay(first), -offset);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const thisMonth = month.slice(0, 7);

  function shift(months: number) {
    const next = new Date(first.getFullYear(), first.getMonth() + months, 1);
    onMonthChange(toDay(next));
  }

  return (
    <div className="gcal-mini" data-testid="mini-month">
      <div className="gcal-mini__head">
        <span className="gcal-mini__title">{title}</span>
        <span className="gcal-mini__nav">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)}>›</button>
        </span>
      </div>
      <div className="gcal-mini__grid">
        {DOW.map((label, index) => <div key={index} className="gcal-mini__dow">{label}</div>)}
        {days.map((day) => {
          const classes = ['gcal-mini__day'];
          if (!day.startsWith(thisMonth)) classes.push('is-outside');
          if (day === today) classes.push('is-today');
          if (day === selected) classes.push('is-selected');
          return (
            <button key={day} type="button" className={classes.join(' ')} onClick={() => onSelect(day)} aria-label={day}>
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
