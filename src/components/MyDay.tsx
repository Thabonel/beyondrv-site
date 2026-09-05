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

interface Job {
  id: string; title: string; date: string; time: string; done: boolean; overdue: boolean;
  kind?: string; tickable?: boolean; withOthers?: boolean;
}
interface YardItem { kind: string; title: string; time: string }
interface ContainerOption { slug: string; title: string; publishedEta: string }

interface CrewPayload {
  scope: 'crew' | 'gm';
  name: string;
  today: string;
  date: string;
  jobs?: Job[];
  yard?: YardItem[];
  note?: string;
  containers?: ContainerOption[];
  calendar?: { events: unknown[]; clashes: string[] };
}

const YARD_LABEL: Record<string, string> = {
  task: 'Job',
  meeting: 'Meeting',
  reminder: 'Reminder',
  next_action: 'Next action',
  follow_up: 'Follow up',
  factory_order: 'Factory order',
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

interface CalendarEventLike {
  id: string; kind: string; date: string; start: string; end: string; allDay: boolean;
  title: string; detail: string; isCommitment: boolean; source: string;
}

/**
 * Alex's own phone view: the whole calendar for one day, read only. The full
 * grid belongs on a desktop; on a phone what is wanted is what is on today,
 * in order, which is what this is.
 */
function GmDay({ date, payload }: { date: string; payload: CrewPayload }) {
  const events = ((payload.calendar?.events ?? []) as CalendarEventLike[])
    .filter((event) => event.date === date)
    .sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
  const clashes = payload.calendar?.clashes ?? [];

  return (
    <>
      {clashes.length > 0 && (
        <section className="myday__section" data-testid="myday-clashes">
          <h2>Dates that disagree</h2>
          {clashes.map((clash) => <p key={clash} className="myday__clash">{clash}</p>)}
        </section>
      )}
      <section className="myday__section">
        <h2>On today</h2>
        {!events.length && <p className="myday__muted">Nothing on this day.</p>}
        <ul className="myday__yard">
          {events.map((event) => (
            <li key={event.id} data-testid="myday-gm-item">
              <span className="myday__dot" style={{ background: YARD_COLOUR[event.kind] ?? '#7986cb' }} />
              <span className="myday__yard-when">{event.allDay ? 'All day' : formatTime(event.start.slice(11))}</span>
              <span>
                <strong>{YARD_LABEL[event.kind] ?? event.kind.replace(/_/g, ' ')}</strong>
                <span className="myday__yard-title">{event.title}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
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
  const [reporting, setReporting] = useState(false);
  const [container, setContainer] = useState({ slug: '', date: '', note: '' });
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

  // A "whole calendar" link is Alex's own phone view. Without this it fell
  // through to the crew layout, which reads a jobs list a gm payload does not
  // have, and showed an empty day.
  if (payload?.scope === 'gm') {
    return (
      <main className="myday" data-testid="my-day">
        <header className="myday__head">
          <button type="button" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <div>
            <h1 data-testid="myday-date">{longDate(date)}</h1>
            <p className="myday__who">{payload.name} · whole calendar</p>
          </div>
          <button type="button" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>›</button>
        </header>
        {date !== payload.today && (
          <button type="button" className="myday__today" onClick={() => setDate(payload.today)}>Back to today</button>
        )}
        <GmDay date={date} payload={payload} />
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
        <h2>Your day</h2>
        {busy && !jobs.length && <p className="myday__muted">Loading…</p>}
        {!busy && !jobs.length && <p className="myday__muted">Nothing on for this day.</p>}
        <ul className="myday__jobs">
          {jobs.map((job) => (
            <li key={job.id} className={job.done ? 'is-done' : ''} data-testid="myday-job">
              {job.tickable === false ? (
                // A visit or a handover: theirs to turn up to, not theirs to
                // move, because the date lives on the customer's order.
                <span className="myday__dot myday__dot--job" style={{ background: YARD_COLOUR[job.kind ?? ''] ?? '#616161' }} aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  className="myday__tick"
                  aria-label={job.done ? `Put "${job.title}" back on the list` : `Tick off "${job.title}"`}
                  aria-pressed={job.done}
                  onClick={() => void write({ action: 'complete_task', taskId: job.id })}
                >
                  {job.done ? '✓' : ''}
                </button>
              )}
              <span className="myday__job-title">
                {job.tickable === false && <span className="myday__kind">{YARD_LABEL[job.kind ?? ''] ?? 'On'}</span>}
                {job.title}
                {job.overdue && <span className="myday__overdue">from {longDate(job.date)}</span>}
                {job.withOthers && <span className="myday__shared">with someone else</span>}
              </span>
              {job.time && <span className="myday__time">{formatTime(job.time)}</span>}
              {!job.done && job.tickable !== false && (
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

      {(payload?.containers?.length ?? 0) > 0 && (
        <section className="myday__section">
          <h2>Containers</h2>
          {reporting ? (
            <form
              className="myday__container"
              onSubmit={(e) => {
                e.preventDefault();
                if (!container.slug || !container.date) return;
                const body = { action: 'report_container', productSlug: container.slug, date: container.date, note: container.note };
                setReporting(false);
                setContainer({ slug: '', date: '', note: '' });
                void write(body);
              }}
            >
              <label>
                Which vehicle
                <select
                  value={container.slug}
                  onChange={(e) => setContainer((c) => ({ ...c, slug: e.target.value }))}
                  data-testid="container-vehicle"
                  required
                >
                  <option value="">Choose…</option>
                  {payload!.containers!.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.title}{item.publishedEta ? ` — currently ${item.publishedEta}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                When is it landing
                <input type="date" value={container.date} onChange={(e) => setContainer((c) => ({ ...c, date: e.target.value }))} data-testid="container-date" required />
              </label>
              <label>
                Who told you
                <input
                  value={container.note}
                  onChange={(e) => setContainer((c) => ({ ...c, note: e.target.value }))}
                  placeholder="the shipping line, the factory…"
                  data-testid="container-note"
                />
              </label>
              <div className="myday__container-actions">
                <button type="button" onClick={() => setReporting(false)}>Cancel</button>
                <button type="submit" data-testid="container-save">Tell Alex</button>
              </div>
            </form>
          ) : (
            <button type="button" className="myday__addbtn" onClick={() => setReporting(true)} data-testid="container-report">
              + A container is arriving
            </button>
          )}
          <p className="myday__muted">
            This tells Alex what you have been told. It does not change the website.
          </p>
        </section>
      )}

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
