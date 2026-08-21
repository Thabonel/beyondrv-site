# Customer site search implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give customers a working site search over products, guides, and calculators, reachable from every page, with a shareable results URL and a type-ahead dropdown.

**Architecture:** A build-time Astro endpoint emits a small JSON index from the product collection and a hand-maintained page list. A pure, dependency-free module ranks records against a query. The results page and the header dropdown both consume that one module and that one index.

**Tech Stack:** Astro 7, TypeScript, `node --test --experimental-strip-types` for unit tests, Playwright for e2e. No new runtime dependency.

**Spec:** `docs/plans/2026-08-21-customer-site-search-design.md`

## Global Constraints

- No new runtime dependency. The matching module must be pure TypeScript with no imports outside the repo.
- Unit tests live in `tests/*.test.ts` and run under `npm test`. They import source with an explicit `.ts` extension, e.g. `from '../src/lib/search.ts'`.
- E2E tests live in `tests/e2e/*.spec.ts` and run under `npx playwright test`. `npm run build` must run first, because Playwright serves `dist/` via `npm run preview`.
- Astro serves the built site on port 4321. If a previous run left a preview server behind, `npx playwright test` fails with "Process from config.webServer exited early". Clear it with `pkill -f "astro.mjs preview"` before running.
- Product visibility is decided by `isPublicProduct` from `src/lib/productVisibility.ts`. Archived products must never appear in the index.
- Field weights are exactly: title 10, category 5, summary 3, keywords 1. Phrase bonus is exactly 25.
- The dropdown shows at most 5 records and activates at 2 or more characters.

---

### Task 1: Ranking module

**Files:**
- Create: `src/lib/search.ts`
- Test: `tests/search.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface SearchRecord { id: string; title: string; summary: string; url: string; kind: 'product' | 'guide' | 'tool'; category: string; price: string; keywords: string[] }`
  - `function searchRecords(records: SearchRecord[], query: string, options?: { limit?: number }): SearchRecord[]`

- [ ] **Step 1: Write the failing test**

Create `tests/search.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { searchRecords, type SearchRecord } from '../src/lib/search.ts';

function record(overrides: Partial<SearchRecord> = {}): SearchRecord {
  return {
    id: 'advent-2450-hardtop-slide-on',
    title: 'Advent 2450 Hardtop Ute Slide-On Camper',
    summary: 'Hardtop slide-on for dual-cab utes.',
    url: '/advent-2450-hardtop-slide-on/',
    kind: 'product',
    category: 'slide-on',
    price: 'From $49,990',
    keywords: ['electric lift', 'payload 900kg'],
    ...overrides,
  };
}

test('a query term matches the title', () => {
  const results = searchRecords([record()], 'advent');
  assert.equal(results.length, 1);
});

test('a query term matches the summary', () => {
  const results = searchRecords([record()], 'dual-cab');
  assert.equal(results.length, 1);
});

test('a query term matches a keyword', () => {
  const results = searchRecords([record()], 'payload');
  assert.equal(results.length, 1);
});

test('every query term must match, so an unmatched term excludes the record', () => {
  const results = searchRecords([record()], 'advent submarine');
  assert.deepEqual(results, []);
});

test('a title match outranks a summary match', () => {
  const inTitle = record({ id: 'a', title: 'Touring Camper', summary: 'Nothing here.' });
  const inSummary = record({ id: 'b', title: 'Nothing here.', summary: 'A touring camper.' });

  const results = searchRecords([inSummary, inTitle], 'touring');

  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('a summary match outranks a keyword match', () => {
  const inSummary = record({ id: 'a', title: 'Nothing.', summary: 'Electric lift roof.', keywords: [] });
  const inKeyword = record({ id: 'b', title: 'Nothing.', summary: 'Nothing.', keywords: ['electric lift'] });

  const results = searchRecords([inKeyword, inSummary], 'electric');

  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('a full phrase in the title outranks the same words spread across fields', () => {
  const phrase = record({ id: 'a', title: 'Advent 2450 Hardtop', summary: 'Nothing.', keywords: [] });
  const scattered = record({ id: 'b', title: 'Advent 2150', summary: 'Compare with the 2450.', keywords: [] });

  const results = searchRecords([scattered, phrase], 'advent 2450');

  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('punctuation in the query does not prevent a match', () => {
  const results = searchRecords([record()], 'slide-on!');
  assert.equal(results.length, 1);
});

test('an empty or whitespace query returns nothing', () => {
  assert.deepEqual(searchRecords([record()], ''), []);
  assert.deepEqual(searchRecords([record()], '   '), []);
});

test('records with equal scores are ordered by title', () => {
  const beta = record({ id: 'b', title: 'Beta Camper', summary: '', keywords: [] });
  const alpha = record({ id: 'a', title: 'Alpha Camper', summary: '', keywords: [] });

  const results = searchRecords([beta, alpha], 'camper');

  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('a caller can cap how many results come back', () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
    record({ id, title: `${id} Camper`, summary: '', keywords: [] }));

  const results = searchRecords(many, 'camper', { limit: 5 });

  assert.equal(results.length, 5);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: FAIL. The failure is a module resolution error, because `src/lib/search.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/search.ts`:

```ts
export interface SearchRecord {
  id: string;
  title: string;
  summary: string;
  url: string;
  kind: 'product' | 'guide' | 'tool';
  category: string;
  price: string;
  keywords: string[];
}

export interface SearchOptions {
  limit?: number;
}

const TITLE_WEIGHT = 10;
const CATEGORY_WEIGHT = 5;
const SUMMARY_WEIGHT = 3;
const KEYWORD_WEIGHT = 1;
const PHRASE_BONUS = 25;

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** The weight of the highest-weighted field containing the term, or 0 for no match. */
function termScore(fields: { title: string; category: string; summary: string; keywords: string }, term: string) {
  if (fields.title.includes(term)) return TITLE_WEIGHT;
  if (fields.category.includes(term)) return CATEGORY_WEIGHT;
  if (fields.summary.includes(term)) return SUMMARY_WEIGHT;
  if (fields.keywords.includes(term)) return KEYWORD_WEIGHT;
  return 0;
}

export function searchRecords(records: SearchRecord[], query: string, options: SearchOptions = {}) {
  const normalisedQuery = normalise(query);
  if (!normalisedQuery) return [];
  const terms = normalisedQuery.split(' ');

  const scored: Array<{ record: SearchRecord; score: number }> = [];
  for (const record of records) {
    const fields = {
      title: normalise(record.title),
      category: normalise(record.category),
      summary: normalise(record.summary),
      keywords: normalise(record.keywords.join(' ')),
    };

    let score = 0;
    let matchedEveryTerm = true;
    for (const term of terms) {
      const termWeight = termScore(fields, term);
      if (termWeight === 0) {
        matchedEveryTerm = false;
        break;
      }
      score += termWeight;
    }
    if (!matchedEveryTerm) continue;

    if (fields.title.includes(normalisedQuery)) score += PHRASE_BONUS;
    scored.push({ record, score });
  }

  scored.sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));
  const ordered = scored.map((entry) => entry.record);
  return typeof options.limit === 'number' ? ordered.slice(0, options.limit) : ordered;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: PASS, with 0 failures. The pre-existing suite is 186 tests, so expect 197.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts tests/search.test.ts
git commit -m "feat: add search ranking module"
```

---

### Task 2: Index building and the static page catalogue

**Files:**
- Create: `src/lib/searchIndex.ts`
- Create: `src/data/searchPages.ts`
- Create: `src/pages/search-index.json.ts`
- Test: `tests/search-index.test.ts`

**Interfaces:**
- Consumes: `SearchRecord` from `src/lib/search.ts` (Task 1).
- Produces:
  - `function productSearchUrl(id: string, store: boolean, storeSlug: string): string`
  - `function buildProductRecord(entry: { id: string; data: Record<string, unknown> }): SearchRecord`
  - `const SEARCH_PAGES: SearchRecord[]` from `src/data/searchPages.ts`
  - A built asset at `/search-index.json` shaped `{ records: SearchRecord[] }`

- [ ] **Step 1: Write the failing test**

Create `tests/search-index.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductRecord, productSearchUrl } from '../src/lib/searchIndex.ts';
import { SEARCH_PAGES } from '../src/data/searchPages.ts';

test('a top-level vehicle product lives at the site root', () => {
  assert.equal(productSearchUrl('advent-2450-hardtop-slide-on', false, ''), '/advent-2450-hardtop-slide-on/');
});

test('an expedition product drops the collection prefix from its url', () => {
  assert.equal(productSearchUrl('expedition/4-7m-hardtop-truck-camper', false, ''), '/expedition/4-7m-hardtop-truck-camper/');
});

test('a store product lives under /shop/ using its own slug', () => {
  assert.equal(productSearchUrl('accessories/twin-air-compressor-shield', true, 'twin-air-compressor-shield'), '/shop/twin-air-compressor-shield/');
});

test('a product record carries the fields the ranking module reads', () => {
  const record = buildProductRecord({
    id: 'advent-2450-hardtop-slide-on',
    data: {
      title: 'Advent 2450 Hardtop Ute Slide-On Camper',
      tagline: 'Hardtop slide-on for dual-cab utes.',
      category: 'slide-on',
      price: 'From $49,990',
      features: ['Electric lift roof'],
      keySpecs: [{ label: 'Payload', value: '900kg' }],
    },
  });

  assert.equal(record.kind, 'product');
  assert.equal(record.title, 'Advent 2450 Hardtop Ute Slide-On Camper');
  assert.equal(record.summary, 'Hardtop slide-on for dual-cab utes.');
  assert.equal(record.category, 'slide-on');
  assert.equal(record.price, 'From $49,990');
  assert.equal(record.url, '/advent-2450-hardtop-slide-on/');
  assert.deepEqual(record.keywords, ['Electric lift roof', 'Payload', '900kg']);
});

test('a product with no features or specs still builds a record', () => {
  const record = buildProductRecord({
    id: 'mercedes-sprinter-motorhome',
    data: { title: 'Mercedes Sprinter Motorhome', tagline: 'Van conversion.', category: 'expedition', price: 'POA' },
  });

  assert.deepEqual(record.keywords, []);
});

test('the static page catalogue covers every guide and tool', () => {
  assert.equal(SEARCH_PAGES.length, 6);
  assert.equal(SEARCH_PAGES.filter((page) => page.kind === 'guide').length, 3);
  assert.equal(SEARCH_PAGES.filter((page) => page.kind === 'tool').length, 3);
  for (const page of SEARCH_PAGES) {
    assert.match(page.url, /^\/[a-z0-9/-]+\/$/, `${page.id} should have a trailing-slash root-relative url`);
    assert.ok(page.title, `${page.id} needs a title`);
    assert.ok(page.summary, `${page.id} needs a summary`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: FAIL, module not found for `src/lib/searchIndex.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/searchIndex.ts`:

```ts
import type { SearchRecord } from './search.ts';

export function productSearchUrl(id: string, store: boolean, storeSlug: string) {
  if (store) return `/shop/${storeSlug}/`;
  return `/${id}/`;
}

interface SpecRow {
  label: string;
  value: string;
}

export function buildProductRecord(entry: { id: string; data: Record<string, unknown> }): SearchRecord {
  const data = entry.data;
  const features = Array.isArray(data.features) ? (data.features as string[]) : [];
  const keySpecs = Array.isArray(data.keySpecs) ? (data.keySpecs as SpecRow[]) : [];
  const keywords = [
    ...features,
    ...keySpecs.flatMap((spec) => [spec.label, spec.value]),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return {
    id: entry.id,
    title: String(data.title ?? ''),
    summary: String(data.tagline ?? ''),
    url: productSearchUrl(entry.id, data.store === true, String(data.slug ?? '')),
    kind: 'product',
    category: String(data.category ?? ''),
    price: String(data.price ?? ''),
    keywords,
  };
}
```

Note on `productSearchUrl`: `/${id}/` already yields `/expedition/4-7m-hardtop-truck-camper/` for expedition entries, because the collection id carries the `expedition/` prefix and the route at `src/pages/expedition/[slug].astro` strips it back off. No special case is needed.

Create `src/data/searchPages.ts`. Titles and summaries are shortened from each page's own `title`/`description` props:

```ts
import type { SearchRecord } from '../lib/search.ts';

function page(id: string, title: string, summary: string, url: string, kind: 'guide' | 'tool'): SearchRecord {
  return { id, title, summary, url, kind, category: '', price: '', keywords: [] };
}

/**
 * Guides and calculators are .astro pages with no content collection, so they
 * are listed here. Add a row when you add a guide, or search will not find it.
 */
export const SEARCH_PAGES: SearchRecord[] = [
  page(
    'guides',
    'Slide-On Camper Guides and Weight Tools',
    'Australian guides and tools covering ute suitability, payload, tray fit, GVM and axle limits.',
    '/guides/',
    'guide',
  ),
  page(
    'guides/best-utes-for-slide-on-campers',
    'Best Utes for Slide-On Campers',
    'What makes a ute suitable for a slide-on camper: payload, GVM, tray size, axle limits and suspension.',
    '/guides/best-utes-for-slide-on-campers/',
    'guide',
  ),
  page(
    'guides/gvm-gcm-atm-gtm-explained',
    'GVM, GCM, ATM and GTM Explained',
    'Plain-English guide to GVM, GCM, ATM, GTM, payload, tare and tow ball download for Australian buyers.',
    '/guides/gvm-gcm-atm-gtm-explained/',
    'guide',
  ),
  page(
    'caravan-towing-calculator',
    'Caravan Towing Calculator',
    'Estimate whether your tow vehicle suits a Beyond RV caravan using GVM, GCM, braked towing capacity and tow ball download.',
    '/caravan-towing-calculator/',
    'tool',
  ),
  page(
    'slide-on-camper-weight-calculator',
    'Slide-On Camper Weight Calculator',
    'Estimate whether your ute has the payload, GVM margin and tray size for a slide-on camper.',
    '/slide-on-camper-weight-calculator/',
    'tool',
  ),
  page(
    'vehicle-suitability-checker',
    'Vehicle Suitability Checker',
    'Check whether your ute suits a slide-on camper, or whether your vehicle can tow a Beyond RV caravan.',
    '/vehicle-suitability-checker/',
    'tool',
  ),
];
```

Create `src/pages/search-index.json.ts`:

```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isPublicProduct } from '../lib/productVisibility';
import { buildProductRecord } from '../lib/searchIndex';
import { SEARCH_PAGES } from '../data/searchPages';

export const GET: APIRoute = async () => {
  const products = (await getCollection('products')).filter(isPublicProduct);
  const records = [
    ...products.map((product) => buildProductRecord({ id: product.id, data: product.data as Record<string, unknown> })),
    ...SEARCH_PAGES,
  ];

  return new Response(JSON.stringify({ records }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: PASS, 203 tests.

- [ ] **Step 5: Verify the built index has the right shape**

Run:

```bash
npm run build >/dev/null && node -e "const d=require('./dist/search-index.json');console.log('records',d.records.length);console.log('kinds',JSON.stringify(d.records.reduce((a,r)=>{a[r.kind]=(a[r.kind]||0)+1;return a},{})));console.log('sample',JSON.stringify(d.records[0]))"
```

Expected: `records 21`, and `kinds {"product":15,"guide":3,"tool":3}`. There are 17 product files, two of which are archived (`3-5m-poptop-truck-camper`, `sunpatch-12c-couples-caravan`) and correctly excluded by `isPublicProduct`. If the count differs, a product was added or archived — confirm against `grep -l "^archived: true" src/content/products/*.md src/content/products/*/*.md` before changing anything.

- [ ] **Step 6: Commit**

```bash
git add src/lib/searchIndex.ts src/data/searchPages.ts src/pages/search-index.json.ts tests/search-index.test.ts
git commit -m "feat: emit a search index at build time"
```

---

### Task 3: Results page

**Files:**
- Create: `src/pages/search/index.astro`
- Test: `tests/e2e/site-search.spec.ts`

**Interfaces:**
- Consumes: `searchRecords` and `SearchRecord` from Task 1; `/search-index.json` from Task 2.
- Produces: a page at `/search/` reading `?q=`, with `data-testid` hooks `search-results`, `search-result`, `search-empty`, and `search-no-query`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/site-search.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('deep-linking a query renders matching results without typing', async ({ page }) => {
  await page.goto('/search/?q=advent');

  const results = page.getByTestId('search-result');
  await expect(results.first()).toBeVisible();
  await expect(results.filter({ hasText: 'Advent 2450' })).toHaveCount(1);
});

test('a question about weights finds the guide, not a product', async ({ page }) => {
  await page.goto('/search/?q=gvm');

  const guides = page.getByTestId('search-group-guide');
  await expect(guides).toBeVisible();
  await expect(guides.getByTestId('search-result').filter({ hasText: 'GVM, GCM, ATM and GTM Explained' })).toHaveCount(1);
});

test('a query that matches nothing offers the enquiry form', async ({ page }) => {
  await page.goto('/search/?q=submarine');

  const empty = page.getByTestId('search-empty');
  await expect(empty).toBeVisible();
  await expect(empty.getByRole('link', { name: /enquir/i })).toHaveAttribute('href', '/inquiry-form/');
});

test('visiting the search page with no query prompts rather than listing everything', async ({ page }) => {
  await page.goto('/search/');

  await expect(page.getByTestId('search-no-query')).toBeVisible();
  await expect(page.getByTestId('search-result')).toHaveCount(0);
});

test('typing on the results page updates both the results and the url', async ({ page }) => {
  await page.goto('/search/?q=advent');

  await page.getByTestId('search-page-input').fill('unimog');

  await expect(page.getByTestId('search-result').filter({ hasText: 'Unimog' }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/search\/\?q=unimog$/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --project=chromium-desktop --reporter=list
```

Expected: FAIL. `/search/` 404s, so `search-result` is never found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/pages/search/index.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
---
<BaseLayout
  title="Search | Beyond RV"
  description="Search Beyond RV campers, caravans, buying guides and weight calculators."
  noIndex={true}
>
  <main class="search-page">
    <h1>Search</h1>
    <form class="search-page-form" action="/search/" method="get" role="search">
      <label for="searchPageInput">Search Beyond RV</label>
      <input
        id="searchPageInput"
        data-testid="search-page-input"
        type="search"
        name="q"
        autocomplete="off"
        placeholder="Try a model name, or a question like payload"
      />
      <button type="submit">Search</button>
    </form>

    <div id="searchResults" data-testid="search-results" aria-live="polite"></div>
  </main>
</BaseLayout>

<script>
  import { searchRecords, type SearchRecord } from '../../lib/search';

  const GROUPS: Array<{ kind: SearchRecord['kind']; label: string }> = [
    { kind: 'product', label: 'Products' },
    { kind: 'guide', label: 'Guides' },
    { kind: 'tool', label: 'Tools' },
  ];

  const input = document.getElementById('searchPageInput') as HTMLInputElement | null;
  const output = document.getElementById('searchResults');
  let records: SearchRecord[] = [];

  function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char] as string));
  }

  function resultHtml(record: SearchRecord) {
    const price = record.price ? `<span class="search-result-price">${escapeHtml(record.price)}</span>` : '';
    return `<li data-testid="search-result">
      <a href="${escapeHtml(record.url)}">
        <span class="search-result-title">${escapeHtml(record.title)}</span>
        <span class="search-result-summary">${escapeHtml(record.summary)}</span>
        ${price}
      </a>
    </li>`;
  }

  function render(query: string) {
    if (!output) return;
    if (!query.trim()) {
      output.innerHTML = `<p data-testid="search-no-query">Type above to search campers, caravans, guides and calculators.</p>`;
      return;
    }

    const matches = searchRecords(records, query);
    if (matches.length === 0) {
      output.innerHTML = `<div data-testid="search-empty">
        <p>Nothing matched “${escapeHtml(query)}”.</p>
        <p><a href="/inquiry-form/">Send us an enquiry</a> and we will help you find it.</p>
      </div>`;
      return;
    }

    output.innerHTML = GROUPS.map(({ kind, label }) => {
      const group = matches.filter((record) => record.kind === kind);
      if (group.length === 0) return '';
      return `<section data-testid="search-group-${kind}">
        <h2>${label}</h2>
        <ul>${group.map(resultHtml).join('')}</ul>
      </section>`;
    }).join('');
  }

  function currentQuery() {
    return new URLSearchParams(window.location.search).get('q') ?? '';
  }

  async function start() {
    const query = currentQuery();
    if (input) input.value = query;

    const response = await fetch('/search-index.json');
    records = ((await response.json()) as { records: SearchRecord[] }).records;
    render(query);

    input?.addEventListener('input', () => {
      const next = input.value;
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('q', next);
      else url.searchParams.delete('q');
      history.replaceState({}, '', url);
      render(next);
    });
  }

  void start();
</script>
```

`BaseLayout` already accepts `noIndex` — note the capital I — and `src/components/BaseHead.astro:40` renders `<meta name="robots" content="noindex, nofollow">` from it. Use it as-is. Search result pages should not be indexed, and Google's own guidance says so; the `nofollow` half costs nothing here because every result also appears in the sitemap.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --project=chromium-desktop --reporter=list
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/search/index.astro tests/e2e/site-search.spec.ts
git commit -m "feat: add the customer search results page"
```

---

### Task 4: Header search form

**Files:**
- Modify: `src/components/Header.astro`
- Test: `tests/e2e/site-search.spec.ts`

**Interfaces:**
- Consumes: `/search/` from Task 3.
- Produces: a form in the header with `data-testid="header-search-form"` and an input with `data-testid="header-search-input"`, plus a toggle with `data-testid="header-search-toggle"`.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/site-search.spec.ts`:

```ts
test('the header search submits to the results page', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('unimog');
  await page.getByTestId('header-search-input').press('Enter');

  await expect(page).toHaveURL(/\/search\/\?q=unimog/);
  await expect(page.getByTestId('search-result').first()).toBeVisible();
});

test('the header search form works as a plain GET form', async ({ page }) => {
  await page.goto('/');

  const form = page.getByTestId('header-search-form');
  await expect(form).toHaveAttribute('action', '/search/');
  await expect(form).toHaveAttribute('method', 'get');
  await expect(page.getByTestId('header-search-input')).toHaveAttribute('name', 'q');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --project=chromium-desktop --reporter=list
```

Expected: the two new tests FAIL with "element(s) not found" for `header-search-toggle`.

- [ ] **Step 3: Write the minimal implementation**

In `src/components/Header.astro`, insert this immediately before the `<a href="/cart/" class="nav-cart" …>` element:

```astro
  <div class="nav-search" data-nav-search>
    <button
      type="button"
      class="nav-search-toggle"
      data-testid="header-search-toggle"
      data-nav-search-toggle
      aria-label="Open search"
      aria-expanded="false"
      aria-controls="headerSearchForm"
    >
      Search
    </button>
    <form
      id="headerSearchForm"
      class="nav-search-form"
      data-testid="header-search-form"
      action="/search/"
      method="get"
      role="search"
    >
      <label class="visually-hidden" for="headerSearchInput">Search Beyond RV</label>
      <input
        id="headerSearchInput"
        data-testid="header-search-input"
        type="search"
        name="q"
        autocomplete="off"
        placeholder="Search campers, guides, tools"
      />
    </form>
  </div>
```

Add to the component's `<style>` block:

```css
  .nav-search { position: relative; display: flex; align-items: center; }
  .nav-search-form { display: none; }
  .nav-search.open .nav-search-form { display: block; }
  .nav-search.open .nav-search-toggle { display: none; }
  .nav-search-form input { width: 14rem; padding: 0.4rem 0.6rem; }
  .visually-hidden {
    position: absolute; width: 1px; height: 1px; margin: -1px;
    padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  @media (max-width: 900px) {
    .nav-search { width: 100%; order: -1; }
    .nav-search-toggle { display: none; }
    .nav-search-form { display: block; }
    .nav-search-form input { width: 100%; }
  }
```

Add to the component's existing `<script>` block, after the hamburger wiring:

```js
  const navSearch = document.querySelector('[data-nav-search]');
  const navSearchToggle = document.querySelector('[data-nav-search-toggle]');
  const navSearchInput = document.getElementById('headerSearchInput');

  navSearchToggle?.addEventListener('click', () => {
    navSearch?.classList.add('open');
    navSearchToggle.setAttribute('aria-expanded', 'true');
    navSearchInput?.focus();
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --reporter=list
```

Expected: 7 tests × 5 browser projects = 35 passed. Run all projects here, because the header layout is the part most likely to differ between engines.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.astro tests/e2e/site-search.spec.ts
git commit -m "feat: add search to the site header"
```

---

### Task 5: Type-ahead dropdown

**Files:**
- Create: `src/lib/searchDropdown.ts`
- Modify: `src/components/Header.astro`
- Test: `tests/e2e/site-search.spec.ts`

**Interfaces:**
- Consumes: `searchRecords`, `SearchRecord` from Task 1; the header form from Task 4.
- Produces: `function attachSearchDropdown(input: HTMLInputElement, form: HTMLFormElement): void`, rendering a listbox with `data-testid="header-search-listbox"` and rows with `data-testid="header-search-option"`.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/site-search.spec.ts`:

```ts
test('typing in the header opens a dropdown of matches', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('adv');

  const options = page.getByTestId('header-search-option');
  await expect(options.first()).toBeVisible();
  await expect(options.filter({ hasText: 'Advent' }).first()).toBeVisible();
});

test('a single character is too little to open the dropdown', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('a');

  await expect(page.getByTestId('header-search-listbox')).toBeHidden();
});

test('arrow down then enter opens the highlighted result', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  const input = page.getByTestId('header-search-input');
  await input.fill('unimog');
  await expect(page.getByTestId('header-search-option').first()).toBeVisible();

  await input.press('ArrowDown');
  await input.press('Enter');

  await expect(page).toHaveURL(/unimog/);
});

test('escape closes the dropdown and leaves focus in the input', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  const input = page.getByTestId('header-search-input');
  await input.fill('advent');
  await expect(page.getByTestId('header-search-option').first()).toBeVisible();

  await input.press('Escape');

  await expect(page.getByTestId('header-search-listbox')).toBeHidden();
  await expect(input).toBeFocused();
});

test('the dropdown offers a route to the full results page', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('advent');

  await page.getByTestId('header-search-see-all').click();

  await expect(page).toHaveURL(/\/search\/\?q=advent/);
});

test('the dropdown announces how many results it found', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('unimog');

  await expect(page.getByTestId('header-search-status')).toContainText(/result/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --project=chromium-desktop --reporter=list
```

Expected: the six new tests FAIL with "element(s) not found" for `header-search-option`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/searchDropdown.ts`:

```ts
import { searchRecords, type SearchRecord } from './search';

const MIN_QUERY_LENGTH = 2;
const MAX_ROWS = 5;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] as string));
}

const KIND_LABEL: Record<SearchRecord['kind'], string> = {
  product: 'Product',
  guide: 'Guide',
  tool: 'Tool',
};

export function attachSearchDropdown(input: HTMLInputElement, form: HTMLFormElement) {
  const listbox = document.createElement('ul');
  listbox.id = 'headerSearchListbox';
  listbox.className = 'nav-search-listbox';
  listbox.setAttribute('role', 'listbox');
  listbox.setAttribute('data-testid', 'header-search-listbox');
  listbox.hidden = true;

  const status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('data-testid', 'header-search-status');

  form.append(listbox, status);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listbox.id);

  let records: SearchRecord[] | null = null;
  let rows: HTMLLIElement[] = [];
  let highlighted = -1;

  async function loadRecords() {
    if (records) return records;
    const response = await fetch('/search-index.json');
    records = ((await response.json()) as { records: SearchRecord[] }).records;
    return records;
  }

  function close() {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    highlighted = -1;
  }

  function highlight(index: number) {
    if (rows.length === 0) return;
    const next = (index + rows.length) % rows.length;
    rows.forEach((row, position) => row.setAttribute('aria-selected', String(position === next)));
    input.setAttribute('aria-activedescendant', rows[next].id);
    highlighted = next;
  }

  function open(query: string, matches: SearchRecord[]) {
    const seeAllHref = `/search/?q=${encodeURIComponent(query)}`;
    listbox.innerHTML = matches.length === 0
      ? `<li class="nav-search-row" role="option" aria-selected="false" data-testid="header-search-empty">
           <a href="/inquiry-form/">Nothing matched. Send an enquiry instead.</a>
         </li>`
      : matches.map((record, index) => `
          <li id="headerSearchOption${index}" class="nav-search-row" role="option" aria-selected="false"
              data-testid="header-search-option" data-href="${escapeHtml(record.url)}">
            <a href="${escapeHtml(record.url)}">
              <span>${escapeHtml(record.title)}</span>
              <span class="nav-search-kind">${KIND_LABEL[record.kind]}</span>
            </a>
          </li>`).join('')
        + `<li id="headerSearchSeeAll" class="nav-search-row" role="option" aria-selected="false"
               data-testid="header-search-see-all" data-href="${escapeHtml(seeAllHref)}">
             <a href="${escapeHtml(seeAllHref)}">See all results for “${escapeHtml(query)}”</a>
           </li>`;

    rows = Array.from(listbox.querySelectorAll('li'));
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlighted = -1;
    status.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
  }

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      close();
      return;
    }
    const loaded = await loadRecords();
    open(query, searchRecords(loaded, query, { limit: MAX_ROWS }));
  });

  input.addEventListener('focus', () => { void loadRecords(); });

  input.addEventListener('keydown', (event) => {
    if (listbox.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight(highlighted + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(highlighted - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
      input.focus();
    } else if (event.key === 'Enter' && highlighted >= 0) {
      event.preventDefault();
      const href = rows[highlighted].dataset.href;
      if (href) window.location.href = href;
    }
  });

  // Select on mousedown: blur fires before click and would remove the row first.
  listbox.addEventListener('mousedown', (event) => {
    const row = (event.target as HTMLElement).closest('li');
    const href = row?.dataset.href;
    if (!href) return;
    event.preventDefault();
    window.location.href = href;
  });

  document.addEventListener('click', (event) => {
    if (!form.contains(event.target as Node)) close();
  });
}
```

In `src/components/Header.astro`, add to the `<script>` block after the toggle wiring:

```js
  import { attachSearchDropdown } from '../lib/searchDropdown';

  const headerSearchForm = document.getElementById('headerSearchForm');
  if (navSearchInput instanceof HTMLInputElement && headerSearchForm instanceof HTMLFormElement) {
    attachSearchDropdown(navSearchInput, headerSearchForm);
  }
```

Add to the component's `<style>` block:

```css
  .nav-search-listbox {
    list-style: none; margin: 0; padding: 0.25rem 0;
    position: absolute; top: 100%; left: 0; right: 0; z-index: 60;
    background: #111; border: 1px solid #333; border-radius: 8px;
    max-height: 60vh; overflow-y: auto;
  }
  .nav-search-row a {
    display: flex; justify-content: space-between; gap: 0.5rem;
    padding: 0.45rem 0.6rem; color: #fff; text-decoration: none; font-size: 0.82rem;
  }
  .nav-search-row[aria-selected='true'] a { background: #222; }
  .nav-search-kind { color: #888; font-size: 0.7rem; }
  @media (max-width: 900px) {
    .nav-search-listbox { position: static; max-height: 40vh; }
  }
```

The mobile rule matters: inside the hamburger overlay the list must sit in normal flow, not float, or the on-screen keyboard covers it.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --reporter=list
```

Expected: 13 tests × 5 browser projects = 65 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchDropdown.ts src/components/Header.astro tests/e2e/site-search.spec.ts
git commit -m "feat: add a type-ahead dropdown to the header search"
```

---

### Task 6: Make the structured data and the legacy redirect honest

**Files:**
- Modify: `src/pages/index.astro:54`
- Modify: `netlify.toml:28-32`
- Test: `tests/e2e/site-search.spec.ts`

**Interfaces:**
- Consumes: `/search/` from Task 3.
- Produces: no new code interface.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/site-search.spec.ts`:

```ts
test('the homepage advertises a search endpoint that exists', async ({ page }) => {
  await page.goto('/');

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const website = blocks
    .map((raw) => JSON.parse(raw) as Record<string, any>)
    .find((schema) => schema['@type'] === 'WebSite');

  expect(website).toBeTruthy();
  expect(website.potentialAction.target.urlTemplate).toBe('https://beyondrv.com.au/search/?q={search_term_string}');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --project=chromium-desktop --reporter=list -g "advertises a search endpoint"
```

Expected: FAIL, received `https://beyondrv.com.au/our-slide-on-campers/?q={search_term_string}`.

- [ ] **Step 3: Write the minimal implementation**

In `src/pages/index.astro`, change the `urlTemplate` line from:

```js
      "urlTemplate": "https://beyondrv.com.au/our-slide-on-campers/?q={search_term_string}"
```

to:

```js
      "urlTemplate": "https://beyondrv.com.au/search/?q={search_term_string}"
```

In `netlify.toml`, change the redirect at lines 28-32 from:

```toml
[[redirects]]
  from   = "/"
  to     = "/our-slide-on-campers/?q=:search"
  status = 301
  query  = {s = ":search"}
```

to:

```toml
# Legacy WordPress search URLs (/?s=term) reach the current search page.
[[redirects]]
  from   = "/"
  to     = "/search/?q=:search"
  status = 301
  query  = {s = ":search"}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pkill -f "astro.mjs preview"; npm run build >/dev/null && npx playwright test tests/e2e/site-search.spec.ts --reporter=list
```

Expected: 14 tests × 5 browser projects = 70 passed.

- [ ] **Step 5: Run the whole suite and typecheck**

Run:

```bash
npm test 2>&1 | grep -E "^# (tests|pass|fail)"
npx astro check 2>&1 | grep -E "^- [0-9]+ (errors|warnings)"
pkill -f "astro.mjs preview"; npx playwright test --project=chromium-desktop 2>&1 | tail -3
```

Expected: 203 unit tests passing, 0 errors and 0 warnings from `astro check`, and the full e2e suite passing.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro netlify.toml tests/e2e/site-search.spec.ts
git commit -m "fix: point the advertised search endpoint at the real search page"
```

The redirect only takes effect once deployed; Netlify redirects do not run under `astro preview`. Verify after deploy with:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://beyondrv.com.au/?s=camper"
```

Expected: `301 https://beyondrv.com.au/search/?q=camper`.

---

## Self-review

**Spec coverage.** Index → Task 2. Matching and ranking → Task 1. Results page → Task 3. Header → Task 4. Dropdown → Task 5. Structured data and redirects → Task 6. Unit test list → Tasks 1 and 2. E2E test list → Tasks 3, 4, 5, 6. Every spec section maps to a task.

**Spec drift, corrected here.** The spec's Files section listed `src/lib/searchDropdown.ts` but not `src/lib/searchIndex.ts`, which Task 2 introduces so the index building is unit-testable rather than trapped inside an Astro endpoint. Update the spec's Files section to match.

**Placeholder scan.** No TBD, TODO, or "handle errors appropriately". Every code step carries the real code.

**Type consistency.** `SearchRecord` is defined once in Task 1 and imported everywhere after. `searchRecords(records, query, options)` keeps the same signature in Tasks 1, 3, and 5. `attachSearchDropdown(input, form)` is defined in Task 5 and called with those two arguments in the same task. `productSearchUrl(id, store, storeSlug)` is defined and used only in Task 2.

**Known risk.** Task 2's record-count check will need updating whenever a product is added or archived. The `BaseLayout` prop was verified during review: it exists, spelled `noIndex`, and emits `noindex, nofollow`.
