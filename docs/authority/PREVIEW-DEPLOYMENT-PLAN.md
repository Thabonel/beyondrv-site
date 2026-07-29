# Authority Programme Preview Deployment Plan

Prepared: 29 July 2026
Current source branch: `staging`

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

Expected local result: 40 built pages, 108 passing tests, zero Astro errors, and zero authority-audit findings.

Review the isolated diff and staged file list before committing. The owner’s product-origin answer may be applied before preview if available; otherwise retain the conservative wording already present.

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

Production remains blocked until the isolated preview is approved. After production deployment, repeat the redirect, sitemap, canonical, structured-data and crawl checks against `https://beyondrv.com.au`.

Search Console, Bing and IndexNow actions remain separate external steps requiring the relevant access and explicit authorisation. IndexNow must remain a dry run until its matching public key file is deployed.
