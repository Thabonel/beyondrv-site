# Authority Programme Preview Deployment Plan

Prepared: 29 July 2026
Current source branch: `staging`

## Deployment outcome

Deploy Preview #9 was approved and merged in GitHub. Production deploy `6a69a7d41e3ffa00084fbb06` published main commit `fd37b40c83aceb4b6d3ed67cfc909143d64e8e79` successfully on 29 July 2026. The production authority gate passed except for four legacy redirects whose destination product had since been archived; the follow-up change redirects those URLs to the live Expedition category instead.

## Safety boundary

Do not deploy from the current working tree. It contains unrelated documentation deletions, contract/SignWell work and generated Playwright report changes.

Create a clean `codex/authority-phase-0-1-preview` worktree or branch from the intended `staging` commit, then transfer only reviewed authority hunks and new authority files. Do not use `git add -A`, and do not switch the current dirty working tree to a new branch as a substitute for isolation.

## Review and transfer scope

Use `docs/authority/PHASE-0-1-IMPLEMENTATION-BACKLOG.md` as the primary allowlist. Include the additional origin-claim corrections in:

- `src/pages/about-us/index.astro`
- `src/pages/custom/index.astro`
- `src/pages/expedition/index.astro`
- `src/pages/index.astro`
- `src/data/chatbot-knowledge.md`
- `netlify/functions/chatbot-knowledge.json`
- `src/data/homepage/recent-builds.json`
- the single recent-build default tag change in `src/components/AdminPanel.tsx`
- `src/data/sitemapDates.js`
- `SCRIPTS/audit-authority.mjs`

Hunk-review any file that also contains pre-existing work. In particular, do not assume the whole sale-terms draft, generated knowledge files, homepage, admin panel or project documentation can be staged safely without inspection.

Explicitly exclude unrelated documentation deletions, `playwright-report/index.html`, contract/SignWell function work and any other path not supported by the backlog or claim register.

## Pre-preview verification

Run in the clean isolated tree:

```bash
npm ci
npm run check
npm test
npm run build
npm run audit:authority -- --out docs/authority/baselines/2026-07-29-preview-candidate-crawl.json
git diff --check
```

Expected local result: 39 built pages, 118 passing tests, zero Astro errors, and zero authority-audit findings.

Review the isolated diff and staged file list before committing. The owner confirmed that caravan and camper shells are imported, then completed at the Beyond RV workshop in Mutdapilly; retain that exact distinction throughout the preview.

## Preview deployment

Only after explicit user approval:

1. Push the isolated `codex/authority-phase-0-1-preview` branch.
2. Create a Netlify branch/Deploy Preview from that branch, not a production deploy.
3. Record the preview URL and deployed commit SHA in `docs/authority/programme-tracker.csv`.

Do not submit sitemaps, request indexing or use IndexNow for a preview URL.

## Live preview checks

Check the preview deployment for:

- `/blog/` redirects once to `/guides/`.
- `/guides/` and both published guide pages return `200`.
- canonical URLs continue to point to the intended production URLs.
- the sitemap contains controlled material-change dates rather than deployment timestamps.
- each public page has one canonical `https://beyondrv.com.au/#organization` entity.
- Offer availability values use schema.org URLs and unsupported shipping/returns defaults remain absent.
- no blocked Queensland-origin wording appears in rendered public HTML or chatbot knowledge.
- desktop and mobile navigation expose Guides and the guide hub has no horizontal overflow.

## Production gate

The approved isolated preview was deployed to production. Redirect, sitemap, canonical, structured-data and public wording checks were repeated against `https://beyondrv.com.au`; results are recorded in `baselines/2026-07-29-production-verification.md`.

Search Console and Bing actions remain separate external steps requiring account access. The owner authorised the post-production follow-through; IndexNow can be submitted only after the matching public key file in the follow-up deployment is live.
