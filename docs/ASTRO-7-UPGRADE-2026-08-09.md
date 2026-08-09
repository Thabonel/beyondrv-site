# Astro 7 site upgrade — 9 August 2026

## Executive outcome

The Beyond RV site has been upgraded locally from Astro 4.16.19 to Astro 7.2.0 using staged Astro 5 and Astro 6 checkpoints. The static production build completes and generates all 41 routes. The upgrade has not been deployed.

The framework-related production advisories are resolved. One upstream Netlify dependency issue remains: `@netlify/blobs` 10.7.12 depends on `@netlify/dev-utils` 4.4.7, whose bundled test helper imports the unpatched `image-size` 2.0.2 package. The site imports the main Blobs client, not the local Blobs server or Netlify test image helper where the vulnerable parser is used. This lowers practical exposure, but the advisory must remain tracked until Netlify publishes an updated dependency.

## Upgrade sequence completed

1. Recorded the Astro 4 baseline: 135 unit tests passing, zero type errors, and 41 static routes building.
2. Upgraded to Astro 5 and migrated legacy content collections to the Content Layer.
3. Re-established a green unit, type-check, and build checkpoint.
4. Upgraded to Astro 6 with Node 22 and Zod 4 compatibility.
5. Re-established the same green checkpoint.
6. Upgraded to Astro 7 and its matching React integration.
7. Updated the supported Netlify packages and patched direct/transitive dependencies where a safe release exists.
8. Ran final unit, type, production-build, dependency, and cross-browser checks.

## Code and platform changes

- `astro`: 4.16.19 → 7.2.0
- `@astrojs/react`: 5.0.7 (previously mismatched with Astro 4) → 6.0.2
- `@astrojs/sitemap`: 2.0.2 → 3.7.3
- `@astrojs/check`: 0.9.9 → 0.9.10 and moved to development dependencies
- `@netlify/blobs`: 10.7.8 → 10.7.12
- `@netlify/functions`: 5.2.0 → 5.3.0
- `sharp`: 0.34.5 → 0.35.3
- Netlify build runtime: Node 20 → Node 22
- Project Node engine: `>=22.12.0`
- Content configuration: `src/content/config.ts` → `src/content.config.ts`
- Product content now uses Astro's `glob()` Content Layer loader.
- Content entry routing now uses `entry.id` rather than the removed legacy `entry.slug` property.
- Markdown rendering now uses `render(entry)` rather than the removed `entry.render()` method.
- Product validation retains separate vehicle/storefront rules while exposing a common typed presentation shape.
- Existing suitability metadata is now explicitly validated instead of being stripped as an unknown field.
- A scoped override keeps the GLB optimisation CLI on patched `sharp` 0.35.3. The CLI starts successfully; a real optimisation smoke test is pending because no GLB asset is in the repository yet.

## Verification results

| Gate | Result |
|---|---|
| `npm run check` | Pass — 205 files, 0 errors, 0 warnings |
| `npm test` | Pass — 135/135 |
| `npm run build` | Pass — 41/41 routes |
| Production dependency audit | 3 package findings representing one unpatched `image-size` dependency chain |
| Full dependency audit | Same remaining Netlify chain; patched `sharp`, DOMPurify, and `fast-uri` findings cleared |
| GLB CLI startup | Pass — `gltf-transform` 4.4.2 using `sharp` 0.35.3 |
| Playwright | Pass — 365/365 across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari profiles |

The Astro build still reports the existing large-client-chunk warning. This is a performance follow-up, not a build failure.

## Browser-suite exception resolution

The 54 browser failures represented 11 repeated assertions across the five browser/device profiles. Each assertion was checked against the current implementation rather than being suppressed wholesale.

- One genuine website defect was fixed: the enquiry-page chat launcher now receives its route-specific class in the server-rendered placeholder, so it is hidden on mobile before the optional React chat application loads.
- Admin enquiry tests now open the current collapsed navigation menu.
- The product-hero test now mocks both the active and archived product requests introduced by the current product manager.
- The dashboard recommendation fixture now includes the current lifecycle, order, and inventory-planning fields.
- The performance test now distinguishes the lightweight lazy-chat loader from the optional `SiteChatWidget` application bundle. It still proves that the application bundle is not requested until the launcher is clicked.
- Gallery assertions now use their stated minimum-count contract and the current specification accordion selector.
- Astro preview image checks now recognise `/media/*` as Netlify Blob function-backed media. Those assets remain explicitly scheduled for deploy-preview verification rather than being treated as ordinary static files.

After these changes, all 365 Playwright tests pass across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari profiles.

## Remaining security item

Do not run `npm audit fix --force`. npm currently proposes downgrading `@netlify/blobs` from 10.7.12 to 9.1.5 to remove the report. That is a major rollback of an actively used persistence dependency and is not justified by the current reachability evidence.

Track these upstream packages:

- `@netlify/blobs` 10.7.12
- `@netlify/dev-utils` 4.4.7
- `image-size` 2.0.2

The flagged `image-size` import appears in `@netlify/dev-utils`' test image helper (`getImageResponseSize`). Beyond RV uses `getStore` and `connectLambda` from the main Blobs client. Recheck the audit when Netlify or `image-size` publishes a patched release.

## Safe deployment plan

1. Review the complete working tree and separate the framework upgrade from unrelated configurator/content work if a clean release commit is required.
2. Obtain a deploy-preview build on Netlify using Node 22; do not publish directly to production.
3. On the deploy preview, test the homepage, range pages, a vehicle product, shop/cart, enquiry form, admin login/dashboard, Netlify Blob media, and sitemap.
4. Confirm Netlify Functions can read and write the existing Blob stores without migration or data loss.
5. Run Lighthouse/performance checks and inspect the large configurator/admin bundles separately.
6. Deploy during a monitored window with the previous production deploy available for immediate rollback.
7. After deployment, verify enquiry submission, admin records, media delivery, product routes, structured data, analytics consent, and checkout eligibility.

## Rollback

If the deploy preview or production smoke test fails, restore the previous Netlify deploy first. Code rollback should restore the previous lockfile/package versions, Node 20 setting, legacy content configuration, and legacy content entry APIs together; do not mix Astro 4 packages with the migrated Astro 7 content APIs.

## Reference documentation

- [Astro 5 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v5/)
- [Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/)
- [Astro 7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Netlify Astro framework guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/astro/)
- [`image-size` ICNS denial-of-service advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)
- [`image-size` JXL/HEIF denial-of-service advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)
