# Handover: Beyond RV Slide-On Camper Authority Programme

**Handover date:** 29 July 2026
**Repository:** `/Users/thabonel/Code/Byond_RV`
**Current branch:** `staging`
**Status:** Phases 0 and 1 are locally implemented as far as possible without external accounts, production deployment or one remaining owner clarification.

## Start here

The controlling strategy is:

- `docs/BYONDRV-SLIDE-ON-CAMPER-AUTHORITY-IMPLEMENTATION-GUIDE.md`

The implementation record is:

- `docs/authority/PHASE-0-1-IMPLEMENTATION-BACKLOG.md`
- `docs/authority/BLOCKERS.md`
- `docs/authority/VERIFICATION.md`
- `docs/authority/PREVIEW-DEPLOYMENT-PLAN.md`
- `docs/authority/claim-evidence-register.csv`
- `docs/authority/programme-tracker.csv`

Do not repeat the repository investigation or rebuild the backlog. Continue from these records.

## Owner-confirmed facts

The owners confirmed the following on 29 July 2026:

1. The public brand is **Beyond RV**.
2. Beyond RV has **15 years of RV experience**.
3. Every caravan, camper and motorhome Beyond RV completes is built to the applicable **Australian Design Rule requirements** and receives **Queensland gas and 240V electrical certification**.
4. Beyond RV provides a **five-year construction warranty**. Individual appliances retain their **manufacturer warranties**.

The legal seller identity was extracted from the approved contract-generator record:

- **Legal seller:** Passion Industries Pty Ltd
- **ABN:** 45 145 189 297

These facts have been applied to the website, AI knowledge files, schema identity and authority evidence records.

## One owner answer still required

The earlier question about what Beyond RV does for each product range was unclear. Ask only this:

> For the caravan and camper shells, which is correct: (a) made at Mutdapilly, (b) imported and then completed at Mutdapilly, or (c) it differs by model? If it differs, list each model/range and choose (a) or (b).

Until answered, do not publish claims such as “Queensland built”, “manufactured in Queensland” or “100% Queensland finished”. The unconfirmed claims have been removed or narrowed in the main public pages.

## Work completed

### Programme controls and evidence

- Created the dependency-ordered Phase 0–1 backlog.
- Created the programme tracker, claim/evidence register, blocker register and legacy URL register.
- Created a short owner-confirmation record.
- Recorded genuine external and owner blockers separately.

### Technical authority foundation

- Established a canonical Beyond RV organisation identity and reused its schema ID.
- Standardised visible public branding from ByondRV/Byond RV to Beyond RV.
- Removed unsupported merchant-schema defaults and normalised availability values.
- Replaced blanket sitemap build timestamps with controlled material-change dates.
- Added a repeatable authority crawl audit, including a regression check for blocked Queensland-origin wording.
- Added a safe, dry-run-first IndexNow submission utility.

### Guide and internal-link foundation

- Added `/guides/` as the authority hub.
- Connected the two published guides, vehicle checker and weight/towing calculators.
- Added guide navigation and contextual internal links.
- Added a permanent `/blog/` to `/guides/` hub redirect without guessing old article redirects.
- Updated `llms.txt` and `llms-full.txt`; the catalogue generator was also changed so deployment does not overwrite these additions.

### Owner facts applied

- Updated homepage, About, warranty, category and footer claims.
- Updated product warranty labels on seven relevant products.
- Updated chatbot and generated AI knowledge.
- Added the legal seller name and ABN to the canonical identity/schema.
- Updated the sale-terms legal-review draft with the owner-confirmed warranty position.
- Regenerated and visually checked the seven-page Word version of the sale terms. It remains a **solicitor-review draft and is not approved for customer use**.

### Customer handover data form

The short, one-page printable customer pickup form is:

- `docs/BEYOND-RV-SLIDE-ON-HANDOVER-DATA-QUESTIONNAIRE.docx`

Its writing areas do not use underscore lines, and publication-permission questions were intentionally omitted.

## Principal implementation files

The main authority-programme files are:

- `SCRIPTS/audit-authority.mjs`
- `SCRIPTS/submit-indexnow.mjs`
- `SCRIPTS/build-product-catalogue.mjs`
- `src/data/siteIdentity.js`
- `src/data/sitemapDates.js`
- `src/pages/guides/index.astro`
- `src/pages/guides/best-utes-for-slide-on-campers/index.astro`
- `src/pages/guides/gvm-gcm-atm-gtm-explained/index.astro`
- `src/components/BaseHead.astro`
- `src/components/Header.astro`
- `src/components/Footer.astro`
- `src/layouts/ProductLayout.astro`
- `src/lib/structuredData.js`
- `src/pages/index.astro`
- `src/pages/about-us/index.astro`
- `src/pages/custom/index.astro`
- `src/pages/expedition/index.astro`
- `src/pages/our-slide-on-campers/index.astro`
- `src/pages/our-caravans/index.astro`
- `src/pages/warranty/index.astro`
- `src/data/homepage/recent-builds.json`
- `src/data/chatbot-knowledge.md`
- `public/llms.txt`
- `public/llms-full.txt`
- `netlify.toml`
- `package.json`

The exact broader file-by-file mapping is in `docs/authority/PHASE-0-1-IMPLEMENTATION-BACKLOG.md`.

## Verification completed

All final local checks passed on 29 July 2026:

| Check | Result |
|---|---|
| `npm run check` | Passed: 0 errors; 61 informational hints from existing code |
| `npm test` | Passed: 108/108 |
| `npm run build` | Passed: 40 pages built; sitemap generated |
| Authority crawl audit | Passed: 40 pages; zero findings |
| Stale claim search | Passed for the removed Queensland-built/finished and old experience/warranty wording in public sources |
| `git diff --check` | Passed |

The broader Playwright suite previously produced 254 passes and 26 failures caused by existing product-media, stale gallery assertions and a 320px shop overflow. Details are in `docs/authority/VERIFICATION.md`; these are not Phase 0–1 authority defects.

## Genuine blockers

Do not represent these as completed:

1. Google Search Console access/export and production indexing submissions.
2. Bing Webmaster Tools access/export and production sitemap inspection.
3. Recovery of old article URLs from historical search/CMS/backlink data.
4. The remaining owner clarification about shell origin and manufacturing scope.
5. Production redirect, sitemap and schema verification after deployment.
6. Live IndexNow submission after a public key file is deployed.
7. Google Business Profile and other external citation reconciliation.

The authoritative details and smallest next action for each are in `docs/authority/BLOCKERS.md`.

## Git and deployment warning

Nothing from this task has been pushed or deployed by this handover step.

The `staging` working tree contains many pre-existing modified, deleted and untracked files from other work, including contract/SignWell work and documentation cleanup. Do **not** stage everything with `git add -A`, do not restore deleted files, and do not create a production commit until the authority files have been isolated and reviewed.

A safe continuation is:

1. Review `git status --short` and the Phase 0–1 backlog file map.
2. Review the authority-related diff only.
3. Obtain the one remaining owner answer and update claim C-005/C-009.
4. Decide whether to isolate this work on a `codex/` branch or make a carefully scoped commit on the intended branch.
5. Push to a preview/staging deployment first.
6. Run live redirect, sitemap, canonical and schema checks.
7. Only then merge/deploy to production and perform search-engine submissions.

## Commands for the next task

```bash
cd /Users/thabonel/Code/Byond_RV
npm run check
npm test
npm run build
npm run audit:authority -- --out docs/authority/baselines/2026-07-29-local-crawl.json
git diff --check
```

IndexNow must remain a dry run until the public key is deployed and the user explicitly authorises submission:

```bash
npm run authority:indexnow -- /guides/ /our-slide-on-campers/
```

## Recommended next task prompt

> Read `docs/HANDOVER-SLIDE-ON-AUTHORITY-PHASE-0-1.md`, then read the linked backlog, blocker and verification records. Preserve all unrelated working-tree changes. Apply the owner's product-origin answer if available, review only the authority-related diff, and prepare a safely scoped preview deployment plan. Do not push, merge, deploy or submit URLs without explicit approval.
