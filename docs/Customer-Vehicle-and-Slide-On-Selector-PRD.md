# Beyond RV Customer Vehicle, Slide-On and Expedition Platform Selector

## Product Requirements Document

**Status:** Research-backed implementation PRD  
**Version:** 1.1  
**Date:** 17 August 2026  
**Primary surface:** Beyond RV public website  
**Supporting surface:** Beyond RV Admin  
**Research database:** `data/vehicle-selector/australian-slide-on-vehicles.sqlite`

---

## 1. Executive summary

Beyond RV already has a live vehicle suitability landing page and a manual slide-on weight calculator. The next product is therefore not a new calculator. It is a substantial evolution into two related but deliberately separate journeys:

- A removable slide-on selector for utes and light cab-chassis vehicles.
- An expedition-platform discovery and technical-intake path for fixed camper bodies on Unimog, IVECO, Isuzu, Fuso, MAN and comparable AWD trucks.

Together they help an Australian customer identify:

1. Whether their exact vehicle is a plausible slide-on platform.
2. Whether the intended product is a removable slide-on or an engineered expedition body.
3. Which Beyond RV camper configurations are worth considering.
4. Which measurements or changes are still required.
5. When the vehicle must be referred to Beyond RV, a body builder or an engineer instead of receiving an automated result.

The selector will combine an effective-dated Australian vehicle catalogue, customer-specific measurements, verified Beyond RV camper data, load-position calculations and transparent confidence states. It must never describe a generic model as suitable merely because one variant has adequate published payload.

The research seed contains 136 slide-on/pickup variants and 13 heavy-overland chassis records from 26 primary Australian manufacturer sources, plus a 41-model coverage register. It also demonstrates why the current experience needs stricter data governance:

- Published payload may exclude the tray.
- GVM upgrades create a distinct configuration, not an interchangeable number.
- Certification categories can radically change payload on an otherwise similar vehicle.
- Full-size pickup payload can be lower than a conventional ute.
- Manufacturer weights are frequently approximate or maximum values.
- Model-year changes make undated records unsafe.
- Heavy trucks require frame articulation and subframe design, not tray-fit logic.
- A heavy-truck chassis payload is a body-design budget, not camper compatibility.

### Product promise

> Give customers a clear, useful preliminary pathway without pretending that a web form can certify a vehicle and camper combination.

---

## 2. Current-state audit

### 2.1 What exists

The current website includes:

- `/vehicle-suitability-checker/` — a chooser between the slide-on and caravan tools.
- `/slide-on-camper-weight-calculator/` — a live manual-entry calculator.
- `src/lib/vehicleSuitabilityCalculator.js` — tested calculation logic.
- `/inquiry-form/` integration that carries the entered result into a sales enquiry.
- A separate admin configurator foundation for product options, pricing, weight and rules.

### 2.2 What the current slide-on calculator does well

- Uses customer-entered figures instead of silently assuming a generic vehicle.
- Calculates available payload before camper, estimated loaded camper mass, estimated loaded vehicle mass and GVM margin.
- Checks entered tray length and width against entered camper requirements.
- Avoids a positive result when critical rear-axle, tyre and centre-of-gravity confirmations are unchecked.
- Includes prominent estimate-only warnings and a sales handoff.
- Has automated unit tests for missing fields, overload, tight margin, tray mismatch and a nominal positive scenario.

### 2.3 Material limitations observed

| Area | Current behaviour | Product risk or lost opportunity |
|---|---|---|
| Vehicle identity | Free-text vehicle name | Cannot distinguish model year, cab, grade, engine, drivetrain or certification category. |
| Vehicle data | Customer manually enters GVM and current mass | High friction and easy transcription errors; no source provenance. |
| Camper data | Customer manually enters dry mass, water, options and required tray size | Beyond RV cannot guarantee that customers use the correct product version or option weights. |
| Rear axle | Confirmation checkbox only | Does not calculate load transfer or compare estimated rear axle load to GAWR. |
| Front axle | Not modelled | A rear-mounted camper can unload the front axle or create an adverse steering/braking condition. |
| Centre of gravity | Confirmation checkbox only | No geometric calculation or accepted CG envelope. |
| Tyres and tray | Confirmation checkbox / dimensions | No numeric tyre load rating, tray rating, mounting system or clearance check. |
| Fit language | Green result says “Looks suitable” | Stronger than the underlying data justifies; should be framed as a preliminary candidate. |
| Margins | Fixed 150 kg tight-margin rule | Not configurable by product, vehicle class, axle uncertainty or company policy. |
| Data freshness | No vehicle catalogue | No source dates, expiry, supersession or model-year controls. |
| Recommendation | Always “Confirm with Beyond RV” | Does not rank campers, explain configuration changes or identify the binding constraint. |
| Saved results | Query-string handoff only | No durable versioned assessment, evidence attachments or staff review workflow. |

### 2.4 Critical camper-data gap

The current Beyond RV slide-on product records contain base dimensions and water capacities but mark suitability data as draft. They do not publish the verified values required for automated matching:

- Production dry mass and tolerance by model/version.
- Standard-inclusion mass baseline.
- Option-by-option mass deltas.
- Loaded travel scenarios.
- Longitudinal and lateral centre of gravity.
- Accepted centre-of-gravity envelope on the support base.
- Mounting-point locations and reactions.
- Cab-over, headboard, chassis and wheel-arch clearances.
- Maximum permitted rear overhang.
- Required tray structural rating and mounting method.

No automated “candidate” result may launch until these facts are measured and approved.

---

## 3. Research findings

### 3.1 Seed coverage

The initial working database includes source-backed rows for:

- Ford Ranger Super Duty.
- Toyota HiLux.
- Isuzu D-MAX.
- Mazda BT-50.
- Mitsubishi Triton.
- Toyota LandCruiser 70.
- Toyota Tundra.
- Chevrolet Silverado 1500 and 2500 HD.
- Kia Tasman.

The coverage register also identifies Ford Ranger, Nissan Navara, GWM Cannon, GWM Cannon Alpha, KGM Musso, Volkswagen Amarok, RAM 1500/2500/3500, Ford F-150, Isuzu N Series/NPS, Hino 300, Fuso Canter/Canter 4x4, IVECO Daily 4x4, Mercedes-Benz Sprinter Cab Chassis and Volkswagen commercial platforms for staged research.

The dedicated heavy-overland table adds current source-backed records for Mercedes-Benz Unimog U 4023, IVECO Daily 4x4, Isuzu NPS 75-175 4x4, Fuso Canter 4x4, MAN TGM 4x4 RV and IVECO Eurocargo ML150 4x4. The coverage backlog also includes Unimog U 5023, IVECO T-Way, MAN TGS, Mercedes-Benz Arocs and Zetros, Scania XT, Volvo FMX and Tatra Phoenix. Order-specific, imported, ex-service and legacy chassis remain manual-review only.

### 3.2 Representative exact findings

| Vehicle / variant | Published or derived figures | Product implication |
|---|---|---|
| Ford Ranger Super Duty MY26 single cab, excluding tray | 4,500 kg GVM; 8,000 kg GCM; 1,982 kg maximum payload; 1,900/2,800 kg front/rear GAWR | Strong platform, but the headline payload is before tray and other body equipment. |
| Toyota HiLux MY26 4x4 WorkMate single-cab auto | 1,830 kg maximum kerb; 3,065 kg GVM; derived 1,235 kg payload | A useful conventional cab-chassis baseline; axle data still needs a second source or owner/compliance evidence. |
| Isuzu D-MAX 25.5MY 4x4 SX single-cab 3.0L | 1,790 kg kerb excluding tray; 3,100 kg GVM; 1,310 kg payload; 1,450/1,910 kg axle ratings | Source includes genuine accessory tray geometry, making it valuable for the first end-to-end matching pilot. |
| Mitsubishi Triton 25MY GLX Double Cab Chassis | 3,200 kg GVM; 1,210 kg model-level payload; 1,580/2,040 kg axle capacities | Strong model-level result, but exact drivetrain/transmission mapping must be resolved before publication. |
| Toyota LandCruiser 70 MY25 GX single-cab auto | 2,130 kg approximate kerb; 3,510 kg GVM; derived 1,380 kg payload | Attractive platform; published GVM is above 3,500 kg, so licence/registration messaging must be handled carefully. |
| Toyota Tundra MY26 | Limited: derived 744 kg payload; Platinum: derived 702 kg | Size is not a proxy for camper capacity. These variants should normally rank below suitable cab-chassis utes. |
| Chevrolet Silverado 2500 HD LTZ Premium | NB1: 733 kg payload at 4,495 kg GVM; NB2: 1,386 kg at 5,148 kg GVM | Certification category is a first-class selector field; NB1 and NB2 must never be collapsed. |
| Kia Tasman MY26 S 4x2 pickup | 2,126 kg kerb; 3,250 kg GVM; 1,124 kg payload; 1,450/2,040 kg axle ratings | Important omission from the original shortlist; tub-compatible fitment still needs separate geometry rules. |

### 3.3 Heavy-overland exact findings

| Platform / configuration | Official Australian figures captured | Selector implication |
|---|---|---|
| Mercedes-Benz Unimog U 4023 | 3,850 mm wheelbase; 4,600/6,000 kg axle limits; body installation space up to 4,100 × 2,280 × 1,400 mm; 170 kW / 900 Nm | Mercedes-Benz describes a special subframe for torsion-free box-body mounting. The page's 10.3 t mass label is ambiguous and must be clarified before publication. |
| IVECO Daily 4x4 single cab | 3,480/3,780/4,175 mm wheelbases; 7,200/7,200/7,000 kg GVM; 4,232/4,222/4,000 kg published body payload | Six exact single/crew configurations are stored. Body and subframe design still requires the IVECO body-builder manual. |
| IVECO Daily 4x4 crew cab | 3,480/3,780/4,175 mm wheelbases; 3,867/3,857/3,635 kg body payload | Cab choice materially changes the mass budget; it cannot be a cosmetic selector option. |
| Isuzu NPS 75-175 4x4 | Day cab: 2,872 kg chassis and 4,628 kg payload; crew cab: 3,152 kg and 4,348 kg; both 7,500 kg GVM and 3,100/6,000 kg load limits | The current source is NPS 75-175, not the older 75-155 often seen in historical content. Store cab-to-axle and baseline axle distribution. |
| Fuso Canter 4x4 Wide Cab | 6,500 kg GVM; 10,000 kg GCM; 3,415 mm wheelbase; optional 4,500 kg GVM | Useful discovery record, but the public page lacks chassis mass and axle limits, so it cannot support a calculated result. |
| MAN TGM 13.250-290 4x4 RV | 13,000 kg GVM; 6,300/7,800 kg axle capacities; 4,250 mm wheelbase; short-cab payload 7,195 kg and long-cab 6,789 kg | The RV specification is unusually useful because it supplies baseline axle distribution. Its conditional 20,000/28,000 kg GCM wording must remain explicit. |
| IVECO Eurocargo ML150 4x4 | 15,000 kg GVM; 19,000 kg GCM; 3,915 or 4,150 mm wheelbase | Model-level discovery only until exact order-code chassis mass and axle tables are sourced. |

### 3.4 Research conclusions

1. **Exact variant identity is mandatory.** Make/model alone is unsafe and unhelpful.
2. **Payload is not remaining camper capacity.** Tray, passengers, accessories, cargo and towball download consume it.
3. **Cab-chassis and pickup-tub variants need different fitment paths.** A tub vehicle is not automatically compatible with a flat-base slide-on.
4. **Axle ratings are as important as GVM.** A vehicle can remain under GVM while exceeding rear GAWR.
5. **Model-year-effective data is necessary.** The May 2026 Tundra figures already differ from older summaries.
6. **Certification and upgrades must be explicit.** Silverado NB1/NB2 and HiLux optional GVM configurations cannot be represented as a single toggle without evidence.
7. **“All Australian vehicles” is an ongoing catalogue operation.** It cannot be completed by a one-time scrape.
8. **Expedition bodies need their own assessment model.** Frame twist, subframe isolation, cab tilt, axle distribution and body-builder limits are not slide-on fields.
9. **Heavy-vehicle availability is order-code-specific.** A family name such as TGM, T-Way or Arocs cannot be treated as a selectable chassis.
10. **Legacy Unimog names need correction.** Current Australian source material exposes U 4023; U 300/U 400/U 4000 and ex-service vehicles must not inherit current figures.

---

## 4. Goals and non-goals

### 4.1 Goals

1. Help a non-technical customer identify their exact vehicle variant with minimal friction.
2. Prefill trustworthy manufacturer figures with visible source and model-year context.
3. Combine catalogue figures with actual vehicle measurements and fitted-equipment inputs.
4. Match only against approved Beyond RV camper configurations.
5. Calculate GVM, payload, front/rear axle estimates, physical fit and configurable safety margins.
6. Explain the binding constraints in plain English.
7. Produce an auditable, versioned assessment that staff can review and convert into an enquiry/configuration.
8. Provide a safe manual pathway for older, modified, imported or unlisted vehicles.
9. Create a governed admin workflow for adding, reviewing, publishing, expiring and superseding data.
10. Qualify expedition-platform enquiries with enough structured evidence for a body builder and engineer to assess them efficiently.

### 4.2 Non-goals

- Legal certification, engineering sign-off or registration approval.
- A promise that a camper definitely fits based only on catalogue data.
- Automatic approval of GVM upgrades, suspension modifications or tray conversions.
- Replacement of certified weighbridge measurements.
- Automatic VIN decoding in MVP.
- Historical coverage of every vehicle ever sold in Australia at first launch.
- 3D visualisation in MVP.
- Caravans or trailer-towing recommendations in this selector; the existing towing calculator remains separate.
- Automated engineering approval of fixed bodies, subframes, chassis modifications or heavy-vehicle compliance.

---

## 5. Users

### 5.1 Customer personas

| Persona | Need |
|---|---|
| Existing ute owner | Determine whether the current vehicle and tray are a plausible match. |
| Vehicle shopper | Compare exact variants before buying a vehicle. |
| Existing slide-on researcher | Identify which Beyond RV model is worth discussing. |
| Modified-vehicle owner | Enter measured/compliance data that overrides the stock catalogue snapshot. |
| Full-size pickup owner | Understand tub/engineering and real payload constraints. |
| Light-truck owner | Route into a truck-body or engineering-led path. |
| Expedition-truck buyer or owner | Compare plausible 4x4 chassis and prepare a technically complete body-design enquiry. |

### 5.2 Internal personas

- Sales adviser: reviews assessment evidence and contacts the lead.
- Product manager: owns camper facts and matching policies.
- Vehicle-data steward: imports and verifies manufacturer data.
- Engineer/technical reviewer: approves formulas, CG envelopes and exception rules.
- Administrator: publishes/withdraws variants and manages permissions.

---

## 6. Experience principles

1. **Ask easy questions first.** Vehicle identity precedes mass terminology.
2. **Show where numbers came from.** Every prefilled rating links to its source and date.
3. **Measured beats generic.** Current individual axle weights supersede catalogue estimates for the customer's assessment without altering the catalogue.
4. **Never hide uncertainty.** Missing axle, tyre, tray or camper data produces an incomplete/technical-review outcome.
5. **Explain the constraint.** “Rear axle estimate exceeds the rating by 86 kg” is better than a generic red result.
6. **No false green.** The strongest automated outcome is “Preliminary candidate — final confirmation required.”
7. **Separate suitability from desirability.** A technically plausible match can still have poor operating margin.
8. **Preserve the evidence.** Every result is tied to immutable data and calculation versions.

---

## 7. Customer journey

### Step 1: Select the purpose

- “I already own a vehicle.”
- “I am choosing a vehicle.”
- “My vehicle is modified or not listed.”
- “I want a removable slide-on camper.”
- “I want a fixed expedition body on a truck chassis.”

The product choice changes the data model and workflow. A fixed expedition body never passes through the tray-fit calculator.

### Step 2: Identify the exact vehicle

Guided fields:

1. Make.
2. Model.
3. Model year.
4. Cab type.
5. Body type: cab-chassis/tray, factory tub, converted tray or truck chassis.
6. Grade.
7. Drivetrain.
8. Engine.
9. Transmission.
10. Certification or GVM configuration where relevant.
11. For trucks: exact manufacturer order code, axle configuration, wheelbase and cab type.

The UI shows a short identity summary for confirmation. If the customer cannot identify the exact variant, they can upload or transcribe compliance-plate details and continue in “needs staff verification” mode.

### Step 3: Confirm current body and equipment

- Tray/tub manufacturer and material.
- Tray mass if known.
- Usable length and width.
- Headboard, wheel-arch and cab clearance measurements.
- Bullbar, winch, suspension, long-range tank, spare wheels, toolboxes, canopy, towbar and other accessories.
- Any certified GVM upgrade, with evidence.
- Tyre size and load index.

Stock catalogue payload is immediately reduced by known additions. The customer is told when a source payload excludes the tray.

For an expedition chassis, this step instead captures the intended body envelope, body-builder guide version, proposed mounting/subframe system, cab-to-axle dimension, cab-tilt envelope, frame and suspension modifications, spare-wheel/fuel-tank/exhaust/AdBlue locations and any chassis equipment that competes for installation space. Unknown critical fields trigger technical intake, not a calculated match.

### Step 4: Enter occupants and travel load

- Driver and passengers.
- Vehicle luggage/recovery gear.
- Towball download if towing while carrying the camper.
- Other permanent or trip-specific load.

### Step 5: Add measured weights

Preferred:

- Date of weighbridge measurement.
- Front axle mass.
- Rear axle mass.
- Total mass.
- Measurement condition: fuel level, occupants, tray/accessories and cargo included.
- Optional weighbridge docket upload.

If only total mass is available, rear-axle results remain incomplete. Catalogue kerb mass is shown as a low-confidence estimate, never as a measured value.

### Step 6: Choose camper and load scenario

- Beyond RV product.
- Published template/version.
- Required tray/body configuration.
- Product architecture: removable slide-on or fixed expedition body.
- Standard inclusions.
- Selected options.
- Fresh and grey water state.
- LPG, food, clothing and personal gear scenario.
- Towing at the same time, if applicable.

The camper mass and CG are system-controlled facts. Customers may not type a lower dry mass than the approved product value.

### Step 7: Calculate and explain

The result presents:

- Vehicle identity and evidence quality.
- Estimated loaded vehicle mass and remaining GVM margin.
- Estimated front and rear axle loads and margins.
- Tray/tub physical-fit results.
- Camper loaded mass and CG position.
- Tyre and tray-rating status.
- Towing/GCM interaction where supplied.
- The binding constraint and any missing evidence.
- Suggested next action.

For a heavy-overland chassis, the result is a discovery shortlist and engineering intake report. It shows the remaining nominal body-mass budget and known axle/body-envelope facts, but never returns `PRELIMINARY_CANDIDATE` until an approved heavy-body engineering workflow exists. It must explicitly list required body-builder documentation, subframe concept, axle calculation, compliance path and weighbridge evidence.

### Step 8: Save or send

The customer can:

- Email or download a plain-language assessment summary.
- Send the immutable assessment to Beyond RV.
- Request a weighbridge/technical review checklist.
- Compare another vehicle variant while preserving the same camper/load scenario.

PII is requested only when the customer chooses to save or contact Beyond RV.

---

## 8. Result states and language

| State | Meaning | Customer-facing language |
|---|---|---|
| `INCOMPLETE` | Critical identity, measurement or camper facts are missing | “More information needed.” |
| `PRELIMINARY_CANDIDATE` | All automated checks pass with approved margins and adequate evidence | “Preliminary candidate — final confirmation required.” |
| `CONDITIONAL` | Could become a candidate after an explicit configuration change | “Possible with changes.” |
| `TECHNICAL_REVIEW` | Modified, unusual, borderline, truck or unsupported configuration | “Technical review required.” |
| `NOT_RECOMMENDED` | One or more hard limits are exceeded or geometry is incompatible | “Not recommended in this configuration.” |
| `DATA_EXPIRED` | A required catalogue/camper record is outside its freshness policy | “Current specifications need to be re-verified.” |

All heavy-overland and fixed-body paths return `TECHNICAL_REVIEW` in the initial release, even when nominal mass and dimensions appear favourable. The interface may say “plausible platform for technical review,” but not “compatible.”

The product must not use “definitely fits,” “approved,” “certified,” “safe,” or an unqualified “suitable.”

Required disclaimer:

> This is a preliminary compatibility assessment, not engineering or legal approval. Final confirmation requires the exact vehicle and camper configuration, verified fitted-equipment and tray details, current individual axle weights, tyre and component ratings, load position and any applicable modification or licensing evidence.

---

## 9. Calculation requirements

### 9.1 Input precedence

For a customer assessment, use this order:

1. Approved, current measured customer facts.
2. Approved customer compliance/engineering documentation.
3. Exact effective-dated catalogue variant facts.
4. Manual estimate, clearly labelled and unable to produce `PRELIMINARY_CANDIDATE` where the missing fact is critical.

No silent fallback from an exact variant to a model-level value is allowed.

### 9.2 Mass calculations

At minimum:

```text
catalogue payload = GVM - catalogue kerb mass

estimated current vehicle mass =
  baseline vehicle mass
  + additions not included in baseline

estimated loaded camper mass =
  approved camper dry mass
  + option mass
  + water mass
  + LPG/consumables mass
  + customer gear mass

estimated loaded vehicle mass =
  estimated current vehicle mass
  + occupants not included in baseline
  + trip load not included in baseline
  + estimated loaded camper mass
  + towball download

GVM margin = GVM - estimated loaded vehicle mass

GCM margin = GCM - estimated loaded vehicle mass - actual loaded trailer mass
```

The calculation must prevent double counting by recording what each baseline measurement already included.

### 9.3 Axle-load estimation

Where a measured front/rear baseline exists, added loads are distributed by longitudinal position.

For wheelbase `L`, added load `W` at distance `x` behind the front axle:

```text
rear axle increment = W × x / L
front axle increment = W - rear axle increment
```

Loads behind the rear axle may reduce front-axle load. The engine sums every known load item, compares estimated axle loads with front/rear GAWR and applies uncertainty buffers. The model must support:

- Camper CG relative to the vehicle axles.
- Tray and accessory CG where material.
- Towball download position.
- Multiple water tanks and optional equipment positions.
- A minimum acceptable front-axle load policy or percentage-of-baseline rule approved by engineering.

The UI must describe axle results as estimates until validated against a fully loaded individual-axle weighbridge measurement.

### 9.4 Geometry checks

Hard and review checks include:

- Camper base length and width vs usable tray surface.
- Cab-over underside vs cab/roof/headboard clearance.
- Wheel-arch, fuel filler and chassis obstruction clearance.
- Rear overhang policy.
- Camper CG inside the approved vehicle/tray envelope.
- Mounting-point availability and spacing.
- Tub-internal geometry for tub campers.
- Tray structural rating and mounting-system compatibility.
- For fixed bodies: manufacturer body envelope, frame keep-out zones, cab-tilt clearance, driveline/exhaust/AdBlue access and departure-angle effects.

### 9.5 Safety margins

Margins are effective-dated policy data, not hard-coded constants. Policies can vary by:

- Vehicle class.
- Camper family.
- Evidence quality.
- On-road vs remote/off-road intended use.
- Axle vs GVM constraint.
- Whether a customer is towing simultaneously.

The existing fixed 150 kg amber threshold should be replaced by approved policies. The PRD does not prescribe final engineering values.

### 9.6 Evidence/confidence score

The calculation produces a separate evidence grade:

- `A` — exact current variant, verified camper template, individual axle weights and all critical ratings.
- `B` — exact current variant and verified camper; some values derived but no critical fields missing.
- `C` — catalogue-only baseline or model-level figure.
- `D` — manual/unverified/expired data.

Only grades A or B can produce `PRELIMINARY_CANDIDATE`, subject to engineering policy.

### 9.7 Heavy-overland body and axle model

The heavy path calculates a **nominal body-mass budget**, not suitability:

```text
nominal body-mass budget = GVM - verified as-delivered chassis-cab mass

remaining operational margin =
  GVM
  - as-built chassis/body mass
  - occupants
  - fuel and AdBlue not included in the baseline
  - water, LPG and consumables
  - recovery gear, spares and personal cargo
  - towball download where applicable
```

The body model must distribute the proposed subframe, shell, tanks, batteries, equipment and cargo to individual axles using their longitudinal positions. It must retain the source's chassis-cab front/rear mass, not only the total. Before technical approval it must also resolve:

- Exact order code, wheelbase, cab and axle configuration.
- Manufacturer body-builder guide and its revision.
- Permitted body length, width, rear overhang and centre-of-gravity envelope.
- Torsion strategy: rigid, flexible, three-point, four-point or manufacturer-specific mounting.
- Frame drilling/welding restrictions and approved attachment zones.
- Cab tilt, suspension articulation, tyre, driveline, exhaust, cooling, fuel, AdBlue and service clearances.
- Static and intended off-road/dynamic load cases; no unapproved “off-road derating factor” may be invented by the selector.
- Overall height/width/length, GVM/GCM, axle and tyre limits, licence class, registration, modification and compliance implications.

The final as-built design requires individual axle weighbridge verification and the applicable engineering/compliance sign-off. Catalogue payload alone cannot satisfy this gate.

---

## 10. Functional requirements

### 10.1 Vehicle catalogue

- Search/filter by exact Australian-market variant.
- Effective dates and model-year ranges.
- Separate certification/GVM configurations.
- Source URL, publication date, access date and source locator.
- Per-field source and basis where facts originate from multiple documents.
- Publication states: draft, in review, approved, published, expired, superseded, withdrawn.
- Scheduled freshness checks and stale-record alerts.
- No customer exposure until approved by a second reviewer.

### 10.2 Camper catalogue

- Immutable published camper template versions.
- Verified measured dry mass with tolerance.
- Standard inclusion and option mass deltas.
- Tank capacities and default load scenarios.
- Base/cab-over geometry and mounting data.
- Longitudinal/lateral CG by approved configuration or calculation model.
- Compatible body modes: tray, tub, truck body.
- Engineering owner and approval history.

### 10.3 Customer assessments

- Save immutable snapshots of vehicle facts, camper facts, inputs, policies and engine version.
- Preserve source URLs and evidence attachments.
- Allow comparison of multiple vehicles with the same camper/load scenario.
- Provide an “unlisted or modified vehicle” path.
- Generate a staff-readable constraint report and a plain-language customer summary.
- Link into the existing enquiry and future configurator workflow.

### 10.4 Admin review

- Import staging view with field-level diff.
- Payload arithmetic and dimensional validation.
- Duplicate/overlapping effective-date detection.
- Required second-person approval.
- Publish/expire/supersede actions with audit log.
- Impact report listing saved assessments affected by corrected or expired data.
- Manual correction must retain the original source value and correction rationale.

### 10.5 Comparison

Vehicle shoppers can compare up to three exact variants. The comparison prioritises:

- Evidence quality.
- Remaining GVM and rear-axle margin.
- Body/tray compatibility.
- Required conversion or engineering work.
- Licensing/certification considerations.

Do not rank on payload alone.

### 10.6 Expedition-platform intake

- Separate catalogue and filters for light, medium, heavy and extreme-off-road truck chassis.
- Capture exact order code, cab, wheelbase, axle configuration, drivetrain and certification mass.
- Capture chassis-cab total and individual axle masses with their inclusions and tolerances.
- Store the manufacturer body-builder guide, body envelope and mounting restrictions as versioned facts.
- Compare a proposed body concept by mass budget, axle reaction and envelope only; do not auto-approve.
- Generate a technical intake pack containing missing facts, source documents, proposed load schedule and questions for the engineer/body builder.
- Route legacy, imported, ex-service, modified and order-specific vehicles directly to manual review.

---

## 11. Data architecture

### 11.1 Research database

The supplied SQLite database is the controlled research/staging artefact. It includes:

- `sources`.
- `vehicle_variants`.
- `heavy_overland_chassis`.
- `vehicle_model_coverage`.
- `data_review_log`.
- `vehicle_variant_quality` validation view.
- `heavy_overland_chassis_quality` validation view.

All seed rows have `customer_selectable = 0` by design.

### 11.2 Production model

Production should use the existing server-side database rather than serving SQLite or CSV directly to the browser. Recommended entities:

| Entity | Purpose |
|---|---|
| `vehicle_catalog_variants` | Stable exact variant identity and effective dates. |
| `heavy_chassis_variants` | Exact truck order code, cab, wheelbase, axle configuration and certification identity. |
| `heavy_chassis_body_rules` | Versioned body-builder envelope, mounting, keep-out and subframe requirements. |
| `proposed_body_load_items` | Body/subframe/equipment masses and longitudinal/lateral positions. |
| `vehicle_catalog_facts` | Typed, per-field values with units, basis, uncertainty and source. |
| `vehicle_source_documents` | Primary-source metadata, checksum and review state. |
| `vehicle_catalog_publications` | Immutable published snapshots. |
| `camper_fitment_templates` | Approved camper version, mass and geometry. |
| `camper_option_mass_items` | Option mass and position deltas. |
| `fitment_policies` | Versioned margins, rules and outcome mapping. |
| `customer_vehicle_profiles` | Customer-specific identity and configuration. |
| `vehicle_measurements` | Immutable weighbridge and dimension evidence. |
| `suitability_assessments` | Top-level assessment and status. |
| `suitability_assessment_versions` | Immutable inputs, outputs, sources and engine version. |
| `suitability_constraint_results` | One result per GVM, axle, geometry, tyre or policy constraint. |

Vehicle facts should be typed records rather than only columns so front/rear axle limits, multiple kerb definitions and future facts can carry independent provenance.

### 11.3 Required fact metadata

Every safety-relevant fact stores:

- Value and unit.
- Definition/basis, such as maximum kerb, minimum kerb, tare or measured.
- Included/excluded equipment.
- Source document and page/table locator.
- Effective from/to.
- Model year and market.
- Verification status and reviewer.
- Uncertainty/tolerance where known.
- Superseded-by link.

### 11.4 API outline

```text
GET  /api/vehicle-selector/makes
GET  /api/vehicle-selector/models?make=&year=
GET  /api/vehicle-selector/variants?make=&model=&year=&cab=&body=
GET  /api/vehicle-selector/variants/:id
GET  /api/vehicle-selector/campers?vehicleVariantId=
POST /api/vehicle-selector/assessments/preview
POST /api/vehicle-selector/assessments
GET  /api/vehicle-selector/assessments/:shareToken

GET  /api/expedition-platforms/makes
GET  /api/expedition-platforms/variants?make=&model=&cab=&wheelbase=&axles=
POST /api/expedition-platforms/intakes/preview
POST /api/expedition-platforms/intakes

POST /api/admin/vehicle-catalog/imports
POST /api/admin/vehicle-catalog/variants/:id/request-review
POST /api/admin/vehicle-catalog/variants/:id/publish
POST /api/admin/vehicle-catalog/variants/:id/expire
GET  /api/admin/vehicle-catalog/freshness
```

Only published public-safe fields are returned to the browser. Admin notes and internal review information remain server-side.

---

## 12. Data acquisition and maintenance

### 12.1 Source priority

1. Australian manufacturer specification PDF or body-builder guide.
2. Australian manufacturer variant/specification webpage.
3. Australian compliance plate, owner manual or approved modification certificate for the customer's vehicle.
4. Dealer confirmation only when captured with document/evidence and flagged for review.

Media reviews, dealer listings, search snippets and overseas specifications are discovery sources only and cannot populate published facts.

### 12.2 Scraping policy

- Prefer downloadable manufacturer PDFs and stable tables.
- Store the canonical source URL, retrieval date and content checksum.
- Respect site terms, robots controls and reasonable request rates.
- Extract into staging only.
- Run schema, range and payload-arithmetic validation.
- Require human comparison with the source before publication.
- Screenshot/OCR extraction requires extra review and stores the page locator.
- Never auto-publish because a scraper reports success.

### 12.3 Freshness

- Check current-model sources monthly for change signals.
- Force annual review before the next model-year selector launch.
- Immediately expire a record when the manufacturer withdraws or materially changes the source.
- A source older than the configured freshness window can remain in historical searches but cannot generate a new preliminary-candidate result without review.
- Heavy-chassis records also expire when an order-code specification or body-builder guide is superseded, even if the model family name is unchanged.

### 12.4 Scope rollout

**Wave 1 — highest commercial value**

- Ranger Super Duty.
- HiLux cab-chassis.
- D-MAX cab-chassis.
- BT-50 cab-chassis.
- Triton cab-chassis.
- LandCruiser 70 cab-chassis.
- Standard Ranger cab-chassis.
- Beyond RV Advent range with verified product facts.

**Wave 2 — conversions and full-size pickups**

- Silverado 2500 HD.
- RAM 2500/3500.
- Tundra, Silverado 1500, RAM 1500, F-150.
- Kia Tasman, GWM Cannon/Alpha, Musso and Amarok where a tub camper or approved conversion exists.

**Parallel expedition foundation — technical intake, no automated compatibility**

- IVECO Daily 4x4 and Isuzu NPS 75-175 4x4 exact configurations.
- MAN TGM 4x4 RV exact configurations.
- Unimog U 4023 model-level discovery with manufacturer clarification.
- Fuso Canter 4x4 and IVECO Eurocargo 4x4 after exact axle/chassis data is obtained.
- Beyond RV Expedition body templates, subframe concepts and load schedules.

**Wave 3 — broader trucks and historical demand**

- Isuzu N Series, Hino 300 and other light trucks where a fixed body product exists.
- Unimog U 5023 where Australian order-code documentation is available.
- IVECO T-Way, MAN TGS, Mercedes-Benz Arocs/Zetros, Scania XT, Volvo FMX and Tatra Phoenix only when there is real enquiry demand and a supported engineering path.
- High-demand superseded model years based on enquiry analytics.

---

## 13. Content, accessibility and presentation

### 13.1 Plain-language help

Every term has contextual help and an example: GVM, GCM, kerb, tare, payload, GAWR, towball download, centre of gravity and load index.

### 13.2 Accessibility

- WCAG 2.2 AA target.
- Complete keyboard operation.
- Labels and error summaries linked to inputs.
- Results communicated in text and icons, never colour alone.
- Live calculation changes announced conservatively; no noisy per-keystroke screen-reader updates.
- Units remain visible and are not placeholder-only.

### 13.3 Mobile

- One decision per screen or compact step group.
- Sticky progress and saved state.
- Numeric keyboards for mass/dimensions.
- Photo guidance for compliance plate, tyre and tray measurements.
- Results lead with the outcome and binding constraint, followed by detailed calculations.

### 13.4 SEO

Index only stable educational and selector landing content. Do not index customer assessment URLs. Add structured FAQ content but do not generate thousands of thin make/model pages until verified content and genuine search value exist.

---

## 14. Privacy and security

- Anonymous preview does not require contact information.
- Saved assessments use unguessable share tokens and configurable expiry.
- Weighbridge dockets, compliance plates, VINs and registration data are private attachments with strict access controls.
- VIN and registration are optional and excluded from analytics payloads.
- Public assessment views exclude internal notes and private identifiers.
- Rate-limit preview and save endpoints.
- Validate all numeric ranges server-side.
- Store the exact engine/policy/data snapshot used for each result.

---

## 15. Analytics and success measures

Events:

- Selector started/completed.
- Exact variant found/not found.
- Weighbridge data available.
- Camper compared.
- Result state and binding constraint category.
- Assessment sent to Beyond RV.
- Staff review outcome.
- Enquiry-to-quote and quote-to-sale conversion.

Do not send VIN, registration, free-text notes or attachment contents to analytics.

Initial targets after complete Wave 1 launch:

| Measure | Target |
|---|---:|
| Exact-variant selection rate for in-scope current vehicles | ≥ 90% |
| Completed assessments with enough data to identify next action | ≥ 75% |
| Published variants with current primary source and second review | 100% |
| Customer-visible arithmetic/source defects | 0 |
| Assessments producing unexplained generic outcomes | < 5% |
| Sales enquiries carrying a structured assessment | ≥ 60% of selector-generated leads |

---

## 16. Acceptance criteria

### Vehicle identity and data

- A customer cannot select only “Toyota HiLux”; an exact available variant or unlisted/manual path is required.
- Variant options are effective-dated and Australian-market-specific.
- Every prefilled safety-relevant number displays source title/date and basis.
- A GVM-upgraded or different certification-category vehicle is represented separately.
- Expired/draft records cannot be used for a customer preliminary-candidate result.

### Calculations

- The engine prevents double counting of masses included in a weighbridge baseline.
- GVM, front GAWR, rear GAWR, tray/tub geometry and critical policy checks each produce a separate result.
- Towing at the same time includes towball download and GCM interaction.
- A vehicle under GVM but over rear GAWR returns `NOT_RECOMMENDED` or `TECHNICAL_REVIEW` per policy, never candidate.
- Missing individual axle data cannot be disguised by checking a confirmation box.
- Calculation tests cover loads ahead of, between and behind axles.

### Camper data

- Only approved immutable camper templates can be matched.
- Dry mass, options, liquids and customer gear remain distinct in the result.
- CG and geometry facts are required for a preliminary-candidate result.

### Auditability

- Every saved result can be reproduced from its immutable data, policy and engine versions.
- Corrected catalogue data does not silently rewrite historical assessments.
- Admin publication requires a different reviewer from the importer/editor.

### Language

- No automated result uses “certified,” “approved,” “safe” or “definitely fits.”
- The disclaimer and next action are visible without expanding details.

### Heavy-overland path

- A heavy chassis cannot enter the removable slide-on calculation path.
- A customer must identify an exact order code or receive an incomplete/manual-review result.
- Nominal chassis payload is labelled as a body-mass budget, never remaining camper capacity.
- Missing body-builder guide, baseline axle distribution or mounting architecture prevents any compatibility claim.
- Legacy/imported/ex-service Unimog and other specialist trucks always route to technical review.
- Initial-release heavy results cannot return `PRELIMINARY_CANDIDATE`.

---

## 17. Testing strategy

### 17.1 Unit tests

- Payload/GVM arithmetic.
- Baseline inclusion/exclusion rules.
- Axle reaction formula and negative front-axle increment for rear-overhang loads.
- Water and option mass calculations.
- Physical-fit rules.
- Margin policies and outcome mapping.
- Evidence-grade rules.
- Effective-date and supersession behaviour.

### 17.2 Data tests

- Unique variant identity/effective-date overlap.
- Positive and plausible ranges.
- Published payload equals GVM minus kerb where the source uses that definition.
- GVM does not exceed GCM.
- Axle ratings are not accidentally reversed.
- Customer-selectable records have all mandatory facts, current sources and two approvals.
- Heavy rows reconcile chassis-cab front plus rear mass to total and total plus payload to GVM where the source supplies all values.

### 17.3 Scenario tests

- D-MAX cab-chassis payload excludes the tray.
- HiLux standard vs approved GVM-upgrade record.
- Silverado 2500 NB1 vs NB2.
- Tundra appears physically large but fails loaded-margin policy.
- Modified vehicle with measured axles and certification evidence.
- Vehicle under GVM but over rear GAWR.
- Adequate masses but insufficient tray length.
- Camper mass passes but CG falls outside the approved envelope.
- Towing changes a candidate result through towball/GCM constraints.
- Expired source blocks a previously positive preview.
- IVECO Daily 4x4 single vs crew cab changes the body-mass budget.
- Isuzu NPS day vs crew cab changes baseline axle distribution and cab-to-axle distance.
- MAN TGM 20,000 vs 28,000 kg GCM source condition is never flattened or silently selected.
- Unimog U 4023 with an unresolved 10.3 t label returns technical review.
- Legacy U 4000 cannot inherit a current U 4023 record.

### 17.4 End-to-end tests

- Mobile and desktop guided flow.
- Anonymous preview to enquiry handoff.
- Saved result privacy and expiry.
- Admin import, review, publish, expire and impact report.
- Accessibility keyboard and screen-reader flow.

---

## 18. Delivery plan

### Phase 0 — engineering and data readiness

- Approve terminology, formulas, margin policies and result language.
- Measure every Beyond RV slide-on camper and approved option.
- Establish camper CG and geometry data.
- Complete Wave 1 vehicle rows and secondary review.
- Convert the research schema into production migrations.
- Define the fixed expedition-body engineering workflow, body-load schedule and approved subframe concepts.

### Phase 1 — guided identity and prefill

- Replace free-text identity with exact variant selection plus manual fallback.
- Prefill source-backed ratings.
- Preserve current manual mass/fit calculator as fallback.
- Add data provenance and evidence grade.

### Phase 2 — camper matching and axle engine

- Add approved camper templates and option weights.
- Implement axle/CG and geometry calculations.
- Add result states, binding constraints and comparison.
- Save immutable assessments.

### Phase 3 — admin data operations

- Import/review/publish/expire workflow.
- Freshness monitor and change diffs.
- Impact analysis for corrections.
- Role permissions and audit history.

### Phase 4 — platform expansion

- Full-size pickups.
- Light trucks and expedition chassis through the technical-intake path.
- Add calculated heavy-body assessment only after body-builder and engineering rules are approved, tested and versioned.
- High-demand older model years.
- Optional compliance-plate assistance or VIN decoding if a reliable licensed Australian source is procured.

---

## 19. Launch gates

The upgraded selector must not launch candidate recommendations until all are true:

1. Beyond RV has verified camper mass, options, water scenarios, geometry and CG.
2. Engineering has approved the axle model and safety-margin policies.
3. Every public vehicle row has primary source, effective dates, field basis and second-person approval.
4. The full end-to-end flow has passed scenario and accessibility tests.
5. Legal/compliance review approves outcome language and disclaimer placement.
6. Staff have an operational workflow for incomplete and technical-review leads.
7. Data owners and review cadence are assigned.

Until then, the correct production improvement is guided vehicle identity and conservative prefill feeding the existing manual checker—not automated camper approval.

---

## 20. Decisions required

1. Which exact Beyond RV models and option packs will be measured first?
2. Who owns vehicle-data review and who acts as the independent approver?
3. What GVM and axle safety margins will engineering approve for each use case?
4. Is towing while carrying a slide-on supported at launch or routed to technical review?
5. Will factory tubs be supported by dedicated campers, or only after approved tray conversion?
6. Which states' licence/registration guidance will be displayed, and who maintains it?
7. What source-freshness window is acceptable for current and historical variants?
8. Should customers be able to upload weighbridge/compliance documents anonymously or only after creating an enquiry?
9. Which fixed Expedition bodies are supported on Daily 4x4, NPS, TGM and Unimog, and what are their verified subframe/body mass and CG load schedules?
10. Which engineer and body builder own heavy-chassis sign-off, and which mounting architectures will Beyond RV support?
11. Should the site's existing Unimog U 300/U 400/U 4000 references be replaced with current U 4023 language or retained only in a clearly labelled legacy path?

---

## 21. Primary research sources

- Ford Australia — [Ranger Super Duty](https://www.ford.com.au/showroom/trucks-and-vans/ranger/super-duty/)
- Toyota Australia — [HiLux Spec Table, June 2026](https://www.toyota.com.au/-/media/toyota/main-site/vehicle-hubs/hilux/files/20260630_hilux_spec_sheet_gto010060.pdf?rev=d222769888af49519347727deb13bb73)
- Isuzu UTE Australia — [25.5MY D-MAX Specifications](https://cdn-iua.dataweavers.io/-/media/d-max/documents/25-5my-isuzu-d-max-vehicle-specifications.pdf?rev=30680420a74d44c9af2c12f77ee2d85d)
- Mazda Australia — [BT-50 Payload Calculator](https://www.mazda.com.au/cars/bt-50/payload/)
- Mitsubishi Motors Australia — [25MY Triton GLX Double Cab Chassis payload and axle data](https://www.mitsubishi-motors.com.au/blog/2025/payload-towing-and-axle-strength.html)
- Toyota Australia — [LandCruiser 70 Spec Table, October 2025](https://www.toyota.com.au/-/media/toyota/main-site/vehicle-hubs/lc70/files/20251021_lc70_spec_table_gto009454.pdf?rev=4e4c662a09fe418c9a5a7b00509b16dd)
- Toyota Australia — [Tundra Spec Table, May 2026](https://www.toyota.com.au/-/media/toyota/main-site/vehicle-hubs/tundra/files/20260506-tundra_spec-table_gto009469-v1.pdf?rev=fe8c44cde59d4c339adb2c9124278b61)
- GMSV — [Towing With Silverado](https://www.gmspecialtyvehicles.com/au-en/chevrolet/trucks/trailering-and-towing)
- Kia Australia — [Tasman MY26 Brochure](https://www.kia.com/content/dam/kwcms/au/en/images/pdf/tasman/kia-tasman-brochure.pdf)
- Mercedes-Benz Trucks Australia — [Unimog U 4023 Extreme Off-road](https://www.mercedes-benz-trucks.com/au/en/trucks/unimog-offroad.html)
- IVECO Australia — [Daily 4x4 Specification Sheet](https://www.iveco.com/au/-/media/IVECOdotcom/Australia/Products/DailyMy24/Brochures/New-Daily-4x4-Spec-Sheet---Web-Version.pdf?rev=0fa977f9dcb94b2a930710f0f71e1b36)
- Isuzu Australia — [NPS 75-175 4x4 Specifications](https://prd1.isuzu.com.au/media/5rrdsxuw/spec_nps_75_175_4x4_2605_r3.pdf)
- Fuso Australia — [Canter 4x4 Wide Cab](https://www.fuso.com.au/range/canter/4x4/wide-cab/)
- MAN Truck & Bus Australia — [TGM 13.250-290 4x4 RV Specification](https://www.man.com.au/wp-content/uploads/2025/02/TGM-13.250-290-4X4-RV-Spec.pdf)
- IVECO Australia — [Eurocargo MY24 4x4](https://www.iveco.com/au/Eurocargo/Eurocargo-MY24-4x4)
