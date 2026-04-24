# ByondRV Website — Phase A PRD

**Project:** ByondRV marketing site rebuild
**Phase:** A — Marketing site, AI admin, site chatbot, content, SEO, launch readiness
**Owner:** ByondRV
**Built by:** Thabo (barter arrangement)
**Status:** Approved (amendments incorporated 2026-04-22)
**Date:** 2026-04-22
**Related docs:** `2026-04-18-executive-summary.md`, Phase B PRD (Stripe checkout — to be rewritten), Phase C PRD (3D configurator — to be rewritten)

---

## 1. Purpose & Scope

### 1.1 Purpose
Rebuild the ByondRV marketing site from WordPress to Astro + Netlify. Phase A covers the public marketing site, the AI-powered admin, the customer-facing chatbot, content structure, SEO, analytics, and launch readiness. Phase A does **not** include real payments (Phase B) or the 3D configurator (Phase C).

### 1.2 Launch strategy
All three phases (A + B + C) will be built before DNS cutover. The current WordPress site remains live throughout the build. No deadline. There is a single launch when all three phases are ready.

### 1.3 What's in scope for Phase A
- Full public site build in Astro (all pages listed in §3)
- AI admin system (chat interface → staging branch → preview → publish)
- Customer-facing site chatbot (text-only, every page)
- Enquiry form (replica of current form + Cloudflare Turnstile)
- Custom analytics dashboard fed by PostHog (owner only ever sees the custom dashboard)
- SEO foundations (structured data, meta, sitemap, robots)
- Performance + accessibility targets met
- Legal pages (Privacy Policy, cookie consent banner)
- Image optimisation via Astro `<Image />` + Netlify Image CDN
- All content-ready placeholders for Phase B and Phase C integration points

### 1.4 What's out of scope for Phase A
- Stripe / real payments (Phase B)
- 3D configurator (Phase C)
- Bilingual / Mandarin support
- Blog, case studies, owner stories (none exist on current site, none to migrate)
- CRM integration
- Email marketing automation
- Customer accounts / login
- Multi-staff admin access
- Any backend beyond the AI admin worker, the chatbot worker, and analytics ingestion

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Astro | Static-first, fast, matches Markdown content model |
| Hosting | Netlify | Client hosting; Deploy Previews solve the staging flow |
| Content | Markdown files in git repo | Simple, version-controlled, AI-editable |
| Styling | Per `mockup.html` (dark theme + orange accent) | Design reference already approved |
| Images | Astro `<Image />` + Netlify Image CDN | Free on Netlify tier; AI admin commits images to repo |
| Forms | Netlify Forms + Cloudflare Turnstile | Free, simple, email delivery, proven spam protection |
| Analytics engine | PostHog Cloud (free tier, hidden) | 1M events/mo free; powers the custom dashboard but the owner never sees PostHog's UI |
| Analytics UI | Custom Astro/React admin route | Owner-friendly metrics view |
| Admin UI | Custom Astro/React admin route with auth | Non-technical UX |
| AI admin worker | Anthropic Claude **Sonnet** | Higher reasoning quality for content edits, safer rewrites |
| Chatbot worker | Anthropic Claude **Haiku** | ~10× cheaper, fast enough, plenty smart for product Q&A |

---

## 3. Site Structure & URL Map

### 3.1 Total pages: 25

**Standard pages (10)**
- `/` — Home
- `/our-caravans/` — Caravan category landing
- `/our-slide-on-campers/` — Slide-on category landing
- `/expedition/` — Expedition Vehicles category (NEW)
- `/on-sale/` — Current stock on sale
- `/custom/` — Custom build enquiry
- `/about-us/`
- `/warranty/`
- `/inquiry-form/` — Standalone enquiry form page
- `/privacy-policy/`

**Caravan product pages (3)**
- `/sunpatch-15xc-couples-offroad-van/` — Existing, preserve URL
- `/sunpatch-19xc-hardtop-couples-offroad-van/` — NEW, Coming Soon
- `/sunpatch-21xf-hardtop-family-offroad-van/` — NEW, Coming Soon

**Slide-on / truck camper product pages (8)** — all existing URLs preserved
- `/advent-2150-hardtop-slide-on/`
- `/advent-2300-hardtop-slide-on/`
- `/advent-2450-hardtop-slide-on/`
- `/7ft-electric-poptop-slide-on/`
- `/4-7m-truck-camper/`
- `/3-5m-poptop-truck-camper/`
- `/3-5m-truck-camper-cabover/`
- `/mercedes-sprinter-motorhome/`

**Expedition product pages (4)** — all NEW
- `/expedition/unimog-overlander-camper/`
- `/expedition/unimog-poptop-camper/`
- `/expedition/isuzu-nps-cabover-camper/`
- `/expedition/isuzu-nps-poptop-camper/`

### 3.2 Navigation structure

**Primary nav (header):**
Home · Our Caravans · Our Slide-On Campers · Expedition Vehicles · On Sale · Custom · About · Contact

**Footer:**
Privacy Policy · Warranty · About Us · Phone (0430 863 819) · Email (beyondcaravans@gmail.com) · Address (77 Coleyville Rd, Mutdapilly QLD 4307)

### 3.3 Redirects (configured in `netlify.toml`)

Three deprecated caravan models redirect (301) to the caravan category page:

| From | To |
|---|---|
| `/12-ft/` | `/our-caravans/` |
| `/15-ft/` | `/our-caravans/` |
| `/sunpatch-12c-couples-caravan/` | `/our-caravans/` |

All existing product URLs that survive are preserved exactly (no redirect needed). Canonical URL tags set per page.

---

## 4. Page Specifications

All pages share: header nav, hero section, dark theme + orange accent, footer with contact + legal, mobile-first responsive layout, structured data per page type, floating chatbot widget. Per-page detail below.

### 4.1 Home (`/`)

**Purpose:** Brand credibility, product overview, funnel visitors to Caravans / Slide-ons / Expedition.

**Sections (top to bottom):**
1. Hero — full-bleed image/video, headline ("Adventure Beyond Limits" or similar), primary CTA "Explore Our Range"
2. Range overview — 3-card grid (Caravans / Slide-Ons / Expedition) linking to each category
3. Featured products — 3-4 cards pulling from on-sale or highlighted products (configurable via admin)
4. Why ByondRV — value props (Queensland-finished, custom, warranty, etc.)
5. Expedition highlight — dedicated callout for the new Expedition range (Unimog/Isuzu), positioned as premium/authentic
6. Social proof — testimonials section is a placeholder for now (no testimonials yet — easy to populate via AI admin once collected)
7. CTA band — "Request a Call Back" → enquiry form
8. Footer

**Structured data:** `Organization` + `WebSite`

### 4.2 Category pages (`/our-caravans/`, `/our-slide-on-campers/`, `/expedition/`)

**Shared layout:**
1. Category hero with short intro copy
2. Product grid — each card shows: image, name, short tagline, key spec (length/weight), "From $X" price or "POA", CTA
3. "Coming Soon" products shown with badge; "Register Interest" CTA pre-fills enquiry form
4. Comparison table (optional, for caravans): model / length / sleeps / TARE / ATM / price

**Expedition page specifics:**
- Founder-credibility block (optional) — possible point-of-contact photo of Alex if available; otherwise a short text intro positioning Beyond RV as builders who actually use what they make
- Clear separation between Unimog products and Isuzu products

**Structured data:** `CollectionPage` with `ItemList` of products

### 4.3 Product pages (single-product, 15 pages)

**Shared layout:**
1. Image gallery (hero + 4-8 thumbnails, lightbox on click)
2. Product name + tagline
3. Price (or "POA" or "Coming Soon")
4. Key specs block — 4-6 headline numbers (length, TARE, sleeps, base, etc.)
5. Full description (markdown content area, editable via AI admin)
6. Full specifications table
7. Features list
8. "Buy Now" CTA **(Phase A: routes to enquiry form with product pre-filled. Phase B: wires to Stripe.)**
9. "Enquire" CTA (always present, alongside Buy Now)
10. Related products (2-3 cards from same category)
11. FAQ accordion (per-product, optional)

**Coming Soon products (19-XC, 21-XF):**
- "Coming Soon" badge prominent
- Price hidden or shown as "POA"
- Primary CTA becomes "Register Interest" (routes to enquiry form, Message pre-filled)
- No Buy Now button
- Spec table may have TBC fields

**Structured data:** `Product` with `offers`, `brand`, `image`, `description`. `FAQPage` if FAQ accordion used.

### 4.4 On Sale (`/on-sale/`)

**Purpose:** Current ready-to-sell stock.
**Content:** Subset of product pages with "In Stock Now" badge and stock count. Same card grid as category pages.
**Admin:** AI admin must be able to toggle products on/off this page via a flag in the product's Markdown front matter.

### 4.5 Custom (`/custom/`)

**Purpose:** Lead capture for custom builds.
**Content:** Value prop, what's possible (slide-ons, truck campers, expedition builds), process overview, gallery of past custom builds, CTA to enquiry form with Message pre-filled ("Custom build enquiry").

### 4.6 About Us (`/about-us/`)

**Content:** Company story, Queensland workshop (Mutdapilly), team, certifications, address, photos of workshop.
**Fix needed:** current site has a generic meta description that doesn't describe About content. Rewrite.

### 4.7 Warranty (`/warranty/`)

**Content:** Full warranty terms. Currently exists on live site — port content across, refresh formatting.
**Fix needed:** current meta description is wrong. Rewrite.

### 4.8 Privacy Policy (`/privacy-policy/`)

**Content:** Australian Privacy Principles compliant. Covers: what data is collected (enquiry form submissions, analytics events, chatbot conversations), how it's used, third parties (PostHog, Anthropic, Netlify Forms, Cloudflare Turnstile), user rights, contact for privacy queries.
**Must be drafted or reviewed by someone qualified** — don't copy-paste from the old site without checking APP compliance.

### 4.9 Enquiry Form (`/inquiry-form/`)

See §5.

### 4.10 404 Not Found (`/404.html` — served by Netlify for any unknown path)

**Tone:** Playful, on-brand, short. ByondRV sells the outdoors — lean into it. No apology spiral, no corporate dead-end. The page should make the visitor smile and then get them somewhere useful in one click.

**Headline (primary option):**
> **Looks like you've gone bush.**

**Sub-copy:**
> This page has wandered off the map. Happens to the best of us. Let's get you back to somewhere with a view.

**Secondary playful lines to rotate (pick one at build, don't overthink):**
- *"No tracks, no signs, no service. Classic."*
- *"Even the Unimog couldn't get here."*
- *"You've found the one place in Australia we haven't built a camper for."*

**Visual:**
- Hero image: one of ByondRV's lifestyle shots — a camper parked somewhere remote, preferably with tyre tracks fading off into nothing. Desaturated slightly so the buttons pop. If no suitable shot is available at launch, use a simple SVG illustration of a dusty signpost with crooked arrows (the AI admin can swap it later with *"Change the 404 image to this shot"*).
- On the page but subtle: small animated dust-trail SVG under the headline (CSS only, respects `prefers-reduced-motion`).

**Primary CTAs (three buttons, stacked on mobile, row on desktop):**
1. **Back to Home** → `/`
2. **Browse Campers** → `/our-slide-on-campers/`
3. **Get in touch** → `/inquiry-form/`

**Below the buttons — "Popular this month":**
A simple 3-card row populated at build time from the top 3 products by PostHog `pageview` count over the last 30 days (falls back to a hand-curated list if analytics data isn't available yet). Each card: product photo, name, "View →".

**Technical requirements:**
- Static HTML generated by Astro (`src/pages/404.astro`) — no JS required to render
- Served via Netlify's default 404 behaviour (no redirect, returns HTTP 404)
- Same header / footer / chatbot widget as the rest of the site
- Logs a PostHog `404_hit` event with the attempted path so the owner can spot broken inbound links in the analytics dashboard
- Meta: `<meta name="robots" content="noindex">` — never show up in search
- Passes the same Lighthouse targets as the rest of the site

**AI admin hooks:**
The owner can ask the admin to rotate the headline or swap the image without touching code — e.g. *"Change the 404 headline to 'You've wandered out of range'"* or *"Use the new Unimog sunset photo on the 404 page"*.

---

## 5. Enquiry Form

### 5.1 Fields (replica of current live form, with copy clarified)

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | Text | Yes | |
| Email | Email | Yes | |
| Message | Textarea | Yes | Pre-filled when coming from product page (see 5.3) |
| Preferred call-back date | Date picker (DD/MM/YYYY, AU format) | Yes | **Copy: "When should we call you?"** — this is when ByondRV phones the customer, not a showroom visit |
| Preferred call-back time | Time picker (HH:MM AM/PM) | Yes | Same — call-back time |

Form intro copy must make clear: "Tell us when's a good time for us to give you a call."

### 5.2 Submission pipeline

1. Client-side validation
2. Cloudflare Turnstile check (invisible mode preferred)
3. Submit via **Netlify Forms** (built-in, free, no code)
4. Netlify emails submission to `beyondcaravans@gmail.com`
5. Thank-you page or inline success state

No CRM, no database — matches current workflow.

### 5.3 Pre-fill logic

When a user clicks "Enquire" or "Buy Now" or "Register Interest" from a product page, route to `/inquiry-form/?product=sunpatch-15xc` (or equivalent). Form pre-fills Message field with: `"I'm interested in the [Product Name]. [Rest of message placeholder for user to complete]"`.

Captured as a hidden `product_interest` field in the Netlify submission so the sales team sees product context even though it's not a visible field.

When the user lands at the form via the chatbot's "Talk to a human" hand-off, the Message field is pre-filled with a short summary of the chat conversation (see §7.5).

### 5.4 Spam protection
Cloudflare Turnstile — invisible challenge, only escalates on suspicious traffic. Free.

### 5.5 Accessibility
All fields keyboard-navigable, proper labels, error messages linked to fields, WCAG 2.1 AA compliant.

---

## 6. AI Admin System

### 6.1 User experience

1. Owner logs into `/admin` (authenticated route)
2. Sees chat interface: "What would you like to change?"
3. Types plain-English instructions, e.g., "Drop the Advent 2450 price to $72,000" or "Upload this new hero image for the Sunpatch 15-XC"
4. AI confirms what it's about to do: "I'll update the Advent 2450 price from $75,000 to $72,000. Continue?"
5. Owner confirms
6. AI commits change to `staging` git branch
7. Netlify Deploy Preview auto-builds (30-90 sec)
8. Staging URL link appears in chat: "Preview ready: https://staging--byondrv.netlify.app/advent-2450-hardtop-slide-on/"
9. Owner clicks link, reviews, comes back
10. Owner clicks "Publish" button in admin
11. Admin merges `staging` → `main`, triggers production build
12. Change is live in ~60 seconds

### 6.2 Architecture

```
[Owner] → [Admin chat UI] → [AI worker (Claude Sonnet)]
                                     ↓
                      [GitHub API: commit to staging branch]
                                     ↓
                      [Netlify: auto-builds Deploy Preview]
                                     ↓
                      [Owner reviews staging URL]
                                     ↓
                      [Owner clicks Publish]
                                     ↓
                      [Admin: merge staging → main via GitHub API]
                                     ↓
                      [Netlify: auto-builds production]
```

### 6.3 Supported operations (Phase A)

Must-have:
- Edit text content on any page (product descriptions, features, headlines, body copy)
- Update product prices
- Toggle product visibility (on-sale flag, coming-soon flag)
- Upload and replace product images (AI commits image to `/src/assets/products/`)
- Add / remove / reorder items in feature lists
- Update meta titles and descriptions
- View and mark enquiry form submissions as read
- Manage chatbot Q&A knowledge entries (see §7.7)

Nice-to-have (defer if time is short):
- Add new product page (from template)
- Bulk operations ("mark all 3 Advent models as $5,000 off for this week")

### 6.4 Safety rails

- Every AI-committed change goes to `staging`, never directly to `main`. No exceptions.
- AI must confirm destructive actions (deletions, big price changes >20%) before committing
- All commits authored by `byondrv-ai@beyondrv.com.au` (or equivalent) for audit trail
- Rollback: any commit in `main`'s history can be reverted via the admin UI (simple "Undo last change" button for the last 5 changes)
- Auth: admin route protected by single-user login (email + password + optional 2FA)
- Rate limit: max 20 AI-executed edits per hour to prevent runaway loops or abuse

### 6.5 Error handling

- If AI doesn't understand the request, it asks a clarifying question rather than guessing
- If the requested change fails (e.g., image upload fails, git commit rejected), AI shows the error in plain English with a "try again" or "contact Thabo" option
- AI never fabricates content — if the owner says "update the Sunpatch 15-XC description with the new features", AI asks what the new features are rather than inventing them

### 6.6 Admin user model

Single-owner login for Phase A. One email + password (with optional 2FA). Account managed via Netlify Identity or equivalent simple auth provider. Multi-user / role-based admin is out of scope for Phase A.

---

## 7. Site Chatbot (Customer-Facing)

### 7.1 Purpose

A floating text-only chat widget on every page that answers product questions in plain English, helps customers find the right camper, and routes qualified leads to the enquiry form.

### 7.2 User experience

- Floating chat bubble bottom-right corner of every page
- Click → slide-out panel (~400px wide on desktop, full-screen on mobile)
- Greeting message: "Hi! I'm the ByondRV assistant. Ask me anything about our campers or caravans."
- If user is on a product page, greeting is contextual: "Got questions about the Sunpatch 15-XC? Ask away."
- User types a question → response streams back in seconds
- "Talk to a human" button always visible at the top of the chat panel

### 7.3 Knowledge

The chatbot knows:
- All product pages (full content, specs, prices) loaded as context
- All FAQ entries
- Brand information (warranty, contact details, location, what makes ByondRV different)
- Page-specific context (the current page the user is on)

The chatbot does NOT know:
- Live stock counts (uses the on-sale flag from product front matter as a proxy)
- Personal customer information
- Anything outside ByondRV products and brand

### 7.4 What it does

- Answers product questions ("What's the payload of the Unimog Overlander?", "Will the Advent 2300 fit a Hilux?")
- Recommends products based on stated needs ("I'm a couple doing the Big Lap — what would suit?")
- Explains warranty, contact methods, brand story
- Hands off to the enquiry form when the customer wants to buy or speak to a person
- Refuses politely when it doesn't know — never fabricates ("I don't have that specific info — I'll connect you with the team")

### 7.5 What it does NOT do

- Take payments (that's the Buy Now button — Phase B)
- Quote custom builds (routes to enquiry form / future configurator)
- Discuss anything off-topic from ByondRV
- Make promises about delivery dates, stock, or finance approval
- Save conversations (stateless — no chat history persists)

### 7.6 Tech

- **Anthropic Claude Haiku** (cheap + fast, plenty smart for product Q&A)
- Stateless conversations (no DB, no chat history)
- Each session: max 30 messages (cost cap, abuse prevention)
- Daily API budget cap (default $20/day, configurable)
- Loads asynchronously — no blocking page render
- Fully accessible (keyboard navigable, screen reader compatible)
- Conversations counted as analytics events (volume, top questions, hand-off rate) — see §8.2

### 7.7 Owner controls (via AI admin)

- "Add this Q&A to the chatbot's knowledge: ..." → creates a structured FAQ entry
- "Don't let the chatbot talk about [topic]" → adds to a guardrails list
- View chatbot analytics in dashboard: total conversations, hand-off rate, common questions, abandonment points

### 7.8 Hand-off to enquiry form

When the user signals intent to buy / speak to someone / unanswered question:
- Chatbot offers: "Want me to set up a call with the team?"
- On confirm: opens the enquiry form with Message pre-filled with a brief summary of the conversation (e.g., *"Customer asked about the Advent 2450 for a 70-Series LandCruiser, particularly payload concerns. Wants a call to discuss."*)
- Pre-fill includes the page they were on and any product they expressed interest in

### 7.9 Cost expectation

Approximately $5-15/month at typical caravan-site traffic levels (Haiku pricing, 30-message session cap, daily budget cap). Far below the cost of a single missed lead.

---

## 8. Analytics Dashboard

### 8.1 Data source

PostHog Cloud, free tier (1M events/month). Captures: pageviews, enquiry submissions, button clicks (Buy Now / Enquire / Register Interest), traffic source (with UTM tracking for YouTube videos), chatbot conversations.

**The owner never sees PostHog's UI.** All data is pulled via PostHog's API and rendered in our own simpler dashboard inside the admin panel.

### 8.2 Custom dashboard UI (inside admin panel at `/admin/analytics`)

Shown KPIs:
- Site visits — last 7 / 30 / 90 days, with trend sparkline
- Enquiry submissions — count + recent list (last 10 with name, product interest, date)
- Top 5 products by page views (last 30 days)
- Traffic sources — Google / Direct / Social / Referral (pie or bar)
- **YouTube source attribution** — which videos drove traffic (via UTM parameters in video description links)
- Conversion rate — enquiry submissions / total sessions
- **Chatbot metrics** — total conversations, hand-off-to-enquiry rate, top 5 questions asked

Rendering: Recharts (or similar lightweight lib) inside Astro/React component. Data fetched server-side from PostHog API to keep auth tokens off the client.

### 8.3 Cookie consent

Banner on first visit: "We use cookies to understand how the site is used. [Accept] [Decline]". Decline = PostHog not loaded, chatbot still works (it doesn't use cookies). Required for Australian Privacy Principles alignment and good practice.

---

## 9. SEO

### 9.1 Structured data (JSON-LD per page type)

| Page type | Schema |
|---|---|
| Home | `Organization`, `WebSite` (with SearchAction) |
| Product pages | `Product` with `offers`, `brand`, `image`, `description`, `aggregateRating` (if reviews exist) |
| Category pages | `CollectionPage` + `ItemList` |
| Custom, About | `WebPage` |
| About Us | `Organization` |
| Contact / Enquiry | `ContactPage` |
| Pages with FAQs | `FAQPage` |

Also site-wide: `LocalBusiness` schema with Mutdapilly QLD address, hours, phone, GeoCoordinates — helps Google Maps / local search.

### 9.2 Meta titles & descriptions

**Every page gets a unique, keyword-targeted title and description — rewritten fresh, not copied from WordPress.** Current site has several pages with duplicated or wrong meta content. Content task during build.

### 9.3 Technical SEO

- `sitemap.xml` auto-generated by Astro at build
- `robots.txt` allows all crawlers
- Canonical URL tags on every page
- Open Graph + Twitter Card meta on every page with product image
- Image alt text on all images (AI admin must enforce this on upload)
- Internal linking: every product page links to its category; category pages link to all products; home links to all categories

### 9.4 Pre-launch SEO tasks

- Obtain Google Search Console access from client, baseline current traffic and queries
- Verify new site in Search Console before DNS cutover
- Submit new sitemap on launch day
- Monitor for 404s and ranking drops in the first 2 weeks post-launch

---

## 10. Performance & Accessibility

### 10.1 Performance targets (Lighthouse)

- Performance: ≥95
- Accessibility: ≥95
- Best Practices: ≥95
- SEO: 100

### 10.2 Implementation

- Astro's static output (no JS on pages that don't need it)
- Netlify Image CDN for all images (AVIF/WebP, responsive sizes, lazy loading)
- No web fonts loaded synchronously
- No render-blocking third-party scripts (PostHog and chatbot loaded async, after consent for PostHog)
- Critical CSS inlined
- Page weight target: <500KB per page including one hero image

### 10.3 Accessibility (WCAG 2.1 AA)

- Semantic HTML throughout
- Keyboard navigation works on every interactive element (including chatbot)
- Visible focus states
- Alt text on all content images (decorative images marked empty alt)
- Colour contrast ≥4.5:1 for body text, ≥3:1 for large text
- Form labels, error states, ARIA where needed
- Test with screen reader (VoiceOver minimum) before launch

---

## 11. Content Requirements (from Client)

Client (ByondRV / via Thabo) supplies, before or during build:

**Per product (×15):**
- Hero image (min 1920×1080, consistent style) — most available from existing site / hard drive
- Gallery images (4-8 per product) — same source
- Full spec sheet — pull from existing site, fill gaps as needed
- Marketing description copy — port from existing site, refresh
- Price (or "POA" confirmed) — from existing site
- Key features list — from existing site

**Expedition range (×4):** all content is new — full workup required. Alex to provide product details, specs, photos.

**General:**
- Updated About Us copy
- Company photos (workshop, team, finished builds) — from hard drive
- Warranty terms (refreshed from current site)
- Privacy policy (APP-compliant, may need legal review)
- Logo in vector format (SVG preferred) — requested from China, ETA TBC
- Brand colour palette confirmation (dark theme + orange accent already in use)
- Optional: photo of Alex as point-of-contact for Expedition page

**Ongoing (client / owner does these):**
- Review and reply to enquiry form submissions (notification goes to `beyondcaravans@gmail.com`)
- Update product availability via AI admin as stock moves
- Add chatbot Q&A entries via AI admin as new common questions emerge

---

## 12. Legal & Compliance

- **Australian Privacy Principles:** Privacy Policy must be compliant; cookie consent banner required
- **Australian Consumer Law:** disclaimers on product pages (warranty rights, voluntary warranty vs statutory rights)
- **Spam Act 2003:** enquiry form submissions imply consent for response only, not marketing; any future marketing emails need explicit opt-in
- **Accessibility:** WCAG 2.1 AA (non-mandatory but best practice and reduces risk)
- **Trading details in footer:** address (77 Coleyville Rd, Mutdapilly QLD 4307), phone, email

---

## 13. Constraints & Dependencies

### 13.1 Client / ByondRV must do

- Provide Google Search Console access
- Provide all content per §11
- Confirm `beyondcaravans@gmail.com` is the address for enquiry form submissions (visible on existing site)
- Review and approve staging versions of each page before they go to main
- Alex to drive the Expedition range content (4 new products)

### 13.2 Build dependencies (Thabo)

- GitHub repo created (private)
- Netlify account connected, site configured
- Cloudflare account for Turnstile
- PostHog Cloud account (free tier)
- Anthropic API key for AI admin worker (Sonnet) and chatbot worker (Haiku)
- Domain DNS access ready for cutover day (not changed until all phases complete)

### 13.3 External dependencies

- Netlify: hosting, forms, image CDN, deploy previews
- Cloudflare: Turnstile spam protection
- PostHog: analytics engine
- Anthropic: Claude API (Sonnet for admin, Haiku for chatbot)
- GitHub: content + code storage

---

## 14. Launch Checklist (Phase A portion)

Phase A is "launch-ready" when all of these are green. Actual DNS cutover waits for Phase B + C to also be launch-ready.

- [ ] All 25 pages built and content-complete
- [ ] All existing URLs preserved; 3 redirects configured and tested
- [ ] Enquiry form tested end-to-end (submission lands at `beyondcaravans@gmail.com`)
- [ ] Cloudflare Turnstile active and tested
- [ ] AI admin functional: edit text, edit price, upload image, publish flow all working
- [ ] Site chatbot functional: answers product questions accurately, hands off to enquiry form correctly, respects daily budget cap
- [ ] Analytics dashboard showing real data from PostHog
- [ ] Cookie consent banner working
- [ ] Lighthouse ≥95 on Performance, Accessibility, Best Practices; 100 on SEO
- [ ] Structured data validated (Google Rich Results Test, all page types)
- [ ] Sitemap generated; robots.txt correct
- [ ] All meta titles and descriptions unique and keyword-appropriate
- [ ] Image alt text on every image
- [ ] WCAG 2.1 AA spot-check with screen reader
- [ ] Mobile layout reviewed on real devices (iOS Safari, Android Chrome)
- [ ] 404 page designed and live
- [ ] Google Search Console verified on new site
- [ ] Client has reviewed and approved every page on staging

---

## 15. Open Items & Assumptions

These need decisions or confirmation during build:

1. **Founder-credibility block on Expedition page** — pending decision/photo from Alex; placeholder until then
2. **Privacy Policy** — draft from scratch or commission a quick legal review
3. **Logo SVG** — pending from China; build can proceed with PNG until SVG arrives

All other prior open items resolved:
- ABN: not required (not on existing site)
- Showroom CTA: clarified — it's a call-back, copy updated
- Testimonials: none currently, placeholder
- T&Cs: not separate; covered by Privacy Policy + Warranty + About Us
- Admin user model: single owner login confirmed
- WordPress freeze: not required
- Anthropic model: Sonnet for admin, Haiku for chatbot
- Finance calculator / trade-in: out of Phase A; backlog

---

## 16. Success Criteria

Phase A is successful if:

- Owner can update any page text, price, or image without Thabo's involvement, using the AI admin, and see changes live in ≤2 minutes from publish
- Owner can add / edit chatbot Q&A entries via AI admin and the chatbot reflects the change immediately
- Site chatbot answers product questions accurately based on real product content and hands off cleanly to enquiry form when needed
- New site launch (alongside Phase B + C) preserves or improves current SEO ranking for the existing URLs
- Lighthouse scores are green across the board
- Enquiry form submission rate (per visitor) is equal or better than current WordPress site in the first 30 days post-launch
- No production incidents (downtime, data loss, failed publishes) in the first 30 days

---

*End of Phase A PRD.*
