# State of the build

Date: 4 September 2026
Repo: `Thabonel/beyondrv-site`
Status: **work paused, site build considered finished**

One change was still in review when work stopped: pull request #79, which removes
the last customer-facing mentions of a tub from the calculator. Everything else
described here is on `main`.

This is the state of the code at the point work stopped. It is the document to
read first. For how the vehicle picker and the publication gate were built, read
[HANDOVER-2026-09-04.md](HANDOVER-2026-09-04.md), and behind it
[HANDOVER-VEHICLE-PICKER-AND-CAMPER-FINDER-2026-09-01.md](HANDOVER-VEHICLE-PICKER-AND-CAMPER-FINDER-2026-09-01.md).

## What the site does

A customer picks their vehicle, and the calculator fills in the figures it
already knows. It tells them what a slide-on would weigh on that vehicle, which
camper model their tray suits, and hands everything they entered to the enquiry
form so they are not asked twice.

Everything it shows is attributable. Every published figure came from a
manufacturer document, and where a figure is optimistic or corrected the customer
is told so on the page.

## Numbers at the point of pausing

| Item | Value |
|---|---|
| Live variants | **165** across **14 makes** |
| Of those, trucks | 6 |
| Of those, without a factory tray | 96 |
| Optimistic-kerb disclosures | 30 |
| Corrected-figure disclosures | 3 |
| Awaiting review | 18 of 183 candidates |
| Database | 159 ute rows, 33 chassis rows, 32 sources |
| Tray specifications | 0 rows; the table and loader exist, no data yet |
| Truck families still unresearched | 6 |
| Pull requests merged 3 to 4 September | 19 |

## The rule that shapes the calculator

**A Beyond RV slide-on mounts on a flat tray.** It cannot sit in a factory tub at
any length.

That was established late and changed several things. The page no longer offers a
tub as a tray type, no longer asks for a "tray or tub" measurement, and no longer
fills the camper-fit field with a tub's dimensions. A vehicle that leaves the
factory without a tray is told what it needs rather than what it lacks:

> A Beyond RV slide-on mounts on a flat tray. This vehicle would need a tray
> fitted before a camper could go on.

Before that, such a customer was told their load area was, for example, 420 mm
shorter than the shortest camper. True, and it sent them looking for a longer ute
instead of a tray.

**96 of the 165 live variants are in that position.** They are not dead ends.
Each is an owner who needs a tray fitted, which is a conversation rather than a
rejection.

## How publication works

A variant reaches a customer through `isPromoted` in
`src/lib/vehicleCatalogue/derive.ts`:

1. `overrides.json` `hide` removes it, whatever else says.
2. `overrides.json` `show` publishes it on a named person's authority, and the
   calculator discloses that to the customer.
3. `reviews.json` publishes it through the admin review screen.
4. Otherwise `customer_selectable` plus an approved `data_review_log` entry.

**Everything live went through route 2.** The review screen works and has never
been used; 18 rows are waiting in it.

`SCRIPTS/build-vehicle-catalogue.mjs` turns the database plus overrides into
`catalogue.json` and `vehicle-review-candidates.json`, and runs first in the
Netlify build.

## What is unfinished

### Six truck families

Fuso Canter, IVECO T-Way, MAN TGS, Mercedes-Benz Arocs, Scania XT, Volvo FMX.
Only the Canter is close to camper territory.

**Budget for manual document supply, not research.** Every manufacturer site
tried has blocked automated retrieval: ford.com.au and hino.com.au return 403,
isuzu.com.au fails TLS verification. The Hino came from a mirror; the Isuzu,
Sprinter and Crafter sheets were supplied by the owner. Entering a sheet takes
minutes once it is in hand.

A new manufacturer host must be added to `ALLOWED_SOURCE_HOSTS` in
`src/lib/vehicleCatalogue/validate.ts`, or the build refuses to write the
catalogue at all.

### Nine rows the build cannot publish

Three lack a chassis mass: `fuso-canter-4x4-wide-cab-current`,
`iveco-eurocargo-my24-ml150-4x4`, `unimog-u4023-au-current`.

Six lack a model year, **deliberately**: the two `isuzu-nps-75-175-4x4-*` rows and
the four `vw-crafter-55-*` rows. `seed.sql` carries an explicit instruction not to
substitute a research date for a model year. Publishing them is a decision, not a
research task.

### Ford's heavier-options kerb figures

Thirty variants carry an optimistic-kerb disclosure. The database already proves
Ford publishes both bases: 17 Ford rows hold the heaviest-equipment figure from
the 2022MY specifications, while 23 Rangers hold the lightest from the 2026.50MY
brochure.

The one input needed is that brochure, page 21, table "4x4 | Wolftrak, Tremor,
Wildtrak, Platinum, Raptor Ranger 2026.50MY Specifications", row group "Vehicle
Masses (kg)". **Do not derive them from the 2022MY rows**: a 2026 Wildtrak's
lightest kerb of 2331 kg sitting 10 kg under the 2022 Wildtrak's heaviest of
2341 kg is two bases coinciding, not a relationship.

### Tray specifications: the table is empty

`tray_specifications` and `SCRIPTS/load-tray-specifications.mjs` are built and
tested, with no data in them. This matters more than it looks: if a camper only
goes on a tray, tray dimensions are the whole question for 96 of 165 vehicles.

Norweld, MITS Alloy and Duratray publish the data. **Every row needs
`dimension_basis`**, because Norweld's figures are outside dimensions, "from the
front of the headboard to the back of the tray", while the calculator asks for
the usable floor. The finder matches within 50 mm and a headboard is 40 to 80 mm,
so an outside figure in a usable field moves customers to the wrong camper. The
loader refuses any row whose basis is unstated.

See `data/vehicle-selector/tray-specs/README.md`.

### Smaller items

- The review screen has never been used. Using it once would exercise route 3.
- `catalogue.json`, `vehicle-review-candidates.json` and
  `vehicle-variant-index.json` are generated and committed, so any two branches
  touching vehicle data conflict in them. Resolution is regeneration, never a
  hand-merge.
- The Sprinter brochure labels its dual cab pages as single cab; the title and
  model codes are right. Two Crafter 50 dual cab rows do not reconcile as
  printed.

## Repository practice

`quality` runs `npm run check`, `npm test` and `npm run audit:repository`.
`browsers` runs `npm run test:e2e` across five browser projects. **Both are
required on `main`.**

- `strict` is false: a branch need not be rebased onto the latest `main`. With it
  true, every pull request would need rebasing whenever `main` moved, which on
  3 September was several times an hour.
- `enforce_admins` is false, so an admin can override in an emergency. That was
  used three times on 4 September at the owner's explicit instruction, and the
  full suite was run against merged `main` afterwards each time except the last,
  which the owner stopped.

`tsc --noEmit` does not check `.astro` script blocks. `astro check` does, and
`npm run check` runs it.

At the point of pausing: **419 unit tests, 910 end-to-end tests across five
browsers, zero type errors, repository audit clean.**

## The habit worth keeping

More than one thing reported success today while having changed nothing: a pull
request marked MERGED into a spent branch; a deploy called pending that had
shipped 45 seconds after merge; a build script printing success while deleting
two Hino rows; a local test run passing against a file that was never committed;
and a "regression" that was a selector matching nothing.

CI caught one of them. The rest were caught by checking a control that should
**not** have moved, and by treating a green result as a claim to verify rather
than an answer. The traps section of the 4 September handover records each one
and the check that would have caught it sooner.
