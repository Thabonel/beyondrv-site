# Vehicle review screen implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the GM publish reviewed vehicle variants from the admin dashboard, so the vehicle picker on the slide-on weight calculator stops being hidden.

**Architecture:** Review decisions are drafted into Netlify Blobs while the GM works, then written as one commit to `data/vehicle-selector/reviews.json` through the GitHub contents API. The build script merges that overlay over the SQLite rows, applying corrections and treating a listed variant as approved for promotion. The build-time gate stays the only route to publication.

**Tech Stack:** TypeScript, Astro, React (admin panels), Netlify Functions, Netlify Blobs, SQLite via `sqlite3` CLI at build time, `node --test` with `--experimental-strip-types`, Playwright for end to end.

**Spec:** `docs/superpowers/specs/2026-08-30-vehicle-review-screen-design.md`

## Global Constraints

- Unit tests run under `npm test`, which is `node --test --experimental-strip-types`. TypeScript parameter properties are **not** supported in strip-only mode — declare class fields explicitly.
- Test files live in `tests/` and import source with an explicit `.ts` extension, for example `from '../netlify/functions/vehicle-review-core.ts'`.
- Admin endpoints follow `netlify/functions/admin-marketing-ideas.ts`: check `getAdminActor`, then `hasAdminCapability`, then `connectBlobStore(event)`, and return JSON with an explicit `Content-Type` header.
- Correctable fields and their ranges, exactly: `gvmKg` 1500–8000, `kerbKg` 1000–6000, `trayLengthMm` 1200–4000, `trayWidthMm` 1200–2500. All integers.
- `kerbKg` must be strictly less than `gvmKg` after corrections are applied.
- `reviewer` and `reviewedAt` are always taken from the admin session and the server clock. Never from a request body.
- `reviewedAt` is an ISO `YYYY-MM-DD` date string.
- Validation style follows `validateCatalogueOverrides` in `src/lib/vehicleCatalogue/derive.ts`: trim strings, cap lengths, collect every error into an array, return `{ valid, errors, value? }`. Never throw for user input.
- Variant ids are capped at 240 characters, matching the existing override cap.

---

### Task 1: Add the `vehicles:review` capability

The `gm` role currently holds neither `site:read` nor `site:write`, so without this the GM cannot reach the screen at all.

**Files:**
- Modify: `netlify/functions/admin-auth.ts`
- Test: `tests/admin-auth.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `'vehicles:review'` as a member of the `AdminCapability` union, granted to roles `gm`, `owner`, and `legacy_admin`

- [ ] **Step 1: Write the failing test**

Append to `tests/admin-auth.test.ts`:

```ts
test('the gm can review vehicles, and site_admin cannot', () => {
  const gm = { id: 'g1', displayName: 'GM', role: 'gm' as const };
  const siteAdmin = { id: 's1', displayName: 'Site admin', role: 'site_admin' as const };
  const owner = { id: 'o1', displayName: 'Owner', role: 'owner' as const };

  assert.equal(hasAdminCapability(gm, 'vehicles:review'), true);
  assert.equal(hasAdminCapability(owner, 'vehicles:review'), true);
  // Publishing vehicle specifications is not part of editing the site.
  assert.equal(hasAdminCapability(siteAdmin, 'vehicles:review'), false);
});

test('reviewing vehicles does not grant site editing to the gm', () => {
  const gm = { id: 'g1', displayName: 'GM', role: 'gm' as const };

  assert.equal(hasAdminCapability(gm, 'site:write'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/admin-auth.test.ts`
Expected: FAIL. `'vehicles:review'` is not assignable to `AdminCapability`.

- [ ] **Step 3: Add the capability**

In `netlify/functions/admin-auth.ts`, add `| 'vehicles:review'` to the `AdminCapability` union beside `'site:write'`, add `'vehicles:review'` to `ALL_CAPABILITIES`, and add it to the `gm` set in `ROLE_CAPABILITIES`:

```ts
  gm: new Set([
    'sales:read',
    'sales:write',
    'agreements:read',
    'agreements:write',
    'agreements:approve',
    'agreements:send',
    'agreements:record_acceptance',
    'configurations:read',
    'configurations:write',
    'configurations:approve',
    'deposits:verify',
    'builds:read',
    'builds:release',
    'vehicles:review',
  ]),
```

`owner` and `legacy_admin` use `ALL_CAPABILITIES`, so they pick it up automatically. Do not add it to `site_admin`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/admin-auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/admin-auth.ts tests/admin-auth.test.ts
git commit -m "feat: add a vehicles:review capability for the gm"
```

---

### Task 2: Validate a review entry

**Files:**
- Create: `netlify/functions/vehicle-review-core.ts`
- Test: `tests/vehicle-review-core.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `CORRECTABLE_FIELDS: Record<'gvmKg' | 'kerbKg' | 'trayLengthMm' | 'trayWidthMm', { min: number; max: number }>`
  - `type ReviewCorrections = Partial<Record<keyof typeof CORRECTABLE_FIELDS, number>>`
  - `type ReviewEntry = { id: string; reviewer: string; reviewedAt: string; corrections?: ReviewCorrections }`
  - `validateReviewEntry(value: unknown, index: number): { errors: string[]; entry?: ReviewEntry }`

- [ ] **Step 1: Write the failing test**

Create `tests/vehicle-review-core.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReviewEntry } from '../netlify/functions/vehicle-review-core.ts';

const VALID = { id: 'ford-ranger-2023-xlt', reviewer: 'j.smith', reviewedAt: '2026-08-30' };

test('a review entry with no corrections is accepted', () => {
  const result = validateReviewEntry(VALID, 0);

  assert.deepEqual(result.errors, []);
  assert.equal(result.entry?.id, 'ford-ranger-2023-xlt');
  assert.equal(result.entry?.corrections, undefined);
});

test('a correction inside its range is accepted', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 3350 } }, 0);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.entry?.corrections, { gvmKg: 3350 });
});

// A slipped keystroke must not publish a 33,500 kg ute.
test('a correction outside its range is rejected at both boundaries', () => {
  const low = validateReviewEntry({ ...VALID, corrections: { gvmKg: 1499 } }, 0);
  const high = validateReviewEntry({ ...VALID, corrections: { gvmKg: 8001 } }, 0);

  assert.equal(low.entry, undefined);
  assert.equal(high.entry, undefined);
  assert.match(low.errors[0], /gvmKg/);
  assert.match(high.errors[0], /gvmKg/);
});

test('a correction exactly on its boundary is accepted', () => {
  assert.deepEqual(validateReviewEntry({ ...VALID, corrections: { gvmKg: 1500 } }, 0).errors, []);
  assert.deepEqual(validateReviewEntry({ ...VALID, corrections: { gvmKg: 8000 } }, 0).errors, []);
});

test('a non-integer correction is rejected', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { gvmKg: 3350.5 } }, 0);

  assert.equal(result.entry, undefined);
  assert.match(result.errors[0], /whole number/);
});

test('an unknown correctable field is rejected rather than ignored', () => {
  const result = validateReviewEntry({ ...VALID, corrections: { payloadKg: 900 } }, 0);

  assert.equal(result.entry, undefined);
  assert.match(result.errors[0], /payloadKg/);
});

test('a missing id is rejected', () => {
  const result = validateReviewEntry({ reviewer: 'j.smith', reviewedAt: '2026-08-30' }, 3);

  assert.equal(result.entry, undefined);
  assert.match(result.errors[0], /\[3\]\.id/);
});

test('a reviewedAt that is not a real date is rejected', () => {
  assert.notDeepEqual(validateReviewEntry({ ...VALID, reviewedAt: '2026-02-30' }, 0).errors, []);
  assert.notDeepEqual(validateReviewEntry({ ...VALID, reviewedAt: '30-08-2026' }, 0).errors, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: FAIL. Cannot find module `vehicle-review-core.ts`.

- [ ] **Step 3: Write the implementation**

Create `netlify/functions/vehicle-review-core.ts`:

```ts
/**
 * Review decisions are written by an admin endpoint and read again by the build.
 * Both sides validate, so a file edited by hand cannot publish a figure the
 * endpoint would have refused.
 */

export const CORRECTABLE_FIELDS = {
  gvmKg: { min: 1500, max: 8000 },
  kerbKg: { min: 1000, max: 6000 },
  trayLengthMm: { min: 1200, max: 4000 },
  trayWidthMm: { min: 1200, max: 2500 },
} as const;

export type CorrectableField = keyof typeof CORRECTABLE_FIELDS;
export type ReviewCorrections = Partial<Record<CorrectableField, number>>;

export interface ReviewEntry {
  id: string;
  reviewer: string;
  reviewedAt: string;
  corrections?: ReviewCorrections;
}

const MAX_ID = 240;
const MAX_REVIEWER = 120;

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateReviewEntry(value: unknown, index: number): { errors: string[]; entry?: ReviewEntry } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { errors: [`reviews[${index}] must be an object.`] };
  }

  const record = value as Record<string, unknown>;
  const id = trimmed(record.id);
  const reviewer = trimmed(record.reviewer);
  const reviewedAt = trimmed(record.reviewedAt);

  if (!id) errors.push(`reviews[${index}].id is required.`);
  else if (id.length > MAX_ID) errors.push(`reviews[${index}].id must be at most ${MAX_ID} characters.`);
  if (!reviewer) errors.push(`reviews[${index}].reviewer is required.`);
  else if (reviewer.length > MAX_REVIEWER) errors.push(`reviews[${index}].reviewer must be at most ${MAX_REVIEWER} characters.`);
  if (!isIsoDate(reviewedAt)) errors.push(`reviews[${index}].reviewedAt must be a real YYYY-MM-DD date.`);

  let corrections: ReviewCorrections | undefined;
  if (record.corrections !== undefined) {
    if (!record.corrections || typeof record.corrections !== 'object' || Array.isArray(record.corrections)) {
      errors.push(`reviews[${index}].corrections must be an object.`);
    } else {
      const parsed: ReviewCorrections = {};
      for (const [field, raw] of Object.entries(record.corrections as Record<string, unknown>)) {
        const bounds = CORRECTABLE_FIELDS[field as CorrectableField];
        if (!bounds) {
          errors.push(`reviews[${index}].corrections.${field} is not a correctable field.`);
          continue;
        }
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          errors.push(`reviews[${index}].corrections.${field} must be a number.`);
          continue;
        }
        if (!Number.isInteger(raw)) {
          errors.push(`reviews[${index}].corrections.${field} must be a whole number.`);
          continue;
        }
        if (raw < bounds.min || raw > bounds.max) {
          errors.push(`reviews[${index}].corrections.${field} must be between ${bounds.min} and ${bounds.max}.`);
          continue;
        }
        parsed[field as CorrectableField] = raw;
      }
      if (Object.keys(parsed).length > 0) corrections = parsed;
    }
  }

  if (errors.length) return { errors };
  return { errors: [], entry: corrections ? { id, reviewer, reviewedAt, corrections } : { id, reviewer, reviewedAt } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/vehicle-review-core.ts tests/vehicle-review-core.test.ts
git commit -m "feat: validate a single vehicle review entry"
```

---

### Task 3: Validate the whole file, merge entries, and apply corrections

**Files:**
- Modify: `netlify/functions/vehicle-review-core.ts`
- Test: `tests/vehicle-review-core.test.ts`

**Interfaces:**
- Consumes: `validateReviewEntry`, `ReviewEntry`, `CORRECTABLE_FIELDS` from Task 2
- Produces:
  - `validateReviewsFile(value: unknown): { valid: boolean; errors: string[]; reviews?: ReviewEntry[] }`
  - `mergeReviews(existing: ReviewEntry[], incoming: ReviewEntry[]): ReviewEntry[]`
  - `applyCorrections<T extends Record<string, unknown>>(row: T, entry: ReviewEntry | undefined): { row: T; correctedFields: CorrectableField[] }`

- [ ] **Step 1: Write the failing test**

Append to `tests/vehicle-review-core.test.ts`, and extend the import to `{ applyCorrections, mergeReviews, validateReviewEntry, validateReviewsFile }`:

```ts
test('a well formed file is accepted', () => {
  const result = validateReviewsFile({ reviews: [VALID] });

  assert.equal(result.valid, true);
  assert.equal(result.reviews?.length, 1);
});

test('every error in a file is collected, not just the first', () => {
  const result = validateReviewsFile({ reviews: [{ reviewer: 'a', reviewedAt: 'nope' }, { id: 'x' }] });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3, `expected several errors, got ${result.errors.length}`);
});

test('a file that is not an object is rejected without throwing', () => {
  assert.equal(validateReviewsFile(null).valid, false);
  assert.equal(validateReviewsFile([]).valid, false);
  assert.equal(validateReviewsFile({ reviews: 'no' }).valid, false);
});

test('a duplicated id in one file is rejected', () => {
  const result = validateReviewsFile({ reviews: [VALID, { ...VALID, reviewedAt: '2026-08-31' }] });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /duplicate/i);
});

// Re-reviewing a vehicle must update it, never add a second entry for it.
test('merging replaces an entry with the same id rather than duplicating it', () => {
  const existing = [{ id: 'a', reviewer: 'old', reviewedAt: '2026-08-01' }];
  const incoming = [{ id: 'a', reviewer: 'new', reviewedAt: '2026-08-30' }, { id: 'b', reviewer: 'new', reviewedAt: '2026-08-30' }];

  const merged = mergeReviews(existing, incoming);

  assert.equal(merged.length, 2);
  assert.equal(merged.find((entry) => entry.id === 'a')?.reviewer, 'new');
});

test('merging sorts by id so the committed file has a stable diff', () => {
  const merged = mergeReviews([], [{ id: 'b', reviewer: 'r', reviewedAt: '2026-08-30' }, { id: 'a', reviewer: 'r', reviewedAt: '2026-08-30' }]);

  assert.deepEqual(merged.map((entry) => entry.id), ['a', 'b']);
});

test('corrections overwrite the row and name the fields they changed', () => {
  const row = { gvmKg: 3200, kerbKg: 2200, trayLengthMm: null };

  const result = applyCorrections(row, { id: 'a', reviewer: 'r', reviewedAt: '2026-08-30', corrections: { gvmKg: 3350 } });

  assert.equal(result.row.gvmKg, 3350);
  assert.equal(result.row.kerbKg, 2200);
  assert.deepEqual(result.correctedFields, ['gvmKg']);
});

test('a row with no review entry is returned untouched', () => {
  const row = { gvmKg: 3200, kerbKg: 2200 };

  const result = applyCorrections(row, undefined);

  assert.deepEqual(result.row, row);
  assert.deepEqual(result.correctedFields, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: FAIL. `validateReviewsFile` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `netlify/functions/vehicle-review-core.ts`:

```ts
export function validateReviewsFile(value: unknown): { valid: boolean; errors: string[]; reviews?: ReviewEntry[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Vehicle reviews must be an object.'] };
  }
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.reviews)) {
    return { valid: false, errors: ['Vehicle reviews must include a reviews array.'] };
  }

  const errors: string[] = [];
  const reviews: ReviewEntry[] = [];
  const seen = new Set<string>();

  for (const [index, item] of candidate.reviews.entries()) {
    const result = validateReviewEntry(item, index);
    errors.push(...result.errors);
    if (!result.entry) continue;
    if (seen.has(result.entry.id)) {
      errors.push(`reviews[${index}].id is a duplicate of an earlier entry.`);
      continue;
    }
    seen.add(result.entry.id);
    reviews.push(result.entry);
  }

  if (errors.length) return { valid: false, errors };
  return { valid: true, errors: [], reviews };
}

/**
 * Later decisions win. Sorting by id keeps the committed file's diff readable,
 * so a reviewer can see what one publish actually changed.
 */
export function mergeReviews(existing: ReviewEntry[], incoming: ReviewEntry[]): ReviewEntry[] {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function applyCorrections<T extends Record<string, unknown>>(
  row: T,
  entry: ReviewEntry | undefined,
): { row: T; correctedFields: CorrectableField[] } {
  if (!entry?.corrections) return { row, correctedFields: [] };
  const corrected = { ...row } as Record<string, unknown>;
  const correctedFields: CorrectableField[] = [];
  for (const [field, value] of Object.entries(entry.corrections)) {
    corrected[field] = value;
    correctedFields.push(field as CorrectableField);
  }
  correctedFields.sort();
  return { row: corrected as T, correctedFields };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: PASS, 16 tests

- [ ] **Step 5: Write the failing test for the corrected pair**

A correction may touch only one of the two masses, so the pair can only be judged
against the row it applies to. Append to `tests/vehicle-review-core.test.ts`,
extending the import with `validateCorrectedPair`:

```ts
test('a correction that pushes kerb mass to or above GVM is rejected', () => {
  const row = { gvmKg: 3350, kerbKg: 2300 };

  assert.notDeepEqual(validateCorrectedPair('ford-a', row, { kerbKg: 3350 }), []);
  assert.notDeepEqual(validateCorrectedPair('ford-a', row, { kerbKg: 3400 }), []);
  assert.deepEqual(validateCorrectedPair('ford-a', row, { kerbKg: 3349 }), []);
});

test('lowering GVM below an uncorrected kerb mass is rejected', () => {
  assert.notDeepEqual(validateCorrectedPair('ford-a', { gvmKg: 3350, kerbKg: 2300 }, { gvmKg: 2200 }), []);
});

test('a row with no corrections is judged on its own figures', () => {
  assert.deepEqual(validateCorrectedPair('ford-a', { gvmKg: 3350, kerbKg: 2300 }, undefined), []);
  assert.notDeepEqual(validateCorrectedPair('ford-a', { gvmKg: 2300, kerbKg: 3350 }, undefined), []);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: FAIL. `validateCorrectedPair` is not exported.

- [ ] **Step 7: Implement the pair check**

Append to `netlify/functions/vehicle-review-core.ts`:

```ts
/**
 * A correction can touch one mass and not the other, so the pair only makes
 * sense judged against the row it applies to. A kerb mass at or above GVM would
 * publish a vehicle with no payload at all.
 */
export function validateCorrectedPair(
  id: string,
  row: { gvmKg: number; kerbKg: number },
  corrections: ReviewCorrections | undefined,
): string[] {
  const gvmKg = corrections?.gvmKg ?? row.gvmKg;
  const kerbKg = corrections?.kerbKg ?? row.kerbKg;
  if (kerbKg >= gvmKg) {
    return [`${id}: kerb mass ${kerbKg} kg is not below GVM ${gvmKg} kg.`];
  }
  return [];
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: PASS, 19 tests

- [ ] **Step 9: Commit**

```bash
git add netlify/functions/vehicle-review-core.ts tests/vehicle-review-core.test.ts
git commit -m "feat: validate, merge and apply vehicle review decisions"
```

---

### Task 4: Promote reviewed variants at build time

**Files:**
- Create: `data/vehicle-selector/reviews.json`
- Modify: `src/lib/vehicleCatalogue/derive.ts`
- Modify: `SCRIPTS/build-vehicle-catalogue.mjs`
- Test: `tests/vehicle-catalogue-derive.test.ts`

**Interfaces:**
- Consumes: `validateReviewsFile`, `applyCorrections`, `ReviewEntry` from Task 3
- Produces: `isPromoted(row, overrides, reviewedIds?: ReadonlySet<string>)` — a third optional parameter, so existing callers keep working

- [ ] **Step 1: Write the failing test**

Append to `tests/vehicle-catalogue-derive.test.ts`:

```ts
const UNREVIEWED = { id: 'ford-a', customer_selectable: 0, latest_review_id: null, latest_review_decision: null };
const NO_OVERRIDES = { show: [], hide: [] };

test('a variant listed in reviews is promoted', () => {
  assert.equal(isPromoted(UNREVIEWED, NO_OVERRIDES, new Set(['ford-a'])), true);
});

test('a variant not listed anywhere is still not promoted', () => {
  assert.equal(isPromoted(UNREVIEWED, NO_OVERRIDES, new Set(['ford-b'])), false);
});

// Hiding is a safety control and must beat every route to publication.
test('a hidden variant stays hidden even when reviewed', () => {
  assert.equal(isPromoted(UNREVIEWED, { show: [], hide: ['ford-a'] }, new Set(['ford-a'])), false);
});

test('omitting the reviewed set leaves existing behaviour unchanged', () => {
  assert.equal(isPromoted(UNREVIEWED, NO_OVERRIDES), false);
  assert.equal(
    isPromoted({ id: 'ford-a', customer_selectable: 1, latest_review_id: 7, latest_review_decision: 'approved' }, NO_OVERRIDES),
    true,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/vehicle-catalogue-derive.test.ts`
Expected: FAIL. `isPromoted` takes two arguments.

- [ ] **Step 3: Extend `isPromoted`**

In `src/lib/vehicleCatalogue/derive.ts`, replace the body of `isPromoted`:

```ts
export function isPromoted(
  row: CataloguePromotionRow,
  overrides: CatalogueOverrides,
  reviewedIds: ReadonlySet<string> = new Set(),
): boolean {
  if (overrides.hide.includes(row.id)) return false;
  if (overrides.show.some((entry) => entry.id === row.id)) return true;
  if (reviewedIds.has(row.id)) return true;
  return row.customer_selectable === 1
    && row.latest_review_id !== null
    && row.latest_review_decision === 'approved';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/vehicle-catalogue-derive.test.ts`
Expected: PASS

- [ ] **Step 5: Create the empty overlay file**

Create `data/vehicle-selector/reviews.json`:

```json
{
  "reviews": []
}
```

- [ ] **Step 6: Wire the overlay into the build script**

In `SCRIPTS/build-vehicle-catalogue.mjs`, add the import beside the existing ones:

```js
import { applyCorrections, validateReviewsFile } from '../netlify/functions/vehicle-review-core.ts';
```

Add the path beside `overridesPath`:

```js
const reviewsPath = resolve(root, 'data/vehicle-selector/reviews.json');
```

After the overrides are validated, read and validate the overlay:

```js
const reviewValidation = validateReviewsFile(JSON.parse(readFileSync(reviewsPath, 'utf8')));
if (!reviewValidation.valid || !reviewValidation.reviews) {
  console.error('Vehicle reviews are invalid:');
  for (const error of reviewValidation.errors) console.error(`  ${error}`);
  process.exit(1);
}
const reviewsById = new Map(reviewValidation.reviews.map((entry) => [entry.id, entry]));
const reviewedIds = new Set(reviewsById.keys());

for (const id of reviewedIds) {
  if (!rowIds.has(id)) throw new Error(`Review refers to missing variant ${id}.`);
}
```

Place that block after `const rowIds = new Set(rows.map((row) => row.id));` so the missing-variant check can run.

Change the promotion filter to pass the reviewed set:

```js
  .filter((r) => isPromoted(r, overrides, reviewedIds))
```

Inside the `.map((r) => {` callback, before building the object:

```js
    const reviewEntry = reviewsById.get(r.id);
    const { row: corrected, correctedFields } = applyCorrections(
      { gvmKg: r.gvm_kg, kerbKg: r.kerb_mass_kg, trayLengthMm: r.usable_load_length_mm ?? null, trayWidthMm: r.usable_load_width_mm ?? null },
      reviewEntry,
    );
```

Then use the corrected values in the returned object, replacing those four lines:

```js
      gvmKg: corrected.gvmKg,
      kerbKg: corrected.kerbKg,
      trayLengthMm: corrected.trayLengthMm,
      trayWidthMm: corrected.trayWidthMm,
      correctedFields,
```

And extend the publication branch so an overlay approval is distinguishable:

```js
      publication: publicationOverride
        ? { approvalId: `override:${r.id}`, approvedAt: publicationOverride.approvedAt, method: 'override' }
        : reviewEntry
          ? { approvalId: `review:overlay:${r.id}`, approvedAt: reviewEntry.reviewedAt, method: 'review', reviewer: reviewEntry.reviewer }
          : { approvalId: `review:${r.latest_review_id}`, approvedAt: r.latest_reviewed_at, method: 'review' },
```

Finally, add a guard after corrections are applied so a corrected pair cannot invert:

```js
    if (corrected.kerbKg >= corrected.gvmKg) {
      throw new Error(`Refusing to publish ${r.id}: kerb mass ${corrected.kerbKg} is not below GVM ${corrected.gvmKg}.`);
    }
    // Payload is GVM minus kerb, and the catalogue validator enforces that.
    const massCorrected = correctedFields.includes('gvmKg') || correctedFields.includes('kerbKg');
    const payloadKg = massCorrected ? corrected.gvmKg - corrected.kerbKg : r.published_payload_kg;
    const disclosedCorrections = massCorrected ? [...correctedFields, 'payloadKg'].sort() : correctedFields;
```

- [ ] **Step 7: Verify the build still runs and publishes nothing new**

Run: `node SCRIPTS/build-vehicle-catalogue.mjs`
Expected: exits 0. `src/data/vehicle-selector/catalogue.json` still reports zero variants, because `reviews.json` is empty.

Then confirm a reviewed variant does publish. Temporarily put one real id into `data/vehicle-selector/reviews.json`:

```bash
sqlite3 data/vehicle-selector/australian-slide-on-vehicles.sqlite \
  "SELECT id FROM vehicle_variants WHERE make='Ford' LIMIT 1;"
```

Put that id in the file with `"reviewer": "test", "reviewedAt": "2026-08-30"`, run the build again, and confirm the catalogue now holds one variant. Then restore the file to `{ "reviews": [] }`.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions

- [ ] **Step 9: Commit**

```bash
git add data/vehicle-selector/reviews.json src/lib/vehicleCatalogue/derive.ts SCRIPTS/build-vehicle-catalogue.mjs tests/vehicle-catalogue-derive.test.ts
git commit -m "feat: promote reviewed variants from the review overlay at build time"
```

---

### Task 5: Extract the GitHub commit helper

`getFileSha` and `commitFile` are copy-pasted into `admin-deploy.ts`, `admin-product-edit.ts`, `admin-product-archive.ts`, and `admin-chat.ts`. Rather than add a fifth copy, extract one.

**Files:**
- Create: `netlify/functions/github-contents.ts`
- Modify: `netlify/functions/admin-deploy.ts`
- Test: `tests/github-contents.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `buildCommitBody(content: string, sha: string | null, message: string, branch: string): Record<string, unknown>`
  - `getFileSha(path: string): Promise<string | null>`
  - `commitFile(path: string, content: string, sha: string | null, message: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `tests/github-contents.test.ts`. Only the pure body builder is unit tested; the two network functions are exercised end to end in Task 7.

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommitBody } from '../netlify/functions/github-contents.ts';

test('content is base64 encoded for the contents API', () => {
  const body = buildCommitBody('{"reviews":[]}', null, 'msg', 'main');

  assert.equal(Buffer.from(body.content as string, 'base64').toString('utf8'), '{"reviews":[]}');
});

// Without the sha, GitHub treats the write as a create and rejects it for an
// existing file. With a stale sha it rejects the write, which is what stops one
// reviewer silently overwriting another.
test('an existing file carries its sha, a new file does not', () => {
  assert.equal(buildCommitBody('x', 'abc123', 'msg', 'main').sha, 'abc123');
  assert.equal('sha' in buildCommitBody('x', null, 'msg', 'main'), false);
});

test('utf8 content survives the round trip', () => {
  const body = buildCommitBody('Björn — 3350kg', null, 'msg', 'main');

  assert.equal(Buffer.from(body.content as string, 'base64').toString('utf8'), 'Björn — 3350kg');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/github-contents.test.ts`
Expected: FAIL. Cannot find module `github-contents.ts`.

- [ ] **Step 3: Write the implementation**

Create `netlify/functions/github-contents.ts`:

```ts
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';

export function buildCommitBody(content: string, sha: string | null, message: string, branch: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  // GitHub treats a write without a sha as a create, and rejects a write whose
  // sha is stale. Both behaviours are what stop one publish clobbering another.
  if (sha) body.sha = sha;
  return body;
}

export async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error reading ${path}: ${await res.text()}`);
  const data = await res.json() as { sha: string };
  return data.sha;
}

export async function getFileContent(path: string): Promise<string | null> {
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error reading ${path}: ${await res.text()}`);
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf8');
}

export async function commitFile(path: string, content: string, sha: string | null, message: string): Promise<void> {
  const res = await fetch(`${API}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildCommitBody(content, sha, message, GITHUB_BRANCH)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error for ${path}: ${err}`);
  }
}

export function githubIsConfigured(): boolean {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO);
}
```

- [ ] **Step 4: Point `admin-deploy.ts` at the shared helper**

Delete the local `getFileSha` and `commitFile` from `netlify/functions/admin-deploy.ts` and import them instead:

```ts
import { commitFile, getFileSha } from './github-contents';
```

Leave the rest of that handler alone. Do not touch `admin-product-edit.ts`, `admin-product-archive.ts`, or `admin-chat.ts` in this task — migrating them is not needed for this feature and widens the blast radius.

- [ ] **Step 5: Run tests and typecheck**

Run: `node --test --experimental-strip-types tests/github-contents.test.ts && npx tsc --noEmit`
Expected: PASS, and no type errors

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/github-contents.ts netlify/functions/admin-deploy.ts tests/github-contents.test.ts
git commit -m "refactor: extract the shared GitHub contents helper"
```

---

### Task 6: Serve review candidates and save drafts

**Files:**
- Create: `netlify/functions/admin-vehicle-review.ts`
- Test: `tests/vehicle-review-core.test.ts` (draft shape helpers)

**Interfaces:**
- Consumes: `validateReviewEntry`, `CORRECTABLE_FIELDS` from Tasks 2 and 3; `getAdminActor`, `hasAdminCapability` from Task 1
- Produces:
  - `GET /.netlify/functions/admin-vehicle-review?make=Ford` returning `{ make, makes: string[], candidates: Candidate[] }`
  - `PUT /.netlify/functions/admin-vehicle-review` accepting `{ id, included, corrections }` and returning `{ ok: true }`
  - `VEHICLE_REVIEW_DRAFT_STORE = 'vehicle-review-drafts'` and `draftKey(id)` exported from `vehicle-review-core.ts`
  - `Candidate = { id, label, make, model, gvmKg, kerbKg, trayLengthMm, trayWidthMm, verificationStatus, source: { manufacturer, title, url }, included, corrections }`

- [ ] **Step 1: Write the failing test for the draft key**

Append to `tests/vehicle-review-core.test.ts`, extending the import with `draftKey`:

```ts
test('draft keys are namespaced and encoded so an odd id cannot escape the store', () => {
  assert.equal(draftKey('ford-ranger-2023'), 'vehicle-review/ford-ranger-2023.json');
  assert.equal(draftKey('a/b'), 'vehicle-review/a%2Fb.json');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: FAIL. `draftKey` is not exported.

- [ ] **Step 3: Add the store constants**

Append to `netlify/functions/vehicle-review-core.ts`:

```ts
export const VEHICLE_REVIEW_DRAFT_STORE = 'vehicle-review-drafts';

export function draftKey(variantId: string) {
  return `vehicle-review/${encodeURIComponent(variantId)}.json`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: PASS

- [ ] **Step 5: Write the endpoint**

Create `netlify/functions/admin-vehicle-review.ts`.

`catalogue.json` holds only promoted variants, so unpublished candidates need
their own generated file. Write it beside `netlify/functions/vehicle-variant-index.json`,
which the build script already generates for a function to import — a function
importing across into `src/` is not a pattern this repo uses, and esbuild bundling
is not worth the risk.

In `SCRIPTS/build-vehicle-catalogue.mjs`, after the catalogue is written:

```js
const candidates = rows.map((r) => ({
  id: r.id,
  make: r.make,
  model: r.model,
  modelYear: r.model_year_start,
  grade: r.grade,
  cabType: r.cab_type,
  bodyType: r.body_type,
  gvmKg: r.gvm_kg,
  kerbKg: r.kerb_mass_kg,
  trayLengthMm: r.usable_load_length_mm ?? null,
  trayWidthMm: r.usable_load_width_mm ?? null,
  verificationStatus: r.verification_status,
  source: { manufacturer: r.manufacturer, title: r.title, url: r.url },
}));
writeFileSync(resolve(root, 'netlify/functions/vehicle-review-candidates.json'), `${JSON.stringify({ candidates }, null, 2)}\n`);
```

Then the endpoint:

```ts
import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { mapWithConcurrency, selectExistingKeys } from './blob-batch';
import { CORRECTABLE_FIELDS, draftKey, VEHICLE_REVIEW_DRAFT_STORE, type ReviewCorrections } from './vehicle-review-core';
import candidateData from './vehicle-review-candidates.json';

const CAPABILITY = 'vehicles:review';
const CONCURRENCY = 12;

interface CandidateRow {
  id: string; make: string; model: string; modelYear: number; grade: string;
  cabType: string; bodyType: string; gvmKg: number; kerbKg: number;
  trayLengthMm: number | null; trayWidthMm: number | null; verificationStatus: string;
  source: { manufacturer: string; title: string; url: string };
}

interface Draft { included: boolean; corrections: ReviewCorrections }

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function parseCorrections(value: unknown): ReviewCorrections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const parsed: ReviewCorrections = {};
  for (const [field, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(field in CORRECTABLE_FIELDS)) continue;
    if (typeof raw === 'number' && Number.isInteger(raw)) parsed[field as keyof ReviewCorrections] = raw;
  }
  return parsed;
}

export const handler: Handler = async (event) => {
  if (!['GET', 'PUT'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, CAPABILITY)) return forbiddenResponse(CAPABILITY);
  connectBlobStore(event);

  const rows = (candidateData as { candidates: CandidateRow[] }).candidates;
  const makes = [...new Set(rows.map((row) => row.make))].sort();

  try {
    const store = getBlobStore(VEHICLE_REVIEW_DRAFT_STORE);

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id || !rows.some((row) => row.id === id)) return json(400, { error: 'Unknown vehicle variant.' });
      const draft: Draft = { included: body.included !== false, corrections: parseCorrections(body.corrections) };
      await store.setJSON(draftKey(id), draft);
      return json(200, { ok: true });
    }

    const make = event.queryStringParameters?.make ?? makes[0] ?? '';
    const forMake = rows.filter((row) => row.make === make);

    const { blobs } = await store.list();
    const withDrafts = selectExistingKeys(forMake, (row) => draftKey(row.id), blobs.map((blob) => blob.key));
    const draftEntries = await mapWithConcurrency(withDrafts, CONCURRENCY, async (row) => {
      try {
        return [row.id, await store.get(draftKey(row.id), { type: 'json' }) as Draft | null] as const;
      } catch {
        return [row.id, null] as const;
      }
    });
    const drafts = new Map(draftEntries);

    const candidates = forMake.map((row) => {
      const draft = drafts.get(row.id) ?? null;
      return {
        ...row,
        // Source-verified rows start ticked; the rest are a deliberate act.
        included: draft ? draft.included : row.verificationStatus === 'source_verified',
        corrections: draft?.corrections ?? {},
      };
    });

    return json(200, { make, makes, candidates });
  } catch (error) {
    console.warn('admin-vehicle-review: unavailable', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
```

- [ ] **Step 6: Regenerate the candidate file and typecheck**

Run: `node SCRIPTS/build-vehicle-catalogue.mjs && npx tsc --noEmit`
Expected: `netlify/functions/vehicle-review-candidates.json` exists with 159 rows, and no type errors

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/admin-vehicle-review.ts netlify/functions/vehicle-review-core.ts SCRIPTS/build-vehicle-catalogue.mjs netlify/functions/vehicle-review-candidates.json tests/vehicle-review-core.test.ts
git commit -m "feat: serve vehicle review candidates and save drafts"
```

---

### Task 7: Publish a batch of reviews

**Files:**
- Modify: `netlify/functions/admin-vehicle-review.ts`
- Test: `tests/vehicle-review-core.test.ts`

**Interfaces:**
- Consumes: `mergeReviews`, `validateReviewsFile`, `validateReviewEntry`, `validateCorrectedPair` from Task 3; `commitFile`, `getFileContent`, `getFileSha`, `githubIsConfigured` from Task 5
- Produces: `POST /.netlify/functions/admin-vehicle-review` with `{ make }`, returning `{ ok: true, published: number }`
- Produces: `buildPublishCommitMessage(reviewer: string, count: number, make: string): string`

- [ ] **Step 1: Write the failing test**

Append to `tests/vehicle-review-core.test.ts`, extending the import with `buildPublishCommitMessage`:

```ts
test('the commit message names the reviewer, the count and the make', () => {
  const message = buildPublishCommitMessage('j.smith', 24, 'Ford');

  assert.match(message, /24/);
  assert.match(message, /Ford/);
  assert.match(message, /j\.smith/);
});

test('the commit message is singular for one vehicle', () => {
  assert.match(buildPublishCommitMessage('j.smith', 1, 'Ford'), /1 Ford vehicle\b/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: FAIL. `buildPublishCommitMessage` is not exported.

- [ ] **Step 3: Add the message builder**

Append to `netlify/functions/vehicle-review-core.ts`:

```ts
export function buildPublishCommitMessage(reviewer: string, count: number, make: string): string {
  const noun = count === 1 ? 'vehicle' : 'vehicles';
  return `data: publish ${count} ${make} ${noun} reviewed by ${reviewer}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/vehicle-review-core.test.ts`
Expected: PASS

- [ ] **Step 5: Add the publish branch to the endpoint**

In `netlify/functions/admin-vehicle-review.ts`, extend the allowed methods to `['GET', 'PUT', 'POST']`, add the imports:

```ts
import { commitFile, getFileContent, getFileSha, githubIsConfigured } from './github-contents';
import { buildPublishCommitMessage, mergeReviews, validateCorrectedPair, validateReviewEntry, validateReviewsFile, type ReviewEntry } from './vehicle-review-core';

const REVIEWS_PATH = 'data/vehicle-selector/reviews.json';
```

Add this branch after the `PUT` branch and before the `GET` handling:

```ts
    if (event.httpMethod === 'POST') {
      if (!githubIsConfigured()) return json(503, { error: 'Publishing is not configured. GITHUB_TOKEN and GITHUB_REPO are required.' });

      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const make = typeof body.make === 'string' ? body.make.trim() : '';
      const forMake = rows.filter((row) => row.make === make);
      if (!forMake.length) return json(400, { error: 'Unknown make.' });

      const { blobs } = await store.list();
      const stored = new Set(blobs.map((blob) => blob.key));
      const reviewedAt = new Date().toISOString().slice(0, 10);
      const incoming: ReviewEntry[] = [];
      const errors: string[] = [];

      for (const row of forMake) {
        const draft = stored.has(draftKey(row.id))
          ? await store.get(draftKey(row.id), { type: 'json' }) as Draft | null
          : null;
        const included = draft ? draft.included : row.verificationStatus === 'source_verified';
        if (!included) continue;
        const candidate = { id: row.id, reviewer: actor.id, reviewedAt, ...(draft?.corrections && Object.keys(draft.corrections).length ? { corrections: draft.corrections } : {}) };
        const result = validateReviewEntry(candidate, incoming.length);
        if (!result.entry) { errors.push(...result.errors); continue; }
        const pairErrors = validateCorrectedPair(row.id, row, result.entry.corrections);
        if (pairErrors.length) { errors.push(...pairErrors); continue; }
        incoming.push(result.entry);
      }

      if (errors.length) return json(400, { error: `Nothing was published. ${errors.join(' ')}` });
      if (!incoming.length) return json(400, { error: 'Nothing is ticked, so there is nothing to publish.' });

      const existingRaw = await getFileContent(REVIEWS_PATH);
      const existingParsed = existingRaw ? validateReviewsFile(JSON.parse(existingRaw)) : { valid: true, errors: [], reviews: [] as ReviewEntry[] };
      if (!existingParsed.valid || !existingParsed.reviews) {
        return json(500, { error: `The published reviews file is invalid, so nothing was written. ${existingParsed.errors.join(' ')}` });
      }

      const merged = mergeReviews(existingParsed.reviews, incoming);
      const sha = await getFileSha(REVIEWS_PATH);
      await commitFile(REVIEWS_PATH, `${JSON.stringify({ reviews: merged }, null, 2)}\n`, sha, buildPublishCommitMessage(actor.id, incoming.length, make));

      await mapWithConcurrency(incoming, CONCURRENCY, async (entry) => {
        try { await store.delete(draftKey(entry.id)); } catch { /* a stale draft is harmless */ }
        return null;
      });

      await appendOwnerAudit('vehicles_published', 'vehicle_review', make, { count: incoming.length }, actor);
      return json(200, { ok: true, published: incoming.length });
    }
```

Add the audit import:

```ts
import { appendOwnerAudit } from './owner-copilot-store-utils';
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/admin-vehicle-review.ts netlify/functions/vehicle-review-core.ts tests/vehicle-review-core.test.ts
git commit -m "feat: publish a reviewed batch as one commit"
```

---

### Task 8: The review panel component

**Files:**
- Create: `src/components/VehicleReview.tsx`

**Interfaces:**
- Consumes: the `Candidate` shape from Task 6
- Produces: a default-exported `VehicleReview` component taking `{ candidates, makes, make, loading, error, publishing, onMakeChange, onToggle, onCorrect, onPublish }`

- [ ] **Step 1: Write the component**

Follow `src/components/MarketingIdeas.tsx` for styling conventions: inline styles, dark palette, `data-testid` on anything a test needs.

```tsx
import React from 'react';

export interface ReviewCandidate {
  id: string;
  make: string;
  model: string;
  modelYear: number;
  grade: string;
  cabType: string;
  bodyType: string;
  gvmKg: number;
  kerbKg: number;
  trayLengthMm: number | null;
  trayWidthMm: number | null;
  verificationStatus: string;
  source: { manufacturer: string; title: string; url: string };
  included: boolean;
  corrections: Record<string, number>;
}

const cell: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #252525', fontSize: '0.74rem', color: '#ddd', verticalAlign: 'top' };
const numberInput: React.CSSProperties = { width: '5.5rem', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.35rem', fontSize: '0.74rem' };

export default function VehicleReview({
  candidates, makes, make, loading, error, publishing, onMakeChange, onToggle, onCorrect, onPublish,
}: {
  candidates: ReviewCandidate[];
  makes: string[];
  make: string;
  loading: boolean;
  error: string;
  publishing: boolean;
  onMakeChange: (make: string) => void;
  onToggle: (id: string, included: boolean) => void;
  onCorrect: (id: string, field: string, value: number | null) => void;
  onPublish: () => void;
}) {
  if (loading) return <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>Loading vehicles…</p>;
  if (error) return <p data-testid="vehicle-review-error" style={{ margin: 0, color: '#f87171', fontSize: '0.78rem' }}>{error}</p>;

  const tickedCount = candidates.filter((candidate) => candidate.included).length;

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <select
        data-testid="vehicle-review-make"
        value={make}
        onChange={(event) => onMakeChange(event.target.value)}
        style={{ ...numberInput, width: 'auto' }}
      >
        {makes.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['', 'Vehicle', 'GVM (kg)', 'Kerb (kg)', 'Tray L (mm)', 'Tray W (mm)', 'Source'].map((heading) => (
                <th key={heading} style={{ ...cell, color: '#888', fontWeight: 700, textAlign: 'left' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id} data-testid="vehicle-review-row">
                <td style={cell}>
                  <input
                    type="checkbox"
                    data-testid={`vehicle-review-tick-${candidate.id}`}
                    checked={candidate.included}
                    onChange={(event) => onToggle(candidate.id, event.target.checked)}
                  />
                </td>
                <td style={{ ...cell, color: '#fff' }}>
                  {candidate.make} {candidate.model} {candidate.modelYear} {candidate.grade}
                  {candidate.verificationStatus !== 'source_verified' && (
                    <div data-testid="vehicle-review-needs-check" style={{ color: '#e0b341', fontSize: '0.66rem' }}>Needs a second look</div>
                  )}
                </td>
                {(['gvmKg', 'kerbKg', 'trayLengthMm', 'trayWidthMm'] as const).map((field) => (
                  <td key={field} style={cell}>
                    <input
                      type="number"
                      data-testid={`vehicle-review-${field}-${candidate.id}`}
                      style={numberInput}
                      value={candidate.corrections[field] ?? candidate[field] ?? ''}
                      onChange={(event) => onCorrect(candidate.id, field, event.target.value === '' ? null : Number(event.target.value))}
                    />
                    {candidate.corrections[field] !== undefined && (
                      <div style={{ color: '#e0b341', fontSize: '0.62rem' }}>corrected</div>
                    )}
                  </td>
                ))}
                <td style={cell}>
                  <a href={candidate.source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#7bb7c4' }}>
                    {candidate.source.manufacturer}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        data-testid="vehicle-review-publish"
        onClick={onPublish}
        disabled={publishing || tickedCount === 0}
        style={{
          justifySelf: 'start', background: tickedCount ? '#222' : 'transparent',
          border: '1px solid #444', color: tickedCount ? '#fff' : '#777',
          borderRadius: '6px', padding: '0.35rem 0.7rem', fontWeight: 700, fontSize: '0.74rem',
          cursor: publishing || !tickedCount ? 'default' : 'pointer',
        }}
      >
        {publishing ? 'Publishing…' : `Publish ${tickedCount} ${make} ${tickedCount === 1 ? 'vehicle' : 'vehicles'}`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/VehicleReview.tsx
git commit -m "feat: add the vehicle review panel component"
```

---

### Task 9: Wire the panel into the dashboard and cover it end to end

**Files:**
- Modify: `src/components/AdminDashboard.tsx`
- Test: `tests/e2e/admin-vehicle-review.spec.ts`

**Interfaces:**
- Consumes: `VehicleReview` from Task 8; the endpoints from Tasks 6 and 7
- Produces: a "Vehicle Review" panel in the admin dashboard

- [ ] **Step 1: Write the failing end to end test**

Create `tests/e2e/admin-vehicle-review.spec.ts`, following the route-mocking style already used in `tests/e2e/admin-marketing-ideas.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const CANDIDATES = {
  make: 'Ford',
  makes: ['Ford', 'Toyota'],
  candidates: [
    {
      id: 'ford-a', make: 'Ford', model: 'Ranger', modelYear: 2023, grade: 'XLT', cabType: 'dual', bodyType: 'cab_chassis',
      gvmKg: 3350, kerbKg: 2300, trayLengthMm: null, trayWidthMm: null, verificationStatus: 'source_verified',
      source: { manufacturer: 'Ford', title: 'Spec sheet', url: 'https://example.com/a' }, included: true, corrections: {},
    },
    {
      id: 'ford-b', make: 'Ford', model: 'Ranger', modelYear: 2023, grade: 'Wildtrak', cabType: 'dual', bodyType: 'tub',
      gvmKg: 3280, kerbKg: 2350, trayLengthMm: 1550, trayWidthMm: 1520, verificationStatus: 'needs_secondary_review',
      source: { manufacturer: 'Ford', title: 'Spec sheet', url: 'https://example.com/b' }, included: false, corrections: {},
    },
  ],
};

test('the panel lists candidates and ticks only the source-verified ones', async ({ page }) => {
  await page.route('**/admin-vehicle-review**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANDIDATES) }));
  await page.goto('/admin');

  await expect(page.getByTestId('vehicle-review-row')).toHaveCount(2);
  await expect(page.getByTestId('vehicle-review-tick-ford-a')).toBeChecked();
  // A row nobody has verified must not publish by simply being in the list.
  await expect(page.getByTestId('vehicle-review-tick-ford-b')).not.toBeChecked();
  await expect(page.getByTestId('vehicle-review-needs-check')).toHaveCount(1);
});

test('the publish button counts only ticked rows', async ({ page }) => {
  await page.route('**/admin-vehicle-review**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANDIDATES) }));
  await page.goto('/admin');

  await expect(page.getByTestId('vehicle-review-publish')).toHaveText('Publish 1 Ford vehicle');

  await page.getByTestId('vehicle-review-tick-ford-b').check();
  await expect(page.getByTestId('vehicle-review-publish')).toHaveText('Publish 2 Ford vehicles');
});

test('publishing nothing is not offered', async ({ page }) => {
  const none = { ...CANDIDATES, candidates: CANDIDATES.candidates.map((c) => ({ ...c, included: false })) };
  await page.route('**/admin-vehicle-review**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(none) }));
  await page.goto('/admin');

  await expect(page.getByTestId('vehicle-review-publish')).toBeDisabled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && npx playwright test tests/e2e/admin-vehicle-review.spec.ts --project=chromium-desktop`
Expected: FAIL. No rows found.

- [ ] **Step 3: Wire the panel into the dashboard**

In `src/components/AdminDashboard.tsx`, import the component and add state beside the existing marketing idea state:

```tsx
import VehicleReview, { type ReviewCandidate } from './VehicleReview';
```

```tsx
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleMakes, setVehicleMakes] = useState<string[]>([]);
  const [vehicleCandidates, setVehicleCandidates] = useState<ReviewCandidate[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState('');
  const [vehiclesPublishing, setVehiclesPublishing] = useState(false);

  async function loadVehicles(make = '') {
    setVehiclesError('');
    try {
      const query = make ? `?make=${encodeURIComponent(make)}` : '';
      const res = await adminFetch(`/.netlify/functions/admin-vehicle-review${query}`);
      if (res.status === 401) { clearAdminToken(); window.location.href = '/.netlify/functions/admin-login'; return; }
      const body = await adminJson<{ make: string; makes: string[]; candidates: ReviewCandidate[] }>(res, 'Could not load vehicles');
      if (!res.ok) throw new Error(body.error ?? 'Could not load vehicles');
      setVehicleMake(body.make);
      setVehicleMakes(body.makes ?? []);
      setVehicleCandidates(body.candidates ?? []);
    } catch (err) {
      setVehiclesError(err instanceof Error ? err.message : 'Could not load vehicles.');
    } finally {
      setVehiclesLoading(false);
    }
  }

  useEffect(() => { void loadVehicles(); }, []);

  async function saveVehicleDraft(candidate: ReviewCandidate) {
    await adminFetch('/.netlify/functions/admin-vehicle-review', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: candidate.id, included: candidate.included, corrections: candidate.corrections }),
    });
  }

  function updateCandidate(id: string, change: (candidate: ReviewCandidate) => ReviewCandidate) {
    setVehicleCandidates((prev) => {
      const next = prev.map((candidate) => (candidate.id === id ? change(candidate) : candidate));
      const updated = next.find((candidate) => candidate.id === id);
      if (updated) void saveVehicleDraft(updated);
      return next;
    });
  }

  async function publishVehicles() {
    setVehiclesPublishing(true);
    setVehiclesError('');
    try {
      const res = await adminFetch('/.netlify/functions/admin-vehicle-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make: vehicleMake }),
      });
      const body = await adminJson<{ published?: number }>(res, 'Could not publish vehicles');
      if (!res.ok) throw new Error(body.error ?? 'Could not publish vehicles');
      await loadVehicles(vehicleMake);
    } catch (err) {
      setVehiclesError(err instanceof Error ? err.message : 'Could not publish vehicles.');
    } finally {
      setVehiclesPublishing(false);
    }
  }
```

Add the panel beside the existing ones:

```tsx
          <Panel title="Vehicle Review">
            <VehicleReview
              candidates={vehicleCandidates}
              makes={vehicleMakes}
              make={vehicleMake}
              loading={vehiclesLoading}
              error={vehiclesError}
              publishing={vehiclesPublishing}
              onMakeChange={(make) => { setVehiclesLoading(true); void loadVehicles(make); }}
              onToggle={(id, included) => updateCandidate(id, (candidate) => ({ ...candidate, included }))}
              onCorrect={(id, field, value) => updateCandidate(id, (candidate) => {
                const corrections = { ...candidate.corrections };
                if (value === null) delete corrections[field]; else corrections[field] = value;
                return { ...candidate, corrections };
              })}
              onPublish={() => void publishVehicles()}
            />
          </Panel>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && npx playwright test tests/e2e/admin-vehicle-review.spec.ts --project=chromium-desktop`
Expected: PASS, 3 tests

- [ ] **Step 5: Run everything**

Run: `npm test && npx tsc --noEmit && npx playwright test --project=chromium-desktop`
Expected: PASS, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminDashboard.tsx tests/e2e/admin-vehicle-review.spec.ts
git commit -m "feat: add the vehicle review panel to the admin dashboard"
```

---

## Manual verification after deploy

The publish path talks to the GitHub API, which no test exercises. After merging, verify once on production:

1. Sign in to `/admin` as the GM. The Vehicle Review panel lists Ford with 24 rows, most ticked.
2. Untick one row, correct one GVM, and reload. Both survive, because drafts persist.
3. Press Publish. A commit appears on `main` naming the reviewer and the count.
4. Wait for the deploy. The vehicle picker appears on `/slide-on-camper-weight-calculator/`.
5. Pick the corrected vehicle. The provenance panel shows the corrected figure as Beyond RV's own, and the others as Ford's.

If step 3 fails with a GitHub error, check that `GITHUB_TOKEN` has `contents: write` on the repository. The token is shared with `admin-deploy`, so a failure there affects both.
