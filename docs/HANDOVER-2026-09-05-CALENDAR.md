# Handover: the calendar, 5 September 2026

Continues [HANDOVER-2026-09-05.md](HANDOVER-2026-09-05.md), which covers the
Netlify deploy failure, the vehicle data, and the state of the site generally.
This one covers only the calendar and the phone views, which is all that
changed since.

Repo `Thabonel/beyondrv-site`, production
[beyondrv.com.au](https://beyondrv.com.au).

---

## Read this first

**The working checkout is still stale.** `/Users/thabonel/Code/Byond_RV` sits on
`vehicle-selector-prefill`. Work from a `git worktree` created from
`origin/main`.

**`browsers` takes about 16 minutes and it earns it.** The Playwright job runs
five projects; `quality` finishes long before it. It has caught three real
defects in this work that local runs missed, so do not merge around it. Every
push restarts it.

**Run the browser tests with `TZ=UTC`.** CI runs in UTC, this machine is
Brisbane, and one bug only appeared outside business hours. `TZ=UTC npx
playwright test …` reproduces CI's clock.

**A link on someone's phone must never be built from `window.location.origin`.**
A deploy preview is a frozen build at its own address, and it shares the live
data store. A crew link generated while admin was open on a preview pinned that
phone to the preview for good: it authenticated, reported "opened today", and
accepted work — and never received another fix. Nothing looked broken from
either end. Crew links are now hard-coded to `https://beyondrv.com.au`. The
general rule: anything meant to outlive the session that created it takes the
canonical origin, not the current one.

**Netlify Blobs listings are eventually consistent.** A read of a key you just
wrote is reliable; a `list()` that should contain it is not. Anything that
writes then immediately re-lists will intermittently miss its own write. This
caused a real bug (below) and will cause more.

---

## Merged

| PR | What |
|---|---|
| #94 | The calendar rebuilt as Google Calendar, with the Gmail sync |
| #95 | Handovers from the calendar, and visits and handovers from email and call notes |
| #96 | Calendar · Dashboard · Enquiries · Analytics in the admin header |
| #97 | The phone day view for people who will not log in |
| #98 | Assign anyone, or several people, to anything; container reports from a phone |
| #99 | Assignees kept on create; the phone link fixes above |

Production after #97: `generatedAt` 06:0x, 168 published variants, 52 known
models, `/admin/` 302 unauthenticated. Unchanged, which is correct: everything
here is behind a gate.

---

## What exists now

### The calendar

Google Calendar's layout, in admin, first tab. Top bar with Today, arrows,
period, search and a Day/Week/Month/Schedule menu; a sidebar with **+ Create**,
a mini month, **Crew phone links**, and a checkbox per event kind; a fixed
grid that scrolls inside itself and opens at 8am.

Ten kinds. Six are projected from records that own their dates (orders,
enquiries, products); meetings and reminders live in the calendar's own store;
tasks are their own records.

**The rule the whole thing rests on: a date has one home.** Dragging an event
writes the new date onto the record that owns it. Nothing keeps a second copy.
A container ETA cannot be dragged, because it lives on the product content file
and reaches the site through Pending review.

### The Gmail sync

`google-gmail-calendar-sync` runs every 15 minutes. It reads unprocessed
messages from the existing Gmail thread store, asks a nano-tier model for dated
items against a strict schema, validates confidence and links against real
orders and products, de-duplicates, and writes. A visit or handover that names
its order is written **onto that order**; anything else becomes a calendar
event carrying the email it came from.

**It does nothing until the ByondRV mailbox is connected** in the Google tab.
That is still the main outstanding action.

### The phone views

`/my-day/`, no login. Alex adds a person under **Crew phone links**, the site
shows a link once, **Text it** opens the SMS app, they add it to their home
screen.

- **The key is in the URL fragment.** Browsers never send the part after `#` to
  a server, so it stays out of Netlify's access log, the `Referer` header and
  the CDN. Requests carry it in `X-Crew-Key`.
- **Only a hash is stored**, compared in constant time. A lost link is
  *replaced*, not re-sent: **Reissue** kills the old one instantly.
- **The manifest deliberately has no `start_url`**, so the launch URL defaults
  to the document URL with its fragment. On iPhone a home-screen web app has
  its own storage and cannot read what Safari cached; without this the icon
  opens to nothing. A test asserts it stays absent.
- **The key stays in the address bar until the app is installed.** *Add to Home
  Screen* captures the URL as it stands, so clearing the fragment on first load
  — which the page used to do, to keep it out of a screenshot — removed the one
  copy the install had to capture. It is cleared only once
  `display-mode: standalone` matches, where there is no address bar and the
  app's own storage already holds it.
- **The link always points at the live site**, never at whatever address admin
  is open on. See the warning at the top of this document.
- **The page reloads when it becomes visible**, on a two-minute backstop, and on
  request. It used to load once and never look again, so anything assigned
  after it was opened stayed invisible.
- **The header names the person.** Without it there was no way to tell which
  link was on a phone when work went to the wrong one.

Verified on a real iPhone: the icon installs with the Beyond RV logo, launches
standalone, and carries its key.

A `crew` link shows their jobs, anything else assigned to them, the day's yard
read-only, a note, and container reporting. A `gm` link shows the whole day.

### Container reports

Li hears when a container lands before anyone else, and his wife tracks them.
On their phone: **A container is arriving** — vehicle, date, who told them.

**It does not touch the product file.** That date is what the website
publishes. A report sits beside it; when they differ, both are on the calendar
and "dates that disagree" names the difference, attributed to a phone or an
email. A report for a vehicle with no published ETA is flagged too.

---

## Defects found by using it, and their causes

Worth reading: each was invisible to the tests that existed, and each says
something about where to look next.

**A new item sometimes did not appear, and creating it again made two.**
Netlify Blobs listing lag, as above. The panel now holds what it just wrote and
merges it into the listing until the listing catches up. Anything else in this
codebase that writes then re-lists has the same bug waiting.

**Assigning a meeting did not stick.** Its owners were filed under
`meeting:cal-1` while the grid reads that event as `calendar:cal-1`. The answer
went where nobody looks. Meetings and reminders now keep their owners on their
own record; only projected dates use an assignment record, keyed by the event
id the grid actually reads, and that id travels with the request so the two
cannot drift apart.

**A "whole calendar" link opened an empty day.** The endpoint returned a `gm`
payload; the page only knew the crew layout, read a `jobs` array that was not
there, and said nothing was on. Half a feature shipped because the endpoint and
the view were built in different sittings.

**The phone link pinned people to a frozen build, and could not carry its own
key.** Three faults in one path, none of them reachable without a real phone.
The link took the current origin, so one generated on a preview pointed there
for ever. The page stripped its own key from the address bar before *Add to
Home Screen* could capture it. And it never re-checked itself. Between them
these produced a phone that looked healthy — it authenticated, said "opened
today", and its own writes reached the calendar — while never showing anything
assigned to it. **The asymmetry was the clue: writes from the phone arrived,
reads never updated.** Worth remembering as a shape: when one direction works
and the other does not, suspect two different builds before suspecting the
logic.

**Assignees were dropped when an event was created.** The create call sent the
title, times and notes but not the list of people. Tasks passed theirs, so only
the other kinds were affected. The tests had covered assigning on create for a
task and on edit for a meeting, and missed the square between them — a reminder
that a test matrix with holes reads as thorough right up until someone uses the
combination nobody tried.

**Save fell off the bottom of the screen.** The popup measured its height once
on open; picking Task or hitting a validation error made it taller. It now
re-measures with a `ResizeObserver` and scrolls internally.

**Moving the start time did not move the end.** Found by CI, not locally,
because the default times depend on the hour you run at: Brisbane afternoon hid
it, UTC morning exposed it.

**The Crew section was unfindable.** It sat below ten calendar rows, under the
fold. Now orange and above the list, with a test pinning it there.

---

## Decisions that should not be undone casually

**A date has one home.** Dragging writes to the owning record. Anything else
creates a second version of the truth, which is the failure that cost the
flights.

**A supplier's date is a claim, not an arrival.** Email and phone reports sit
beside the published ETA and are compared to it. Nothing publishes without
Alex.

**Container ETAs cannot be dragged.** Not caution: the data. The ETA lives on
the product content file and ships through Pending review.

**Dependencies match on product, not dates.** Comparing every visit against
every container would fire whenever any vehicle anywhere was late, and an alarm
that is usually wrong gets ignored — which is how the first one was missed.

**Only a hash of a phone key is stored.** So a lost link is replaced, not
recovered. That is the point: it makes a stolen phone survivable.

**A link that leaves the building takes the canonical origin.** Not the one it
was made on. This is why crew links are hard-coded.

**Crew see no prices and no order state.** The yard list is stripped in
`crew-core`, not in the view, so a change to the view cannot start leaking.

---

## Outstanding

1. **Connect the ByondRV mailbox** in the Google tab. Everything AI-facing on
   the calendar is inert until then. Read-only scopes; the redirect URI must be
   exactly `https://beyondrv.com.au/.netlify/functions/google-oauth-callback`.
2. **Anyone whose link was issued before 5 September needs a new one.** A link
   generated while admin was on a deploy preview points at that frozen build
   and cannot be repaired. Delete the icon, **Reissue**, install from the new
   link. Done for Thabo Nel; check nobody else is on an old one. The Crew panel
   shows "opened today" either way, so it cannot tell you which — reissue if in
   doubt.
3. **Audit the rest of the codebase for write-then-list.** The listing lag is
   general; the calendar is simply where it was noticed.
4. The `.ics` subscription feed, if the phone views turn out not to be enough.
5. Resize on the calendar, once records carry an end date.
6. The truck model-year decision; sixteen researched rows still wait on it.

---

## Conventions

`npm run check`, `npm test`, `npm run audit:repository` locally; CI runs
`quality` then `browsers`. Pure logic lives in `*-core.ts` files and is tested
without constructing a Netlify event — follow that when adding anything.

Writing style: Google developer documentation style.
