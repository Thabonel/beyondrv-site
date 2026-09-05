/**
 * The page Li and Oscar tap on their phone.
 *
 * There is no login and there is no admin here. The key arrives in the URL
 * fragment, gets cached, and goes back out in a header. Everything else is one
 * day: their jobs, what is happening in the yard, and a note.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './my-day.css';

const KEY_STORAGE = 'beyondrv.crew.key';
const DAY = '/.netlify/functions/crew-day';
const WRITE = '/.netlify/functions/crew-write';

interface Job { id: string; title: string; date: string; time: string; done: boolean; overdue: boolean }
interface YardItem { kind: string; title: string; time: string }

interface CrewPayload {
  scope: 'crew' | 'gm';
  name: string;
  today: string;
  date: string;
  jobs?: Job[];
  yard?: YardItem[];
  note?: string;
  calendar?: { events: unknown[]; clashes: string[] };
}

const YARD_LABEL: Record<string, string> = {
  customer_visit: 'Customer visiting',
  expected_handover: 'Handover',
  expected_arrival: 'Arriving',
  container_eta: 'Container due',
};

const YARD_COLOUR: Record<string, string> = {
  customer_visit: '#d50000',
  expected_handover: '#0b8043',
  expected_arrival: '#f6bf26',
  container_eta: '#f4511e',
};

/**
 * The key is in the fragment because a fragment is never sent to a server, so
 * it stays out of the access log. It is moved into storage and cleared from
 * the address bar on the way past; an installed home-screen app relaunches
 * with the fragment, so both routes work.
 */
function readKey(): string {
  let key = '';
  if (typeof window === 'undefined') return '';
  const fragment = window.location.hash.match(/(?:^#|&)k=([A-Za-z0-9_-]{43})/);
  if (fragment) {
    key = fragment[1];
    try {
      window.localStorage.setItem(KEY_STORAGE, key);
    } catch {
      // Private mode: the key lasts as long as the tab, which is enough.
    }
    // Not history.replaceState with an empty hash, which leaves a bare "#":
    // this restores a clean address without adding a history entry.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return key;
  }
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

function todayLocal() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDays(day: string, days: number) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function longDate(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(time: string) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

export default function MyDay() {
  const [key, setKey] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [payload, setPayload] = useState<CrewPayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newJob, setNewJob] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const noteSaved = useRef('');

  useEffect(() => { setKey(readKey()); }, []);

  const call = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), 'X-Crew-Key': key ?? '' },
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'That did not work.');
    return data;
  }, [key]);

  const load = useCallback(async (forDate: string) => {
    if (!key) return;
    setBusy(true);
    setError('');
    try {
      const data = await call(`${DAY}?date=${forDate}`) as unknown as CrewPayload;
      setPayload(data);
      // Only take the server's note when nothing has been typed since the last
      // save. A refresh triggered by ticking a job off must not wipe a note
      // someone is halfway through writing.
      const incoming = data.note ?? '';
      // Read the previous saved value before overwriting the ref: the state
      // updater runs later, and would otherwise compare against the new value
      // and conclude every field was dirty.
      const previouslySaved = noteSaved.current;
      noteSaved.current = incoming;
      setNote((current) => (current === previouslySaved ? incoming : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
      setPayload(null);
    } finally {
      setBusy(false);
    }
  }, [call, key]);

  useEffect(() => { if (key) void load(date); }, [key, date, load]);

  async function write(body: Record<string, unknown>) {
    try {
      const result = await call(WRITE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setStatus(typeof result.message === 'string' ? result.message : '');
      await load(date);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(''), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (key === null) return <div className="myday-loading">…</div>;

  if (!key || error) {
    return (
      <main className="myday myday--locked">
        <h1>Beyond RV</h1>
        <p>{error || 'This link is not working. Ask Alex to send you a new one.'}</p>
      </main>
    );
  }

  const isToday = date === (payload?.today ?? todayLocal());
  const jobs = payload?.jobs ?? [];
  const yard = payload?.yard ?? [];
  const open = jobs.filter((job) => !job.done);

  return (
    <main className="myday" data-testid="my-day">
      <header className="myday__head">
        <button type="button" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div>
          <h1 data-testid="myday-date">{longDate(date)}</h1>
          <p className="myday__who">{payload?.name ? `${payload.name} · ` : ''}{open.length} job{open.length === 1 ? '' : 's'} to do</p>
        </div>
        <button type="button" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>›</button>
      </header>
      {!isToday && (
        <button type="button" className="myday__today" onClick={() => setDate(payload?.today ?? todayLocal())}>Back to today</button>
      )}

      <section className="myday__section">
        <h2>Your jobs</h2>
        {busy && !jobs.length && <p className="myday__muted">Loading…</p>}
        {!busy && !jobs.length && <p className="myday__muted">Nothing on for this day.</p>}
        <ul className="myday__jobs">
          {jobs.map((job) => (
            <li key={job.id} className={job.done ? 'is-done' : ''} data-testid="myday-job">
              <button
                type="button"
                className="myday__tick"
                aria-label={job.done ? `Put "${job.title}" back on the list` : `Tick off "${job.title}"`}
                aria-pressed={job.done}
                onClick={() => void write({ action: 'complete_task', taskId: job.id })}
              >
                {job.done ? '✓' : ''}
              </button>
              <span className="myday__job-title">
                {job.title}
                {job.overdue && <span className="myday__overdue">from {longDate(job.date)}</span>}
              </span>
              {job.time && <span className="myday__time">{formatTime(job.time)}</span>}
              {!job.done && (
                <label className="myday__move">
                  <span className="myday__sr">Move "{job.title}" to another day</span>
                  <input
                    type="date"
                    value={job.date}
                    onChange={(e) => { if (e.target.value) void write({ action: 'move_task', taskId: job.id, date: e.target.value }); }}
                  />
                </label>
              )}
            </li>
          ))}
        </ul>

        {adding ? (
          <form
            className="myday__add"
            onSubmit={(e) => {
              e.preventDefault();
              const title = newJob.trim();
              if (!title) return;
              setNewJob('');
              setAdding(false);
              void write({ action: 'add_task', title, date });
            }}
          >
            <input
              autoFocus
              value={newJob}
              onChange={(e) => setNewJob(e.target.value)}
              placeholder="What needs doing?"
              aria-label="What needs doing?"
              data-testid="myday-new-job"
            />
            <button type="submit" data-testid="myday-add-save">Add</button>
            <button type="button" onClick={() => { setAdding(false); setNewJob(''); }}>Cancel</button>
          </form>
        ) : (
          <button type="button" className="myday__addbtn" onClick={() => setAdding(true)} data-testid="myday-add">+ Add a job</button>
        )}
      </section>

      <section className="myday__section">
        <h2>In the yard {isToday ? 'today' : 'that day'}</h2>
        {!yard.length && <p className="myday__muted">Nothing booked in.</p>}
        <ul className="myday__yard">
          {yard.map((item, index) => (
            <li key={`${item.kind}-${index}`} data-testid="myday-yard-item">
              <span className="myday__dot" style={{ background: YARD_COLOUR[item.kind] ?? '#616161' }} />
              <span className="myday__yard-when">{item.time ? formatTime(item.time) : 'All day'}</span>
              <span>
                <strong>{YARD_LABEL[item.kind] ?? 'On'}</strong>
                <span className="myday__yard-title">{item.title}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="myday__section">
        <h2>Note for this day</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (note !== noteSaved.current) { noteSaved.current = note; void write({ action: 'set_note', date, note }); } }}
          placeholder="Anything Alex should know"
          aria-label="Note for this day"
          rows={2}
          data-testid="myday-note"
        />
      </section>

      {status && <div className="myday__status" role="status" data-testid="myday-status">{status}</div>}
    </main>
  );
}
