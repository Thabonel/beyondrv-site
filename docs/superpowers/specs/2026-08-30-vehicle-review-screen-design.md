# Vehicle review screen

**Status:** Approved design, ready for planning
**Date:** 30 August 2026
**Phase:** 3 of the vehicle selector work
**Depends on:** `data/vehicle-selector/australian-slide-on-vehicles.sqlite`, and the build-time promotion gate in `SCRIPTS/build-vehicle-catalogue.mjs`
**Related:** [Vehicle selector pre-fill and source watcher](2026-08-18-vehicle-selector-prefill-design.md)

## 1. Goal

Give the GM a way to publish reviewed vehicle variants from the admin dashboard,
so the picker on the slide-on weight calculator stops being hidden.

The picker shipped in phase 2 and works. It is switched off because the
publication gate finds nothing to show: `data_review_log` is empty, so no variant
is promoted, so the built catalogue holds zero variants. The gate is correct
design and stays. What is missing is any way to satisfy it without hand-editing a
SQLite file.

The reviewer is a busy person, and these figures feed an estimate. Final numbers
are settled by the owner and the GM at quote time. The screen is therefore built
for speed of sign-off, not for exhaustive per-row ceremony.

**Non-goals.** The calculator's result logic does not change. Tray size
collection stays in pull request #34. The 27 variants marked
`needs_secondary_review` get no separate workflow: they appear in the same list
as everything else, just unticked. No bulk import, no source re-scraping.

## 2. Decisions taken

| Decision | Choice |
|---|---|
| First publication scope | Ford only, 24 variants |
| Who reviews | The GM, identified from the admin session |
| What the reviewer can do | Approve, exclude, or correct a figure |
| What a correction requires | Only the number. Attribution comes from the session |
| When a review goes live | On an explicit Publish action, one commit per batch |
| Where decisions live | `data/vehicle-selector/reviews.json`, committed to the repo |
| Which gate they satisfy | The existing review gate, not the `overrides.json` bypass |

## 3. Architecture

Six pieces, four of them new.

| Piece | Role |
|---|---|
| `src/components/VehicleReview.tsx` | New. Presentational checklist panel |
| `netlify/functions/admin-vehicle-review.ts` | New. Reads candidates, saves drafts, publishes |
| `netlify/functions/vehicle-review-core.ts` | New. Validation and merge logic, no I/O, unit tested |
| `data/vehicle-selector/reviews.json` | New. Committed review decisions |
| `SCRIPTS/build-vehicle-catalogue.mjs` | Extended. Merges the overlay before promoting |
| `src/lib/vehicleCatalogue/derive.ts` | Extended. `isPromoted` accepts an overlay approval |

Drafts live in a `vehicle-review-drafts` blob store, one blob per variant,
following the same pattern as `customer-lead-status`.

## 4. Data

### 4.1 Published decisions

`data/vehicle-selector/reviews.json`:

```json
{
  "reviews": [
    { "id": "ford-ranger-2023-xlt-dual-cab", "reviewer": "j.smith", "reviewedAt": "2026-08-30" },
    {
      "id": "ford-ranger-2023-wildtrak-dual-cab",
      "reviewer": "j.smith",
      "reviewedAt": "2026-08-30",
      "corrections": { "gvmKg": 3350 }
    }
  ]
}
```

Presence in `reviews` means approved. There is no `decision` field and no notes
field. Excluding a variant means leaving it out of the list.

`reviewer` is the admin actor id from the session. `reviewedAt` is an ISO
`YYYY-MM-DD` date, set by the server. Neither is accepted from the request body.

`corrections` is optional. The reviewer and the corrector are the same person at
the same moment, so the entry's own `reviewer` and `reviewedAt` cover corrections
too and no extra fields are stored.

### 4.2 Correctable fields

Only the four figures the calculator pre-fills may be corrected:

| Field | Range | Notes |
|---|---|---|
| `gvmKg` | 1500 to 8000 | Integer |
| `kerbKg` | 1000 to 6000 | Integer |
| `trayLengthMm` | 1200 to 4000 | Integer. Matches the tray bounds in pull request #34 |
| `trayWidthMm` | 1200 to 2500 | Integer. Matches the tray bounds in pull request #34 |

A correction outside its range fails validation at the endpoint and again at
build time. `kerbKg` greater than or equal to `gvmKg` fails, whether one figure
was corrected or both.

`payloadKg` is deliberately absent from that list. The catalogue validator
enforces `gvmKg - kerbKg === payloadKg`, so payload is derived rather than
independent. Correcting either mass recomputes payload and discloses it as
corrected alongside the field that caused it. A reviewer never types it.

### 4.3 Drafts

One blob per variant in `vehicle-review-drafts`, keyed
`vehicle-review/<variantId>.json`, holding the ticked state and any typed
corrections. Drafts are working state, never a source of published truth. Publish
reads drafts, writes `reviews.json`, then clears the drafts it published.

## 5. The review screen

A Vehicle Review panel in the admin dashboard, filtered to a single make, Ford by
default.

One row per unpublished variant showing:

- the variant label, as produced by `buildVariantLabels`
- GVM and kerb mass, editable in place
- tray length and width, editable in place, blank for cab-chassis
- a link to the source the figures came from, opening in a new tab
- a tick, controlling whether the row publishes

**Source-verified rows start ticked.** 132 of the 159 variants already carry
`verification_status = 'source_verified'`, so the reviewer's job is spotting the
row that looks wrong, not confirming two dozen correct ones. The 27 rows marked
`needs_secondary_review` start unticked and are labelled as such, so publishing
one is a deliberate act rather than the default.

A footer shows the count and one action: **Publish 24 vehicles**, with the number
reflecting the current ticks. Editing a figure marks the row as corrected in the
interface, so the reviewer can see what they changed before publishing.

Typing autosaves the row's draft. A closed laptop loses nothing.

## 6. Publishing

`POST /.netlify/functions/admin-vehicle-review/publish`:

1. Load every draft, and keep those whose variant belongs to the requested
   make. Drafts are keyed by variant id, so the make comes from the catalogue
   row, not from the draft.
2. Validate each ticked row through `vehicle-review-core`.
3. Merge into the existing `reviews.json`, replacing any entry with the same id.
4. Write the file through the GitHub contents API, using `GITHUB_TOKEN`,
   `GITHUB_REPO`, and `GITHUB_BRANCH`, the same way `admin-product-edit` does.
5. Clear the published drafts.
6. Record an owner audit entry through `appendOwnerAudit`.

One commit per publish, so a Ford batch is one rebuild rather than 24. The commit
message names the reviewer and the count.

Netlify rebuilds on the commit. The picker appears roughly a minute later.

## 7. Build merge

`SCRIPTS/build-vehicle-catalogue.mjs` gains a third input beside the SQLite and
`overrides.json`.

1. Read and validate `reviews.json`. Validation mirrors
   `validateCatalogueOverrides`: trim strings, cap lengths, check ISO dates,
   collect every error, then fail the build. An unknown variant id fails, the way
   an unknown override id already does.
2. Apply corrections over the SQLite row values.
3. Treat a variant listed in `reviews` as approved for promotion.

An overlay approval carries `approvalId` of `review:overlay:<variantId>`. The
`review:` prefix is required: the catalogue validator rejects a publication whose
method is `review` without it. The `overlay:` segment keeps the route
distinguishable from a `data_review_log` approval.

`isPromoted` gains one clause, checked after `hide` and before the
`customer_selectable` path:

```
if (overrides.hide.includes(row.id)) return false;
if (overrides.show.some((entry) => entry.id === row.id)) return true;
if (reviews.has(row.id)) return true;
return row.customer_selectable === 1 && ...
```

The existing build-time refusal check is unchanged and still applies to any row
carrying `customer_selectable = 1`.

### 7.1 Provenance of a corrected figure

The catalogue emits a `source` object per variant carrying the manufacturer,
title, and URL. A corrected figure did not come from that source, so publishing
it under the manufacturer's name would state something untrue on a public page.

Each corrected field is therefore listed on the variant:

```json
"correctedFields": ["gvmKg"],
"publication": { "approvalId": "overlay:ford-ranger-2023-wildtrak-dual-cab", "approvedAt": "2026-08-30", "method": "review", "reviewer": "j.smith" }
```

The provenance panel on the calculator shows corrected figures as Beyond RV's
own, and uncorrected figures keep citing the manufacturer. This costs the
reviewer nothing at review time.

## 8. Access control

**The `gm` role cannot currently reach this screen.** Its capability set in
`netlify/functions/admin-auth.ts` covers sales, agreements, configurations,
deposits, and builds. It holds neither `site:read` nor `site:write`.

Add a `vehicles:review` capability and grant it to `gm` and `owner`. Do not widen
`site:write` to the GM, which would also grant product and content editing.

Every endpoint checks `vehicles:review` through `hasAdminCapability` and returns
`forbiddenResponse('vehicles:review')` without it, following the pattern in
`admin-dashboard.ts`.

## 9. Failure behaviour

| Failure | Behaviour |
|---|---|
| Blob store unavailable | The screen loads read-only and says drafts cannot be saved. Nothing publishes |
| GitHub token missing or rejected | Publish fails with a message naming the cause. Drafts survive |
| A correction fails validation | The endpoint rejects the batch and names the offending rows. Nothing is committed |
| `reviews.json` malformed at build time | The build fails. A bad file never reaches customers |
| Two reviewers publish at once | Last write wins on a per-variant basis. The GitHub API's `sha` precondition makes a lost update fail loudly rather than silently |

An outage must never publish a partial batch. Publishing is all or nothing.

## 10. Testing

`vehicle-review-core` holds all validation and merge logic with no I/O, and is
unit tested under `node --test`:

- a correction outside its range is rejected, at each boundary
- `kerbKg` at or above `gvmKg` is rejected
- an unknown variant id is rejected
- publishing merges over an existing entry for the same id rather than duplicating
- reviewer and date come from the caller, never from the request body
- an empty batch is rejected rather than committing an unchanged file

The build merge is tested through the existing
`tests/vehicle-catalogue-validate.test.ts` and
`tests/vehicle-catalogue-derive.test.ts` fixtures:

- a reviewed variant is promoted
- a hidden variant stays hidden even when reviewed
- a corrected figure reaches the built catalogue
- a corrected field is listed in `correctedFields`

End to end, under `tests/e2e/`:

- the panel lists unpublished variants with every row ticked
- unticking a row removes it from the publish count
- publishing with nothing ticked is refused

## 11. Out of scope

- Tray size collection. That is pull request #34, unblocked by this work
- Re-reviewing a variant that is already published
- Any change to how the calculator computes a result
- Publishing makes other than the one selected in the panel
