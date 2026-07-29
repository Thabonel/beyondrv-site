# Phase 0–1 Verification — 29 July 2026

## Passed checks

| Check | Result |
|---|---|
| `npm run check` | Passed: 0 errors, 0 warnings, 61 existing hints. |
| `npm test` | Passed: 118/118 tests. |
| `npm run build` | Passed: 40 pages generated; sitemap index generated. |
| `npm run audit:authority -- --out docs/authority/baselines/2026-07-29-local-crawl.json` | Passed: 40 pages, zero findings, including the strengthened misleading-origin wording regression check. |
| Built sitemap inspection | Passed: deployment timestamps removed; controlled dates appear only for recorded materially changed paths. |
| Built JSON-LD inspection | Passed: no `#business`, internal availability codes, unsupported shipping/returns fields or fixed `priceValidUntil`. |
| IndexNow dry run | Passed: same-origin URLs normalised; exact payload printed; no request sent. |
| Desktop rendered hub check | Passed at 1280px: no horizontal overflow; three equal guide cards; navigation fits. |
| Mobile rendered hub check | Passed at 390px: no horizontal overflow; one-column cards; hamburger opens and exposes Guides. |
| Browser console | No warnings or errors on `/guides/`. |
| `git diff --check` | Passed. |

## Owner-confirmed claim consistency pass

After the owner response on 29 July 2026, the public source was updated to use 15 years of RV experience, the scoped ADR/Queensland gas and 240V certification statement, and the five-year construction warranty with individual appliance manufacturer warranties. Unconfirmed “Queensland built” and “Queensland finished” wording was removed from the main public pages pending product-origin clarification.

A continuation review found residual origin wording on the About, Custom and Expedition pages, in homepage recent-build data and in public chatbot knowledge. Those claims were removed or narrowed, the generated chatbot knowledge was refreshed, and the crawl audit was extended so the blocked phrases fail future audits.

The owner subsequently confirmed on 29 July 2026 that caravan and camper shells are imported, then completed at the Beyond RV workshop in Mutdapilly, Queensland. Claim records C-005 and C-009 were resolved with that narrower wording. Public and AI-facing copy now distinguishes imported shells from the completion work performed at Mutdapilly and continues to prohibit Queensland-built or Queensland-manufactured shell claims.

The sale-terms Word draft was regenerated from its Markdown source and all seven rendered pages were visually inspected. The updated warranty clause renders cleanly with no clipping or overlap. The document remains a solicitor-review draft and is not approved for customer use.

## Broader existing end-to-end suite

The existing `site-smoke.spec.ts` and `mobile-layout.spec.ts` suite was also run across five configured browser/device projects: 254 tests passed and 26 failed. None of the failure locations or assertions were introduced by the Phase 0–1 files.

The failures group into these existing repository/environment defects:

- A dynamic `/media/products/advent-2450-hardtop-slide-on/...img_0609.webp` asset is unavailable in local preview, affecting the Advent 2450 page and its category card.
- Gallery assertions are stale: Advent 2450 renders 32 thumbnails while the test expects exactly 30; Advent 2300 and 7ft pop-top tests expect a `.specs-table` element that the current pages do not render.
- `/shop/twin-air-compressor-shield/` has 40px root overflow at 320px in Chromium and mobile Chrome.

These are recorded as verification exceptions, not authority-programme blockers. Fixing unrelated product media, gallery fixtures and shop layout is outside Phase 0–1 scope and requires a separate task. Temporary failure artefacts were moved out of the workspace to `/tmp/byondrv-authority-test-results.niWOgM/`; tracked test-result state was restored.
