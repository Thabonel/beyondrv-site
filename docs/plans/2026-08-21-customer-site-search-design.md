# Customer site search design

Date: 2026-08-21

## Problem

The site has no search. Customers browse by navigating the category pages, so
someone who arrives knowing a model name ("Advent 2450") or a question
("payload", "GVM") has to guess which nav link leads to it.

The homepage already tells Google a search exists. `src/pages/index.astro`
publishes a `WebSite` schema whose `SearchAction` points at
`/our-slide-on-campers/?q={search_term_string}`. Nothing on that page reads
`q` — fetching it with and without the parameter returns byte-identical HTML.
Google crawled the unfilled template URL, which is one of the URLs in the
current Search Console "Alternate page with proper canonical tag" report.

`netlify.toml` also carries a redirect sending legacy WordPress search URLs
(`/?s=<term>`) to that same non-functional endpoint. The redirect does not
fire: `/?s=camper` returns 200 with no redirect.

## Goals

- Customers can find products, buying guides, and calculators from any page.
- Search results have a real URL that can be linked and shared.
- The `SearchAction` describes something that works.
- No new runtime dependency.

## Non-goals

- Full body-text indexing. Frontmatter and page summaries are enough at this
  size, and body indexing is what would justify reaching for Pagefind.
- Search over shop parts beyond what the product collection already holds.
- Any admin-side search.

## Scope

23 records:

| Kind | Count | Source |
|---|---|---|
| `product` | 17 | `src/content/products/`: 11 top-level, 1 under `accessories/`, 5 under `expedition/` |
| `guide` | 3 | The two articles under `src/pages/guides/` plus the guides index, so a search for "guides" reaches the hub |
| `tool` | 3 | Towing calculator, slide-on weight calculator, vehicle suitability checker |

## Design

### Index

`src/pages/search-index.json.ts` is an Astro endpoint that emits
`/search-index.json` during the build, so the index cannot drift from the
content it describes.

Each record:

```ts
interface SearchRecord {
  id: string;          // slug or page path
  title: string;
  summary: string;     // tagline for products, one-line description for pages
  url: string;
  kind: 'product' | 'guide' | 'tool';
  category: string;    // '' for guides and tools
  price: string;       // '' for guides and tools
  keywords: string[];  // features and keySpecs, flattened
}
```

Products derive every field from existing frontmatter. Guides and calculators
are `.astro` pages with no content collection, so they are listed in
`src/data/searchPages.ts` — a hand-maintained array of six entries. That file
is the one place a new guide has to be registered, and it is small enough to
review at a glance.

Estimated payload: a few KB. It is fetched at most once per page — on load for
`/search/`, and lazily on first focus of the header input everywhere else — so
visitors who never search never pay for it.

### Matching and ranking

`src/lib/search.ts` is pure and dependency-free, so it is unit-testable
without a DOM or a network.

Normalise both query and fields to lowercase, stripping punctuation. Split the
query into terms. A record matches when **every** term appears in at least one
of its fields, so extra words narrow rather than widen the result set.

Field weights:

| Field | Weight |
|---|---|
| `title` | 10 |
| `category` | 5 |
| `summary` | 3 |
| `keywords` | 1 |

A record whose `title` contains the whole query as a phrase gets a bonus, so
"advent 2450" ranks the Advent 2450 above a record that merely contains both
words separately. Results sort by score descending, then title ascending, so
ordering is stable for equal scores. An empty query returns no results rather
than everything.

### Results page

`src/pages/search/index.astro` at `/search/`.

- Reads `?q=` on load, fetches `/search-index.json`, renders matches grouped
  under **Products**, **Guides**, and **Tools**, in that order.
- Products show hero image, title, tagline, and price. Guides and tools show
  title and summary.
- After first load, typing filters in place and rewrites `?q=` with
  `history.replaceState`, so the URL always reflects what is on screen and
  stays shareable.
- No query: prompt, plus links to the main category pages.
- No matches: say so, and link the enquiry form. A customer who cannot find
  something should be one click from asking about it.

### Header

A **Search** control sits before Cart in `src/components/Header.astro`.

It is a real form:

```html
<form action="/search/" method="get" role="search">
```

so it works with JavaScript disabled and crawlers see an honest endpoint. On
desktop the input expands on click, because the nav already carries nine
links, the cart, and the Enquire CTA, and an always-visible input crowds them.
On mobile it renders as a full-width input at the top of the open hamburger
menu.

### Type-ahead dropdown

The header input also shows results as the customer types, so a known model
name takes three keystrokes and a click with no page load. `search()` and the
fetched index are shared with the results page, so the matching costs nothing
extra; the work is in the interaction.

Behaviour:

- Fetch `/search-index.json` once, lazily, on first focus of the input — not
  on page load, so it costs nothing for visitors who never search.
- Show at most 5 records, then a final row: **See all results for "<query>"**,
  linking to `/search/?q=<query>`.
- Each row shows the title and a `kind` label, so a guide is never mistaken
  for a product.
- Below 2 characters, show nothing.
- No matches: a single row offering the enquiry form, matching the page.

Accessibility contract:

- The input is `role="combobox"` with `aria-expanded`, `aria-controls`
  pointing at the listbox, and `aria-activedescendant` pointing at the
  highlighted row. The list is `role="listbox"`, rows are `role="option"`.
- Arrow Down and Arrow Up move the highlight, wrapping at both ends. Enter
  opens the highlighted row, or submits the form when nothing is highlighted.
  Escape closes the list and returns focus to the input. Tab leaves without
  selecting.
- A polite live region announces the result count as it changes.

Two known traps, called out because they are the usual defects:

- **Blur beats click.** Closing on `blur` cancels a click on a row, because
  blur fires first and the row is gone before the click lands. Select on
  `mousedown` instead of relying on `click` after `blur`.
- **Mobile space.** The header search sits inside the hamburger overlay, and
  the on-screen keyboard takes roughly half the viewport. The list renders
  inline within the overlay rather than as a floating layer, and scrolls
  within its own bounds, so it never overflows behind the keyboard.

The results page remains the primary surface. The dropdown serves customers
who already know a model name; the page serves customers still deciding, which
is why it keeps the images, taglines, and prices.

### Structured data and redirects

- `src/pages/index.astro`: repoint the `SearchAction` `urlTemplate` to
  `https://beyondrv.com.au/search/?q={search_term_string}`. The schema stays;
  it becomes true rather than being deleted.
- `netlify.toml`: repair the legacy redirect so `/?s=<term>` reaches
  `/search/?q=<term>`.

This resolves the Search Console finding by making the advertised endpoint
real. The finding itself is benign — canonicals are correct on every flagged
URL, and Google is indexing the canonical as intended — so no other change is
needed for it.

## Testing

Unit, `tests/search.test.ts`, written before the module:

- A single term matches title, summary, and keywords.
- Every term must match; an extra unmatched term excludes the record.
- Title matches outrank summary matches, which outrank keyword matches.
- A full phrase in the title outranks the same words scattered across fields.
- An empty or whitespace query returns nothing.
- Ranking is stable for equal scores.
- A caller can cap the result count, for the dropdown's top five.

E2E, `tests/e2e/site-search.spec.ts`:

- Submitting the header form lands on `/search/?q=…` with the expected product.
- Deep-linking `/search/?q=advent` renders results without typing.
- A query matching a guide returns it under **Guides**, not under Products.
- A nonsense query shows the no-match state with the enquiry link.
- Typing two characters in the header opens the dropdown with matching rows.
- Arrow Down then Enter opens the highlighted result.
- Escape closes the dropdown and leaves focus on the input.
- Choosing "See all results" lands on the results page for the same query.

## Files

New:

- `src/pages/search-index.json.ts`
- `src/pages/search/index.astro`
- `src/lib/search.ts`
- `src/lib/searchIndex.ts`
- `src/lib/searchDropdown.ts`
- `src/data/searchPages.ts`
- `tests/search.test.ts`
- `tests/search-index.test.ts`
- `tests/e2e/site-search.spec.ts`

Edited:

- `src/components/Header.astro`
- `src/pages/index.astro`
- `netlify.toml`
