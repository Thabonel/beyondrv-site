# Crew day view: product requirements

Status: approved 5 September 2026. Companion to
[COMPANY-CALENDAR-PRD.md](COMPANY-CALENDAR-PRD.md).

## Summary

Li and Oscar get an icon on their phone. They tap it and their jobs for today
are there. No login, no password, no admin. Alex gets the same icon for the
whole calendar.

## Why

The owners will not sign in to the site. They are willing to work; they are not
willing to keep an account. Every job the calendar knows about is therefore
invisible to the people doing it, and Alex relays it by phone.

The barrier is the login, not the site. So the login goes, and the thing that
replaces it is a link only that person has.

## Goals

1. One tap from a phone home screen to today's jobs. No credential, ever.
2. Li and Oscar can add a job, tick one off, move one, and leave a note.
3. They can see what is happening in the yard that day, so they know who is
   coming and what is landing.
4. Alex can add a person, send them their link, and revoke it, from the
   calendar.
5. Losing a phone costs one tap to fix, and affects one person.

## Non-goals

- Accounts, passwords, or a sign-in screen of any kind.
- Anything from admin beyond the day view: no prices, no contracts, no orders
  screen, no other people's jobs.
- Letting crew move a customer visit or a handover. Those are promises to a
  customer and stay with Alex.
- Push notifications and offline use. The page needs a connection.

## Users

| Person | Scope | What they get |
|---|---|---|
| Li, Oscar | `crew` | Their jobs for a day, the day's visits and arrivals read-only, add and complete their own jobs, a day note |
| Alex | `gm` | The whole calendar, editable, in a phone shell |

## Access

### The link

Alex adds a person in **Crew**. The site generates a key and shows the link
once:

```
https://beyondrv.com.au/my-day/#k=<43 characters, base64url of 32 random bytes>
```

**The key is in the fragment, deliberately.** Browsers never send the part
after `#` to the server, so the key never reaches Netlify's access logs, a
`Referer` header, or the CDN. Requests carry it in an `X-Crew-Key` header
instead. This is the single most important detail in the design; a key in the
path or the query string is written to a log the moment it is used.

**Only a hash of the key is stored** (SHA-256, verified in constant time). The
site cannot read a key back, so a leak of the blob store does not hand anyone a
working link. That means a lost link cannot be re-sent, only replaced, which is
the correct trade: **Reissue** takes one tap, kills the old link immediately,
and touches nobody else.

### Getting it onto the phone

Alex taps **Send to Li**, which opens their phone's SMS app with the link
already written (`sms:?&body=…`). On a desktop, **Copy link** instead.

Li opens it once and uses *Add to Home Screen* (iPhone: Share, then Add to Home
Screen; Android: the Chrome menu, then Install or Add to Home screen).

The page's manifest **omits `start_url`**, so the launch URL defaults to the
document URL, fragment included. That matters on iPhone, where a web app added
to the home screen gets its own storage container and cannot see anything the
Safari tab saved: the key has to travel in the URL or the installed icon opens
to nothing. The key is also cached in `localStorage` as a fallback for a launch
that arrives without a fragment. Standalone mode hides the address bar, so the
key is not on screen in normal use.

### Refusals

- No key, or an unknown key: a plain page saying to ask Alex for a new link.
  It never says whether a key merely expired or never existed.
- A revoked key: the same page.
- Ten bad keys from one address in five minutes: `429` for fifteen minutes,
  and an owner audit entry. A 43-character random key is not brute-forceable,
  but a lockout removes the argument.
- `<meta name="robots" content="noindex, nofollow, noarchive">` on the page.

## The day view

`/my-day/`, phone-shaped, no admin chrome.

```
┌─────────────────────────────┐
│  ‹   Friday 5 September  ›  │
│         [ Today ]           │
├─────────────────────────────┤
│  YOUR JOBS                  │
│  ○ Fit the Advent tray      │
│  ○ Chase the shipping agent │
│  ✓ Check the gas cert       │
│  + Add a job                │
├─────────────────────────────┤
│  IN THE YARD TODAY          │
│  10am  Tasmanian customer   │
│        visiting · Advent    │
│  ETA   Container: Sunpatch  │
├─────────────────────────────┤
│  NOTE FOR TODAY             │
│  [ waiting on parts       ] │
└─────────────────────────────┘
```

- **Your jobs**: open tasks whose `assigneeId` is this person, for that day,
  plus their overdue ones on today. Tapping one ticks it off; a date control
  moves it. Completed jobs stay visible for the day, struck through.
- **In the yard today**: customer visits, handovers, expected arrivals and
  container ETAs for that day, read-only. Titles and times only; no prices, no
  order status, no notes.
- **Add a job**: a title, and the day being viewed. It is created assigned to
  them, `source: 'crew'`.
- **Note for today**: one free-text note per person per day, saved on blur.
  Alex sees it on the calendar.

Alex's `gm` link renders the full calendar component instead, with the editing
the admin calendar has.

## Data

### Crew store

Blob store `calendar-crew`, key `crew/<id>.json`.

```ts
interface CrewMember {
  id: string;              // crew-<timestamp>-<random>
  name: string;            // 1 to 120 characters
  scope: 'crew' | 'gm';
  keyHash: string;         // SHA-256 of the key, hex
  keyIssuedAt: string;
  revokedAt: string;       // set, and the link is dead
  lastSeenAt: string;      // so Alex can see whether they use it
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### Day notes

Blob store `calendar-day-notes`, key `notes/<crewId>/<YYYY-MM-DD>.json`:
`{ crewId, date, note, updatedAt }`.

### Tasks

Tasks gain `assigneeId` (a crew id, or empty for Alex). `admin-owner-copilot-tasks`
and `admin-calendar-write` accept and preserve it. The task popover on the
calendar gains an assignee picker.

## Endpoints

| Function | Method | Purpose |
|---|---|---|
| `admin-crew` | GET, POST, PATCH, DELETE | Alex lists, adds, revokes and reissues people. `sales:write`, except GET on `sales:read`. POST and reissue return the key **once**. |
| `crew-day` | GET `?date=` | What this key may read for that date. `crew` scope returns their jobs and the day's yard items; `gm` returns the calendar payload. |
| `crew-write` | POST | `add_task`, `complete_task`, `move_task`, `set_note`. Every write is checked against the key's own id: a crew member can only touch a task assigned to them. |

Both crew endpoints read the key from `X-Crew-Key`, never from the URL.

## Files

```
netlify/functions/crew-core.ts        keys, hashing, scope rules, validation  (new, pure)
netlify/functions/admin-crew.ts       Alex manages people                     (new)
netlify/functions/crew-day.ts         the day payload                         (new)
netlify/functions/crew-write.ts       crew writes                             (new)
netlify/functions/admin-owner-copilot-tasks.ts   assigneeId                   (edit)
netlify/functions/admin-calendar-write.ts        assigneeId on create         (edit)
src/pages/my-day.astro                the page                                (new)
src/components/MyDay.tsx              the day view                            (new)
src/components/calendar/CrewPanel.tsx Alex's Crew section                     (new)
public/my-day.webmanifest             no start_url, by design                 (new)
tests/crew-core.test.ts               keys, scope, validation                 (new)
tests/e2e/crew-day.spec.ts            the phone flow                          (new)
```

## Tests

Core:

- A key is 43 base64url characters and two keys never collide.
- Verification is by hash; a wrong key of the right shape fails; a revoked
  member fails; the check does not short-circuit on the first differing byte.
- A crew member may complete and move only a task whose `assigneeId` is theirs;
  another's task and an unassigned one are refused.
- The `crew` day payload contains no price, order status, or customer contact
  field.
- Overdue jobs appear on today and not on a past day being browsed.

Browser, at 340px:

- With no key the page asks for a new link and shows nothing else.
- With a key, today's jobs render; ticking one posts `complete_task`; adding
  one posts `add_task` with the viewed date; ‹ › move the day.
- The yard section is read-only: no control can move a customer visit.
- The manifest has no `start_url`, so the installed icon keeps the fragment.

## Rollout

One branch from `main`, one PR. `/my-day/` sits outside `/admin`, so the edge
gate does not cover it; its own key check is the gate. Public catalogue numbers
(168 variants, 52 models) must not change.
