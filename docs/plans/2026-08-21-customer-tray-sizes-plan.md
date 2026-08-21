# Customer-reported tray sizes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer contribute the tray size fitted to their vehicle, offer it to the next customer with the same vehicle, and require them to confirm or correct it.

**Architecture:** A public Netlify function aggregates reports per vehicle variant in a blob store, counting distinct sizes rather than storing one row per submission. The weight calculator offers the most-reported size for the selected variant and posts a confirmation or a correction. An admin panel lists what has been reported and can delete a bad entry.

**Tech Stack:** Netlify Functions, Netlify Blobs, Astro 7, TypeScript, `node --test --experimental-strip-types`, Playwright. No new dependency.

**Spec:** `docs/plans/2026-08-21-customer-tray-sizes-design.md`

## Global Constraints

- No new runtime dependency.
- Unit tests live in `tests/*.test.ts` under `npm test`, importing source with an explicit `.ts` extension.
- E2E lives in `tests/e2e/*.spec.ts`. Run `npm run build` first; Playwright serves `dist/`.
- `astro preview` daemonises, so a leftover server makes Playwright report "Process from config.webServer exited early". Clear it with `npx astro preview stop` before running.
- Netlify functions import JSON only from **inside** `netlify/functions/`. They must not import a value from `src/`. Only `import type` crosses that boundary.
- Bounds are exactly: length 1200–4000 mm, width 1200–2500 mm, integers only.
- Only `cab_chassis` variants accept reports. All 81 `pickup_tub` variants are rejected.
- Rate limit is exactly `isRateLimited(event, 'tray-sizes', 10, 60 * 60)`.
- Nothing identifying is ever stored: only a variant id, two dimensions, counts and timestamps.

---

### Task 1: Aggregation core

**Files:**
- Create: `netlify/functions/tray-size-core.ts`
- Test: `tests/tray-size-core.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface TraySizeBucket { lengthMm: number; widthMm: number; reports: number; firstReportedAt: string; lastReportedAt: string }`
  - `interface TraySizeRecord { variantId: string; sizes: TraySizeBucket[]; totalReports: number; updatedAt: string }`
  - `function validateTraySize(lengthMm: unknown, widthMm: unknown): { ok: true; lengthMm: number; widthMm: number } | { ok: false; error: string }`
  - `function addTraySizeReport(existing: TraySizeRecord | null, variantId: string, lengthMm: number, widthMm: number, now: string): TraySizeRecord`
  - `function winningTraySize(record: TraySizeRecord | null): { lengthMm: number; widthMm: number; reports: number } | null`
  - `function removeTraySize(record: TraySizeRecord, lengthMm: number, widthMm: number, now: string): TraySizeRecord`
  - `const TRAY_SIZE_STORE = 'vehicle-tray-sizes'`
  - `function traySizeKey(variantId: string): string`

- [ ] **Step 1: Write the failing test**

Create `tests/tray-size-core.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTraySizeReport,
  removeTraySize,
  traySizeKey,
  validateTraySize,
  winningTraySize,
  type TraySizeRecord,
} from '../netlify/functions/tray-size-core.ts';

const T1 = '2026-08-21T01:00:00.000Z';
const T2 = '2026-08-21T02:00:00.000Z';
const T3 = '2026-08-21T03:00:00.000Z';

test('a plausible tray size is accepted', () => {
  assert.deepEqual(validateTraySize(2100, 1800), { ok: true, lengthMm: 2100, widthMm: 1800 });
});

test('a numeric string is accepted, because form values arrive as strings', () => {
  assert.deepEqual(validateTraySize('2100', '1800'), { ok: true, lengthMm: 2100, widthMm: 1800 });
});

test('a length outside the plausible range is rejected', () => {
  assert.equal(validateTraySize(18000, 1800).ok, false);
  assert.equal(validateTraySize(18, 1800).ok, false);
});

test('a width outside the plausible range is rejected', () => {
  assert.equal(validateTraySize(2100, 9000).ok, false);
  assert.equal(validateTraySize(2100, 90).ok, false);
});

test('a fractional measurement is rejected, because trays are recorded in whole millimetres', () => {
  assert.equal(validateTraySize(2100.5, 1800).ok, false);
});

test('something that is not a number at all is rejected', () => {
  assert.equal(validateTraySize('wide', 1800).ok, false);
  assert.equal(validateTraySize(null, 1800).ok, false);
});

test('a first report creates a bucket holding one report', () => {
  const record = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);

  assert.equal(record.variantId, 'ford-ranger-cc');
  assert.equal(record.totalReports, 1);
  assert.deepEqual(record.sizes, [
    { lengthMm: 2100, widthMm: 1800, reports: 1, firstReportedAt: T1, lastReportedAt: T1 },
  ]);
});

test('a repeat of the same size increments rather than duplicating', () => {
  const first = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);
  const second = addTraySizeReport(first, 'ford-ranger-cc', 2100, 1800, T2);

  assert.equal(second.sizes.length, 1);
  assert.equal(second.sizes[0].reports, 2);
  assert.equal(second.sizes[0].firstReportedAt, T1, 'the first sighting is preserved');
  assert.equal(second.sizes[0].lastReportedAt, T2);
  assert.equal(second.totalReports, 2);
});

test('a different size becomes its own bucket', () => {
  const first = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);
  const second = addTraySizeReport(first, 'ford-ranger-cc', 2400, 1800, T2);

  assert.equal(second.sizes.length, 2);
  assert.equal(second.totalReports, 2);
});

test('the most reported size wins', () => {
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2400, 1800, T1);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T2);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T3);

  assert.deepEqual(winningTraySize(record), { lengthMm: 2100, widthMm: 1800, reports: 2 });
});

test('equal counts break on the most recent report', () => {
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2400, 1800, T1);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T2);

  assert.deepEqual(winningTraySize(record), { lengthMm: 2100, widthMm: 1800, reports: 1 });
});

test('a variant nobody has reported has no winning size', () => {
  assert.equal(winningTraySize(null), null);
  assert.equal(winningTraySize({ variantId: 'x', sizes: [], totalReports: 0, updatedAt: T1 }), null);
});

test('deleting one size leaves the others and their counts intact', () => {
  let record = addTraySizeReport(null, 'ford-ranger-cc', 2100, 1800, T1);
  record = addTraySizeReport(record, 'ford-ranger-cc', 2100, 1800, T2);
  record = addTraySizeReport(record, 'ford-ranger-cc', 9999 - 7899, 1800, T3); // 2100 again
  record = addTraySizeReport(record, 'ford-ranger-cc', 2400, 1800, T3);

  const pruned = removeTraySize(record, 2400, 1800, T3);

  assert.deepEqual(pruned.sizes.map((s) => s.lengthMm), [2100]);
  assert.equal(pruned.sizes[0].reports, 3);
  assert.equal(pruned.totalReports, 3, 'the total drops by exactly the deleted bucket');
});

test('the blob key is namespaced and url safe', () => {
  assert.equal(traySizeKey('ford-ranger-cc'), 'tray-sizes/ford-ranger-cc.json');
  assert.equal(traySizeKey('a/b'), 'tray-sizes/a%2Fb.json');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: FAIL, module not found for `netlify/functions/tray-size-core.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `netlify/functions/tray-size-core.ts`:

```ts
export const TRAY_SIZE_STORE = 'vehicle-tray-sizes';

/**
 * A cab chassis ships without a tray, so these bounds come from what people
 * actually fit, not from a manufacturer figure. Recorded manufacturer
 * dimensions span 1300-2630 long and 1270-1895 wide; the wider range leaves
 * room for a genuine aftermarket tray while rejecting a mistyped 18000 or 18.
 */
export const TRAY_LENGTH_MIN_MM = 1200;
export const TRAY_LENGTH_MAX_MM = 4000;
export const TRAY_WIDTH_MIN_MM = 1200;
export const TRAY_WIDTH_MAX_MM = 2500;

export interface TraySizeBucket {
  lengthMm: number;
  widthMm: number;
  reports: number;
  firstReportedAt: string;
  lastReportedAt: string;
}

export interface TraySizeRecord {
  variantId: string;
  sizes: TraySizeBucket[];
  totalReports: number;
  updatedAt: string;
}

export function traySizeKey(variantId: string) {
  return `tray-sizes/${encodeURIComponent(variantId)}.json`;
}

function whole(value: unknown) {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

export function validateTraySize(lengthMm: unknown, widthMm: unknown):
  | { ok: true; lengthMm: number; widthMm: number }
  | { ok: false; error: string } {
  const length = whole(lengthMm);
  const width = whole(widthMm);
  if (length === null || width === null) {
    return { ok: false, error: 'Enter the tray length and width in whole millimetres.' };
  }
  if (length < TRAY_LENGTH_MIN_MM || length > TRAY_LENGTH_MAX_MM) {
    return { ok: false, error: `Tray length must be between ${TRAY_LENGTH_MIN_MM} and ${TRAY_LENGTH_MAX_MM} mm.` };
  }
  if (width < TRAY_WIDTH_MIN_MM || width > TRAY_WIDTH_MAX_MM) {
    return { ok: false, error: `Tray width must be between ${TRAY_WIDTH_MIN_MM} and ${TRAY_WIDTH_MAX_MM} mm.` };
  }
  return { ok: true, lengthMm: length, widthMm: width };
}

export function addTraySizeReport(
  existing: TraySizeRecord | null,
  variantId: string,
  lengthMm: number,
  widthMm: number,
  now: string,
): TraySizeRecord {
  const sizes = (existing?.sizes ?? []).map((size) => ({ ...size }));
  const match = sizes.find((size) => size.lengthMm === lengthMm && size.widthMm === widthMm);

  if (match) {
    match.reports += 1;
    match.lastReportedAt = now;
  } else {
    sizes.push({ lengthMm, widthMm, reports: 1, firstReportedAt: now, lastReportedAt: now });
  }

  return {
    variantId,
    sizes,
    totalReports: sizes.reduce((sum, size) => sum + size.reports, 0),
    updatedAt: now,
  };
}

/**
 * Most reported wins. Ties break on the most recent report, then the longer
 * tray, so two customers on the same vehicle always see the same suggestion.
 */
export function winningTraySize(record: TraySizeRecord | null) {
  const sizes = record?.sizes ?? [];
  if (sizes.length === 0) return null;

  const best = [...sizes].sort((a, b) =>
    b.reports - a.reports
    || b.lastReportedAt.localeCompare(a.lastReportedAt)
    || b.lengthMm - a.lengthMm)[0];

  return { lengthMm: best.lengthMm, widthMm: best.widthMm, reports: best.reports };
}

export function removeTraySize(record: TraySizeRecord, lengthMm: number, widthMm: number, now: string): TraySizeRecord {
  const sizes = record.sizes.filter((size) => !(size.lengthMm === lengthMm && size.widthMm === widthMm));
  return {
    ...record,
    sizes,
    totalReports: sizes.reduce((sum, size) => sum + size.reports, 0),
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: PASS. The suite is 259 before this task, so expect 273.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/tray-size-core.ts tests/tray-size-core.test.ts
git commit -m "feat: add tray size aggregation core"
```

---

### Task 2: Variant index for the functions

**Files:**
- Modify: `SCRIPTS/build-vehicle-catalogue.mjs`
- Create: `netlify/functions/vehicle-variant-index.json`
- Test: `tests/vehicle-variant-index.test.ts`

**Interfaces:**
- Consumes: `src/data/vehicle-selector/catalogue.json`.
- Produces: `netlify/functions/vehicle-variant-index.json`, shaped `{ variants: Array<{ id: string; bodyType: string }> }`.

**Why this task exists:** the endpoint must reject a `variantId` that does not exist, and must reject tub vehicles. Netlify functions in this repo import JSON only from beside themselves — `admin-chat.ts` imports `./product-catalogue.json`, and nothing imports a value from `src/`. So the functions get their own slim index, committed like `product-catalogue.json` is, and regenerated by the same script that writes the catalogue.

- [ ] **Step 1: Write the failing test**

Create `tests/vehicle-variant-index.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import catalogue from '../src/data/vehicle-selector/catalogue.json' with { type: 'json' };
import index from '../netlify/functions/vehicle-variant-index.json' with { type: 'json' };

test('the function-side index lists every catalogue variant', () => {
  const catalogueIds = catalogue.variants.map((v: { id: string }) => v.id).sort();
  const indexIds = index.variants.map((v: { id: string }) => v.id).sort();

  assert.deepEqual(indexIds, catalogueIds, 'run `npm run catalogue:build` to regenerate the index');
});

test('the index carries the body type, which decides whether a tray applies', () => {
  const byId = new Map(catalogue.variants.map((v: { id: string; bodyType: string }) => [v.id, v.bodyType]));

  for (const entry of index.variants as Array<{ id: string; bodyType: string }>) {
    assert.equal(entry.bodyType, byId.get(entry.id), `${entry.id} has the wrong body type`);
  }
});

test('the index carries nothing beyond what the endpoint needs', () => {
  for (const entry of index.variants as Array<Record<string, unknown>>) {
    assert.deepEqual(Object.keys(entry).sort(), ['bodyType', 'id']);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: FAIL, cannot find `netlify/functions/vehicle-variant-index.json`.

- [ ] **Step 3: Write the minimal implementation**

In `SCRIPTS/build-vehicle-catalogue.mjs`, add beside the existing `outPath`:

```js
const variantIndexPath = resolve(root, 'netlify/functions/vehicle-variant-index.json');
```

and immediately after the existing `writeFileSync(outPath, ...)` line:

```js
// The functions cannot import from src/, so they get a slim copy of just the
// fields the tray-size endpoint validates against.
const variantIndex = { variants: variants.map((v) => ({ id: v.id, bodyType: v.bodyType })) };
writeFileSync(variantIndexPath, `${JSON.stringify(variantIndex, null, 2)}\n`);
console.log(`Wrote ${variantIndexPath}`);
```

Then generate it:

```bash
node --experimental-strip-types SCRIPTS/build-vehicle-catalogue.mjs
```

This requires the `sqlite3` CLI. If it is unavailable, generate the index directly from the committed catalogue instead — the result is identical:

```bash
node -e "const c=require('./src/data/vehicle-selector/catalogue.json');require('fs').writeFileSync('netlify/functions/vehicle-variant-index.json',JSON.stringify({variants:c.variants.map(v=>({id:v.id,bodyType:v.bodyType}))},null,2)+'\n')"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: PASS, 276 tests.

Also confirm the shape:

```bash
node -e "const i=require('./netlify/functions/vehicle-variant-index.json');console.log('variants',i.variants.length);console.log('cab_chassis',i.variants.filter(v=>v.bodyType==='cab_chassis').length)"
```

Expected: `variants 132`, `cab_chassis 51`.

- [ ] **Step 5: Commit**

```bash
git add SCRIPTS/build-vehicle-catalogue.mjs netlify/functions/vehicle-variant-index.json tests/vehicle-variant-index.test.ts
git commit -m "feat: emit a slim variant index for the netlify functions"
```

---

### Task 3: Public endpoint

**Files:**
- Create: `netlify/functions/tray-sizes.ts`
- Test: `tests/tray-sizes-endpoint.test.ts`

**Interfaces:**
- Consumes: Task 1's core, Task 2's index, `isRateLimited` from `./security-utils`, `connectBlobStore`/`getBlobStore` from `./blob-store`.
- Produces:
  - `GET /.netlify/functions/tray-sizes` → `{ sizes: { [variantId]: { lengthMm, widthMm, reports } } }`
  - `POST` with `{ variantId, lengthMm, widthMm }` → `{ ok: true, size: { lengthMm, widthMm, reports } }`
  - `function acceptTraySizeSubmission(body: Record<string, unknown>, isCabChassis: (id: string) => boolean): { ok: true; variantId: string; lengthMm: number; widthMm: number } | { ok: false; error: string }` — exported so the request rules are testable without a Netlify event.

- [ ] **Step 1: Write the failing test**

Create `tests/tray-sizes-endpoint.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptTraySizeSubmission } from '../netlify/functions/tray-sizes.ts';

const isCabChassis = (id: string) => id === 'ford-ranger-cc';

test('a valid submission for a cab chassis is accepted', () => {
  const result = acceptTraySizeSubmission(
    { variantId: 'ford-ranger-cc', lengthMm: 2100, widthMm: 1800 },
    isCabChassis,
  );
  assert.deepEqual(result, { ok: true, variantId: 'ford-ranger-cc', lengthMm: 2100, widthMm: 1800 });
});

test('a variant the catalogue has never heard of is rejected', () => {
  const result = acceptTraySizeSubmission(
    { variantId: 'not-a-real-vehicle', lengthMm: 2100, widthMm: 1800 },
    isCabChassis,
  );
  assert.equal(result.ok, false);
});

test('a tub vehicle is rejected, because its dimensions are already known', () => {
  const result = acceptTraySizeSubmission(
    { variantId: 'ford-f150-tub', lengthMm: 2100, widthMm: 1800 },
    isCabChassis,
  );
  assert.equal(result.ok, false);
});

test('an implausible size is rejected before it reaches the store', () => {
  const result = acceptTraySizeSubmission(
    { variantId: 'ford-ranger-cc', lengthMm: 18000, widthMm: 1800 },
    isCabChassis,
  );
  assert.equal(result.ok, false);
});

test('a missing variant id is rejected', () => {
  assert.equal(acceptTraySizeSubmission({ lengthMm: 2100, widthMm: 1800 }, isCabChassis).ok, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: FAIL, `netlify/functions/tray-sizes.ts` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `netlify/functions/tray-sizes.ts`:

```ts
import type { Handler } from '@netlify/functions';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { isRateLimited, rateLimitResponse } from './security-utils';
import variantIndex from './vehicle-variant-index.json';
import {
  addTraySizeReport,
  TRAY_SIZE_STORE,
  traySizeKey,
  validateTraySize,
  winningTraySize,
  type TraySizeRecord,
} from './tray-size-core';

const CAB_CHASSIS = new Set(
  (variantIndex.variants as Array<{ id: string; bodyType: string }>)
    .filter((v) => v.bodyType === 'cab_chassis')
    .map((v) => v.id),
);

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

/**
 * The request rules, separated from the Netlify plumbing so they can be tested
 * without constructing an event.
 */
export function acceptTraySizeSubmission(
  body: Record<string, unknown>,
  isCabChassis: (id: string) => boolean,
): { ok: true; variantId: string; lengthMm: number; widthMm: number } | { ok: false; error: string } {
  const variantId = typeof body.variantId === 'string' ? body.variantId.trim() : '';
  if (!variantId) return { ok: false, error: 'Choose your vehicle before reporting a tray size.' };
  if (!isCabChassis(variantId)) {
    return { ok: false, error: 'Tray sizes are only collected for cab chassis vehicles.' };
  }

  const size = validateTraySize(body.lengthMm, body.widthMm);
  if (!size.ok) return { ok: false, error: size.error };

  return { ok: true, variantId, lengthMm: size.lengthMm, widthMm: size.widthMm };
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  connectBlobStore(event);

  try {
    const store = getBlobStore(TRAY_SIZE_STORE);

    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const sizes: Record<string, { lengthMm: number; widthMm: number; reports: number }> = {};
      for (const blob of blobs) {
        const record = await store.get(blob.key, { type: 'json' }) as TraySizeRecord | null;
        const winner = winningTraySize(record);
        if (record?.variantId && winner) sizes[record.variantId] = winner;
      }
      return json(200, { sizes });
    }

    if (await isRateLimited(event, 'tray-sizes', 10, 60 * 60)) return rateLimitResponse();

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    } catch {
      return json(400, { error: 'Invalid request' });
    }

    const accepted = acceptTraySizeSubmission(body, (id) => CAB_CHASSIS.has(id));
    if (!accepted.ok) return json(400, { error: accepted.error });

    const key = traySizeKey(accepted.variantId);
    const existing = await store.get(key, { type: 'json' }) as TraySizeRecord | null;
    const updated = addTraySizeReport(
      existing, accepted.variantId, accepted.lengthMm, accepted.widthMm, new Date().toISOString(),
    );
    await store.setJSON(key, updated);

    return json(200, { ok: true, size: winningTraySize(updated) });
  } catch (error) {
    console.warn('tray-sizes: unavailable', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: PASS, 281 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/tray-sizes.ts tests/tray-sizes-endpoint.test.ts
git commit -m "feat: collect customer-reported tray sizes"
```

---

### Task 4: Calculator integration

**Files:**
- Modify: `src/pages/slide-on-camper-weight-calculator/index.astro`
- Test: `tests/e2e/tray-sizes.spec.ts`

**Interfaces:**
- Consumes: Task 3's endpoint.
- Produces: `data-testid` hooks `tray-reported`, `tray-confirm`, `tray-correct`.

**Integration points that already exist:** `applyVariant` calls `setIfNotEdited('trayLength', ...)` and `setIfNotEdited('trayWidth', ...)`, which respect `customerEdited`, so a reported size can use the same path and will never overwrite a typed value. `selectedVariant` holds the current variant. `renderProvenance` re-runs on the first edit of a prefilled field.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/tray-sizes.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const RANGER_CC = 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo';

async function selectRanger(page: import('@playwright/test').Page) {
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', RANGER_CC);
}

test('a vehicle nobody has reported offers no tray size and posts nothing', async ({ page }) => {
  const writes: unknown[] = [];
  await page.route('**/.netlify/functions/tray-sizes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sizes: {} }) });
      return;
    }
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/slide-on-camper-weight-calculator/');
  await selectRanger(page);

  await expect(page.getByTestId('tray-reported')).toHaveCount(0);
  await expect(page.locator('#trayLength')).toHaveValue('');
  expect(writes).toEqual([]);
});

test('a reported size is offered with its count and must be confirmed', async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  await page.route('**/.netlify/functions/tray-sizes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ sizes: { [RANGER_CC]: { lengthMm: 2100, widthMm: 1800, reports: 7 } } }),
      });
      return;
    }
    writes.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/slide-on-camper-weight-calculator/');
  await selectRanger(page);

  const reported = page.getByTestId('tray-reported');
  await expect(reported).toBeVisible();
  await expect(reported).toContainText('2100');
  await expect(reported).toContainText('1800');
  await expect(reported).toContainText('7');
  await expect(page.locator('#trayLength')).toHaveValue('2100');

  // Nothing is posted merely by selecting the vehicle.
  expect(writes).toEqual([]);

  await page.getByTestId('tray-confirm').click();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ variantId: RANGER_CC, lengthMm: 2100, widthMm: 1800 });
});

test('confirming twice reports once', async ({ page }) => {
  const writes: unknown[] = [];
  await page.route('**/.netlify/functions/tray-sizes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ sizes: { [RANGER_CC]: { lengthMm: 2100, widthMm: 1800, reports: 7 } } }),
      });
      return;
    }
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/slide-on-camper-weight-calculator/');
  await selectRanger(page);
  await page.getByTestId('tray-confirm').click();
  await expect(page.getByTestId('tray-confirm')).toBeDisabled();

  await expect.poll(() => writes.length).toBe(1);
});

test('correcting the size clears the fields and reports what the customer typed', async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  await page.route('**/.netlify/functions/tray-sizes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ sizes: { [RANGER_CC]: { lengthMm: 2100, widthMm: 1800, reports: 7 } } }),
      });
      return;
    }
    writes.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/slide-on-camper-weight-calculator/');
  await selectRanger(page);

  await page.getByTestId('tray-correct').click();
  await expect(page.locator('#trayLength')).toHaveValue('');
  await expect(page.locator('#trayWidth')).toHaveValue('');

  // There is no Calculate button — the page recalculates on every keystroke —
  // so a correction is reported once the field settles, on blur.
  await page.fill('#trayLength', '2400');
  await page.fill('#trayWidth', '1850');
  await page.locator('#trayWidth').blur();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ variantId: RANGER_CC, lengthMm: 2400, widthMm: 1850 });
});

test('a reporting outage leaves the calculator working', async ({ page }) => {
  await page.route('**/.netlify/functions/tray-sizes', route =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) }));

  await page.goto('/slide-on-camper-weight-calculator/');
  await selectRanger(page);

  await expect(page.getByTestId('tray-reported')).toHaveCount(0);
  await page.fill('#trayLength', '2400');
  await expect(page.locator('#trayLength')).toHaveValue('2400');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx astro preview stop; npm run build >/dev/null && npx playwright test tests/e2e/tray-sizes.spec.ts --project=chromium-desktop --reporter=list
```

Expected: FAIL. `tray-reported` and `tray-confirm` do not exist.

Note there is **no Calculate button** on this page — `fields.forEach(id => byId(id)?.addEventListener('input', ...))` recalculates on every keystroke. Do not add one.

- [ ] **Step 3: Write the minimal implementation**

Add the panel markup immediately after the `trayWidth` field's closing `</div>`:

```astro
        <div class="form-field" id="trayReportedField" hidden>
          <p class="form-help" data-testid="tray-reported" id="trayReportedText"></p>
          <div class="tray-report-actions">
            <button type="button" id="trayConfirm" data-testid="tray-confirm">That is my tray</button>
            <button type="button" id="trayCorrect" data-testid="tray-correct">Mine is different</button>
          </div>
        </div>
```

Add to the page's `<script>`:

```ts
  interface ReportedTraySize { lengthMm: number; widthMm: number; reports: number }

  let reportedSizes: Record<string, ReportedTraySize> = {};
  let reportedLoaded = false;
  let traySizeReportedFor: string | null = null;

  async function loadReportedTraySizes() {
    if (reportedLoaded) return;
    reportedLoaded = true;
    try {
      const response = await fetch('/.netlify/functions/tray-sizes');
      if (!response.ok) return;
      reportedSizes = ((await response.json()) as { sizes?: Record<string, ReportedTraySize> }).sizes ?? {};
    } catch {
      // A reporting outage must never block someone working out whether a
      // camper fits, so the calculator carries on with empty tray fields.
    }
  }

  async function postTraySize(variantId: string, lengthMm: number, widthMm: number) {
    if (traySizeReportedFor === variantId) return;
    traySizeReportedFor = variantId;
    try {
      await fetch('/.netlify/functions/tray-sizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, lengthMm, widthMm }),
      });
    } catch {
      // Nothing to recover: the customer's own calculation is unaffected.
    }
  }

  function showReportedTraySize(variant: any) {
    const field = byId('trayReportedField');
    const text = byId('trayReportedText');
    const confirm = inputById('trayConfirm');
    const reported = reportedSizes[variant.id];
    const alreadyKnown = Boolean(variant.trayLengthMm && variant.trayWidthMm);

    if (!reported || alreadyKnown) {
      if (field) (field as HTMLElement).hidden = true;
      return;
    }

    setIfNotEdited('trayLength', reported.lengthMm);
    setIfNotEdited('trayWidth', reported.widthMm);
    if (text) {
      text.textContent = `Tray ${reported.lengthMm} × ${reported.widthMm} mm, reported by `
        + `${reported.reports} owner${reported.reports === 1 ? '' : 's'} of this vehicle. `
        + 'Trays are fitted after purchase, so please check yours.';
    }
    if (confirm) confirm.disabled = false;
    if (field) (field as HTMLElement).hidden = false;
  }
```

Wire the controls, near the other listeners:

```ts
  inputById('trayConfirm')?.addEventListener('click', () => {
    const reported = selectedVariant ? reportedSizes[selectedVariant.id] : null;
    if (!selectedVariant || !reported) return;
    const confirm = inputById('trayConfirm');
    if (confirm) confirm.disabled = true;
    void postTraySize(selectedVariant.id, reported.lengthMm, reported.widthMm);
  });

  inputById('trayCorrect')?.addEventListener('click', () => {
    for (const id of ['trayLength', 'trayWidth']) {
      const input = inputById(id);
      if (input) input.value = '';
      customerEdited.delete(id);
    }
    const field = byId('trayReportedField');
    if (field) (field as HTMLElement).hidden = true;
    inputById('trayLength')?.focus();
  });
```

In `applyVariant`, after `selectedVariant = variant;`:

```ts
    traySizeReportedFor = null;
    void loadReportedTraySizes().then(() => {
      if (selectedVariant?.id === variant.id) showReportedTraySize(variant);
    });
```

In `resetVehicleSelection`, beside the other clearing:

```ts
    traySizeReportedFor = null;
    const reportedField = byId('trayReportedField');
    if (reportedField) (reportedField as HTMLElement).hidden = true;
```

Report a correction when the customer finishes editing, beside the other listeners. `change` fires on blur or Enter, once the value has settled — `input` would report a size per keystroke:

```ts
  function reportTypedTraySize() {
    // Only a cab chassis with no published dimensions is worth collecting, and
    // only once the customer has supplied both numbers themselves.
    if (!selectedVariant || selectedVariant.bodyType !== 'cab_chassis') return;
    if (selectedVariant.trayLengthMm || selectedVariant.trayWidthMm) return;
    if (!customerEdited.has('trayLength') || !customerEdited.has('trayWidth')) return;

    const length = Number(value('trayLength'));
    const width = Number(value('trayWidth'));
    if (!Number.isInteger(length) || !Number.isInteger(width)) return;
    void postTraySize(selectedVariant.id, length, width);
  }

  for (const id of ['trayLength', 'trayWidth']) {
    inputById(id)?.addEventListener('change', reportTypedTraySize);
  }
```

Add to the page's `<style>`:

```css
  .tray-report-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.4rem; }
  .tray-report-actions button {
    background: transparent; border: 1px solid var(--border); color: var(--cream);
    border-radius: 6px; padding: 0.4rem 0.7rem; cursor: pointer; font: inherit; font-size: 0.8rem;
  }
  .tray-report-actions button:disabled { opacity: 0.55; cursor: default; }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx astro preview stop; npm run build >/dev/null && npx playwright test tests/e2e/tray-sizes.spec.ts --reporter=list
```

Expected: 5 tests × 5 browser projects = 25 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/slide-on-camper-weight-calculator/index.astro tests/e2e/tray-sizes.spec.ts
git commit -m "feat: offer and collect customer-reported tray sizes"
```

---

### Task 5: Admin moderation

**Files:**
- Create: `netlify/functions/admin-tray-sizes.ts`
- Create: `src/components/TraySizes.tsx`
- Modify: `src/components/AdminDashboard.tsx`
- Test: `tests/e2e/admin-tray-sizes.spec.ts`

**Interfaces:**
- Consumes: Task 1's core.
- Produces:
  - `GET /.netlify/functions/admin-tray-sizes` → `{ records: TraySizeRecord[] }`, needs `site:read`
  - `DELETE` with `{ variantId, lengthMm, widthMm }`, needs `site:write`
  - `TraySizes` component with props `{ records, loading, error, deletingKey, onDelete }`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/admin-tray-sizes.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const record = {
  variantId: 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo',
  sizes: [
    { lengthMm: 2100, widthMm: 1800, reports: 7, firstReportedAt: '2026-08-01T00:00:00.000Z', lastReportedAt: '2026-08-20T00:00:00.000Z' },
    { lengthMm: 3900, widthMm: 2400, reports: 1, firstReportedAt: '2026-08-19T00:00:00.000Z', lastReportedAt: '2026-08-19T00:00:00.000Z' },
  ],
  totalReports: 8,
  updatedAt: '2026-08-20T00:00:00.000Z',
};

test('reported tray sizes are listed with their counts and can be deleted', async ({ page }) => {
  const deletes: Array<Record<string, unknown>> = [];

  // AdminDashboard renders its panels behind `{data && ...}` and they
  // dereference data.inventory.byCategory and friends, so an empty object
  // crashes the page. Reuse the full fixture.
  await page.route('**/.netlify/functions/admin-dashboard?range=30', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) }));

  await page.route('**/.netlify/functions/admin-tray-sizes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [record] }) });
      return;
    }
    deletes.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/admin/');

  const rows = page.getByTestId('tray-size-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('2100');
  await expect(rows.first()).toContainText('7');

  // The single outlier is the one worth removing.
  await rows.nth(1).getByRole('button', { name: /delete/i }).click();

  await expect.poll(() => deletes.length).toBe(1);
  expect(deletes[0]).toEqual({ variantId: record.variantId, lengthMm: 3900, widthMm: 2400 });
});
```

Import the `dashboard` fixture rather than inventing one — copy it from `tests/e2e/admin-marketing-ideas.spec.ts`, or export it from a shared helper if you would rather not duplicate it. An empty object will not do: the panels dereference `data.inventory.byCategory` and would throw.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx astro preview stop; npm run build >/dev/null && npx playwright test tests/e2e/admin-tray-sizes.spec.ts --project=chromium-desktop --reporter=list
```

Expected: FAIL, `tray-size-row` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `netlify/functions/admin-tray-sizes.ts`:

```ts
import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { removeTraySize, TRAY_SIZE_STORE, traySizeKey, type TraySizeRecord } from './tray-size-core';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (!['GET', 'DELETE'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  const capability = event.httpMethod === 'GET' ? 'site:read' : 'site:write';
  if (!hasAdminCapability(actor, capability)) return forbiddenResponse(capability);
  connectBlobStore(event);

  try {
    const store = getBlobStore(TRAY_SIZE_STORE);

    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const records: TraySizeRecord[] = [];
      for (const blob of blobs) {
        const record = await store.get(blob.key, { type: 'json' }) as TraySizeRecord | null;
        if (record?.variantId) records.push(record);
      }
      records.sort((a, b) => b.totalReports - a.totalReports || a.variantId.localeCompare(b.variantId));
      return json(200, { records });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    } catch {
      return json(400, { error: 'Invalid request' });
    }

    const variantId = typeof body.variantId === 'string' ? body.variantId : '';
    const lengthMm = Number(body.lengthMm);
    const widthMm = Number(body.widthMm);
    if (!variantId || !Number.isInteger(lengthMm) || !Number.isInteger(widthMm)) {
      return json(400, { error: 'Provide the variant and the exact size to remove.' });
    }

    const key = traySizeKey(variantId);
    const existing = await store.get(key, { type: 'json' }) as TraySizeRecord | null;
    if (!existing) return json(404, { error: 'No reports for that vehicle.' });

    // Remove one size, never the whole variant: a single bad entry should not
    // discard the good reports beside it.
    await store.setJSON(key, removeTraySize(existing, lengthMm, widthMm, new Date().toISOString()));
    return json(200, { ok: true });
  } catch (error) {
    console.warn('admin-tray-sizes: unavailable', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
```

Create `src/components/TraySizes.tsx`:

```tsx
import React from 'react';

export interface TraySizeBucket {
  lengthMm: number;
  widthMm: number;
  reports: number;
  lastReportedAt: string;
}

export interface TraySizeRecord {
  variantId: string;
  sizes: TraySizeBucket[];
  totalReports: number;
}

export default function TraySizes({
  records, loading, error, deletingKey, onDelete,
}: {
  records: TraySizeRecord[];
  loading: boolean;
  error: string;
  deletingKey: string | null;
  onDelete: (variantId: string, size: TraySizeBucket) => void;
}) {
  if (loading && records.length === 0) {
    return <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>Loading reported tray sizes…</p>;
  }
  if (error) {
    return <p style={{ margin: 0, color: '#f87171', fontSize: '0.78rem' }}>{error}</p>;
  }
  if (records.length === 0) {
    return (
      <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>
        No tray sizes reported yet. Customers add these from the slide-on weight calculator.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {records.map((record) => (
        <div key={record.variantId} style={{ borderBottom: '1px solid #252525', paddingBottom: '0.6rem' }}>
          <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 800 }}>{record.variantId}</div>
          {record.sizes.map((size) => {
            const key = `${record.variantId}:${size.lengthMm}x${size.widthMm}`;
            return (
              <div
                key={key}
                data-testid="tray-size-row"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.35rem' }}
              >
                <span style={{ color: '#ddd', fontSize: '0.76rem' }}>
                  {size.lengthMm} × {size.widthMm} mm · {size.reports} report{size.reports === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(record.variantId, size)}
                  disabled={deletingKey === key}
                  style={{
                    background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px',
                    padding: '0.25rem 0.5rem', cursor: deletingKey === key ? 'wait' : 'pointer', fontSize: '0.7rem', fontWeight: 700,
                  }}
                >
                  {deletingKey === key ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

In `src/components/AdminDashboard.tsx`, add the import, the state, the loader and the delete handler following the exact shape of the existing marketing-ideas code (`loadSavedIdeas` / `writeIdea`), then mount it beside the other panels:

```tsx
          <Panel
            title="Reported Tray Sizes"
            description={"Tray dimensions customers reported for their own vehicle, with how many reported each. Delete an entry that is obviously wrong."}
          >
            <TraySizes
              records={traySizeRecords}
              loading={traySizesLoading}
              error={traySizesError}
              deletingKey={traySizeDeleting}
              onDelete={deleteTraySize}
            />
          </Panel>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx astro preview stop; npm run build >/dev/null && npx playwright test tests/e2e/admin-tray-sizes.spec.ts --reporter=list
```

Expected: 5 passed, one per browser project.

- [ ] **Step 5: Run everything and commit**

```bash
npm test 2>&1 | grep -E "^# (tests|pass|fail)"
npx astro check 2>&1 | grep -E "^- [0-9]+ (errors|warnings)"
npx astro preview stop; npm run build >/dev/null && npx playwright test --project=chromium-desktop 2>&1 | tail -3
```

Expected: 281 unit tests passing, 0 errors and 0 warnings, and the full e2e suite green.

```bash
git add netlify/functions/admin-tray-sizes.ts src/components/TraySizes.tsx src/components/AdminDashboard.tsx tests/e2e/admin-tray-sizes.spec.ts
git commit -m "feat: review and remove reported tray sizes from the admin dashboard"
```

---

## Self-review

**Spec coverage.** Storage → Task 1. Choosing what to show → Task 1 (`winningTraySize`). What the customer sees, the confirmation loop → Task 4. Endpoint → Task 3. Validation → Tasks 1 and 3. Moderation → Task 5. Failure behaviour → Task 4's outage test and the 503 paths in Tasks 3 and 5. Every spec section maps to a task.

**A task the spec did not anticipate.** Task 2 exists because Netlify functions in this repo import JSON only from beside themselves — `admin-chat.ts` imports `./product-catalogue.json`, and no function imports a value from `src/`. The spec assumed the endpoint could check the catalogue directly. Update the spec's Files section to list `netlify/functions/vehicle-variant-index.json` and the `SCRIPTS/build-vehicle-catalogue.mjs` change.

**Placeholder scan.** No TBD or TODO. Every code step carries the real code.

**Type consistency.** `TraySizeRecord` and `TraySizeBucket` are defined in Task 1 and imported thereafter; the `TraySizes` component redeclares a narrower view of the same shape, which is deliberate — the admin bundle does not import server modules, matching how `MARKETING_IDEA_STATUSES` is handled. `winningTraySize` returns `{ lengthMm, widthMm, reports }` in Tasks 1, 3 and 4 alike. `postTraySize(variantId, lengthMm, widthMm)` is defined and called with those three arguments only.

**Two risks checked and closed rather than left to the implementer.**
- There is no Calculate button. The page recalculates on every `input`, so the spec's "posted on Calculate" described a control that does not exist. Corrections now post on the tray fields' `change` event, and the spec has been corrected to match.
- `AdminDashboard` renders its panels behind `{data && ...}` and they dereference `data.inventory.byCategory`, so Task 5's e2e must use the full dashboard fixture, not `{}`.

**Remaining risk.** Task 2's index can drift if someone edits `catalogue.json` by hand. The Task 2 test fails loudly in that case and names the command to fix it.
