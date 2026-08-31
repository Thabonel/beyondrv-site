# Camper fit finder

**Status:** Approved design, ready for planning
**Date:** 31 August 2026
**Phase:** 4 of the vehicle selector work
**Depends on:** `suitabilityData` in `src/content.config.ts`, and the existing fit arithmetic in `src/lib/vehicleSuitabilityCalculator.js`
**Related:** [Vehicle review screen](2026-08-30-vehicle-review-screen-design.md)

## 1. Goal

Let someone with a ute tray find out which Beyond RV campers fit it, before they
know which camper they want.

The weight calculator answers "does this camper fit my ute" for a camper the
customer has already chosen and whose weights they type in themselves. The
question buyers actually arrive with is the other way round: *I have this tray,
what fits it?*

Weight is not the discriminator. Every slide-on is between 700 kg and 1 tonne,
and the loaded-weight check already covers that. **Tray size is what decides it.**

The site is a starting point. The real answer comes from a conversation between
the customer and Beyond RV, and the interface must read that way.

**Non-goals.** No change to the weight arithmetic or the red/amber/green ladder.
No change to how enquiries are recorded. The finder does not replace the detailed
check; it feeds it.

## 2. Decisions taken

| Decision | Choice |
|---|---|
| Where it lives | A short step above the existing calculator |
| What the customer supplies | Tray length and width, typed |
| Verdict bands | Fits, close, too small |
| Near-miss width | Short by 50 mm or less on both dimensions reads as "close" |
| Campers with no dimensions | Listed without a verdict, as "ask us" |
| Confidence gate | A camper appears at `target` status, worded as indicative |
| Data source | The products content collection, not a hardcoded list |

## 3. The data, and one thing that blocks it

### 3.1 What exists

`src/content.config.ts:30` already defines `suitabilityData`, with a
`draft | target | confirmed` status and the two fields this needs:

```ts
requiredTrayLengthMm: z.string().optional(),
requiredTrayWidthMm: z.string().optional(),
```

Every camper currently sits at `{ status: 'draft' }` with both fields empty.

The dimensions exist as display prose in `keySpecs` under a `Base` label, and
again in the body text of each product page.

### 3.2 What to fill in

| Camper | Base | Source |
|---|---|---|
| 7ft Electric Pop-Top | 2120 × 2020 | Body text, consistent |
| Advent 2150 | 2150 × 2000 | keySpecs and body agree |
| Advent 2300 | 2300 × 2000 | Body text, consistent |
| Advent 2450 | **disputed** | See below |

Transcribed at `status: target`. The owner has confirmed that for these campers
the base dimensions **are** the tray dimensions required.

### 3.3 Blocker: the Advent 2450 states two widths

`src/content/products/advent-2450-hardtop-slide-on.md` contains both:

- `keySpecs` Base: `2450mm x 2000mm`
- body text: `2450mm x 2000mm` **and** `2450mm x 2050mm`

Two different widths for the same camper in the same file, 50 mm apart, which is
exactly the near-miss band. A fit verdict built on the wrong one would tell a
customer with a 2020 mm tray that the camper fits when it does not.

**The 2450 must not be published to the finder until someone states which width
is correct.** Until then it stays at `draft` and appears in the "ask us" group,
which the design already handles. No code change is needed to hold it back.

## 4. Architecture

Four pieces, two of them new.

| Piece | Role |
|---|---|
| `src/lib/camperFit.ts` | New. Bucketing logic, no I/O, unit tested |
| `src/components/CamperFitFinder` markup in the page | New. Two inputs and a grouped shortlist |
| `src/content/products/*.md` | Extended. `suitabilityData` filled for three campers |
| `src/pages/slide-on-camper-weight-calculator/index.astro` | Extended. Queries the collection instead of hardcoding four campers |

### 4.1 Why query the collection

The page currently hardcodes its camper list, with absolute URLs and
`dryWeight: 'Manual entry required'` for every entry.

That list is **not** currently stale: the fifth slide-on file is
`category: expedition` and `archived: true`, so a correct filter returns the same
four. The reason to query is narrower than "the list has drifted" — it is that
`suitabilityData` lives on the collection entry, and copying dimensions into a
second hardcoded list would create the drift that does not exist yet.

Filter: `category === 'slide-on'` and not `archived`.

## 5. Matching

```ts
export type FitBucket = 'fits' | 'close' | 'too_small' | 'unknown';

export function camperFit(
  trayLengthMm: number,
  trayWidthMm: number,
  campers: FinderCamper[],
): Array<{ camper: FinderCamper; bucket: FitBucket; shortfallMm: number }>;
```

Rules, applied per camper:

1. No `requiredTrayLengthMm` or no `requiredTrayWidthMm`, or a status of `draft` → `unknown`.
2. Tray meets or exceeds both required dimensions → `fits`.
3. Short by 50 mm or less on **both** dimensions → `close`. Equivalently, the
   larger of the two shortfalls is 50 mm or less. A camper 10 mm short on width
   and 200 mm short on length is `too_small`, not `close`.
4. Otherwise → `too_small`.

`shortfallMm` is the larger of the two shortfalls, zero when it fits. It is what
the interface shows, so "50 mm short on width" is stated rather than implied.

`NEAR_MISS_MM = 50` is a named constant. Changing the tolerance is one line.

A tray dimension that is missing, zero, or negative yields `unknown` for every
camper rather than a confident list built on nothing.

## 6. Interface

Above the existing form:

- **Tray length (mm)** and **Tray width (mm)**, two number inputs
- A shortlist, grouped and ordered: *Fits*, *Close*, *Too small*, *Ask us*
- Each row: camper name linking to its product page, and the margin — "180 mm
  clear" or "50 mm short on width"
- Each row has a **Check this camper** action, which fills
  `requiredTrayLength` and `requiredTrayWidth` in the detailed form below and
  scrolls to it

The shortlist appears only once both dimensions are entered. Nothing is shown
before that, because an empty verdict list reads as "nothing fits".

The two finder inputs do not replace `trayLength` and `trayWidth` in the
detailed form; choosing a camper carries the values down so nobody types them
twice.

### 6.1 What it says about confidence

While a camper is at `target`:

> Indicative figures. Beyond RV confirms fit for your vehicle before purchase.

At `confirmed`, that line drops. The `unknown` group says:

> Made to order. Talk to Beyond RV about fitting this to your tray.

The existing final warning and estimate disclaimer on the page are unchanged and
still apply.

## 7. Failure behaviour

| Failure | Behaviour |
|---|---|
| No camper has dimensions | The finder renders, and every camper falls into "ask us". No empty state that implies nothing fits |
| A dimension in frontmatter is not a number | The build fails. `suitabilityData` types these as `z.string()`, so the schema accepts `"abc"` and the page's build-time parse must throw rather than coerce it to zero. A camper silently treated as needing a 0 mm tray would fit everything |
| Customer enters a tray smaller than every camper | All campers group under "too small", with the smallest shortfall first, and the "ask us" group still shows |
| JavaScript unavailable | The finder inputs are inert; the detailed calculator behaves exactly as it does today |

The finder must never claim a fit it cannot support. When in doubt the answer is
"ask us", not a verdict.

## 8. Testing

`src/lib/camperFit.ts` is pure and unit tested under `node --test`:

- a tray larger than required on both dimensions fits
- a tray exactly equal on both dimensions fits, at the boundary
- 50 mm short is `close`, 51 mm short is `too_small`, at both boundaries
- short on width only, and short on length only, are both `close`
- 10 mm short on one dimension and 200 mm short on the other is `too_small`
- a non-numeric dimension throws rather than being read as zero
- a camper at `draft` status is `unknown` even when it has dimensions
- a camper missing either dimension is `unknown`
- a zero or negative tray dimension makes every camper `unknown`
- `shortfallMm` reports the larger of the two shortfalls

End to end, extending `tests/e2e/vehicle-selector.spec.ts` or a sibling spec:

- entering a tray shows campers grouped into the expected buckets
- choosing a camper fills the required tray fields in the detailed form
- a camper without dimensions appears under "ask us" with no verdict
- the indicative wording is present for a `target` camper and absent for a
  `confirmed` one

## 9. Out of scope

- Prefilling tray dimensions from the vehicle picker. It stays hidden until the
  Ford reviews land, and the finder is designed so that prefill is a later
  addition rather than a redesign
- Tray size collection from owners, which is pull request #34
- Any camper weight comparison. The loaded-weight check already covers it
- Resolving the Advent 2450 width, which is a question for the owner
