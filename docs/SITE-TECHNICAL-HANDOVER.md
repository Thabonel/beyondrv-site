# Beyond RV Website Technical Handover

Last updated: 2026-06-05

This document is a technical map of the Beyond RV website for future developers. It explains how the site is built, where data lives, how pages are generated, how Netlify functions work, what environment variables are needed, and what to watch when making changes.

This file lives under `docs/`, which is ignored by Git in this repo. It is intentionally a local handover document.

## Executive Summary

The site is a static Astro 4 website deployed to Netlify. Public pages are mostly Astro-rendered static HTML. React is used only where browser interactivity is needed: admin dashboards, the chat widget, cookie consent, analytics setup, and product optional-extras configuration.

Product pages are generated from Astro content collection Markdown files in `src/content/products/`. The shared product page UI is `src/layouts/ProductLayout.astro`; category/listing pages filter the same collection and render `ProductCard.astro` cards.

Netlify Functions provide dynamic backend behavior:

- Contact/enquiry submission and email delivery.
- Admin authentication and admin dashboards.
- AI site chat.
- AI-assisted admin editing and response generation.
- Lead status, customer orders, and media storage through Netlify Blobs.
- PostHog analytics and Google Search Console reporting.

The public build is static, but functions and Blobs make admin, forms, chat, and media dynamic in production.

## Tech Stack

- Runtime/build: Node, Astro 4, Vite.
- UI: Astro components plus React 19 islands.
- Styling: one global stylesheet, `src/styles/global.css`, with CSS custom properties.
- Content: Astro content collections using Markdown frontmatter validated by Zod in `src/content/config.ts`.
- Hosting: Netlify static deploy with Netlify Functions.
- Storage: Netlify Blobs for enquiries, lead status, customer orders, and uploaded media.
- Email: Resend API.
- AI: OpenAI API.
- Analytics: PostHog browser analytics and PostHog API for admin dashboards.
- Search data: Google Search Console service account API plus robots/page checks.
- Testing: Node test runner for pure JS logic and Playwright for end-to-end browser/layout coverage.

## Important Commands

Run from repo root:

```bash
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4321
npm test
npm run test:e2e
npm run check
npm run images:optimize
node SCRIPTS/build-product-catalogue.mjs
node SCRIPTS/audit-mobile-overflow.mjs http://127.0.0.1:4321
```

Netlify runs:

```bash
node SCRIPTS/build-product-catalogue.mjs && npm run build
```

The catalogue script must run before build because `site-chat` imports generated JSON under `netlify/functions/`.

## Repository Structure

```text
src/
  components/         Astro and React UI components
  content/products/   Product Markdown content collection
  data/               Chatbot and homepage JSON data
  layouts/            Shared page and product layouts
  lib/                Shared helpers
  pages/              Astro route files
  styles/global.css   Main stylesheet

netlify/functions/    Backend functions
public/               Static assets served from site root
SCRIPTS/              Build, audit, and image scripts
tests/e2e/            Playwright tests
test/                 Node unit tests
docs/                 Local docs/assets, ignored by Git
```

Several old-source asset folders exist in the repo root. Most are intentionally ignored by `.gitignore` and should not be treated as active source unless specifically needed.

## Build and Deployment

The site is configured in `astro.config.mjs`:

- `site` is `https://beyondrv.com.au`.
- `output` is `static`.
- output directory is `dist`.
- integrations: `@astrojs/sitemap` and `@astrojs/react`.
- sitemap excludes `/admin/`, `/admin/analytics/`, `/inquiry-form/success/`, and `/404.html`.

Netlify is configured in `netlify.toml`:

- Build command: `node SCRIPTS/build-product-catalogue.mjs && npm run build`.
- Publish directory: `dist`.
- Node version: 20.
- Functions directory: `netlify/functions`.
- Several legacy redirects map old URLs to current product/category pages.
- `/media/*` is rewritten to `/.netlify/functions/media-serve?key=:splat`.
- Long-lived caching is set for `/_astro/*`, `/images/*`, `/wp-content/uploads/*`, and favicon files.
- Security headers include `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.

## Routing

Astro pages:

- `/` from `src/pages/index.astro`
- `/our-slide-on-campers/`
- `/our-caravans/`
- `/on-sale/`
- `/expedition/`
- Product routes from `src/pages/[...slug].astro`
- Expedition product routes from `src/pages/expedition/[slug].astro`
- `/inquiry-form/` and `/inquiry-form/success/`
- `/vehicle-suitability-checker/`
- `/slide-on-camper-weight-calculator/`
- `/caravan-towing-calculator/`
- `/custom/`
- `/about-us/`
- `/warranty/`
- `/privacy-policy/`
- `/guides/gvm-gcm-atm-gtm-explained/`
- `/guides/best-utes-for-slide-on-campers/`
- `/admin/`
- `/admin/analytics/`
- `/404.html`

Product route split:

- `src/pages/[...slug].astro` renders all product Markdown entries that do not start with `expedition/`.
- `src/pages/expedition/[slug].astro` renders product Markdown entries whose collection slug starts with `expedition/`, stripping the prefix for the route param.

Both dynamic product routes pass the product entry to `ProductLayout.astro`.

## Layouts and Shared Page Shell

### `BaseLayout.astro`

All public pages use `src/layouts/BaseLayout.astro`.

Responsibilities:

- Imports global CSS.
- Renders `BaseHead`, `Header`, `Footer`.
- Renders custom desktop cursor elements.
- Captures `ref`, `utm_source`, `utm_medium`, and `utm_campaign` from URL query parameters into localStorage for 30 days.
- Loads React islands:
  - `CookieConsent`
  - `PostHogProvider`
  - `SiteChatWidget`
- Runs reveal-on-scroll animation setup using `IntersectionObserver`.
- Runs custom cursor animation on non-touch devices.

Props:

- `title`, `description`, `image`, `type`, `noIndex`, `canonicalUrl`
- `structuredData`
- `preloadImage`
- `activePath`
- `productTitle`
- `productSlug`

### `BaseHead.astro`

`src/components/BaseHead.astro` emits:

- Charset and viewport.
- Page title and meta description.
- Optional noindex.
- Canonical URL.
- Favicons and apple touch icon.
- Optional image preload.
- Open Graph and Twitter metadata.
- Google font preconnect/import.
- Provided structured data.
- Site-wide LocalBusiness/AutomotiveBusiness schema for Beyond RV.

### `Header.astro`

Header nav links:

- Our Caravans
- Slide-Ons
- Expedition
- Suitability
- On Sale
- Custom
- About

The mobile hamburger toggles `.nav-links.open` and updates `aria-expanded` and `aria-label`. Mobile CSS makes the menu a fixed panel below the header. When editing header CSS, run the mobile layout Playwright tests because small stacking/overflow changes can break iPhone behavior.

### `Footer.astro`

Footer contains brand, social/contact, product, company, and legal/navigation links. It uses global footer styles.

## Product Content System

Products live in `src/content/products/**/*.md`.

Current product Markdown files:

- `3-5m-diy-camper-box-with-cabover-and-underfloor-storage.md`
- `3-5m-poptop-truck-camper.md`
- `7ft-electric-poptop-slide-on.md`
- `advent-2150-hardtop-slide-on.md`
- `advent-2300-hardtop-slide-on.md`
- `advent-2450-hardtop-slide-on.md`
- `mercedes-sprinter-motorhome.md`
- `sunpatch-12c-couples-caravan.md`
- `sunpatch-15xc-couples-offroad-van.md`
- `sunpatch-19xc-hardtop-couples-offroad-van.md`
- `sunpatch-21xf-hardtop-family-offroad-van.md`
- `expedition/3-5m-electric-poptop-cabover-family-camper.md`
- `expedition/4-7m-hardtop-truck-camper.md`
- `expedition/blue-unimog-overlander-camper.md`
- `expedition/unimog-overlander-camper.md`
- `expedition/unimog-poptop-camper.md`

Schema is defined in `src/content/config.ts`.

Required fields:

- `title`
- `category`: one of `caravan`, `slide-on`, `expedition`
- `tagline`
- `price`
- `heroImage`
- `gallery`
- `keySpecs`

Optional/defaulted fields:

- `priceBadge`
- `status`: `available`, `on-sale`, or `coming-soon`
- `onSale`
- `featured`
- `specs`
- `specGroups`
- `features`
- `faq`
- `relatedSlugs`
- `youtubeVideo`
- `seoTitle`
- `seoDesc`
- `canonicalUrl`

`youtubeVideo` supports:

- `id`
- `title`
- `description`
- `thumbnail`
- `uploadDate`
- `duration`
- `startSeconds`
- `transcriptSummary`

### Product Page Rendering

`src/layouts/ProductLayout.astro` builds the full product detail page:

- Product structured data.
- Breadcrumb schema.
- FAQ schema when FAQ exists.
- Video schema when YouTube video exists.
- Responsive hero/gallery with thumbnails.
- Gallery prev/next controls.
- Product title, tagline, status, price, key specs, and CTAs.
- Markdown body slot.
- Optional video walkthrough.
- Specifications accordion from `specGroups`; fallback to flat `specs`.
- Optional extras React configurator for non-coming-soon products.
- Features list.
- FAQ accordion.
- Final enquiry CTA band.

Client-side script handles:

- Gallery image switching.
- Gallery prev/next.
- Product FAQ accordion.
- Expand/collapse all specification groups.

### Product Cards

`src/components/ProductCard.astro` renders product cards for category/listing pages. It uses `displayImageUrl` and `imageSrcSet` from `src/lib/media.ts`.

## Listing and Marketing Pages

### Homepage

`src/pages/index.astro` is the largest marketing page. It pulls:

- product collection via `getCollection('products')`
- `src/data/homepage/recent-builds.json`
- `src/data/homepage/testimonials.json`

Important homepage sections:

- Full-screen hero.
- Moving ticker.
- Range overview.
- Featured products.
- Story/why Beyond RV.
- Expedition highlight.
- Build process.
- Trust cards.
- Recent builds and fitouts.
- Testimonials.
- FAQ.
- CTA.

Homepage width/mobile behavior has been sensitive in the past. Do not paper over overflow with only `overflow-x: hidden`. Use `SCRIPTS/audit-mobile-overflow.mjs` and Playwright mobile tests to find the real offender. Common causes are viewport-width units, fixed widths, large transformed elements, and grid/flex children that do not have `min-width: 0`.

### Category Pages

Category pages generally filter products from the content collection:

- `our-slide-on-campers`: slide-on products.
- `our-caravans`: caravan products.
- `expedition`: expedition products.
- `on-sale`: products marked on sale or sale status.

These pages share global grid/card styles.

### Guides and Calculator Pages

The suitability checker and calculators are static Astro pages with client-side scripts. Shared calculation logic for vehicle suitability lives in `src/lib/vehicleSuitabilityCalculator.js`, with tests in `test/vehicleSuitabilityCalculator.test.js`.

The vehicle suitability page has intentionally horizontally scrollable tables. These are wrapped with `.authority-table-wrap`, which the mobile overflow audit treats as an allowed scroller.

## Images and Media

Public assets are served from `public/` and are referenced with site-root paths like `/images/site/logo.png`.

### Image Helper

`src/lib/media.ts` provides:

- `displayImageUrl(src, width, fit)`
- `imageSrcSet(src, widths)`
- `thumbImageUrl(src)`

Behavior:

- Optimized product images under `/images/optimized/products/` use local WebP variants when they exist.
- For `/media/`, `/images/`, and `/wp-content/uploads/` paths, it returns Netlify Image CDN URLs like `/.netlify/images?url=...&w=...&fit=...`.
- Thumbnail URLs for optimized product images use `-thumb.webp`.

### Product Image Optimization

`SCRIPTS/optimize-product-images.mjs` scans product Markdown image references under `/wp-content/uploads`, `/images/products`, and `/images/site`, converts source files to WebP variants using Sharp, updates Markdown references when `--write` is used, and writes a report to `docs/reports/product-image-optimization-report.json`.

Command:

```bash
npm run images:optimize
```

This runs:

```bash
node SCRIPTS/optimize-product-images.mjs --write
```

### Dynamic Media Uploads

Admin-uploaded media is stored in Netlify Blobs store `product-media` and served through:

```text
/media/* -> /.netlify/functions/media-serve?key=:splat
```

Relevant functions:

- `admin-media.ts`
- `admin-media-upload.ts`
- `media-serve.ts`

## Forms and Enquiries

The public form is `src/pages/inquiry-form/index.astro`.

Fields include:

- name
- email
- phone
- message
- callback date/time
- self-reported referral source
- optional referral source detail
- hidden product, intent, referral, and UTM fields
- honeypot `bot-field`

The page reads query params:

- `product`
- `name`
- `intent`
- `message`

Product and optional-extras CTAs prefill the enquiry form using these params.

Submit flow:

1. The form intercepts submit in browser JavaScript.
2. It POSTs JSON to `/.netlify/functions/contact-submit`.
3. On success it redirects to `/inquiry-form/success/`.
4. On failure it leaves the user on the page and shows an error plus phone fallback.

`contact-submit.ts`:

- validates/sanitizes payload
- blocks honeypot submissions
- sends email using Resend
- stores enquiry backup in Netlify Blobs store `customer-enquiries`

Admin lead status is stored separately in `customer-lead-status`.

## Chatbot

Browser UI: `src/components/SiteChatWidget.tsx`

Backend: `netlify/functions/site-chat.ts`

Build-time knowledge:

- `SCRIPTS/build-product-catalogue.mjs` generates:
  - `netlify/functions/product-catalogue.json`
  - `netlify/functions/chatbot-knowledge.json`
- Source knowledge file:
  - `src/data/chatbot-knowledge.md`

Frontend behavior:

- Product pages pass `productSlug` and `productName` through `BaseLayout`.
- Chat opens as a floating widget on desktop.
- On mobile, the open panel becomes full viewport height using `100dvh` and adjusts for keyboard using `visualViewport`.
- Chat is hidden on the enquiry form when closed to avoid blocking form controls.
- "Talk to a human" opens the enquiry form with a message summary.
- Session cap is 30 messages.
- Timeout is 45 seconds.

Backend behavior:

- Uses OpenAI Responses API.
- Default model comes from `OPENAI_CHAT_MODEL`, falling back to `gpt-5-nano`.
- Streams data events to the frontend.
- Captures chat events to PostHog if capture key is configured.

## Admin Area

Admin pages:

- `src/pages/admin.astro`
- `src/pages/admin/analytics.astro`

Admin React components:

- `AdminPanel.tsx`
- `AdminDashboard.tsx`
- `AnalyticsDashboard.tsx`

Admin API helper:

- `src/lib/adminApi.ts`
- Reads `brv_admin_token` from localStorage.
- Sends token as `x-admin-token`.

Authentication:

- `admin-login.ts` displays a login form and stores an admin token in localStorage.
- `admin-auth.ts` validates password/token/cookie.
- `ADMIN_PASSWORD` is required for admin access.
- `ADMIN_COOKIE_SECRET` improves token signing; if missing, check current function behavior before changing auth logic.

Admin functions:

- `admin-products.ts`: product data API.
- `admin-product-edit.ts`: creates product edit proposals using GitHub file APIs.
- `admin-deploy.ts`: commits AI/admin file changes to GitHub.
- `admin-chat.ts`: AI admin assistant for site changes and operational admin tasks.
- `admin-dashboard.ts`: aggregate enquiries, lead status, analytics, SEO, readiness, and insights.
- `admin-enquiries.ts`: list enquiry records.
- `admin-manual-enquiry.ts`: create admin-entered enquiries.
- `admin-lead-status.ts`: update/read lead status.
- `admin-orders.ts`: customer order tracking.
- `admin-classify-enquiry.ts`: AI lead classification.
- `admin-generate-enquiry-response.ts`: AI response draft generation.
- `admin-daily-lead-summary.ts`: sends lead summary emails.
- `admin-media.ts` and `admin-media-upload.ts`: list/delete/upload product media.
- `admin-contact-config.ts`: reports contact/email configuration readiness.
- `analytics-data.ts`: PostHog query endpoint.
- `seo-data.ts`: Google Search Console and SEO crawler checks.
- `knowledge-rewrite.ts`: AI rewrite helper for chatbot knowledge.

Be careful with admin file-editing functions. They write via GitHub APIs using `GITHUB_TOKEN`, `GITHUB_REPO`, and `GITHUB_BRANCH`, so production changes can be created from the admin UI.

## Netlify Blob Stores

Blob helper: `netlify/functions/blob-store.ts`

It connects using Netlify event blob context where available, or explicit env config:

- `NETLIFY_BLOBS_CONTEXT`
- `NETLIFY_BLOBS_SITE_ID`
- `NETLIFY_SITE_ID`
- `SITE_ID`
- `NETLIFY_BLOBS_TOKEN`
- `NETLIFY_AUTH_TOKEN`

Stores used:

- `customer-enquiries`
- `customer-lead-status`
- `customer-orders`
- `product-media`
- `customer-lead-reminder-email-logs`

The helper returns safe diagnostic messages for unavailable Blob storage. Many admin endpoints degrade with warnings when Blobs are missing, rather than crashing the entire dashboard.

## Analytics

Browser analytics:

- `PostHogProvider.tsx`
- Uses `PUBLIC_POSTHOG_KEY`.
- Host: `https://us.i.posthog.com`.
- Starts only after cookie consent is accepted.
- Captures `enquiry_submitted` on `/inquiry-form/success/`, merging referral and UTM localStorage data.

Server/admin analytics:

- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID`
- `analytics-data.ts`
- `admin-dashboard.ts`

Chat event capture:

- `POSTHOG_CAPTURE_KEY` or fallback `PUBLIC_POSTHOG_KEY`
- `POSTHOG_CAPTURE_HOST`, defaulting to `https://us.i.posthog.com`

Cookie consent key:

- `brv_cookie_consent`

Referral/UTM localStorage keys:

- `brv_referral`
- `brv_utm`

## Environment Variables

Variables currently referenced by the app/functions:

- `ADMIN_PASSWORD`
- `ADMIN_COOKIE_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_ADMIN_MODEL`
- `OPENAI_JUDGE_MODEL`
- `OPENAI_ADMIN_CLASSIFY_MODEL`
- `OPENAI_ADMIN_RESPONSE_MODEL`
- `OPENAI_MARKETING_INSIGHTS_MODEL`
- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`
- `LEAD_REMINDER_TO_EMAIL`
- `LEAD_REMINDER_TIMEZONE`
- `PUBLIC_POSTHOG_KEY`
- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_CAPTURE_KEY`
- `POSTHOG_CAPTURE_HOST`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SEARCH_CONSOLE_SITE_URL`
- `BING_WEBMASTER_API_KEY`
- `NETLIFY_BLOBS_CONTEXT`
- `NETLIFY_BLOBS_SITE_ID`
- `NETLIFY_BLOBS_TOKEN`
- `NETLIFY_SITE_ID`
- `NETLIFY_AUTH_TOKEN`
- `SITE_ID`

Operationally important groups:

- Contact email: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`.
- Admin auth: `ADMIN_PASSWORD`, `ADMIN_COOKIE_SECRET`.
- AI: `OPENAI_API_KEY` and optional model overrides.
- Admin GitHub editing: `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`.
- Analytics: `PUBLIC_POSTHOG_KEY`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`.
- Netlify Blobs: normally provided by Netlify runtime; explicit envs are fallback/local support.
- Search Console: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SEARCH_CONSOLE_SITE_URL`.

## Styling System

All public-site CSS is in `src/styles/global.css`.

Root tokens include:

- colors: `--black`, `--dark`, `--panel`, `--border`, `--orange`, `--orange2`, `--tan`, `--cream`, `--muted`, `--white`
- fonts: `--font-heading`, `--font-body`, `--font-accent`
- layout: `--nav-height`, `--max-width`, `--gutter`

Major class areas:

- reset and base typography
- cursor
- container and nav
- hero/page hero
- buttons, badges
- section headers
- ticker
- product grid and product pages
- specifications/accordion
- optional extras
- story/process/gallery/trust/FAQ/CTA
- forms
- authority/suitability content
- footer
- workshop gallery/build process/testimonials
- chat widget
- responsive media queries

Responsive rules are mostly at `max-width: 1024px`, `768px`, and `640px`. Avoid adding rigid one-off iPhone width breakpoints. Use fluid layout fixes: `minmax(0, 1fr)`, `min-width: 0`, `max-width: 100%`, wrapping, and intentional scroll containers.

## Mobile Overflow and Hamburger Notes

There have been repeated iPhone horizontal scroll issues. The preferred workflow is:

1. Build/preview the site.
2. Run `node SCRIPTS/audit-mobile-overflow.mjs http://127.0.0.1:4321`.
3. Run Playwright mobile layout tests.
4. Fix the actual overflowing component, not just the body.

Current safeguards:

- `html` and `body` use `overflow-x: clip` with fallback hidden.
- Tables that must scroll are wrapped in `.authority-table-wrap`.
- Moving ticker elements are intentionally clipped.
- Mobile header has an interaction test for hamburger open/close at iPhone widths.

Recent hamburger fix:

- `Header.astro` hamburger is `type="button"`.
- It updates `aria-expanded` and `aria-label`.
- Mobile `.nav-links.open` is `position: fixed` below the nav.
- Hamburger has a minimum 44px tap target and explicit stacking.
- Regression test is in `tests/e2e/mobile-layout.spec.ts`.

## Tests

### Node Unit Tests

`npm test` runs Node's built-in test runner.

Current JS unit test:

- `test/vehicleSuitabilityCalculator.test.js`

### Playwright E2E

Config: `playwright.config.ts`

Projects:

- `chromium-desktop`
- `firefox-desktop`
- `webkit-desktop`
- `mobile-chrome`
- `mobile-safari`

The Playwright web server command is:

```bash
npm run preview -- --host 127.0.0.1 --port 4321
```

Important mobile layout tests:

- no root horizontal overflow across key pages at 320px
- homepage cannot be horizontally panned at iPhone widths
- mobile header fits at iPhone widths
- hamburger menu opens and closes at iPhone widths
- chat panel fills mobile viewport and hides launcher while open
- authority tables stay inside intentional scroll area
- enquiry form hides the floating chat launcher on mobile

When changing CSS, header, chat, product layout, tables, or cards, run the mobile layout tests.

### Manual Verification

Useful local flow:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4321
node SCRIPTS/audit-mobile-overflow.mjs http://127.0.0.1:4321
npx playwright test tests/e2e/mobile-layout.spec.ts --grep "homepage cannot|mobile header fits|hamburger menu opens"
```

## Generated Files

Generated but committed/used:

- `netlify/functions/product-catalogue.json`
- `netlify/functions/chatbot-knowledge.json`

Generated/ignored:

- `dist/`
- `.astro/`
- `playwright-report/`
- `test-results/`
- most `docs/` content

Do not manually edit generated catalogue JSON unless you know the build script will preserve it. Source of truth is product Markdown and `src/data/chatbot-knowledge.md`.

## Git Ignore Notes

`.gitignore` ignores:

- `docs/`
- `dist/`
- `.astro/`
- `node_modules/`
- `.netlify/`
- `.playwright-mcp/`
- old source asset folders
- large local image/design files
- many product source image folders

Because `docs/` is ignored, this handover document will not appear in normal `git status`.

## Common Development Tasks

### Add or Edit a Product

1. Add/edit Markdown under `src/content/products/`.
2. Ensure frontmatter matches `src/content/config.ts`.
3. Put expedition products under `src/content/products/expedition/`.
4. Use `/images/optimized/products/...` for optimized assets where possible.
5. Run `node SCRIPTS/build-product-catalogue.mjs`.
6. Run `npm run build`.
7. Test the product page and relevant category page.

### Change Homepage Sections

1. Edit `src/pages/index.astro`.
2. For recent builds/testimonials, prefer editing:
   - `src/data/homepage/recent-builds.json`
   - `src/data/homepage/testimonials.json`
3. Run build and mobile layout tests.
4. Watch for horizontal overflow from grids, images, ticker, or fixed-width content.

### Change Contact Form Behavior

1. Edit `src/pages/inquiry-form/index.astro` for frontend fields/prefill.
2. Edit `netlify/functions/contact-submit.ts` for backend validation/email/storage.
3. Keep field names in sync.
4. Confirm Resend env vars in Netlify.
5. Test form success and failure behavior.

### Change Chat Behavior

1. UI: `src/components/SiteChatWidget.tsx`.
2. Backend/model prompt: `netlify/functions/site-chat.ts`.
3. Knowledge source: `src/data/chatbot-knowledge.md`.
4. Product catalogue source: `src/content/products/`.
5. Run `node SCRIPTS/build-product-catalogue.mjs`.
6. Test streaming response and Talk-to-human flow.

### Change Admin Dashboard

1. UI: `src/components/AdminPanel.tsx`, `AdminDashboard.tsx`, `AnalyticsDashboard.tsx`.
2. API helper: `src/lib/adminApi.ts`.
3. Backend: matching `netlify/functions/admin-*.ts` endpoint.
4. Check admin auth behavior.
5. Check Blob store availability and graceful degradation.

### Change Images

1. Prefer product Markdown image references to optimized WebP assets.
2. Use `SCRIPTS/optimize-product-images.mjs --write` for batch conversion.
3. Check `src/lib/media.ts` behavior before changing image URL conventions.
4. Verify image paths exist in `public/`.

## High-Risk Areas

- Mobile layout/header: test iPhone widths after any nav/global CSS changes.
- Product content schema: invalid frontmatter fails builds.
- Admin GitHub functions: can write production changes through GitHub.
- Netlify Blobs: local runtime may not have Blobs unless configured; production usually provides context.
- Contact form/email: depends on Resend verified sender and env vars.
- Chat/admin AI: depends on OpenAI env and generated catalogue files.
- Image references: product pages can silently show broken images if Markdown points to missing public assets.
- `docs/` is ignored: do not place source files there if they must deploy.

## Deployment Checklist

Before deploying non-trivial changes:

1. `npm run build`
2. `npm test`
3. Run focused Playwright tests for touched areas.
4. If product/chat data changed, ensure `node SCRIPTS/build-product-catalogue.mjs` ran.
5. If CSS/header/layout changed, run mobile layout tests and overflow audit.
6. Check `git status --short` and stage only intended files.
7. Do not commit ignored local reports or old asset folders.

## Current Business/Brand Constants

Public business details embedded in metadata and contact areas:

- Name: Beyond RV
- Alternate name: Beyond Caravans
- Phone: `0430 863 819` / `+61430863819`
- Email fallback: `beyondcaravans@gmail.com`
- Address: `77 Coleyville Rd, Mutdapilly QLD 4307`
- Site URL: `https://beyondrv.com.au/`
- Socials:
  - YouTube: `https://www.youtube.com/@beyondrvcampers4129`
  - Facebook: `https://www.facebook.com/BeyondCaravans`
  - Instagram: `https://www.instagram.com/beyondrvaus/`

If business details change, search the whole repo. They appear in schema, footer/contact copy, functions, and form fallbacks.

