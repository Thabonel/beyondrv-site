# Phase 0 Baseline — 29 July 2026

## Scope and method

The full authority implementation guide was read before implementation. The repository, current build output and selected production endpoints were inspected. This file records observed facts; it does not fill missing search-console or owner evidence with estimates.

## Repository baseline before Phase 1 changes

- Framework: Astro static site, 39 pages in the baseline production build.
- Baseline `npm run check`: passed with zero errors and 61 hints. The hints were existing deprecation/inline-event hints, including unrelated uncommitted SignWell work.
- Baseline `npm test`: 107 tests passed, zero failed.
- Baseline `npm run build`: passed.
- Organisation JSON-LD was duplicated as `#business` and `#organization`.
- Product offers included unsupported zero-cost shipping, zero-day handling/transit, a blanket no-returns policy and a fixed `priceValidUntil`.
- Some collection offers emitted internal availability codes rather than schema.org URLs.
- The header/footer had no Guides link.
- Two guide articles existed but their `/guides/` breadcrumb parent returned 404.
- Public content used “Beyond RV”, “ByondRV” and “Byond RV”.

## Production observations

Observed on 29 July 2026:

- `https://beyondrv.com.au/guides/` returned 404.
- `https://beyondrv.com.au/blog/` returned 404.
- `robots.txt`, `llms.txt`, `llms-full.txt` and the sitemap index returned 200.
- `robots.txt` explicitly allowed general crawlers and named Google, Bing, OpenAI, Anthropic, Perplexity, Apple and Common Crawl agents.
- The public sitemap assigned effectively the same deployment timestamp to every URL, rather than a page-specific material-change date.

## Local crawl after implementation

The repeatable command is:

```sh
npm run build
npm run audit:authority -- --out docs/authority/baselines/2026-07-29-local-crawl.json
```

The generated JSON is the machine-readable page inventory and failure report. It includes URL, title, description, canonical, H1s, image-alt omissions, schema types, duplicate schema IDs, invalid availability values, legacy brand mentions and broken internal links.

Final result: 39 generated public pages audited, zero findings in every check category. The sitemap contains 33 indexable canonical URLs because admin, checkout, cart, success and error routes are intentionally excluded.

## Search baseline still required

The following cannot be produced truthfully from the repository:

- Google Search Console query/page/country/device exports for a fixed comparison period.
- Google indexing, sitemap, Core Web Vitals and crawl-error exports.
- Bing Webmaster Tools query, indexing and crawl exports.
- Historical analytics landing pages and conversions for the former blog.
- Backlink exports needed to prioritise legacy URL recovery.

Store exports under `docs/authority/search-baselines/YYYY-MM-DD/`, recording the exact date range and filters in a README. These are blockers B-001 and B-002 in `BLOCKERS.md`.

## Verification record

See `VERIFICATION.md` for commands, outcomes and unrelated existing end-to-end failures discovered during the broader test run.
