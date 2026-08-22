# Customer-reported tray sizes design

Date: 2026-08-21

## Problem

Whether a slide-on fits is decided by tray size, not weight. The weight
calculator compares `trayLength` and `trayWidth` against a camper's required
dimensions, and fails the fit when either falls short.

The vehicle catalogue covers weights completely and tray dimensions barely. For
the 51 cab-chassis variants a slide-on tray goes on:

| Field | Coverage |
|---|---|
| `gvmKg`, `kerbKg`, `payloadKg` | 51 / 51 |
| `rearGawrKg` | 39 / 51 |
| `trayLengthMm`, `trayWidthMm` | 12 / 51 |

The 39 gaps are not an oversight. A cab chassis ships without a tray; the tray
is fitted afterwards and chosen by the buyer, so there is no manufacturer figure
to publish. Missing by make: Toyota 12, Mazda 10, Ford 6, Mitsubishi 6, Kia 5.
Isuzu and GWM are complete.

So the selector pre-fills every number except the two that decide the answer,
and the customer is left to measure. Meanwhile the people using the calculator
are exactly the people who know their own tray.

## The point that shapes everything

**A tray size is not a property of the vehicle.** Two owners of the same Ranger
cab chassis can legitimately have different trays. Stored data is therefore
"what other owners fitted", never a specification, and it can never be
presented as one.

That is why the customer must confirm or correct what they are shown. The
confirmation is both the safety mechanism and the quality signal: sizes people
agree with accumulate reports, sizes nobody recognises stay at one.

## Goals

- A customer can contribute the tray size they actually have.
- The next customer with the same vehicle is offered it as a starting point,
  labelled with where it came from and how many owners reported it.
- That customer must confirm it or correct it. Nothing is accepted silently.
- The owner can see what has been reported and delete rubbish.
- No new runtime dependency, and nothing identifying is stored.

## Non-goals

- Presenting reported sizes as manufacturer data.
- Collecting reports for tub vehicles. A tub is fixed at the factory, its
  dimensions are already in the catalogue, and `trayState` is
  `not_applicable` for all 81 of them.
- Owner approval before a size is shown. Reports go live immediately and are
  moderated afterwards, because data held behind an unread review queue is
  data nobody benefits from.
- Any change to how weights are pre-filled.

## Design

### Storage

A Netlify Blobs store, `vehicle-tray-sizes`, with one blob per variant at
`tray-sizes/{variantId}.json`:

```ts
interface TraySizeBucket {
  lengthMm: number;
  widthMm: number;
  reports: number;          // confirmations and corrections landing on this size
  firstReportedAt: string;
  lastReportedAt: string;
}

interface TraySizeRecord {
  variantId: string;
  sizes: TraySizeBucket[];
  totalReports: number;
  updatedAt: string;
}
```

Counts are aggregated per distinct size rather than stored per submission, so a
variant holds a handful of real tray sizes rather than a row per visitor. It
holds nothing that could identify anyone.

Two things keep it genuinely bounded, because aggregation alone does not:

- **Dimensions are rounded to the nearest 10 mm before counting.** Nobody
  measures a tray to the millimetre, and without this 2100 and 2103 are
  different sizes. The accepted ranges span 3.64 million distinct millimetre
  pairs; rounding cuts that to 36,400 and, more usefully, makes agreement
  between owners actually register.
- **A variant keeps at most 20 distinct sizes**, evicting the least reported.
  A vehicle with more than twenty genuinely different tray sizes is noise, and
  without a cap a determined submitter could grow one record without limit.

**Writes are conditional.** A read-modify-write would lose a report whenever two
customers submitted for the same vehicle at once, and these counts decide what
the next customer is shown. Each write uses the etag from the read
(`onlyIfMatch`, or `onlyIfNew` when the record does not exist yet) and retries
on a losing race.

### Choosing what to show

The most-reported size wins. Ties break on the most recent report, then on the
longer tray. Ordering is deterministic, so two customers on the same vehicle
see the same suggestion.

A size reported once is still shown, with its count visible. Waiting for a
threshold would keep the feature useless for months, and the confirmation step
is what protects the customer either way — "reported by 1 owner" tells them
precisely how much weight to give it.

### What the customer sees

When a variant with no manufacturer tray dimensions is selected, the existing
provenance panel gains a line:

> Tray 2100 × 1800 mm, reported by 7 owners of this vehicle. Trays are fitted
> after purchase, so please check yours.

and a confirmation control with two actions:

- **That is my tray** — records a confirmation for the shown size and leaves
  the fields filled.
- **Mine is different** — clears both fields for the customer to type, and
  replaces itself with **Report my tray size**, which posts what they typed.

If no reported size exists, the fields stay empty and the panel shows the same
**Report my tray size** button, disabled until both dimensions are filled in
and plausible.

There is no Calculate button to hang this on — the calculator recalculates on
every keystroke — and posting on blur instead was considered and rejected. It
would report a size for every customer who merely filled the fields to run a
calculation, including someone exploring numbers, and none of them ever asked
to contribute. Only an explicit press reports anything.

Each control posts at most once per variant selection. Confirming disables the
confirm button, so a customer clicking it repeatedly cannot inflate a count,
and re-calculating does not re-post an unchanged size. Choosing another variant
starts fresh.

Nothing is submitted on page load, and nothing is submitted without the
customer pressing something. The existing `customerEdited` set already prevents
a pre-fill from overwriting a value the customer typed; the same guard covers
this.

### Endpoint

`netlify/functions/tray-sizes.ts`, public, no authentication.

- `GET` returns the winning size for every variant that has one, as
  `{ [variantId]: { lengthMm, widthMm, reports } }`. One request when the
  selector is first used, rather than a round trip per variant selection. With
  51 cab-chassis variants the payload stays a few KB.
- `POST` takes `{ variantId, lengthMm, widthMm }` and increments the matching
  bucket, creating it when the size is new.

### Validation

- `variantId` must exist in the built catalogue. Checked server-side, so a
  junk key cannot create a blob.
- `lengthMm` between 1200 and 4000; `widthMm` between 1200 and 2500. Integers
  only. Recorded manufacturer figures span 1300–2630 and 1270–1895, so these
  bounds leave room for genuine aftermarket trays while rejecting a mistyped
  18000 or 18.
- The variant's `bodyType` must be `cab_chassis`. Tub dimensions are already
  known and are not the customer's to change.
- Rate limited with the existing helper:
  `isRateLimited(event, 'tray-sizes', 10, 60 * 60)`. That helper hashes the
  client IP rather than storing it, so the privacy posture is unchanged.

### Moderation

`netlify/functions/admin-tray-sizes.ts`, requiring `site:read` to list and
`site:write` to delete, matching the other admin endpoints.

A `TraySizes` component mounted in `AdminDashboard`, following the pattern
already used for saved marketing ideas: a focused presentational component with
the data layer in the dashboard. It lists each variant that has reports, its
sizes and counts, and a delete for each size.

Deleting removes one size bucket, not the whole variant, so one bad entry can
go without discarding good data alongside it.

### Failure behaviour

If the blob store is unavailable the endpoint returns 503 and the calculator
carries on exactly as it does today: empty tray fields the customer fills in.
A reporting outage must never block someone working out whether a camper fits.

## Testing

Unit, against a pure aggregation module, written first:

- A first report creates a bucket with a count of 1.
- A repeat of the same size increments rather than duplicating.
- A different size creates a second bucket.
- The most-reported size wins.
- Equal counts break on the most recent report.
- A length or width outside the bounds is rejected.
- A non-integer is rejected.
- Dimensions are rounded to the nearest 10 mm, so near-identical measurements
  count as agreement.
- A variant never exceeds 20 distinct sizes; the least reported is evicted.
- An unknown `variantId` is rejected.
- A tub variant is rejected.

E2E:

- Selecting a cab-chassis variant with no reported size leaves the tray fields
  empty and offers the contribution invitation.
- Selecting a variant with a reported size shows it with its count, and the
  confirm control.
- Confirming posts the shown size.
- Choosing "mine is different" clears the fields and posts the typed size.
- Nothing is posted merely by selecting a variant.
- Nothing is posted by filling the tray fields for an ordinary calculation.
- Confirming twice posts once.
- A submission that fails can be retried.

## Files

New:

- `netlify/functions/tray-sizes.ts`
- `netlify/functions/admin-tray-sizes.ts`
- `netlify/functions/tray-size-core.ts`
- `netlify/functions/vehicle-variant-index.json` — a slim id and body-type list.
  The endpoint must reject an unknown variant and a tub vehicle, and Netlify
  functions in this repo import JSON only from beside themselves; none imports
  a value from `src/`. Written by `SCRIPTS/build-vehicle-catalogue.mjs`.
- `src/components/TraySizes.tsx`
- `tests/tray-size-core.test.ts`
- `tests/e2e/tray-sizes.spec.ts`

Modified:

- `src/pages/slide-on-camper-weight-calculator/index.astro`
- `src/components/AdminDashboard.tsx`
- `SCRIPTS/build-vehicle-catalogue.mjs`

## Dependency

This builds on the vehicle selector, which is not yet on main. It is in
`feat/vehicle-selector-to-main`. Nothing here can ship before that does,
because a reported size is stored against a variant id and there is no variant
id without the selector.
