# ByondRV Website Rebuild — Executive Summary

**For:** ByondRV Ownership
**Prepared:** 18 April 2026 (revised 22 April 2026 to match approved PRD)
**Status:** Phase A PRD approved — full plan also covers Phase B (online payments) and Phase C (3D configurator)

---

## The Headline

We are rebuilding **beyondrv.com.au** as a modern, AI-search-ready selling machine — with one feature no competitor in the Australian RV market has: **the owner can update products, prices, copy, and stock status by simply typing what they want changed**, with no developer needed.

The new site will be faster, rank higher in Google, appear in ChatGPT and Google AI Overview answers, capture more qualified leads, and give ByondRV a real-time dashboard showing exactly which YouTube videos, Google searches, and pages drive sales — plus a customer-facing chatbot that answers product questions 24/7 and hands hot leads straight to the enquiry form.

---

## Why Now

The current WordPress site is invisible to AI search, slow to update, and offers no visibility into what's actually working. Every change requires a developer. There's no way to see which YouTube videos drive enquiries, which campers get the most attention, or to react quickly when a competitor moves.

The market has shifted. AI search (ChatGPT, Perplexity, Google AI Overviews) is now where serious buyers research $80k+ purchases. Sites that aren't optimised for AI answers are invisible. ByondRV needs to be the answer when someone asks *"best slide-on camper for a Unimog in Australia."*

---

## How We're Building It — One Site, Three Phases of Capability

The site is built and launched as a **single cutover**. Phase B and Phase C are capabilities that bolt onto the same site once Phase A is live and proven.

### Phase A — Marketing Site, AI Admin, Chatbot, Analytics
The complete new website with all 25 pages, fully optimised for Google + AI search, with:
- Working enquiry form routed to `beyondcaravans@gmail.com`
- Custom analytics dashboard (live inquiry inbox, traffic sources, YouTube attribution, conversion data)
- AI admin chat — owner types changes in plain English, site updates in ~30 seconds
- Customer-facing chatbot answering product questions and handing leads to the enquiry form
- "Buy Now" buttons present as placeholders, routing to the enquiry form until Phase B activates them

### Phase B — Stripe Online Payments
Customers can pay a 30% deposit, full price, or apply for finance from any in-stock product page. Already specced (`2026-04-17-buy-now-prd.md`) as a Netlify Function on the same site — no separate build, no migration. Activated once ByondRV's Stripe account is set up.

### Phase C — 3D Slide-On Camper Configurator
A browser-based 3D model where customers design their own slide-on camper, see live price and weight, and pay a deposit to lock in the build. **First in the Australian market.** Already specced (`2026-04-17-3d-configurator-prd.md`). Significant build — runs once Phase A and B are stable, in parallel with a 3D artist producing the model.

---

## What Pages Are Included

**Standard pages (10):** Home, About, Inquiry Form, On Sale, Custom Builds, Privacy Policy, Warranty, Terms, Thank You, plus a 404.

**Caravans (3):** the curated list of caravan models that survive the cull (final selection confirmed by ByondRV).

**Slide-On Campers (8):** the full current slide-on range.

**Expedition Slide-On (4):** the new flagship expedition product — its own dedicated section with up to 4 specification / use-case pages to position ByondRV as the serious off-grid option.

**Total: 25 pages.** Three legacy URLs (`/12-ft`, `/15-ft`, `/sunpatch-12c`) redirect cleanly to `/our-caravans/` so existing Google rankings are preserved.

---

## The Headline Features

### 1. *"Just Type What You Want Changed"*
The owner logs in and types things like:
- *"Add a new slide-on called Outback Pro at $89,000, sleeps 4, 180kg payload, queen bed, diesel heater"*
- *"Drop the price on the Sunpatch 15-XC by $5,000"*
- *"Mark the 3.5m cabover as sold"*
- *"Update the Unimog page hero photo to this new shot"* (drag and drop)

The AI generates the page, updates the data, commits the change, and the site is rebuilt and live in about 30 seconds. No HTML, no clunky CMS, no waiting for a developer. Every change goes via a Deploy Preview the owner can review before promoting.

### 2. AI Search Ready From Day One
Every page includes the structured data (FAQ schema, Product schema, LocalBusiness schema, Organization schema) that makes pages **3.2× more likely to appear** in Google AI Overviews. Content is written in the question-and-answer format AI search engines reward. ByondRV becomes the answer when buyers ask AI for slide-on camper recommendations.

### 3. Real Analytics That Matter
A custom dashboard built for ByondRV — not a dump of someone else's tool. Shows:
- Which YouTube videos drive the most traffic (and which aren't pulling weight)
- Which products get attention vs. which actually convert
- Where visitors come from, what they click, where they drop off
- A live inquiry inbox — every lead with notes, status, and follow-up tracking

PostHog runs invisibly underneath as the engine; the owner only ever sees the clean ByondRV dashboard. Free at our traffic level.

### 4. Customer-Facing Site Chatbot
A floating chat widget on every page. Powered by Claude Haiku (cheap, fast). Knows every product spec, price, dimension, and FAQ from the markdown content. Answers buyer questions in real time, qualifies the lead, and offers to pre-fill the enquiry form with a conversation summary so the owner gets context, not just a name.

Cost-controlled: 30 messages per session, daily spend cap, auto-handoff to the enquiry form if it can't help.

### 5. Fast, Beautiful, Mobile-First
Built on Astro — the same technology behind some of the fastest sites on the web. Loads in under a second, looks pixel-perfect on phone and desktop, scores 95+ on Google's performance test (the threshold that affects search ranking). WCAG 2.1 AA accessibility throughout.

---

## How We Launch Without Risk

The current site stays live and untouched throughout the build. The new site is built at a private Netlify preview URL — no public access, no SEO risk, no impact on current operations.

When the owner has reviewed and approved every page, we do a single DNS switch on launch day. The new site goes live, the old site is taken down. The SiteGround backup of the WordPress site stays available for ~30 days as a safety net.

---

## What's Out of Scope for Phase A (and Why)

| Item | Why deferred |
|------|--------------|
| Customer login accounts | Nothing for a customer to do once logged in until Phase B (Buy Now). Adds time for zero current value. |
| Live online payments | That's Phase B. Decoupling launch from Stripe avoids being blocked by business verification, T&Cs, and bank setup. |
| Multi-staff admin logins | Single owner password is the right call now. Multi-user system is easy to add when there's a second user. |
| Real inventory database | Markdown files (edited via AI chat) handle 25 products perfectly. A database adds cost and complexity with no current benefit. |

---

## What ByondRV Needs to Provide

To begin the build:
1. **Logo files** — high resolution, ideally vector (SVG)
2. **Photo library** — clean product shots and lifestyle photography
3. **Final caravan list** — confirm which 3 caravans survive the cull
4. **Product specifications and current pricing** for each unit to be carried over
5. **Founder photo / Alex photo** for the Expedition section
6. **Privacy Policy review** — confirm or supply current text
7. **Stripe account** (for Phase B — can wait)
8. **One round of content review** at the preview URL before launch

---

## What Happens Next

This document, together with:
- `2026-04-22-phase-a-prd.md` (approved)
- `2026-04-17-buy-now-prd.md` (Phase B, approved in concept)
- `2026-04-17-3d-configurator-prd.md` (Phase C, approved in concept)

is the complete plan. Phase A is approved; build begins immediately. Phase B activates once Stripe is set up. Phase C kicks off once A and B are stable and the 3D artist brief is signed off.

---

*Questions, requested changes, or further approvals — reply to this document and we'll proceed accordingly.*
