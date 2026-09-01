# Trucks in the vehicle picker

**Status:** Approved design, ready for implementation
**Date:** 1 September 2026
**Phase:** 5 of the vehicle selector work
**Related:** [Vehicle review screen](2026-08-30-vehicle-review-screen-design.md), [Tray size to camper model](2026-08-31-camper-fit-finder-design.md)

## 1. Goal

Let a truck owner pick their chassis in the same place a ute owner picks theirs.

`heavy_overland_chassis` holds 15 truck rows with GVM, axle limits, chassis mass
and body length. `SCRIPTS/build-vehicle-catalogue.mjs` queries `vehicle_variants`
only, so every one of them is invisible to the site regardless of approval.

The expedition campers, 3.5 m and 4.7 m, need truck platforms. Without this the
finder can name them but nobody can pick the vehicle that carries them.

**Non-goals.** No change to the weight arithmetic, the red/amber/green ladder, or
the publication gate. No second picker.

## 2. The insight this rests on

A truck is a large cab-chassis, and the catalogue already models cab-chassis:
63 of the 159 ute variants are `cab_chassis`, and `deriveTrayState` returns
`excluded` when the kerb mass basis excludes the tray, which makes the calculator
ask for the tray weight.

So trucks need no new concept. They need mapping.

| Catalogue field | Truck source |
|---|---|
| `kerbKg` | `chassis_cab_total_mass_kg` |
| `payloadKg` | `gvm_kg` minus chassis mass, so it reconciles by construction |
| `bodyType` | `cab_chassis` |
| `trayLengthMm`, `trayWidthMm` | `null`. A chassis has no tray until one is fitted |
| `kerbBasis` | `mass_basis`, worded so it states the body is excluded |

## 3. Decisions taken

| Decision | Choice |
|---|---|
| Where trucks appear | The same picker, in the same make list |
| What `max_body_length_mm` does | Guidance beside the picker. It never prefills a tray length |
| Tray dimensions | Left empty for the customer to enter |
| Publication | The existing gate, unchanged |

### 3.1 Why max body length must not prefill

It is the largest body the chassis accepts, not the tray someone fitted.
Prefilling it would tell a Hino 817 owner their tray is 4865 mm when it may be
4200 mm. That is the same error as reading a U1700's 6940 mm overall length as
its tray, and it runs in the dangerous direction: it would suggest a longer
camper than the vehicle can carry.

It is shown as what it is: the longest body this chassis takes.

## 4. Architecture

| Piece | Role |
|---|---|
| `SCRIPTS/build-vehicle-catalogue.mjs` | Extended. Second query, mapped and unioned |
| `src/lib/vehicleCatalogue/types.ts` | Extended. `platform` and `maxBodyLengthMm` |
| `src/lib/vehicleCatalogue/validate.ts` | Extended. Parses both, defaults `platform` to `ute` |
| `src/pages/slide-on-camper-weight-calculator/index.astro` | Extended. Shows max body length for a truck |

`platform` is `'ute' | 'truck'`. Existing catalogue entries have no such field, so
the validator defaults it to `ute`, and no existing data has to change.

## 5. Publication

Trucks pass through the same gate as utes: `customer_selectable` with an approved
review, an `overrides.json` entry, or an entry in `reviews.json`. Nothing about
the gate changes, and no truck publishes until someone says so.

## 6. Failure behaviour

| Failure | Behaviour |
|---|---|
| A truck has no chassis mass | It cannot produce a reconciling payload, so the build refuses to publish it and names it |
| A truck has no body length | It publishes without the guidance line. The figure is advisory |
| `heavy_overland_chassis` is empty | The catalogue contains utes only, exactly as today |
| A truck id collides with a ute id | The build fails on the existing duplicate-id check |

## 7. Testing

- a truck row maps to a variant whose payload reconciles
- a truck with no chassis mass is refused rather than published with a wrong payload
- `platform` defaults to `ute` for a variant that omits it
- `maxBodyLengthMm` survives validation and is optional
- a truck variant derives `trayState` of `excluded`, so the tray weight is asked for
- end to end: picking a truck fills GVM and chassis mass and leaves the tray fields empty

## 8. Out of scope

- Researching the nine remaining truck families
- Any change to the camper model finder
- Licence class warnings beyond the note already recorded per chassis
