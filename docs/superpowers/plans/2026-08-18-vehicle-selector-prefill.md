# Vehicle Selector Pre-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer pick their vehicle on the slide-on calculator and have its published mass figures fill the form, with the source of every figure shown.

**Architecture:** A Node script reads the research SQLite database, applies a promotion rule, and writes a versioned `catalogue.json` that is committed to the repo. A small module imports and validates it, mirroring `src/lib/configurator/catalogue.ts`. The calculator page gains three cascading selects and pre-fill logic in its existing client script. No runtime fetch and no new Netlify function.

**Tech Stack:** Astro 7, TypeScript, vanilla client-side TS (no React on this route), `node --test --experimental-strip-types`, Playwright, sqlite3 CLI.

**Spec:** `docs/superpowers/specs/2026-08-18-vehicle-selector-prefill-design.md`

## Global Constraints

- Node >= 22.12.0. Tests run with `npm test`, which is `node --test --experimental-strip-types`.
- Test files live in `tests/` and import source with an explicit `.ts` or `.js` extension, for example `../src/lib/productSaleState.ts`.
- The SQLite database at `data/vehicle-selector/australian-slide-on-vehicles.sqlite` is read-only for this work. Never modify `seed.sql` here.
- The generated catalogue is committed. Regenerate with `npm run catalogue:build`.
- Australian English in all customer-visible copy. Dates shown to customers use the form `18 August 2026`.
- No customer-visible copy may state that a vehicle is suitable. The existing status ladder wording is unchanged by this work.
- Every pre-filled field must remain editable.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/vehicleCatalogue/derive.ts` | Pure functions: tray-state derivation and the promotion rule. No I/O. |
| `src/lib/vehicleCatalogue/types.ts` | Catalogue and variant types shared by generator, validator, and page. |
| `src/lib/vehicleCatalogue/validate.ts` | `validateVehicleCatalogue`, mirroring the configurator validator. |
| `src/lib/vehicleCatalogue.ts` | Imports the generated JSON, validates on read, exports it. |
| `SCRIPTS/build-vehicle-catalogue.mjs` | Reads SQLite, calls derive, writes `catalogue.json`. |
| `src/data/vehicle-selector/overrides.json` | Hand-edited `show` and `hide` id lists. |
| `src/data/vehicle-selector/catalogue.json` | Generated output. Committed. |
| `src/pages/slide-on-camper-weight-calculator/index.astro` | Picker markup, pre-fill wiring, provenance panel. |
| `tests/vehicle-suitability-calculator.test.ts` | Missing tests for the existing calculator. |
| `tests/vehicle-catalogue-derive.test.ts` | Tray state and promotion rule. |
| `tests/vehicle-catalogue-validate.test.ts` | Catalogue validation. |
| `tests/e2e/vehicle-selector.spec.ts` | Playwright coverage of the picker. |

---

### Task 1: Unit tests for the existing calculator

The calculator has no tests and this work makes it consume database figures. Lock its behaviour down before anything else changes.

**Files:**
- Create: `tests/vehicle-suitability-calculator.test.ts`
- Read only: `src/lib/vehicleSuitabilityCalculator.js`

**Interfaces:**
- Consumes: `calculateSlideOnSuitability(input, options)` from `src/lib/vehicleSuitabilityCalculator.js`. Input keys are `vehicleGvm`, `currentVehicleWeight`, `passengerWeight`, `accessoryWeight`, `luggageOrGearWeight`, `camperDryWeight`, `camperWaterWeight`, `camperGearWeight`, `camperOptionsWeight`, `trayLength`, `trayWidth`, `requiredTrayLength`, `requiredTrayWidth`, `rearAxleChecked`, `tyreRatingsChecked`, `centreOfGravityChecked`. Options is `{ started: boolean }`. Returns `{ status, statusLabel, title, summary, recommendation, dataQuality, notes, values }` where status is `'neutral' | 'green' | 'amber' | 'red'`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSlideOnSuitability } from '../src/lib/vehicleSuitabilityCalculator.js';

const base = {
  vehicleGvm: '3350', currentVehicleWeight: '2200', passengerWeight: '160',
  accessoryWeight: '80', luggageOrGearWeight: '100', camperDryWeight: '500',
  camperWaterWeight: '60', camperGearWeight: '50', camperOptionsWeight: '20',
  trayLength: '2400', trayWidth: '1850',
  requiredTrayLength: '2100', requiredTrayWidth: '1750',
  rearAxleChecked: true, tyreRatingsChecked: true, centreOfGravityChecked: true,
};

test('returns neutral before the customer has started', () => {
  const result = calculateSlideOnSuitability(base, { started: false });
  assert.equal(result.status, 'neutral');
});

test('a comfortable combination with all confirmations ticked is green', () => {
  const result = calculateSlideOnSuitability(base, { started: true });
  assert.equal(result.status, 'green');
  assert.equal(result.values.remainingGvmMargin, 3350 - 3170);
});

test('exceeding GVM is red and says how far over', () => {
  const result = calculateSlideOnSuitability({ ...base, camperDryWeight: '900' }, { started: true });
  assert.equal(result.status, 'red');
  assert.ok(result.notes.some((n: string) => n.includes('over GVM')));
});

test('a margin under 150 kg is amber even when nothing is exceeded', () => {
  const result = calculateSlideOnSuitability({ ...base, camperDryWeight: '640' }, { started: true });
  assert.equal(result.status, 'amber');
});

test('a tray shorter than the camper requires is red', () => {
  const result = calculateSlideOnSuitability({ ...base, trayLength: '2000' }, { started: true });
  assert.equal(result.status, 'red');
  assert.ok(result.notes.some((n: string) => n.includes('below the required')));
});

test('an unchecked rear axle confirmation forces amber', () => {
  const result = calculateSlideOnSuitability({ ...base, rearAxleChecked: false }, { started: true });
  assert.equal(result.status, 'amber');
  assert.ok(result.notes.some((n: string) => n.includes('Rear axle limits have not been confirmed')));
});

test('a missing required field returns the needs-review result', () => {
  const result = calculateSlideOnSuitability({ ...base, vehicleGvm: '' }, { started: true });
  assert.equal(result.status, 'amber');
  assert.equal(result.title, 'Needs review');
});
```

- [ ] **Step 2: Run the tests and read every failure**

Run: `npm test -- tests/vehicle-suitability-calculator.test.ts`

Expected: they should pass, because this describes existing behaviour. Any failure means an assumption above is wrong about the current code. Do not change `vehicleSuitabilityCalculator.js`. Read the source, correct the test to match real behaviour, and note what surprised you in the commit message.

- [ ] **Step 3: Commit**

```bash
git add tests/vehicle-suitability-calculator.test.ts
git commit -m "test: cover slide-on suitability calculator before selector work"
```

---

### Task 2: Tray-state and promotion rule

**Files:**
- Create: `src/lib/vehicleCatalogue/derive.ts`
- Create: `tests/vehicle-catalogue-derive.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `deriveTrayState(kerbMassBasis: string | null, bodyType: string): TrayState` where `TrayState = 'included' | 'excluded' | 'not_applicable' | 'unknown'`. Also `isPromoted(row: { id: string; verification_status: string }, overrides: CatalogueOverrides): boolean` where `CatalogueOverrides = { show: string[]; hide: string[] }`. Task 3 imports both.

- [ ] **Step 1: Write the failing tests**

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTrayState, isPromoted } from '../src/lib/vehicleCatalogue/derive.ts';

test('a tub vehicle has no tray regardless of how kerb is described', () => {
  assert.equal(deriveTrayState('Published kerb weight', 'pickup_tub'), 'not_applicable');
  assert.equal(deriveTrayState('Published kerb weight; tub body, no tray state published', 'pickup_tub'), 'not_applicable');
});

test('a kerb figure measured with the tray on is included', () => {
  assert.equal(deriveTrayState('Kerb weight with Mazda standard tray fitted', 'cab_chassis'), 'included');
});

test('every wording that excludes the tray is detected', () => {
  for (const basis of [
    'Published kerb mass; excludes tray body',
    'Published kerb weight; excludes tray body',
    'Kerb weight with heaviest factory optional equipment; excludes tray body',
    'Kerb weight excludes tray body',
    'Derived from GVM minus published maximum payload; excludes tray',
  ]) {
    assert.equal(deriveTrayState(basis, 'cab_chassis'), 'excluded', basis);
  }
});

test('silence about the tray is unknown, never assumed', () => {
  assert.equal(deriveTrayState('Published kerb weight', 'cab_chassis'), 'unknown');
  assert.equal(deriveTrayState('Approximate kerb weight', 'cab_chassis'), 'unknown');
  assert.equal(deriveTrayState(null, 'cab_chassis'), 'unknown');
});

test('verified rows promote and flagged rows do not', () => {
  const empty = { show: [], hide: [] };
  assert.equal(isPromoted({ id: 'a', verification_status: 'source_verified' }, empty), true);
  assert.equal(isPromoted({ id: 'b', verification_status: 'needs_secondary_review' }, empty), false);
});

test('hide wins over a verified status, and show wins over a flagged one', () => {
  assert.equal(isPromoted({ id: 'a', verification_status: 'source_verified' }, { show: [], hide: ['a'] }), false);
  assert.equal(isPromoted({ id: 'b', verification_status: 'needs_secondary_review' }, { show: ['b'], hide: [] }), true);
});

test('an id in both lists is hidden, because withholding is the safe direction', () => {
  assert.equal(isPromoted({ id: 'a', verification_status: 'source_verified' }, { show: ['a'], hide: ['a'] }), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/vehicle-catalogue-derive.test.ts`
Expected: FAIL, cannot find module `derive.ts`.

- [ ] **Step 3: Write the implementation**

```typescript
export type TrayState = 'included' | 'excluded' | 'not_applicable' | 'unknown';

export type CatalogueOverrides = { show: string[]; hide: string[] };

/**
 * Most published kerb figures do not say whether a tray is included, and
 * guessing is what overloads a vehicle. Four states, so silence stays silent.
 */
export function deriveTrayState(kerbMassBasis: string | null, bodyType: string): TrayState {
  if (bodyType === 'pickup_tub') return 'not_applicable';
  const basis = (kerbMassBasis ?? '').toLowerCase();
  if (basis.includes('tray fitted')) return 'included';
  if (basis.includes('exclude')) return 'excluded';
  return 'unknown';
}

export function isPromoted(
  row: { id: string; verification_status: string },
  overrides: CatalogueOverrides,
): boolean {
  if (overrides.hide.includes(row.id)) return false;
  if (overrides.show.includes(row.id)) return true;
  return row.verification_status === 'source_verified';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/vehicle-catalogue-derive.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vehicleCatalogue/derive.ts tests/vehicle-catalogue-derive.test.ts
git commit -m "feat: derive tray state and catalogue promotion rule"
```

---

### Task 3: Catalogue types and validator

**Files:**
- Create: `src/lib/vehicleCatalogue/types.ts`
- Create: `src/lib/vehicleCatalogue/validate.ts`
- Create: `tests/vehicle-catalogue-validate.test.ts`

**Interfaces:**
- Consumes: `TrayState` from `derive.ts`.
- Produces: types `VehicleCatalogue`, `CatalogueVariant`, `CatalogueModel`, `CatalogueSource`, and `validateVehicleCatalogue(catalogue: VehicleCatalogue): { valid: boolean; errors: string[]; warnings: string[] }`. Tasks 4 and 5 import these.

- [ ] **Step 1: Write the types**

```typescript
import type { TrayState } from './derive.ts';

export type CatalogueSource = {
  manufacturer: string;
  title: string;
  url: string;
  accessedDate: string;
};

export type CatalogueVariant = {
  id: string;
  make: string;
  model: string;
  modelYear: number;
  grade: string;
  cabType: string;
  bodyType: string;
  drivetrain: string | null;
  label: string;
  gvmKg: number;
  kerbKg: number;
  kerbBasis: string;
  payloadKg: number;
  frontGawrKg: number | null;
  rearGawrKg: number | null;
  trayLengthMm: number | null;
  trayWidthMm: number | null;
  trayState: TrayState;
  trayMassKg: number | null;
  promotedByOverride: boolean;
  source: CatalogueSource;
};

export type CatalogueModel = { make: string; model: string; modelYears: number[] };

export type VehicleCatalogue = {
  schemaVersion: string;
  catalogueVersion: string;
  generatedAt: string;
  sourceDatabaseRowCount: number;
  models: CatalogueModel[];
  variants: CatalogueVariant[];
};
```

- [ ] **Step 2: Write the failing validator tests**

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';
import type { VehicleCatalogue, CatalogueVariant } from '../src/lib/vehicleCatalogue/types.ts';

const variant: CatalogueVariant = {
  id: 'x', make: 'Mazda', model: 'BT-50', modelYear: 2025, grade: 'XT',
  cabType: 'single_cab', bodyType: 'cab_chassis', drivetrain: '4x4',
  label: 'Mazda BT-50 XT single cab 4x4 (2025)',
  gvmKg: 3100, kerbKg: 1914, kerbBasis: 'Kerb weight with Mazda standard tray fitted',
  payloadKg: 1186, frontGawrKg: 1450, rearGawrKg: 1910,
  trayLengthMm: null, trayWidthMm: null, trayState: 'included', trayMassKg: null,
  promotedByOverride: false,
  source: { manufacturer: 'Mazda Australia', title: 'Payload Calculator', url: 'https://example.test', accessedDate: '2026-08-18' },
};

const catalogue: VehicleCatalogue = {
  schemaVersion: '1.0', catalogueVersion: 'test', generatedAt: '2026-08-18T00:00:00.000Z',
  sourceDatabaseRowCount: 159, models: [{ make: 'Mazda', model: 'BT-50', modelYears: [2025] }],
  variants: [variant],
};

test('a well-formed catalogue is valid', () => {
  assert.equal(validateVehicleCatalogue(catalogue).valid, true);
});

test('a missing schemaVersion is an error', () => {
  const bad = { ...catalogue, schemaVersion: '' };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('a variant whose mass arithmetic does not reconcile is an error', () => {
  const bad = { ...catalogue, variants: [{ ...variant, payloadKg: 999 }] };
  const result = validateVehicleCatalogue(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('does not reconcile')));
});

test('a duplicate variant id is an error', () => {
  const bad = { ...catalogue, variants: [variant, variant] };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('a variant whose make and model are missing from the model index is an error', () => {
  const bad = { ...catalogue, models: [] };
  assert.equal(validateVehicleCatalogue(bad).valid, false);
});

test('an empty catalogue is valid but warns', () => {
  const empty = { ...catalogue, models: [], variants: [] };
  const result = validateVehicleCatalogue(empty);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.length > 0);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/vehicle-catalogue-validate.test.ts`
Expected: FAIL, cannot find module `validate.ts`.

- [ ] **Step 4: Write the validator**

```typescript
import type { VehicleCatalogue } from './types.ts';

export function validateVehicleCatalogue(catalogue: VehicleCatalogue) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!catalogue.schemaVersion) errors.push('Catalogue schemaVersion is required.');
  if (!catalogue.catalogueVersion) errors.push('Catalogue catalogueVersion is required.');
  if (!catalogue.generatedAt) errors.push('Catalogue generatedAt is required.');

  const ids = new Set<string>();
  const modelKeys = new Set(catalogue.models.map((m) => `${m.make}|${m.model}`));

  for (const v of catalogue.variants) {
    if (!v.id) errors.push('Every variant requires an id.');
    if (ids.has(v.id)) errors.push(`Duplicate variant id: ${v.id}.`);
    ids.add(v.id);

    // The whole dataset exists so this number is right. Guard it here too.
    if (v.gvmKg - v.kerbKg !== v.payloadKg) {
      errors.push(`Variant ${v.id} does not reconcile: ${v.gvmKg} - ${v.kerbKg} is not ${v.payloadKg}.`);
    }
    if (!modelKeys.has(`${v.make}|${v.model}`)) {
      errors.push(`Variant ${v.id} refers to a make and model missing from the model index.`);
    }
    if (!v.source?.url) errors.push(`Variant ${v.id} has no source url.`);
  }

  if (catalogue.variants.length === 0) {
    warnings.push('Catalogue contains no variants; the picker will not render.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/vehicle-catalogue-validate.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/vehicleCatalogue/types.ts src/lib/vehicleCatalogue/validate.ts tests/vehicle-catalogue-validate.test.ts
git commit -m "feat: add vehicle catalogue types and validator"
```

---

### Task 4: Generator script and first catalogue

**Files:**
- Create: `SCRIPTS/build-vehicle-catalogue.mjs`
- Create: `src/data/vehicle-selector/overrides.json`
- Create (generated): `src/data/vehicle-selector/catalogue.json`
- Create: `src/lib/vehicleCatalogue.ts`
- Modify: `package.json` scripts

**Interfaces:**
- Consumes: `deriveTrayState`, `isPromoted` from `derive.ts`; `validateVehicleCatalogue` from `validate.ts`.
- Produces: `getVehicleCatalogue(): VehicleCatalogue` from `src/lib/vehicleCatalogue.ts`, which Task 5 imports.

- [ ] **Step 1: Create the overrides file**

```json
{
  "show": [],
  "hide": [],
  "note": "show forces a variant into the picker even when flagged. hide removes one. An id in both is hidden. Record why in the commit message."
}
```

- [ ] **Step 2: Write the generator**

```javascript
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveTrayState, isPromoted } from '../src/lib/vehicleCatalogue/derive.ts';
import { validateVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, 'data/vehicle-selector/australian-slide-on-vehicles.sqlite');
const outPath = resolve(root, 'src/data/vehicle-selector/catalogue.json');
const overridesPath = resolve(root, 'src/data/vehicle-selector/overrides.json');

const QUERY = `
SELECT v.id, v.make, v.model, v.model_year_start, v.grade, v.cab_type, v.body_type,
       v.drivetrain, v.gvm_kg, v.kerb_mass_kg, v.kerb_mass_basis, v.published_payload_kg,
       v.front_gawr_kg, v.rear_gawr_kg, v.usable_load_length_mm, v.usable_load_width_mm,
       v.verification_status,
       s.manufacturer, s.title, s.url, s.accessed_date
FROM vehicle_variants v JOIN sources s ON s.id = v.source_id
ORDER BY v.make, v.model, v.model_year_start, v.grade;
`;

const raw = execFileSync('sqlite3', ['-json', dbPath, QUERY.trim()], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const rows = JSON.parse(raw);
const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'));

const variants = rows
  .filter((r) => isPromoted(r, overrides))
  .map((r) => ({
    id: r.id,
    make: r.make,
    model: r.model,
    modelYear: r.model_year_start,
    grade: r.grade,
    cabType: r.cab_type,
    bodyType: r.body_type,
    drivetrain: r.drivetrain ?? null,
    label: [r.make, r.model, r.grade, r.cab_type.replace(/_/g, ' '), r.drivetrain, `(${r.model_year_start})`]
      .filter(Boolean).join(' '),
    gvmKg: r.gvm_kg,
    kerbKg: r.kerb_mass_kg,
    kerbBasis: r.kerb_mass_basis ?? '',
    payloadKg: r.published_payload_kg,
    frontGawrKg: r.front_gawr_kg ?? null,
    rearGawrKg: r.rear_gawr_kg ?? null,
    trayLengthMm: r.usable_load_length_mm ?? null,
    trayWidthMm: r.usable_load_width_mm ?? null,
    trayState: deriveTrayState(r.kerb_mass_basis, r.body_type),
    trayMassKg: null,
    promotedByOverride: overrides.show.includes(r.id),
    source: { manufacturer: r.manufacturer, title: r.title, url: r.url, accessedDate: r.accessed_date },
  }));

const modelMap = new Map();
for (const v of variants) {
  const key = `${v.make}|${v.model}`;
  if (!modelMap.has(key)) modelMap.set(key, { make: v.make, model: v.model, modelYears: new Set() });
  modelMap.get(key).modelYears.add(v.modelYear);
}
const models = [...modelMap.values()]
  .map((m) => ({ ...m, modelYears: [...m.modelYears].sort((a, b) => b - a) }))
  .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model));

const catalogue = {
  schemaVersion: '1.0',
  catalogueVersion: `vehicle-catalogue-${new Date().toISOString().slice(0, 10)}`,
  generatedAt: new Date().toISOString(),
  sourceDatabaseRowCount: rows.length,
  models,
  variants,
};

const validation = validateVehicleCatalogue(catalogue);
if (!validation.valid) {
  console.error('Vehicle catalogue is invalid:');
  for (const e of validation.errors) console.error(`  ${e}`);
  process.exit(1);
}
for (const w of validation.warnings) console.warn(`Warning: ${w}`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(`${variants.length} variants across ${models.length} models, from ${rows.length} database rows.`);
```

- [ ] **Step 3: Add the npm script**

In `package.json`, inside `"scripts"`, add:

```json
"catalogue:build": "node --experimental-strip-types SCRIPTS/build-vehicle-catalogue.mjs"
```

- [ ] **Step 4: Run the generator**

If the import of `derive.ts` from a `.mjs` file fails on your Node version, rename
the script to `SCRIPTS/build-vehicle-catalogue.ts` and update the npm script path.
Type stripping applies to the imported `.ts` files either way.


Run: `npm run catalogue:build`
Expected: `132 variants across 21 models, from 159 database rows.`

If the count differs, stop and report it rather than editing the promotion rule to match. A changed count means the database changed.

- [ ] **Step 5: Write the catalogue module**

```typescript
import rawCatalogue from '../data/vehicle-selector/catalogue.json' with { type: 'json' };
import { validateVehicleCatalogue } from './vehicleCatalogue/validate.ts';
import type { VehicleCatalogue } from './vehicleCatalogue/types.ts';

export const VEHICLE_CATALOGUE = rawCatalogue as unknown as VehicleCatalogue;

export function getVehicleCatalogue(): VehicleCatalogue {
  const validation = validateVehicleCatalogue(VEHICLE_CATALOGUE);
  if (!validation.valid) {
    throw new Error(`Vehicle catalogue is invalid: ${validation.errors.join(' ')}`);
  }
  return VEHICLE_CATALOGUE;
}
```

- [ ] **Step 6: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add SCRIPTS/build-vehicle-catalogue.mjs src/data/vehicle-selector src/lib/vehicleCatalogue.ts package.json
git commit -m "feat: generate vehicle catalogue from research database"
```

---

### Task 5: Picker, pre-fill and provenance

**Files:**
- Modify: `src/pages/slide-on-camper-weight-calculator/index.astro`

**Interfaces:**
- Consumes: `getVehicleCatalogue()` from `src/lib/vehicleCatalogue.ts`.
- Produces: DOM ids `vehicleMake`, `vehicleModel`, `vehicleVariant`, `trayMass`, `trayMassField`, `vehicleProvenance`, used by the Playwright test in Task 6.

Provenance is part of this task rather than its own, because `applyVariant` calls `renderProvenance` directly. Split apart, Task 5 would throw a ReferenceError and could not be tested on its own.

- [ ] **Step 1: Import the catalogue in the page frontmatter**

At the top of the frontmatter block, after the existing imports:

```typescript
import { getVehicleCatalogue } from '../../lib/vehicleCatalogue.ts';
const vehicleCatalogue = getVehicleCatalogue();
```

- [ ] **Step 2: Add the picker markup above the existing `vehicleName` field**

Insert immediately before the `form-field--full` div that contains `vehicleName`:

```astro
<div class="form-field form-field--full">
  <label class="form-label" for="vehicleMake">Find your vehicle (optional)</label>
  <div class="vehicle-picker">
    <select class="form-input" id="vehicleMake"><option value="">Select a make</option></select>
    <select class="form-input" id="vehicleModel" disabled><option value="">Select a model</option></select>
    <select class="form-input" id="vehicleVariant" disabled><option value="">Select a variant</option></select>
  </div>
  <span class="form-help">
    Picking a vehicle fills the published figures below. You can change any of them,
    and a weighbridge figure for your own vehicle is always better than a published one.
  </span>
  <div id="vehicleProvenance" class="vehicle-provenance" hidden></div>
</div>
<script type="application/json" id="vehicleCatalogueData" set:html={JSON.stringify(vehicleCatalogue)}></script>
```

- [ ] **Step 3: Add the tray mass field after `currentWeight`**

```astro
<div class="form-field" id="trayMassField" hidden>
  <label class="form-label" for="trayMass">Tray weight (kg)</label>
  <input class="form-input" id="trayMass" type="number" min="0" placeholder="120" />
  <span class="form-help" id="trayMassHelp"></span>
</div>
```

- [ ] **Step 4: Wire the picker in the existing client script**

Add inside the existing `<script>` block, after the `fields` declaration:

```typescript
const catalogueEl = document.getElementById('vehicleCatalogueData');
const catalogue = catalogueEl ? JSON.parse(catalogueEl.textContent || '{"models":[],"variants":[]}') : { models: [], variants: [] };
const customerEdited = new Set<string>();

const selectById = (id: string) => document.getElementById(id) as HTMLSelectElement | null;

function fillSelect(select: HTMLSelectElement | null, values: string[], placeholder: string) {
  if (!select) return;
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.disabled = values.length === 0;
}

function setIfNotEdited(id: string, value: number | null) {
  if (value === null || customerEdited.has(id)) return;
  const input = inputById(id);
  if (input) input.value = String(value);
}

['gvm', 'currentWeight', 'trayLength', 'trayWidth', 'trayMass'].forEach((id) => {
  inputById(id)?.addEventListener('input', () => customerEdited.add(id));
});

function applyVariant(variantId: string) {
  const variant = catalogue.variants.find((v: any) => v.id === variantId);
  if (!variant) return;
  setIfNotEdited('gvm', variant.gvmKg);
  setIfNotEdited('currentWeight', variant.kerbKg);
  setIfNotEdited('trayLength', variant.trayLengthMm);
  setIfNotEdited('trayWidth', variant.trayWidthMm);

  const nameInput = inputById('vehicleName');
  if (nameInput && !customerEdited.has('vehicleName')) nameInput.value = variant.label;

  const trayField = byId('trayMassField');
  const trayHelp = byId('trayMassHelp');
  const showTray = variant.trayState === 'excluded' || variant.trayState === 'unknown';
  if (trayField) (trayField as HTMLElement).hidden = !showTray;
  if (trayHelp) {
    trayHelp.textContent = variant.trayState === 'excluded'
      ? 'The published kerb weight for this vehicle excludes the tray, so enter your tray weight here.'
      : 'The manufacturer does not state whether the published kerb weight includes a tray. If your vehicle has one, enter its weight here.';
  }
  renderProvenance(variant);
  calculateSlideOn();
}

selectById('vehicleMake')?.addEventListener('change', (event) => {
  const make = (event.target as HTMLSelectElement).value;
  const models = catalogue.models.filter((m: any) => m.make === make).map((m: any) => m.model);
  fillSelect(selectById('vehicleModel'), models, 'Select a model');
  fillSelect(selectById('vehicleVariant'), [], 'Select a variant');
});

selectById('vehicleModel')?.addEventListener('change', (event) => {
  const make = selectById('vehicleMake')?.value;
  const model = (event.target as HTMLSelectElement).value;
  const variants = catalogue.variants.filter((v: any) => v.make === make && v.model === model);
  const select = selectById('vehicleVariant');
  if (!select) return;
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = 'Select a variant';
  select.appendChild(first);
  for (const variant of variants) {
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.label;
    select.appendChild(option);
  }
  select.disabled = variants.length === 0;
});

selectById('vehicleVariant')?.addEventListener('change', (event) => {
  applyVariant((event.target as HTMLSelectElement).value);
});

fillSelect(selectById('vehicleMake'), [...new Set(catalogue.models.map((m: any) => m.make))].sort(), 'Select a make');
```

- [ ] **Step 5: Add the provenance renderer to the client script, above `applyVariant`**

```typescript
function formatAccessedDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${day} ${months[month - 1]} ${year}`;
}

function trayLine(trayState: string) {
  if (trayState === 'included') return 'Kerb mass includes the standard tray.';
  if (trayState === 'excluded') return 'Kerb mass excludes the tray.';
  if (trayState === 'not_applicable') return 'This is a tub vehicle, so no tray applies.';
  return 'The manufacturer does not state whether kerb mass includes a tray.';
}

function renderProvenance(variant: any) {
  const panel = byId('vehicleProvenance');
  if (!panel) return;
  panel.replaceChildren();

  const line = document.createElement('p');
  const link = document.createElement('a');
  link.href = variant.source.url;
  link.textContent = variant.source.title;
  link.rel = 'noopener';
  link.target = '_blank';
  line.append(
    document.createTextNode(`Published by ${variant.source.manufacturer} in `),
    link,
    document.createTextNode(`, checked ${formatAccessedDate(variant.source.accessedDate)}. ${trayLine(variant.trayState)}`),
  );
  panel.appendChild(line);

  if (variant.promotedByOverride) {
    const note = document.createElement('p');
    note.className = 'vehicle-provenance-note';
    note.textContent = 'This variant was published to the selector manually by Beyond RV.';
    panel.appendChild(note);
  }

  (panel as HTMLElement).hidden = false;
}
```

- [ ] **Step 6: Verify the whole flow by hand**

Run `npm run dev` and open `/slide-on-camper-weight-calculator/`.

1. Pick Mazda, then BT-50, then a single cab variant. GVM and current weight fill.
2. Type a different GVM, re-pick a variant, and confirm your typed value survives.
3. Confirm the provenance panel reads "Published by Mazda Australia in Mazda BT-50 Payload Calculator, checked 18 August 2026. Kerb mass includes the standard tray."
4. Confirm the source link opens the manufacturer page.
5. Pick a Ford Ranger cab-chassis variant and confirm the tray weight field appears, blank, with help text explaining why.

- [ ] **Step 7: Commit**

```bash
git add src/pages/slide-on-camper-weight-calculator/index.astro
git commit -m "feat: add vehicle picker, pre-fill and source provenance"
```

---

### Task 6: Playwright coverage

**Files:**
- Create: `tests/e2e/vehicle-selector.spec.ts`

**Interfaces:**
- Consumes: DOM ids from Task 5.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

```typescript
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/slide-on-camper-weight-calculator/');
});

test('picking a vehicle fills the published figures', async ({ page }) => {
  await page.selectOption('#vehicleMake', 'Mazda');
  await page.selectOption('#vehicleModel', 'BT-50');
  const variant = page.locator('#vehicleVariant option').nth(1);
  await page.selectOption('#vehicleVariant', await variant.getAttribute('value') ?? '');

  await expect(page.locator('#gvm')).not.toHaveValue('');
  await expect(page.locator('#currentWeight')).not.toHaveValue('');
  await expect(page.locator('#vehicleProvenance')).toContainText('Published by Mazda Australia');
});

test('a figure the customer typed survives re-picking a vehicle', async ({ page }) => {
  await page.selectOption('#vehicleMake', 'Mazda');
  await page.selectOption('#vehicleModel', 'BT-50');
  const options = page.locator('#vehicleVariant option');
  await page.selectOption('#vehicleVariant', await options.nth(1).getAttribute('value') ?? '');

  await page.fill('#gvm', '9999');
  await page.selectOption('#vehicleVariant', await options.nth(2).getAttribute('value') ?? '');
  await expect(page.locator('#gvm')).toHaveValue('9999');
});

test('the form still works if the catalogue fails to load', async ({ page }) => {
  // Spec section 9: the selector enhances a working tool and is never a dependency of it.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('vehicleCatalogueData')?.remove();
    });
  });
  await page.reload();
  await page.fill('#gvm', '3350');
  await page.fill('#currentWeight', '2200');
  await expect(page.locator('#gvm')).toHaveValue('3350');
});

test('the form still works when no vehicle is picked', async ({ page }) => {
  await page.fill('#gvm', '3350');
  await page.fill('#currentWeight', '2200');
  await expect(page.locator('#gvm')).toHaveValue('3350');
  await expect(page.locator('#trayMassField')).toBeHidden();
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:e2e -- tests/e2e/vehicle-selector.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npm run test:e2e`
Expected: everything passes, including the calculator tests from Task 1.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/vehicle-selector.spec.ts
git commit -m "test: cover vehicle picker end to end"
```
