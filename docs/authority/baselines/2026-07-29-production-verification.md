# Production Verification — 29 July 2026

## Deployment checked

- GitHub merge commit: `fd37b40c83aceb4b6d3ed67cfc909143d64e8e79`
- Netlify production deploy: `6a69a7d41e3ffa00084fbb06`
- Published: 29 July 2026 at 07:13:19 UTC
- Production origin: `https://beyondrv.com.au`

Follow-up deployment:

- GitHub merge commit: `6aba4eb0e4328a1a69dda0ce5894a70d4ac3e2c0`
- Netlify production deploy: `6a69ab548464d000082cc0a8`
- Published: 29 July 2026 at 07:28:06 UTC

## Passed live checks

- Authority routes and their canonical URLs returned `200`.
- Each tested page exposed one canonical organisation schema definition.
- Offer availability values used valid schema.org URLs.
- Approved imported-shell and Mutdapilly completion wording was present.
- Blocked Queensland-manufacturing and origin wording was absent.
- `robots.txt`, `sitemap-index.xml`, `llms.txt` and `llms-full.txt` returned `200`.
- The sitemap contained 33 indexable canonical URLs and material-change timestamps in ISO format.
- The known blog hub and existing product/category legacy redirects resolved in one hop to live pages.

## Resolved follow-up defect

Four legacy URLs targeted `/3-5m-poptop-truck-camper/`, which is now archived and returns `404`:

- `/3-5m-truck-camper`
- `/3-5m-truck-camper/`
- `/15ft-truck-camper-combined-shower-toilet/`
- `/4-6m-poptop-truck-camper-one-off/`

The follow-up changes their destination to `/expedition/`, the closest live category page. This avoids misleading visitors by redirecting them to a different specific product. After deployment, all four URLs were verified to return `301` once and finish on a production `200` response from `/expedition/`.

## External account boundary

Google Search Console and Bing Webmaster credentials are not configured in the local environment. Their reports, sitemap submissions and URL inspections cannot be completed without account-holder access.

## Owner-supplied Lighthouse report

The supplied Lighthouse 9.6.8 report for approved Deploy Preview #9 scored SEO 100, Best Practices 100, Accessibility 97 and Performance 88. Its actionable findings were insufficient white-on-orange contrast, an oversized JPEG CTA background, an oversized navigation logo and imprecise responsive-image sizing. The follow-up separates the accessible dark button orange from the brighter orange used as text on dark surfaces, serves a 61 KB WebP CTA background instead of the 432 KB JPEG, serves a 4.3 KB WebP navigation logo instead of the 29 KB PNG, and supplies more accurate responsive image candidates and sizes.

The PWA score is not treated as a defect because this is a public commerce and information site, not an installable offline application. The report's 2.58 second initial response was measured on a unique Netlify Deploy Preview origin. Three subsequent production-origin checks returned `200` with time-to-first-byte results of 0.64, 0.15 and 0.25 seconds, so the preview result is not attributed to application processing. The reported layout shift had no element attribution in Lighthouse, so it will be retested rather than guessed at.

## Follow-up candidate verification

- `npm run check`: passed with zero errors.
- `npm test`: passed, 118 of 118 tests.
- `npm run build`: passed, 39 pages generated.
- Authority crawl: passed, 39 pages and zero findings.
- IndexNow dry run: passed with the deployed production origin and matching key location; no request sent.
- Redirect configuration assertion: all four retired-product URLs target `/expedition/` with status `301`.
- `git diff --check`: passed.

## Final production verification

- The public IndexNow key file returned `200` with the exact expected value.
- IndexNow accepted all 33 canonical sitemap URLs with HTTP `202`.
- Lighthouse 12.8.2 on the production homepage scored Performance 97, Accessibility 100, Best Practices 100 and SEO 100.
- Production Lighthouse metrics were FCP 2.1 seconds, LCP 2.1 seconds, TBT 0 ms, CLS 0.007 and Speed Index 2.6 seconds.
- The optimized 4.3 KB navigation logo and 61 KB CTA background returned `200` and were referenced by the production homepage.
- Approved imported-shell/Mutdapilly wording was present and blocked manufacturing-origin wording was absent.
