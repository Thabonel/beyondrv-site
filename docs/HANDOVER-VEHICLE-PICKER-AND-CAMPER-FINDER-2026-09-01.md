# Handover: the vehicle picker, the camper finder, and the publication gate

Date: 1 September 2026, updated 3 September 2026
Repo: `Thabonel/beyondrv-site`
Covers: pull requests #37 to #62, from 30 August to 3 September 2026.

The filename keeps its original date so existing links still work.

Read "Open items" and "Traps that cost time" before changing anything in the
vehicle catalogue, the publication gate, or the end-to-end tests.

## Current state

| Item | Value |
|---|---|
| Live on production | **161 variants across 13 makes**, verified 3 September |
| Of those, optimistic kerb | 23, each disclosed to the customer |
| Merged | #37 to #62 |
| Closed unmerged | #56, superseded by #58 |
| Open | #34 (tray sizes, from August) |
| Utes in the database | 159, of which 132 are `source_verified` and 27 `needs_secondary_review` |
| Truck chassis | 15, of which 5 cannot publish |
| Truck families still unresearched | 9 |

The 13 makes are Chevrolet, Ford, GWM, Hino, Isuzu, KGM, Kia, Mazda, Mitsubishi,
Nissan, RAM, Toyota and Volkswagen.

## What shipped

### The admin dashboard stopped timing out

It was returning 500 and `the edge function timed out`. One request fanned out to
Netlify Blobs, PostHog, and OpenAI with no time limit anywhere.

PostHog and OpenAI now run under a shared request deadline and fall back to the
rule-based insights that already existed. Separately, the dashboard was asking
the lead-status store for a record per enquiry whether or not one had ever been
written; it now lists once and fetches only keys that exist.

Functions run in `cmh` and blobs in `us-east-2`, the same region, so the cost is
the number of calls rather than the distance of each.

### The vehicle picker went live

It had been hidden since it was built, because no variant passed the publication
gate. Two things were needed.

**A review screen**, in the admin dashboard, where a reviewer ticks variants and
publishes a batch as one commit to `data/vehicle-selector/reviews.json`. It
needed a new `vehicles:review` capability: the `gm` role held neither
`site:read` nor `site:write`, so it could not have reached the screen at all.

**A build fix.** `SCRIPTS/build-vehicle-catalogue.mjs` never ran in CI. It was
wired only to `npm run catalogue:build`, and `catalogue.json` is committed, so
publishing a decision would have committed the decision and changed nothing a
customer sees. It now runs first in the Netlify build command.

### Trucks joined the same picker

`heavy_overland_chassis` held 15 rows the build never read.

A truck needed no new concept. It is a large cab chassis, and 63 of the 159 utes
are already `cab_chassis`; `deriveTrayState` returns `excluded` for them, which
makes the calculator ask for the tray weight. Trucks map onto the same shape,
with chassis mass as kerb and GVM minus it as payload, so the payload reconciles
by construction.

`max_body_length_mm` deliberately does **not** prefill a tray length. See
"Traps".

### The tray-to-model finder

Campers are built to order, so "will this fit?" is not the question. What tray
size decides is **which model**, because the model names are the sizes.

A step above the calculator takes a tray length and names the model, lists the
smaller ones that also suit, and says which are too long. It covers seven
campers from 2120 mm to 4700 mm.

Model sizes live on the product entries as
`suitabilityData.requiredTrayLengthMm` at `target` status. When someone measures
and confirms one, the "indicative" wording drops with no code change.

### Wording corrections

The empty-picker notice told customers to take their figures from the compliance
plate. A plate carries ratings, not a current weight. It now says to take GVM
from the plate and that an approximate weight is enough.

The 4.7 m camper stated Unimog as a platform flatly in its tagline, `keySpecs`
and `seoDesc`, while its body text said "adapted to suit a Unimog". The
summaries now match the detail.

## What shipped on 3 September

### The last four variants, and a merged pull request that changed nothing

`main` was at 157 variants when it should have been at 161. #50 had been opened
with `--base data/publish-all-verified-utes` so it could stack on #49. #49 merged
to `main` first, which left #50 pointing at a branch that was already spent.
GitHub merged it there and marked it MERGED. Nothing reached `main`.

It was caught only because the production check came back 134 variants with zero
optimistic flags, against a stated expectation of 161. See "Traps".

#58 then landed the 27 flagged variants from `staging`, and did it better than
the replacement branch: it also records `correctedFields: ["payloadKg"]` on three
entries. #56 was closed rather than merged, because merging it would have
overwritten those three disclosures.

That left four RAM 1500 Hurricane variants in the `hide` list. They had moved
there in 87a0b28, a commit titled "make homepage range cards easier to navigate",
as bare id strings with no reason, reviewer or date, unlike every `show` entry.
No code rule required it. All four are read from the RAM 1500 Hurricane brochure
and reconcile exactly: 3505 kg GVM less kerb equals the published payload at
1014, 863, 783 and 893 kg.

#60 published them on the owner's instruction, **with a reason recorded on each**,
including the fact that the brochure states no model year and the catalogue
resolves it to 2026. That was the most plausible motive for the original hide,
and it is now written down.

### The calculators feed the enquiry form

The calculators handed the enquiry form one prose blob, twice, as `message` and
`fit_check_summary`. The form had accepted structured fields from the URL all
along and nothing ever sent one, so a customer who had just measured their tray
was asked for it again, and the figure reached Beyond RV only as text inside a
summary that cannot be sorted or counted.

`tray_length`, `vehicle_make_model_year` and `tray_type` now travel (#61), and
the towing calculator sends the vehicle too (#62).

Deliberate refusals, each with a test:

- **Never `requiredTrayLength` as the tray length.** It sits beside `trayLength`
  and looks interchangeable, but it is the length the *camper* needs. Same shape
  of error as reading a chassis's maximum body length as its tray.
- **Never the `'your vehicle'` fallback.** The summary prose uses it when the
  field is empty. It reads fine in a sentence and is nonsense in a field meant to
  name a vehicle.
- **Omitted, never empty.** A blank parameter clears the field on the enquiry
  form, which is worse for the customer than typing it.

### Two questions that did not exist

`tray_type` and `gvm_upgrade_status` had no honest source on either calculator.
The catalogue knows a tub from the manufacturer's body type and nothing else, and
nothing anywhere asked about a GVM upgrade. Sending `Unsure` would have reached
the admin as the customer's own answer to a question they were never asked.

So #62 asks. Tray type on the slide-on calculator, beside the tray measurements.
GVM upgrade on both, beside the GVM field, because it is the reason the figure on
the compliance plate may be the wrong one to enter.

**The customer outranks the specification sheet.** The catalogue-derived `Tub`
now fills in only where they have not answered. Someone who has fitted a canopy
to a tub says so, and their answer is what arrives. Verified on production: `Tub`
before answering, `Tray with canopy` after.

The towing calculator still sends no `tray_type`. A caravan is towed rather than
carried on a tray, so the question would be noise there.

### The picker filled the numbers and calculated nothing

Reported from a screenshot: a Triton picked from the finder, GVM and current
weight prefilled, and every result reading "Not calculated".

`hasStarted` was set in exactly one place, the listener for typing into a field.
Selecting a vehicle prefills programmatically, which fires no `input` event, so
the calculator returned `initialSuitabilityResult()` no matter what was in the
form. The page's own instruction says "Enter GVM and current weight for the first
payload result", and the picker fills both.

Pre-existing, confirmed by reproducing it on production before merging anything.
Selecting a variant now counts as starting. On production the same Triton went
from "Not calculated" to **1,055 kg**.

The second half of that report was not a bug. No camper was suggested because the
Triton is a tub, so the catalogue has no tray length to prefill and the finder
asks the customer to measure. Entering 2300 mm suggests the Advent 2300. Inferring
a tray length from a specification sheet is exactly the error described under
"Max body length is not a tray length".

## Open items

### 1. Completed, but not as recorded at the time: #49, #50, #51

#49 and #51 merged to `main`. **#50 did not**, despite reporting MERGED: it was
stacked on #49's branch, which merged first, so its merge landed nowhere. Its 27
variants reached `main` later through #58, and the last four through #60.

Anything relying on "#50 merged" is wrong. See "A stacked pull request whose base
merges first becomes a no-op".

Each of these carries a regenerated `catalogue.json`. If a merge conflicts, the
conflict will be in a generated file: regenerate with `npm run catalogue:build`
rather than hand-merging. See "Traps".

### 2. Decided: the 23 optimistic-kerb Ford variants

#50 publishes 27 variants flagged `needs_secondary_review`. Four were flagged
over a one-kilogram discrepancy in a manufacturer's own published payload, and
their stored figures reconcile.

The other 23 carry this note:

> OPTIMISTIC KERB: stored kerb mass is the lightest-orderable-equipment figure,
> giving the largest payload. Ford also publishes a heavier options figure that
> is not captured here. Do not expose until the conservative figure is added.

They were published on the owner's instruction with that note in front of him,
and #51 discloses the fact to customers. **The remedy the note asks for is still
outstanding**, and on 4 September it was established what exactly it is blocked
on.

#### The note's premise is correct, and the database already proves it

Ford publishes both bases. Seventeen Ford rows already in the database carry
`Kerb weight with heaviest factory optional equipment`, taken from
*Next-Generation Ranger 2022MY Specifications*. The 23 flagged rows carry Ford's
`Kerb Weight`, the lightest orderable combination, from the *Ranger 2026.50MY
Specifications Brochure*.

So the dataset holds two different kerb bases for the same make, and the flag
marks precisely the rows using the optimistic one. The flag is correct and the
disclosure is correctly targeted: 23 of 47 Ford variants carry it, and the 17
heaviest-equipment rows rightly do not.

#### What it is blocked on

The heaviest-equipment figures for the 2026.50MY range. On 4 September:

- `ford.com.au` returned **HTTP 403** to automated retrieval, as the note records
- no mirror of the 2026.50MY Australian specifications brochure could be found,
  unlike the Hino sheet, which was readable from a mirror
- third-party pages publish only approximate ranges, which are not a manufacturer
  figure and must not be entered as one

**This needs a manual copy of the 2026.50MY brochure, page 21, table "4x4 |
Wolftrak, Tremor, Wildtrak, Platinum, Raptor Ranger 2026.50MY Specifications",
row group "Vehicle Masses (kg)"** — the same document the lightest figures came
from, read for its heavier column. That is the one input required; everything
downstream is mechanical.

Do not derive these figures from the 2022MY rows. The generations differ, and a
2026 Wildtrak's lightest kerb of 2331 kg sitting 10 kg under the 2022 Wildtrak's
heaviest of 2341 kg is a coincidence of two different bases, not a relationship
to extrapolate from.

#### Decided on 4 September

The owner's instruction is that these are a guide, not a life-and-death figure,
and that every number is checked when the customer brings the vehicle to the
factory. The research note on all 23 rows now records that decision instead of
the instruction "Do not expose until the conservative figure is added", which the
site had already overtaken and which made the record contradict the site.

**The phrase `OPTIMISTIC KERB` was deliberately preserved in every note.** The
build derives the customer disclosure from that literal string:

```js
kerbIsOptimistic: !correctedFields.includes('kerbKg') && /OPTIMISTIC KERB/i.test(r.notes ?? '')
```

Rewriting a note without it would silently switch the disclosure off for that
variant, with nothing failing. If these notes are ever edited again, check the
flag count is still 23 afterwards.

The heavier figure is still worth adding when a copy of the brochure is to hand,
and the note now says so per row. It is no longer a blocker.

#### Until then

Nothing is misrepresented to a customer. The calculator discloses the basis on
every one of the 23, and the standing disclaimer says Beyond RV weighs the
vehicle at the factory before build. The cost of the gap is a payload that reads
better than the vehicle will deliver, which the disclosure states plainly.

#### One thing worth a look while that document is being fetched

Six F-150 rows recorded their basis only as `Published kerb weight`, which says
nothing about which equipment combination it describes.

Resolved on 4 September by disclosing rather than by proving. Ford Australia
defines Kerb Weight across its range as the lightest orderable combination, which
is read from the Ranger brochure footnote we already hold; the F-150 MY24 sheet's
own footnote has not been read. The six are flagged on the owner's standing
decision, because under-disclosing an optimistic figure is the worse error: a
customer told the payload is a best case is more careful, not less.

**This is an inference, and the note on each row says so.** Confirm against the
F-150 sheet footnote when a copy is to hand, alongside the Ranger figures.

### 3. Completed: seed.sql rebuilds the committed database again

`bash data/vehicle-selector/build-database.sh` rebuilds the sqlite from
`schema.sql` and `seed.sql`. Running it on 4 September produced **13 heavy
overland chassis and 28 sources where the committed database has 15 and 29**.

The missing rows are `hino-300-817-4x4-single-cab`, `hino-300-817-4x4-crew-cab`
and the source `hino-300-817-4x4-spec-0822`. The Hino research on 1 September was
written into the binary and never back into the seed.

So **running the build script silently deleted the Hino**, and reported success
while doing it.

Fixed on 4 September. The two chassis, the source and the corrected `hino-300`
coverage row are written into `seed.sql`, and a rebuild now reproduces the
committed database exactly, all 244 rows. The three CSV exports were stale in the
same way and are regenerated.

`tests/vehicle-database-seed.test.ts` rebuilds from `schema.sql` and `seed.sql`
into a temporary file and compares every row against the committed database, so
the next divergence fails rather than waiting to be noticed. Restoring the old
seed fails it.

The underlying habit is the thing to watch: research written straight into the
binary is invisible to the seed, and nothing except that test will tell you.

### 4. A published variant still says "Do not expose"

`ford-ranger-super-duty-my26-single-cab` is live on production and carries this
research note:

> Do not expose until Ford publishes a full delivered-variant mass table and
> tray/body deductions are configured.

Unlike the 23, it carries **no customer disclosure at all**: its kerb basis is
`Derived from GVM minus published maximum payload; excludes tray`, so it is a
derived figure rather than a published one, and `kerbIsOptimistic` is false
because the note does not contain `OPTIMISTIC KERB`.

That is the weaker position of the two. The 23 are optimistic and say so; this
one is derived and says nothing. Three options: add a disclosure of its own,
hide it until Ford publishes the mass table, or accept it as a guide like the 23
and update the note to record that decision. Not decided.

### 5. Nine truck families still unresearched

Isuzu Trucks N Series, Fuso Canter, Mercedes-Benz Sprinter Cab Chassis,
Volkswagen Crafter Cab Chassis, IVECO T-Way 4x4/6x6, MAN TGS 4x4/6x6,
Mercedes-Benz Arocs AWD, Scania XT 4x4/6x6, Volvo FMX 4x4/6x6.

Hino 300 is no longer among them; it was researched on 1 September and moved to
`seeded`.

The method is proven. Hino publishes a specification sheet carrying exactly the
fields the schema wants, including `max_body_length_mm`, which decides which
camper a chassis can take. `hino.com.au` returned 403 to an automated fetch; the
identical document was read from a mirror and the source row records that.

### 6. Five chassis that cannot publish

Three have no `chassis_cab_total_mass_kg`, so no reconciling payload. Two Isuzu
NPS rows have no `model_year_start`, which the catalogue requires as an integer.
The build names each one it skips, and refuses loudly if somebody selects one.

### 7. Completed: the Advent 2450's two widths

Fixed on 3 September. The contradiction was between two frontmatter entries both
labelled "Base": `keySpecs` said `2450mm x 2000mm` and `specGroups` said
`2450mm x 2050mm`. The prose body never mentions a width at all, so the earlier
description of this item was wrong about where the conflict lived.

`specGroups` was the outlier and now reads 2000mm. Three things support that:
every Advent model lists a 2000mm base width in `keySpecs`, the 2450's overall
size is `4410 x 2050 x 2000 (L x W x H)` so 2050 is the overall width rather than
the base, and 2050 sits directly above the base line, which is how a figure gets
copied to the wrong row.

Overall width stays 2050mm. **If the GM knows the 2450's base really is 2050mm,
the one-line change belongs in `keySpecs` instead**, and the whole range should
be checked, because all three Advents claim a 2000mm base.

### 8. Pull request #34, tray sizes

Held since 22 August because nothing was published, so the feature was
unreachable. That reason has gone.

### 9. Completed: the review screen offered published vehicles

Every one of the 161 live variants shows `published: false` in
`vehicle-review-candidates.json`, so the review screen still lists them all as
candidates. The flag tracks `reviews.json` only, and everything live went through
the override path instead. Pre-existing, and confirmed against `main` rather than
assumed.

### 10. Generated files are committed

`catalogue.json` and `netlify/functions/vehicle-review-candidates.json` are
generated and committed. Any two branches that touch vehicle data conflict in
them, every time. This caused six failed merge attempts on 1 September.

The vehicle catalogue is now generated during the Netlify build, so committing
it buys little. Generating both at build time, or ignoring them, removes the
whole class of conflict.

## Traps that cost time

### Max body length is not a tray length

`max_body_length_mm` is the largest body a chassis is **rated for**, not the tray
someone fitted. Prefilling it would tell a Hino 817 owner their tray is 4865 mm
when it might be 4200 mm, and the error runs toward suggesting a longer camper
than the vehicle carries.

The same trap appeared in a U1700 specification sheet, where `Length 6940 mm`
sits beside shipping volume and approach angle. That is the whole vehicle. The
tray measured 4200 mm.

### A stacked pull request whose base merges first becomes a no-op

#50 was opened against #49's branch. #49 merged to `main` first, so #50's merge
landed in a branch that no longer led anywhere. GitHub reported MERGED. The 27
variants never reached `main`.

Either merge the stack strictly bottom-up, or open each pull request against
`main` and rebase. "MERGED" says where a branch went, not that anything shipped.

### Merged is not deployed, and deployed is not live

Three separate states, and only the last one matters to a customer. On
3 September a pull request reported MERGED while `main` was unchanged, and later
a deploy was called pending when it had actually published 45 seconds after the
merge.

Check the last state directly: drive the live page, or read Netlify's own deploy
record. `state: ready` with a `published_at` is the answer; a green pull request
is not.

### Watch for a signal that exists in the artefact you are checking

A deploy watcher polled the served HTML for `vehicle_make_model_year`. That
string lives in Astro's bundled JavaScript, not in the page source, so it would
have polled forever. The catalogue checks worked because catalogue JSON *is*
inlined, and the assumption was carried across to code that is not.

Markup like `id="gvmUpgrade"` is in the HTML and is a sound signal. Anything from
a `<script>` block is not. When a watcher does not fire, check the signal before
concluding anything about the deploy.

### A verification has to be able to fail

Four checks passed for the wrong reason on 1 September:

- grepping a page for text that is present but `hidden`
- fetching a bundle without following the redirect, so the body was empty
- matching a string that already existed before the change
- `grep -A2` on a single-line sitemap, returning the first `lastmod` in the file

Every one reported success regardless of the outcome. **Check something that
should not have changed, alongside the thing that should.** If both read the
same, the check is broken.

Two more on 3 September: a diff that stringified override objects, so every entry
read `[object Object]` and appeared to differ; and a count of `"make":"RAM"`
occurrences that returned 10 for 7 variants, because the page emits each variant
twice. Counting distinct ids gave the right answer, and a Ford control showed the
duplication was page structure rather than a data fault.

For the test suites written that day the method was: **revert the source change
and confirm the right tests fail.** Ten tests passing proves nothing on its own.
Reverting showed exactly the two that asserted new behaviour failing, with every
control still passing.

### Run the commands CI runs

`quality` runs `npm run check` and `npm test`; `browsers` runs
`npm run test:e2e`. Running the unit tests and one Playwright project is not the
same thing, and a type error reached CI that way.

Note also that **`tsc --noEmit` does not check `.astro` script blocks at all**.
`astro check` does, and caught two real errors that `tsc` reported clean.

### Playwright checkboxes on this page

Every field change triggers a full recalculation and re-render, so a coordinate
resolved before that render can land elsewhere by the time a click is delivered.
`page.check` then fails with "Clicking the checkbox did not change its state".

Use the `tick` helper in `tests/e2e/vehicle-selector.spec.ts`: it asserts the box
is visible and enabled, then clicks the element directly. Do not narrow this to
"the checkboxes that have failed so far" — that was tried and the next CI run
failed on a different one.

### The publication guard

`tests/vehicle-catalogue-publication.test.ts` independently recomputes what
should be live from the database and `overrides.json`, then compares it with the
committed catalogue. It caught a catalogue committed at 134 variants while the
overrides listed 161.

If it fails, the catalogue and the overrides disagree. Regenerate; do not edit
the catalogue by hand.

## How publication works

A variant reaches customers through one of three routes, checked in this order
by `isPromoted` in `src/lib/vehicleCatalogue/derive.ts`:

1. `overrides.json` `hide` removes it, whatever else says.
2. `overrides.json` `show` publishes it on a named person's authority. The
   calculator discloses this: "published to the selector manually by Beyond RV".
3. `reviews.json` publishes it through the review screen.
4. Otherwise `customer_selectable` plus an approved `data_review_log` entry.

Everything live today went through route 2. Nothing has ever gone through
route 3 or 4.

## Review found six real bugs

Codex reviewed these pull requests and found six defects that were all correct:

- corrected figures were credited to the manufacturer, because
  `validateVehicleCatalogue` rebuilt each variant without `correctedFields`
- a figure typed back to its original value was reported as corrected
- a chassis with no model year would have failed the build when approved
- correction bounds were ute-shaped, so a 13,000 kg MAN GVM was uncorrectable
- a truck correction accepted on write was rejected on read, because the
  platform did not travel with the entry
- the sitemap still advertised 29 July for two pages whose structured data had
  changed

It is worth keeping on this repo.
