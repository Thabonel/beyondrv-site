# Company calendar: product requirements

Status: approved 5 September 2026. Supersedes the calendar section of
[HANDOVER-2026-09-05.md](HANDOVER-2026-09-05.md).

## Summary

The company calendar is the first page in admin. It shows every dated
commitment the business holds, it looks and behaves like Google Calendar, and
the admin AI keeps it current by reading the company mailbox and the admin's own
records. The GM should be able to open it on a desktop or a folding phone and
see, without clicking anything, who is visiting, what is arriving, and what is
due.

## Why

A customer flew from Tasmania to see a camper that was still in a container.
The supplier's ETA and the customer's visit each existed, in different places,
and nobody compared them. The first calendar (PR #93) put those dates on one
grid. It is not usable yet:

- Week and Day views render all 24 hours into the page instead of a scrolling
  grid, so the GM scrolls the browser through 290rem of empty hours.
- Every event is all-day. No record holds a time, so nothing can sit at
  "10:00 Tuesday" and the hour grid is decoration.
- Creating an event uses `window.prompt`. Details open in a card under the grid
  rather than a popover. There is no mini-month, no calendar list, no search,
  and no keyboard shortcuts.
- Tasks never appear: the dashboard does not pass them to the projection, and
  the calendar write endpoint stores tasks under a different key from every
  other task reader, so drag-to-move on a task returns 404.
- The assistant's `list_calendar` tool omits tasks and container ETAs.
- Nothing from Gmail reaches the calendar. The Gmail sync only matches threads
  to leads and contracts.

## Goals

1. Match Google Calendar's layout, views, and interactions closely enough that
   someone who uses Google Calendar needs no instruction.
2. Business hours (Monday to Saturday, 08:00 to 17:00) are what the GM sees on
   opening. The other hours exist and scroll into view.
3. Work on a desktop and on a folding phone (about 340px folded, about 700px
   open), including when the fold changes mid-session.
4. Timed events. A visit at 10:00 sits at 10:00.
5. The admin AI reads Gmail and admin records and adds relevant items to the
   calendar without being asked, with a visible trail back to the source.
6. Keep the rule that record-owned dates have one home. Moving a visit on the
   calendar moves it on the order.

## Non-goals

- An `.ics` subscription feed or two-way sync with Google Calendar.
- Recurring events.
- Sending email, replying to email, or writing to Gmail in any way. The Google
  connection stays read-only.
- Event lengths on order dates. Orders hold a date and, after this work, a
  time. A visit has no stored duration; the grid draws it as one hour.

## Users

- The GM, on a desktop in the office and on a folding Android phone in the
  yard.
- Sales staff with `sales:write`, on desktop.
- The admin AI, through tools and a scheduled job.

## The view

### Layout

Desktop (620px and wider):

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰  Calendar     [Today]  ‹  ›   September 2026        🔍   [Week ▾] │
├──────────────┬───────────────────────────────────────────────────────┤
│ [+ Create]   │ GMT+10   MON 7   TUE 8   WED 9   THU 10  FRI 11  SAT  │
│              │          ───────────────────────────────────────────  │
│  Mini month  │ all-day  ▒ Container ETA: Sunpatch 21                  │
│  S M T W T F │ ─────────────────────────────────────────────────────  │
│  ...         │  8 AM    │        │        │        │        │        │
│              │  9 AM    │ ██████ │        │        │        │        │
│ My calendars │ 10 AM    │ Visit  │        │   ─── now ───            │
│ ☑ Visits     │ 11 AM    │        │        │        │        │        │
│ ☑ Handovers  │ 12 PM    ░░░░░░░░ lunch ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ ☑ Containers │  1 PM    │        │        │        │        │        │
│ ☑ ...        │  ...     (scrolls; opens at 8 AM)                      │
└──────────────┴───────────────────────────────────────────────────────┘
```

Phone (narrower than 620px): the sidebar is hidden behind **☰**. **Week**
becomes a 3-day view, as Google's Android app does. The folded phone opens on
**Schedule**; the open phone opens on **Week** (3-day). A view the GM picks
stays picked until the page reloads.

### Top bar

| Element | Behaviour |
|---|---|
| **☰** | Toggles the sidebar. |
| **Today** | Moves to today without changing the view. |
| **‹ ›** | Previous or next period for the current view. |
| Title | "September 2026" in Month, "7 – 13 Sep 2026" in Week, "Tuesday, 8 September" in Day. |
| Search | Filters events by title, customer, product, and notes. Results open in Schedule view. |
| View menu | **Day**, **Week**, **Month**, **Schedule**. Shows keyboard shortcuts. |

### Sidebar

- **+ Create** opens the quick-create popover for today at the next whole
  hour, or 08:00 if that is outside business hours.
- A mini month. Today is a filled circle. Clicking a day navigates there.
  Dragging across days is not required.
- **My calendars**: one row per event kind with its colour and a checkbox. The
  set of hidden kinds persists in `localStorage`.

### Event kinds and colours

Colour is meaning, so the kind, not the source, chooses the colour.

| Kind | Colour | Source | Movable |
|---|---|---|---|
| Customer visit | Tomato `#d50000` | order `customerVisitDate` + `customerVisitTime` | Yes, commitment |
| Handover | Basil `#0b8043` | order `expectedHandoverDate` + `expectedHandoverTime` | Yes, commitment |
| Container ETA | Tangerine `#f4511e` | product `containerEtaDate` | No |
| Expected arrival | Banana `#f6bf26` | order `expectedArrivalDate` | Yes |
| Factory order | Grape `#8e24aa` | order `factoryOrderDate` | Yes |
| Next action | Peacock `#039be5` | order `nextActionDate` | Yes |
| Lead follow-up | Blueberry `#3f51b5` | lead status `nextFollowUpDate` | Yes |
| Task | Sage `#33b679` | task `dueDate` + `dueTime` | Yes |
| Meeting | Lavender `#7986cb` | calendar event store | Yes |
| Reminder | Graphite `#616161` | calendar event store | Yes |

Kinds in the calendar event store are `meeting`, `reminder`, `customer_visit`,
`expected_handover`, `container_eta`, and `expected_arrival`. The last four
exist so the AI can record a visit, a handover, or a supplier date it read in
an email or a call note when it cannot resolve the order or product. They carry the same colour as the projected kind.

Commitments (visits and handovers) get a small filled dot before the title.
AI-added events get a sparkle badge after the title.

### Grid

- Fixed height: the viewport minus the top bar. The grid scrolls inside
  itself. On load, and on every navigation, it scrolls to 08:00.
- 15-minute slots, labels every hour, 3rem per hour on desktop, 2.5rem on
  phone.
- An all-day row above the grid, expanding to fit, capped at four rows with a
  **+N more** link.
- Non-business time (before 08:00, after 17:00, and all of Sunday outside
  08:00 to 17:00) is shaded `#f8f9fa`. Lunch, 12:00 to 13:00 Monday to
  Saturday, is shaded `#eceff1`. Sunday 08:00 to 17:00 is tinted `#e8f5e9`,
  meaning "by arrangement". A legend row under the grid explains the three.
- A red current-time line with a dot in the left gutter, on today only.
- Week and Day headers show the weekday initial over the date number. Today's
  number is a filled orange circle.
- In Month view, each day shows up to three event chips, then **+N more**.
  Today's date is a filled orange circle.
- Schedule view is a chronological list grouped by day with the date on the
  left, as Google's is.

### Interactions

| Gesture | Result |
|---|---|
| Click an empty slot | Quick-create popover anchored to the slot, pre-filled with a 1-hour range. |
| Drag on empty space | Quick-create popover for the dragged range. |
| Double-click a day in Month | Opens Day view on that day. |
| Click an event | Detail popover: kind, title, time, notes, links to the owning record and the source email, **Edit**, **Delete** or **Dismiss**, and the reason when the event is not movable. |
| Drag an event | Moves it. For a record-owned date, writes the new date and time to the record. For a container ETA, reverts with the reason. |
| Drag the bottom edge | Resizes. Only events from the calendar store keep a length; record-owned dates revert with the reason. |
| Escape | Closes any popover. |

Failed writes revert the drag and show the error in a snackbar at the bottom
left, as Google's does. Successful writes show a snackbar with **Undo** for
moves and deletes. Undo writes the previous values back.

### Quick-create popover

Fields: **Title** (focused), **Kind** (Meeting, Reminder, Task, Customer
visit, Handover), **Date**, **Start**, **End**, **All day**, **Notes**.
**Save** and **Cancel**. Customer visit and Handover ask for the order and
write the date and time onto that order (`customerVisitDate` and
`customerVisitTime`, or `expectedHandoverDate` and `expectedHandoverTime`);
they do not create a store event, and the order names the event, so there is
no title field. Task writes to the task store. Meeting and Reminder write to
the calendar event store.

The other order dates (expected arrival, factory order, next action), lead
follow-ups, and container ETAs are set where the record is and appear here.

### Visits and handovers from the AI

A visit or handover the AI finds is written the same way, onto the order:

- **Gmail.** When the extraction returns a `customer_visit` or
  `expected_handover` candidate with a `relatedOrderId`, the sync writes the
  date and time onto that order and records an `order_date_set` audit and
  timeline entry naming the email. With no order it becomes a calendar event
  for someone to attach.
- **Call notes.** The voice-capture extraction returns `appointmentKind`,
  `appointmentDate`, and `appointmentTime` when the call fixed a visit or a
  handover. On confirmation, the customer is matched to one live order by
  email, then phone, then an unambiguous name (narrowed by product when two
  orders share a name), and the date is written onto it. With no match it
  becomes a calendar event linked to the enquiry, marked "Added by AI from a
  call note".
- **Assistant.** `set_order_date` with `expected_handover` and a `time`.

The matching rule lives in `order-date-core.ts`; the write in
`order-date-write.ts`. A wrong customer's order is worse than a date left on
the calendar, so anything ambiguous stays on the calendar.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `t` | Today |
| `d`, `w`, `m`, `a` | Day, Week, Month, Schedule |
| `j`, `k` | Next, previous period |
| `c` | Create |
| `/` | Focus search |
| `Esc` | Close popover |

Shortcuts are ignored while focus is in an input.

## Data

### Projected events

The projection in `calendar-events-core.ts` stays pure and gains:

- `start` and `end` as ISO date-times when the record carries a time, and
  `allDay: true` otherwise.
- Tasks read `dueTime`. Orders read `customerVisitTime` and
  `expectedHandoverTime`. Times are `HH:MM`, 24-hour, Brisbane local. A record
  with a date and no time is all-day.
- `source: 'record'`.

`admin-orders.ts` accepts and validates the two new time fields.
`admin-owner-copilot-tasks.ts` accepts `dueTime`. The dashboard passes tasks
into the projection.

### Calendar event store

Blob store `company-calendar-events`, key `events/<id>.json`.

```ts
interface CompanyCalendarEvent {
  id: string;                     // cal-<timestamp>-<random>
  title: string;                  // 1 to 180 characters
  kind: 'meeting' | 'reminder' | 'customer_visit' | 'container_eta' | 'expected_arrival';
  start: string;                  // ISO date-time, or YYYY-MM-DD when allDay
  end: string;                    // same form as start; end >= start
  allDay: boolean;
  notes: string;                  // up to 4000 characters
  location: string;               // up to 300 characters
  source: 'gm' | 'ai' | 'chat';
  sourceEmail?: { threadId: string; messageId: string; subject: string; from: string; excerpt: string };
  links: { orderId?: string; enquiryId?: string; productSlug?: string };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dismissedAt?: string;           // set instead of deleting an AI event
}
```

Validation lives in `calendar-store-core.ts` (pure): `validateEvent`,
`eventKey`, and `isDuplicate`.

### Endpoint: `admin-calendar-events`

| Method | Capability | Body | Result |
|---|---|---|---|
| `GET ?from&to` | `sales:read` | — | `{ events }` from the store, undismissed, in range |
| `POST` | `sales:write` | event without `id` | `{ event }` |
| `PATCH` | `sales:write` | `id` plus changed fields | `{ event }` |
| `DELETE` | `sales:write` | `id` | `{ ok }`; AI events are dismissed, others removed |

The existing `admin-calendar-write` keeps handling record-owned moves and
gains `time` on moves and `dueTime` on task creation. It uses `taskKey`.

### Calendar payload

`admin-dashboard` keeps returning `calendar.events` and `calendar.clashes` for
projected events. The panel fetches the store events from
`admin-calendar-events` for the visible range and merges them client-side.
`calendarClashes` runs over the merged list so an AI-recorded ETA can disagree
with a visit.

## Gmail to calendar

### Trigger

`google-gmail-calendar-sync.ts`, scheduled every 15 minutes, following
`google-gmail-contract-sync.ts`. It runs only when the Google connection is
`connected`. It exits quietly when it is not.

### Pipeline, in `calendar-ai-core.ts` (pure where possible)

1. Read threads from `owner-copilot-gmail-threads`. Select messages whose
   `messageId` is not in the thread's `calendarProcessedMessageIds` and whose
   `receivedAt` is within 14 days.
2. For each message, one OpenAI call with a strict JSON schema
   (`calendar_extraction`). Model `OPENAI_CALENDAR_MODEL`, default
   `gpt-5.4-nano`, reasoning `none`, following `contractAiConfig`. Input: the
   subject, sender, received date, the first 6,000 characters of the body, the
   Brisbane date today, business hours, and a list of open orders (id,
   customer name, email, product) and products with container ETAs (slug,
   title, `containerEtaDate`).
3. The schema returns `candidates[]`, each with `title`, `kind`, `date`,
   `startTime`, `endTime`, `allDay`, `confidence`, `sourceExcerpt`,
   `relatedOrderId`, `relatedProductSlug`, `relatedCustomerEmail`, and
   `reasoning`. The model returns an empty list for messages with no dated
   item.
4. `validateCandidates` drops any candidate with `confidence < 0.6`, a date
   outside the next 365 days or the past 7 days, or a `relatedOrderId` or
   `relatedProductSlug` that does not exist.
5. `isDuplicate` compares against store events: same `sourceEmail.messageId`,
   or same kind and same normalised title within one day.
6. Write survivors with `source: 'ai'`, `createdBy: 'gmail-calendar-sync'`,
   and `sourceEmail` filled. Append `messageId` to the thread's
   `calendarProcessedMessageIds` whether or not anything was written.
7. For a candidate of kind `container_eta` that resolves to a product whose
   `containerEtaDate` differs from the candidate date, write the event and add
   a timeline entry `container_eta_disagreement`. The calendar shows it in
   **Dates that disagree**.
8. Append one Google audit entry per run: messages read, candidates, written,
   duplicates.

### What counts as relevant

The prompt asks for dated items that affect the business: a customer saying
when they will visit or call, a supplier's shipping, arrival, or production
date, a meeting or call that has a date, a payment or document due date, and
a delivery booking. It asks the model to ignore marketing, receipts,
newsletters, and dates that are only quoted from an earlier message.

### Cost bound

At most 40 messages per run. Nano-tier model. A run that hits the bound logs it
and continues next time.

## Assistant tools

| Tool | Change |
|---|---|
| `list_calendar` | Reads projected events (orders, enquiries, tasks, products) and store events. Shows times. |
| `set_order_date` | Gains `time` (`HH:MM`). |
| `create_calendar_event` | New. Title, kind, date, start, end, all-day, notes, links. Source `chat`. |
| `update_calendar_event` | New. Id plus changed fields. |
| `delete_calendar_event` | New. Id. |

The system prompt adds business hours and the rule that the assistant may add
meetings and reminders when the GM mentions them, and must confirm the order
before writing a customer visit.

## Files

```
netlify/functions/calendar-events-core.ts        projection, now with times    (edit)
netlify/functions/calendar-write-core.ts         move rules, now with times    (edit)
netlify/functions/admin-calendar-write.ts        record moves, taskKey fix     (edit)
netlify/functions/calendar-store-core.ts         event validation, dedupe      (new)
netlify/functions/admin-calendar-events.ts       store CRUD                    (new)
netlify/functions/calendar-ai-core.ts            extraction schema, validate   (new)
netlify/functions/google-gmail-calendar-sync.ts  scheduled job                 (new)
netlify/functions/admin-dashboard.ts             pass tasks                    (edit)
netlify/functions/admin-orders.ts                time fields                   (edit)
netlify/functions/admin-owner-copilot-tasks.ts   dueTime                       (edit)
netlify/functions/admin-chat.ts                  tools                         (edit)
src/components/AdminCalendar.tsx                 the view                      (rewrite)
src/components/AdminCalendarPanel.tsx            loads both sources            (edit)
src/components/calendar/*.tsx                    top bar, sidebar, popovers    (new)
src/components/admin-calendar.css                Google styling                (rewrite)
tests/calendar-*.test.ts                         core tests                    (edit, new)
tests/e2e/admin-calendar.spec.ts                 browser tests                 (new)
```

## Tests

Core (`npm test`):

- Projection: a task with `dueTime` becomes a timed event; an order with
  `customerVisitTime` becomes a one-hour timed event; missing time stays
  all-day; tasks and products appear in the assistant's listing.
- Store: `validateEvent` rejects an empty title, `end` before `start`, unknown
  kinds, and oversized notes; `isDuplicate` matches on message id and on
  title-within-a-day; a dismissed event is not a duplicate target.
- AI: `validateCandidates` drops low confidence, far dates, and unknown links;
  the disagreement rule fires only for the same product.
- Write rules: a move with a time writes the time field; a task move uses
  `taskKey`.

Browser (`tests/e2e/admin-calendar.spec.ts`, mocked session and endpoints):

- Desktop: the week grid has an internal scroller whose `scrollTop` is at the
  08:00 row on load; the 07:00 row is above the fold.
- Desktop: clicking a slot opens the quick-create popover; saving posts to
  `admin-calendar-events` and the event appears.
- Desktop: pressing `m` then `w` switches views; `t` returns to today.
- Mobile: the sidebar is hidden, the week view shows three day columns, and
  the folded width opens on Schedule.

Manual before merge: desktop and 340px in the preview browser, screenshots in
the PR.

## Rollout

One branch from `main` after PR #93 merged, one PR. The calendar is admin-only
behind the edge gate, so the public catalogue numbers (168 published variants,
52 known models) must not change.

Environment: `OPENAI_API_KEY` (already set for the assistant) and optionally
`OPENAI_CALENDAR_MODEL`. The Gmail job does nothing until the Google
connection reports `connected`.
