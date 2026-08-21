# Vehicle selector pre-fill and source watcher

**Status:** Approved design, ready for planning
**Date:** 18 August 2026
**Phase:** 2 of the vehicle selector work
**Depends on:** `data/vehicle-selector/` research database, committed on `vehicle-selector-research-data`
**Related:** [Customer Vehicle and Slide-On Selector PRD](../../Customer-Vehicle-and-Slide-On-Selector-PRD.md)

## 1. Goal

Let a customer pick their vehicle from a list instead of typing its mass figures
by hand, and show them where every figure came from.

The slide-on calculator already works. `src/lib/vehicleSuitabilityCalculator.js`
implements the mass logic, and `/slide-on-camper-weight-calculator/` puts a
working form in front of it. What the form cannot do today is tell a customer
what their own vehicle weighs, so it asks them, and a mistyped GVM produces a
confident wrong answer.

Phase 1 built a database of 159 source-verified variants. This phase connects the
two.

**Non-goals.** The result logic and status ladder do not change. Camper-side
product data, axle-load calculation, and centre-of-gravity modelling remain out
of scope, as does an admin UI.

## 2. Decisions taken

| Decision | Choice |
|---|---|
| What picking a vehicle does | Pre-fill the numeric fields and show provenance |
| Which variants appear | Verified rows automatically, with a hand-editable override file |
| Kerb and tray handling | Pre-fill kerb, and add an explicit tray mass field |
| Data delivery | Static generated catalogue, following the configurator pattern |
| Monthly source watcher | Designed here in full, built in a later phase |

## 3. Architecture

Five pieces, four of them new:

| Piece | Role |
|---|---|
| `SCRIPTS/build-vehicle-catalogue.mjs` | Reads the SQLite, applies the promotion rule, writes the catalogue |
| `src/data/vehicle-selector/catalogue.json` | Generated and committed. About 10 KB gzipped |
| `src/data/vehicle-selector/overrides.json` | Hand-edited force-show and force-hide lists |
| `src/lib/vehicleCatalogue.ts` | Imports and validates, mirroring `src/lib/configurator/catalogue.ts` |
| `src/pages/slide-on-camper-weight-calculator/index.astro` | Picker markup and pre-fill logic in the existing script block |

This mirrors the configurator, where `catalogue.json` is committed, `catalogue.ts`
validates it on read, and admin edits reach production by committing through the
GitHub contents API and triggering a rebuild. Following that pattern means no new
runtime dependency on a public marketing page.

The SQLite database stays a research workspace and never ships to the browser.
Add `npm run catalogue:build` to run the generator.

### Why static rather than a runtime fetch

The complete catalogue, including notes and source attribution, measures 157 KB
raw and **10.4 KB gzipped**. That is smaller than a single image on the page.
Fetching it at runtime would add a network round trip, a Netlify function to
maintain, and a failure mode where the picker renders empty, in exchange for
making overrides instant. Overrides do not need to be instant.

If that changes, swapping the static import for a fetch is a change to
`vehicleCatalogue.ts` alone.

## 4. The generated catalogue

Versioned like the configurator catalogue: `schemaVersion`, `catalogueVersion`,
`generatedAt`, and `sourceDatabaseRowCount` so a stale catalogue is detectable.

Two collections:

- `models` — a small index of make, model, and available model years, driving the
  cascading selects.
- `variants` — the figures, each carrying `id`, `gvmKg`, `kerbKg`, `payloadKg`,
  `frontGawrKg`, `rearGawrKg`, `trayLengthMm`, `trayWidthMm`, `trayState`,
  and a `source` object of manufacturer, title, url, and accessedDate.
  `trayMassKg` is defined in the contract but null for every current row.

The generator performs every fragile transformation once, in tested Node, so the
browser receives only clean values. `kerb_mass_basis` is the clearest case: it
arrives as 19 distinct free-text wordings and must never be parsed in the browser.

## 5. Promotion rule

A variant appears when `verification_status === 'source_verified'` and its id is
absent from `overrides.hide`. Any id in `overrides.show` appears regardless, and
the generator records the reason in the output so a hand-promoted row stays
traceable.

Today that promotes **132 variants across 21 models** and withholds 27, including
all 23 Ford Ranger 2026.50MY rows until their kerb figure is corrected.

There is deliberately **no model-year filter**. Somebody driving a 2022 Ranger
should find 2022 figures, because those rows describe that vehicle accurately.
Document staleness is a data-quality question, and `verification_status` already
answers it.

## 6. Kerb and tray handling

Most published kerb figures exclude the tray, and a slide-on always sits on one.
Pre-filling a bare-chassis kerb into a form that then computes remaining capacity
would overstate what the vehicle can carry by more than 100 kg.

The generator derives `trayState` as four values rather than a boolean, because
forcing a guess is what creates the risk:

| `trayState` | Derived from | Behaviour |
|---|---|---|
| `included` | "with Mazda standard tray fitted" | Pre-fill kerb. No tray field. |
| `excluded` | "excludes tray body" and its variants | Pre-fill kerb. Show tray field, blank. See the note below on why no default is available. |
| `not_applicable` | "tub body, no tray state published" | Tub vehicle. No tray field. |
| `unknown` | Everything else | Pre-fill kerb. Show tray field **blank**, with a line stating the manufacturer does not say whether the tray is included. |

`unknown` is the honest default and the majority case. It asks the customer for a
number rather than inventing one.

### The tray field ships blank, always

An earlier draft of this design defaulted the tray field to a published tray
mass. Checking the data killed that idea. Ten rows carry a tray mass in their
notes, and every one of them is a Mazda BT-50 cab-chassis row whose stored kerb
already includes the tray, so the field never appears for them. Of the 29
promotable rows that would show the field, **none** has a tray mass available.

So the field ships blank in every case, with help text asking the customer to
weigh or look up their tray. That is honest, and the alternative would be
fabricating a default for the one number this design exists to get right.

Making a default possible later means storing both kerb states per row, which is
a schema change tracked as an open question below.

## 7. Picker and pre-fill

Three cascading selects — make, then model, then variant — sit above the existing
form. The free-text `vehicleName` input stays, so a customer whose vehicle is not
in the catalogue loses nothing.

| Form field | Source | When absent |
|---|---|---|
| `gvm` | `gvmKg` | Always present |
| `currentWeight` | `kerbKg` | Always present |
| `trayLength`, `trayWidth` | `trayLengthMm`, `trayWidthMm` | Blank for 83 of 132 variants; help text asks the customer to measure |
| `trayMass` (new field) | None available today | Always blank when shown; help text asks the customer to weigh or look up the tray |
| `vehicleName` | Composed label | — |

Every pre-filled value stays editable. Editing a field marks it customer-supplied,
so re-picking a vehicle does not silently overwrite a real weighbridge figure the
customer entered. Pre-fill is a starting point, never an answer.

## 8. Provenance

Below the picker: manufacturer, document title as a link, the date the document
was checked, and one plain-English confidence line.

> Published by Mazda Australia in the BT-50 payload calculator, checked 18 August
> 2026. Kerb mass includes the standard alloy tray.

This is where the phase 1 source work earns its keep, and it is what separates
this from a generic calculator.

## 9. Failure behaviour

If the catalogue fails validation during a build, the build fails. There is no
silent fallback to stale data.

If the picker cannot initialise in the browser, the form remains fully usable as
manual entry, exactly as it is today. The selector enhances a working tool and is
never a dependency of it.

## 10. Testing

`node --test` covers 16 core modules and currently covers this calculator with
nothing at all. That gets fixed here, because this phase makes the calculator
consume database figures rather than hand-typed ones.

- **`vehicleSuitabilityCalculator.js`** — overload, tight margin, tray dimension
  mismatch, unchecked confirmations forcing an amber result, and the
  missing-field path.
- **Generator** — the promotion rule in both override directions, `trayState`
  derivation across all 19 observed basis wordings, and a guard asserting every
  emitted variant still satisfies GVM minus kerb equals payload.
- **Playwright** — picking a vehicle populates the fields, an edited field
  survives a re-pick, and the form still works with the picker disabled.

## 11. Monthly source watcher

Designed here, built in a later phase. It depends on the catalogue, the promotion
rule, and the override file existing first.

### What it must not do

It must never write `customer_selectable` or promote a variant. The value of this
database is that every figure traces to a document somebody read, and phase 1
produced direct evidence of why that matters: a supplied compilation that looked
immaculate, with all arithmetic reconciling, carried wrong kerb and payload
figures for two RAM 1500 grades. Only fetching the manufacturer brochure caught
it. An unattended pipeline would have published them.

The asymmetry decides the design. A missed new model costs a little coverage for
a month. A wrong payload figure that nobody reviewed puts an overloaded vehicle
on the road.

### Three stages, in increasing order of risk

**Stage 1, link health. No AI.** Fetch every URL in the `sources` table monthly.
Record HTTP status and a content hash. Report dead links, redirects, and hosts
that block automated retrieval. This is probably the highest-value part: 28
sources will decay, and `ford.com.au` already blocks retrieval outright.

**Stage 2, figure drift. No AI.** For each source with a stored extraction recipe,
re-extract the known figures and diff them against the database. A changed GVM
means the manufacturer revised the specification, which is exactly what a person
needs to know. Recipes live in `data/vehicle-selector/watch-recipes.json`, keyed
by source id, holding the page or selector hints and the fields expected. Recipes
are maintenance, and the design accepts that cost in exchange for determinism.

**Stage 3, discovery. AI.** For documents whose hash changed, and for a small list
of watched manufacturer index pages, ask a model to identify variants, grades, or
model years present in the document but absent from the database. Give it the
rules already written in `data/vehicle-selector/RESEARCH-PROMPT.md`, which require
a source locator for every figure and forbid inference.

Stages 1 and 2 are deterministic and carry no hallucination risk. Build them
first; they deliver most of the value.

### Output and human gate

Findings go to a review queue in Netlify Blobs, following the owner-copilot store
pattern, with an audit entry per run via `appendOwnerAudit`. An admin screen lists
each finding with the diff and a link to the source document.

Accepting a finding writes to `seed.sql` through the GitHub contents API, the same
route `admin-deploy.ts` already uses, which triggers a rebuild and regenerates the
catalogue. Rejecting records the decision so the next run does not re-raise it.

A blocked host produces a finding of its own that reads "needs manual retrieval",
naming the document, rather than failing silently. That is how a person learns
they need to download a Ford PDF again.

## 12. Open questions

1. Should `vehicle_variants` store both the bare and tray-fitted kerb mass, so
   tray mass becomes derivable rather than absent? Mazda publishes both, and the
   difference is 114 to 144 kg depending on cab. Doing this would let the tray
   field carry a real default and would let a customer with a non-standard tray
   adjust from a known baseline.
2. Which admin capability gates the review queue, once the watcher is built?
3. Should the watcher run against a staging branch rather than committing to the
   default branch directly?
