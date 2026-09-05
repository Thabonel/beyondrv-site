/**
 * Where Alex adds the people who will not log in, and sends them their link.
 *
 * A key exists in this component for exactly as long as the card is open. It
 * is never stored here and never fetched again: the server keeps only a hash,
 * so "send it again" is Reissue, not a lookup.
 */
import React, { useCallback, useEffect, useState } from 'react';

const CREW = '/.netlify/functions/admin-crew';

export interface CrewMemberView {
  id: string;
  name: string;
  scope: 'crew' | 'gm';
  keyIssuedAt: string;
  revokedAt: string;
  lastSeenAt: string;
}

interface Issued { id: string; name: string; link: string }

async function call(method: string, body?: Record<string, unknown>) {
  const response = await fetch(CREW, {
    method,
    credentials: 'same-origin',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Failed (${response.status})`);
  return data;
}

function linkFor(key: string) {
  const origin = typeof window === 'undefined' ? 'https://beyondrv.com.au' : window.location.origin;
  // The key goes after the hash so it is never sent to a server and never
  // lands in an access log.
  return `${origin}/my-day/#k=${key}`;
}

function whenSeen(value: string) {
  if (!value) return 'not opened yet';
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000);
  if (days <= 0) return 'opened today';
  if (days === 1) return 'opened yesterday';
  return `opened ${days} days ago`;
}

export default function CrewPanel() {
  const [crew, setCrew] = useState<CrewMemberView[]>([]);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'crew' | 'gm'>('crew');
  const [issued, setIssued] = useState<Issued | null>(null);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call('GET');
      setCrew(Array.isArray(data.crew) ? data.crew as CrewMemberView[] : []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load the list.');
    }
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  async function add(submit: React.FormEvent) {
    submit.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const data = await call('POST', { name: trimmed, scope });
      setName('');
      setIssued({ id: String((data.member as CrewMemberView).id), name: trimmed, link: linkFor(String(data.key)) });
      setStatus('');
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not add that person.');
    }
  }

  async function reissue(member: CrewMemberView) {
    if (!window.confirm(`Give ${member.name} a new link? Their current one stops working straight away.`)) return;
    try {
      const data = await call('PATCH', { id: member.id });
      setIssued({ id: member.id, name: member.name, link: linkFor(String(data.key)) });
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not make a new link.');
    }
  }

  async function revoke(member: CrewMemberView) {
    if (!window.confirm(`Stop ${member.name}'s link working? They will not be able to open their day.`)) return;
    try {
      const data = await call('DELETE', { id: member.id });
      setStatus(typeof data.message === 'string' ? data.message : '');
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not revoke that link.');
    }
  }

  return (
    <div className="gcal-crew" data-testid="crew-panel">
      <button type="button" className="gcal-crew__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="gcal-crew__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        Crew phone links{crew.length ? ` (${crew.filter((member) => !member.revokedAt).length})` : ''}
      </button>
      {!open && !crew.length && (
        <p className="gcal-crew__hint">Give someone their jobs on their phone, with no login.</p>
      )}

      {open && (
        <>
          {crew.map((member) => (
            <div key={member.id} className={`gcal-crew__row${member.revokedAt ? ' is-revoked' : ''}`} data-testid="crew-row">
              <div>
                <div className="gcal-crew__name">{member.name}{member.scope === 'gm' ? ' · whole calendar' : ''}</div>
                <div className="gcal-crew__meta">{member.revokedAt ? 'link revoked' : whenSeen(member.lastSeenAt)}</div>
              </div>
              <div className="gcal-crew__actions">
                <button type="button" onClick={() => void reissue(member)}>{member.revokedAt ? 'New link' : 'Reissue'}</button>
                {!member.revokedAt && <button type="button" onClick={() => void revoke(member)}>Revoke</button>}
              </div>
            </div>
          ))}

          <form className="gcal-crew__add" onSubmit={add}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Add a person"
              aria-label="Name"
              data-testid="crew-name"
            />
            <select value={scope} onChange={(event) => setScope(event.target.value as 'crew' | 'gm')} aria-label="What they see" data-testid="crew-scope">
              <option value="crew">Their jobs</option>
              <option value="gm">Whole calendar</option>
            </select>
            <button type="submit" data-testid="crew-add">Add</button>
          </form>

          {status && <div className="gcal-crew__status">{status}</div>}
        </>
      )}

      {issued && (
        <div className="gcal-crew__issued" role="dialog" aria-label={`Link for ${issued.name}`} data-testid="crew-issued">
          <div className="gcal-crew__issued-head">{issued.name}&rsquo;s link</div>
          <p>Send it now. It cannot be shown again — if it is lost, make a new one.</p>
          <code data-testid="crew-link">{issued.link}</code>
          <div className="gcal-crew__issued-actions">
            <a href={`sms:?&body=${encodeURIComponent(`Your Beyond RV day: ${issued.link}\n\nOpen it, then add it to your home screen.`)}`} data-testid="crew-sms">Text it</a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(issued.link).then(
                  () => setStatus('Link copied.'),
                  () => setStatus('Could not copy. Select the link above.'),
                );
              }}
            >Copy</button>
            <button type="button" onClick={() => setIssued(null)}>Done</button>
          </div>
          <p className="gcal-crew__how">
            On their phone: open the link, then <strong>Add to Home Screen</strong> —
            iPhone, the Share button; Android, the Chrome menu.
          </p>
        </div>
      )}
    </div>
  );
}
