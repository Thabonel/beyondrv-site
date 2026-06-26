# SEO and AI Search Daily Progress Report

Plan: `docs/plans/2026-06-04-google-ai-search-growth-plan.md`
Started: 2026-06-04
Owner: Beyond RV
Status: Active

## How to update this report

Add a new daily entry at the top of the `Daily log` section. Keep updates short and factual. Include what changed, what was measured, what is blocked, and what should happen next.

## Current priorities

1. Confirm Google Search Console, Bing Webmaster Tools, Google Business Profile, and Bing Places access.
2. Add sitemap freshness signals such as `lastmod`.
3. Request recrawl of homepage, category pages, calculators, guides, and top product pages.
4. Expand AI crawler policy if Beyond RV wants maximum AI answer visibility.
5. Standardise public brand wording.
6. Upgrade the first commercial pillar page: `Slide-On Campers Queensland`.
7. Begin monthly AI prompt visibility testing.

## KPI snapshot

Update these weekly or when new data is available.

| Metric | Current | Target | Last updated | Notes |
| --- | ---: | ---: | --- | --- |
| Google indexed pages | TBD | All public canonical pages | TBD | Check Search Console |
| Google organic clicks, 28 days | TBD | Increasing | TBD | Check Search Console |
| Google organic impressions, 28 days | TBD | Increasing | TBD | Check Search Console |
| Priority query top-10 count | TBD | Increasing | TBD | Track manually/Search Console |
| Bing AI citations | TBD | Increasing | TBD | Bing AI Performance |
| AI prompt citation count | TBD | Increasing | TBD | Manual monthly test |
| Google Business Profile calls | TBD | Increasing | TBD | GBP performance |
| Google reviews | TBD | Increasing | TBD | Track count and rating |
| Organic enquiries | TBD | Increasing | TBD | Analytics/admin leads |

## Daily log

### 2026-06-04 - Conversational admin tools

Status: Implemented first operational Admin Chat tools.

Completed:

- Expanded Admin Chat beyond file edits.
- Added `list_enquiries` tool so the owner can ask for recent leads or search by name, product, email, phone, or message text.
- Added `update_lead_status` tool so clear lead updates can be saved immediately from chat.
- Added `get_seo_health` tool so the owner can ask for SEO health, sitemap status, crawler access, and weak product listing signals.
- Added Brisbane current-date context for safer follow-up date handling.
- Updated the Admin Chat intro, placeholder, starter prompts, and help copy.

Example owner prompts now supported:

- `Find recent enquiries from John`
- `Mark John as contacted and remind me Friday`
- `Show me weak SEO pages this week`
- `Check SEO health`
- `Show hot leads due for follow-up`

Notes:

- Lead status changes from chat save immediately.
- Site/content file edits from chat still queue to Pending Changes and require preview/deploy.
- If multiple enquiries match a lead update, the assistant is instructed to ask the owner to choose before saving.

Verification:

- `npm run check` passed.
- `npm test` passed.

### 2026-06-04 - Admin SEO tracking implementation

Status: Implemented first dashboard version.

Completed:

- Added `/.netlify/functions/seo-data`, an admin-protected SEO reporting endpoint.
- Added live technical checks for:
  - `robots.txt`
  - `sitemap-index.xml`
  - `sitemap-0.xml`
  - sitemap URL count
  - sitemap `lastmod` presence
  - `llms.txt`
  - OpenAI search crawler access
  - Claude and Perplexity crawler access
- Added sample page metadata checks for priority public pages.
- Added Google Search Console integration scaffolding using service-account credentials.
- Added Bing Webmaster status placeholder for future API wiring.
- Added an SEO section to `/admin/analytics`.

Findings:

- The dashboard can now show useful crawl/technical SEO health without external credentials.
- Google Search Console data will appear after Netlify env vars are configured.
- Bing performance requires follow-up API wiring once the API key and desired metrics are confirmed.

Next actions:

- Add Netlify env vars for Google Search Console:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_PRIVATE_KEY`
  - `GOOGLE_SEARCH_CONSOLE_SITE_URL`
- Add the Google service account as a user in Google Search Console.
- Decide whether to add Claude and Perplexity crawler allow rules to `robots.txt`.
- Add sitemap `lastmod` support.

Verification:

- `npm run check` passed.
- `npm test` passed.

Blockers:

- Search Console and Bing live performance data require verified account/API credentials.

### 2026-06-04

Status: Plan created.

Completed:

- Researched current Google, Bing/Copilot, ChatGPT Search, local SEO, and GEO guidance.
- Inspected the local Astro site structure.
- Checked live crawl surfaces:
  - `https://beyondrv.com.au/robots.txt`
  - `https://beyondrv.com.au/llms.txt`
  - `https://beyondrv.com.au/sitemap-index.xml`
  - `https://beyondrv.com.au/sitemap-0.xml`
- Confirmed the site has a strong base: static HTML, sitemap, robots policy, `llms.txt`, LocalBusiness schema, Product schema, FAQ schema, and guide/calculator pages.
- Created the active strategy document.
- Created this daily progress report.

Findings:

- Google has indexed the domain, but some snippets still show older homepage copy.
- Sitemap entries do not currently include `lastmod`.
- AI crawler allowlist does not explicitly include Claude or Perplexity search crawlers.
- Brand wording appears inconsistent across some content and metadata.
- Product and guide pages need stronger answer-ready text for AI search citations.

Next actions:

- Confirm Search Console and Bing Webmaster access.
- Add sitemap `lastmod`.
- Request recrawl for priority URLs.
- Decide crawler policy for Claude and Perplexity.
- Start upgrading the `Slide-On Campers Queensland` content target.

Blockers:

- Need access confirmation for Google Search Console, Bing Webmaster Tools, Google Business Profile, and Bing Places.

## Monthly AI prompt test log

Run these prompts monthly across Google AI search, ChatGPT Search, Bing/Copilot, Perplexity, and Claude Search where available.

| Date | Engine | Prompt | Beyond RV visible? | Beyond RV cited? | Cited URL | Main competitors | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TBD | TBD | Best slide-on camper builders in Queensland | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Best slide-on campers Australia | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Who builds Unimog camper bodies in Australia? | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Who builds Isuzu NPS camper bodies in Australia? | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Best ute slide-on campers for Australian touring | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Can a dual cab ute carry a slide-on camper? | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Slide-on camper vs off-road caravan | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Best truck campers for remote travel Australia | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Queensland off-road caravan manufacturers | TBD | TBD | TBD | TBD | TBD |
| TBD | TBD | Custom camper body builders Australia | TBD | TBD | TBD | TBD | TBD |

## Backlog

Technical:

- Add sitemap `lastmod`.
- Add IndexNow support for Bing.
- Validate structured data in Rich Results Test.
- Verify crawler access for Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, and PerplexityBot.
- Review whether `llms-full.txt` should include updated product/category summaries.

Content:

- Build or upgrade `Slide-On Campers Queensland` pillar page.
- Add vehicle suitability sections to product pages.
- Add video transcript summaries to product pages.
- Add build case studies.
- Add last updated dates to guides.
- Add author/reviewer trust notes for technical guides.

Local and authority:

- Update Google Business Profile.
- Update Bing Places.
- Start review request workflow.
- Build directory/citation consistency list.
- Pitch off-road, caravan, 4x4, and touring publishers.
- Publish product walkthroughs on YouTube with links back to product pages.
