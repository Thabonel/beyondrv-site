# Tray size to camper model

**Status:** Approved design, ready for implementation
**Date:** 31 August 2026
**Phase:** 4 of the vehicle selector work
**Related:** [Vehicle review screen](2026-08-30-vehicle-review-screen-design.md)

## 1. Goal

Tell someone with a ute tray which camper model suits it.

**Campers are built to order.** A camper does not have to be squeezed onto a
tray, because it is built for that tray. So "will this camper fit?" is not the
question — it will fit when it is delivered.

What tray size does decide is **which model**. The model names are the sizes: an
Advent 2150 is a 2150 mm camper. You cannot build a 2450 onto a 2100 mm tray,
because that is a 2150. Build to order absorbs a small difference, not a model
change.

So the tool answers: *my tray is this long, which model am I looking at?*

**Non-goals.** No fit verdict, no pass or fail. No change to the weight
calculator's arithmetic or its red/amber/green ladder. Nothing about weight:
every slide-on is 700 kg to 1 tonne, and the loaded-weight check already covers
that.

**This supersedes an earlier draft of this spec** that treated camper footprints
as fixed and computed whether they fit. That premise was wrong.

## 2. Decisions taken

| Decision | Choice |
|---|---|
| The question answered | Which model suits this tray, not whether a camper fits |
| Where it lives | A short step above the existing weight calculator |
| What the customer supplies | Tray length in mm, typed |
| What decides the model | The model's nominal length, which is its name |
| Build-to-order tolerance | 50 mm, named constant |
| Result | The largest model the tray suits, plus the smaller ones that also suit |
| Confidence | Indicative. Beyond RV confirms before purchase |

## 3. The models

Nominal length is the model. Width is recorded but does not discriminate: every
model is 2000 mm to 2050 mm wide and build to order absorbs that range.

| Model | Nominal length | Roof |
|---|---|---|
| 7ft Electric Pop-Top | 2120 mm | Electric pop-top |
| Advent 2150 | 2150 mm | Hardtop |
| Advent 2300 | 2300 mm | Hardtop |
| Advent 2450 | 2450 mm | Hardtop |

The 7ft and the Advent 2150 are 30 mm apart, so at that tray size both suit and
the real choice is roof type. The interface has to make that readable rather than
presenting a 30 mm difference as if it mattered.

### 3.1 On the Advent 2450's disputed width

Its file states 2000 mm in `keySpecs` and 2050 mm in the body. Under this design
that no longer blocks anything, because width does not select the model. Worth
correcting in the content, but it is not on this feature's path.

## 4. Architecture

| Piece | Role |
|---|---|
| `src/lib/camperModels.ts` | New. Model selection, no I/O, unit tested |
| `src/content/products/*.md` | Extended. `suitabilityData.requiredTrayLengthMm` filled |
| `src/pages/slide-on-camper-weight-calculator/index.astro` | Extended. Queries the collection, renders the step |

`suitabilityData` already exists in `src/content.config.ts:30` with a
`draft | target | confirmed` status. `requiredTrayLengthMm` now means *the tray
length this model is built for*. Filled at `target`, transcribed from the
published model sizes.

The page currently hardcodes its four campers. It queries the collection instead,
filtered to `category === 'slide-on'` and not archived, so the model list and the
sizes come from one place.

## 5. Selection

```ts
export const BUILD_TOLERANCE_MM = 50;

export type ModelVerdict = 'best' | 'also_suits' | 'too_long' | 'unknown';

export function modelsForTray(
  trayLengthMm: number,
  models: CamperModel[],
): Array<{ model: CamperModel; verdict: ModelVerdict }>;
```

Rules:

1. A model with no nominal length, or at `draft` status, is `unknown`.
2. A model suits when `nominalLengthMm <= trayLengthMm + BUILD_TOLERANCE_MM`.
   The tolerance is what build to order absorbs.
3. The largest suiting model is `best`. The rest that suit are `also_suits`.
4. Anything that does not suit is `too_long`.
5. A tray length that is missing, zero, or negative makes every model `unknown`.

Ordering within the result is by nominal length, longest first, so `best` leads.

## 6. Interface

Above the existing form: one field, **Tray length (mm)**, and a result.

The result names the model and says why:

> **Advent 2300** — built for a 2300 mm tray, which matches yours.
> Also suits your tray: Advent 2150, 7ft Electric Pop-Top.
> Too long for this tray: Advent 2450.

Each model links to its product page. Choosing one fills `requiredTrayLength` in
the detailed calculator below, so the finder feeds the existing check.

Where two models are within the tolerance of each other, they are presented as a
choice of roof rather than a difference in size:

> At this tray length the 7ft Electric Pop-Top and the Advent 2150 both suit.
> The difference is the roof, not the size.

Nothing renders until a tray length is entered. An empty result would read as
"nothing suits you".

Standing line under the result, while models are at `target`:

> Indicative. Campers are built to order, so Beyond RV confirms the final size
> with you before build.

## 7. Failure behaviour

| Failure | Behaviour |
|---|---|
| No model has a nominal length | Every model is `unknown` and the step says to talk to Beyond RV. No empty result |
| A length in frontmatter is not a number | The build fails. `suitabilityData` types it as `z.string()`, so the schema accepts `"abc"` and the page's build-time parse must throw rather than coerce to zero. A model read as 0 mm would suit every tray |
| Tray shorter than every model | Every model is `too_long`, and the step says Beyond RV builds to order and to get in touch. This is a conversation, not a dead end |
| JavaScript unavailable | The field is inert and the detailed calculator behaves exactly as today |

The step never says a camper will not fit, because that is not true of a
build-to-order product. The strongest negative it gives is "too long for this
tray", pointing at a smaller model.

## 8. Testing

`src/lib/camperModels.ts`, unit tested under `node --test`:

- a tray longer than every model makes the longest model `best`
- a tray exactly equal to a model's nominal length makes that model `best`
- a tray 50 mm shorter than a model still suits it, at the boundary
- a tray 51 mm shorter does not, at the boundary
- smaller models that suit are `also_suits`, ordered longest first
- a tray shorter than every model makes all of them `too_long`
- a model at `draft` is `unknown` even with a nominal length
- a zero or negative tray length makes every model `unknown`
- a non-numeric nominal length throws rather than being read as zero

End to end:

- entering a tray length names a model and lists the alternatives
- choosing a model fills the required tray length in the detailed form
- the two models within tolerance are presented as a roof choice

## 9. Out of scope

- Prefilling tray length from the vehicle picker, which stays hidden until the
  Ford reviews land. The step is designed so prefill is an addition, not a redesign
- Tray size collection from owners, pull request #34
- Camper width. It does not select the model
- Correcting the Advent 2450's stated width, which is a content fix
