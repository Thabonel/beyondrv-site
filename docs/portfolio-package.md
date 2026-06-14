# Beyond RV — Portfolio Package for Nel Innovation Labs

## Quick Reference

| | |
|---|---|
| **Client** | Beyond RV (beyondrv.com.au) |
| **Industry** | RV manufacturing — slide-on campers, caravans, expedition vehicles |
| **Location** | Mutdapilly, Queensland, Australia |
| **Live URL** | https://beyondrv.com.au |
| **GitHub** | github.com/Thabonel/beyondrv-site |
| **Timeline** | April – June 2026 (~8 weeks) |
| **Commits** | 192 |

---

## Project Summary

Full website rebuild for Beyond RV, a Queensland manufacturer of slide-on campers, off-road caravans, and expedition vehicles. Migrated from a legacy WordPress site to a modern Astro static site with an AI-powered admin system, customer chatbot, and owner copilot for lead management.

**The site serves two audiences:**
1. **Customers** — browsing products, checking specs, asking the AI chatbot questions, submitting enquiries
2. **The owner (Alex)** — managing products, inventory, leads, site content, and business knowledge through an AI-assisted admin panel

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Astro 4.16 (static site generation) |
| Interactive islands | React 18 |
| Hosting | Netlify (serverless functions + CDN) |
| AI/LLM | OpenAI (GPT-5 Nano, GPT-5 Mini) |
| Analytics | PostHog |
| Image CDN | Netlify Image CDN |
| Persistence | Netlify Blobs (9 stores) |
| Email | Resend API |
| Integrations | Google OAuth (Gmail + Drive), YouTube Data API |
| Testing | Playwright (e2e), Node test runner |
| CSS | Custom design system (CSS custom properties) |

---

## Key Features Built

### 1. AI Customer Chatbot
- Public-facing chatbot on every page
- Page-aware — knows which product the customer is viewing
- Injects full product catalogue + business knowledge into every prompt
- Handles ~2,900+ impressions/month from Google Search
- Prompt attack detection, session caps, handoff to enquiry form
- Mobile keyboard adaptation via Visual Viewport API
- PostHog analytics on every interaction with topic classification

### 2. AI Admin Assistant
- Admin-only chat interface with 6 tools (function calling via OpenAI)
- Can read/write site files through GitHub API
- Safety judge system — every proposed file change is evaluated by a second AI before queuing
- Judge decisions: allow, block, revise, escalate
- Pending changes → review → deploy → Netlify rebuild pipeline
- SEO health checks, lead management, product editing

### 3. Owner Copilot (Lead Intelligence)
- Automatic lead scoring (0-100) based on enquiry content
- AI classification: priority (hot/warm/info-only/spam), intent, urgency
- AI email draft generation with guardrail validation
- Google Gmail + Drive integration (OAuth, read-only sync)
- Match suggestions linking emails/files to customer records
- Weekly reports, daily lead summary emails
- Full audit trail on every action

### 4. Product Management System
- 16 product entries with full frontmatter (pricing, specs, galleries, videos)
- Build-time catalogue compilation into JSON for AI injection
- Status management (available, on-sale, coming-soon)
- Media upload with Netlify Blob storage
- Order/inventory tracking
- Structured data (JSON-LD) for SEO

### 5. AI Search Discovery
- Custom `robots.txt` with explicit AI crawler rules (OpenAI, Claude, Perplexity, Apple, CommonCrawl)
- Auto-generated `llms.txt` and `llms-full.txt` from product catalogue
- Sitemap with `lastmod` dates for AI crawlers
- The site ranks #1-2 for brand queries in Google and appears in ChatGPT search results

### 6. Performance Optimization
- Mobile Lighthouse score: 83 → improved with non-blocking fonts, deferred JS, optimized images
- Desktop Lighthouse score: 94+
- HTML overflow-x protection for mobile
- CSS-based animations with `will-change` and `transform` (GPU composited)
- Responsive image pipeline with 400/480/800/1200 width variants
- Custom cursor animation (desktop only, disabled on mobile/tablet)

### 7. Knowledge Management
- Canonical business knowledge stored in `chatbot-knowledge.md`
- Admin can edit via Knowledge tab in admin panel
- AI Rewrite feature — paste rough notes, AI formats into clean dot points
- Build script compiles knowledge + product data into JSON injected into every chatbot prompt
- Construction/engineering specs, brand positioning, chatbot tone rules, legal guardrails

---

## Architecture Highlights

### Serverless Backend (49 Netlify Functions)
- Customer chatbot, admin chat, image serving, contact form handling
- Lead management, enquiry responses, weekly reporting
- Google OAuth flow (Gmail + Drive sync)
- Product editing, media management, order tracking
- AI guardrails, product knowledge context builder
- SEO health monitoring, analytics data aggregation
- 9 Netlify Blob stores for persistence (no database needed)

### Safety & Guardrails
- Two-layer AI safety: judge evaluates every file change
- AI output guardrails: regex validation blocking unsupported claims (pricing, warranty, fitment, compliance)
- Prompt attack detection on public chatbot
- Admin authentication with HMAC-SHA256 tokens (8-hour expiry)
- All admin actions audited to blob store

### Build Pipeline
```
Product Markdown → build-product-catalogue.mjs → catalogue.json + knowledge.json + llms.txt
→ astro build → static HTML/CSS/JS → Netlify deploy
```

---

## Pages Built

- Homepage (hero, range grid, story, process, trust, FAQ, CTA)
- Product category pages (slide-on campers, caravans, expedition, custom)
- 16 individual product pages with spec tables, galleries, video embeds
- About us, warranty, privacy policy, enquiry form
- On-sale stock page
- Interactive tools: slide-on weight calculator, caravan towing calculator, vehicle suitability checker
- Technical guides: GVM/GCM/ATM/GTM explained, best utes for slide-on campers
- Admin dashboard with analytics
- Admin panel (chat, knowledge, products, orders, enquiries, media, leads, reports)

---

## Screenshots (Suggested)

For the portfolio, capture these:
1. **Homepage** — full hero section with "Built For Where Roads End"
2. **Product page** — Advent 2150 or Sunpatch 15-XC showing spec table + gallery
3. **Chatbot widget** — open on mobile showing a product conversation
4. **Admin panel** — Knowledge tab or Pending Changes tab
5. **Admin chat** — showing the AI proposing a file change
6. **Mobile view** — homepage scrolled on a phone

---

## Metrics

| Metric | Value |
|---|---|
| Products managed | 16 (4 slide-on, 4 caravan, 8 expedition) |
| Serverless functions | 49 |
| Blob stores | 9 |
| Google Search impressions (28 days) | 2,958 |
| Google Search clicks (28 days) | 141 |
| Brand query position | #1-2 |
| Desktop Lighthouse | 94 |
| Mobile Lighthouse | 83 (targeting 90+) |
| ChatGPT search appearance | Confirmed (cited as #1 for QLD Unimog campers) |

---

## Developer Notes

If adding this to a portfolio site:

1. **Live URL**: https://beyondrv.com.au
2. **Repo** (if sharing): github.com/Thabonel/beyondrv-site (private — share access as needed)
3. **Key files to highlight**:
   - `netlify/functions/admin-chat.ts` — AI admin assistant with tool calling + safety judge
   - `netlify/functions/site-chat.ts` — customer chatbot with product knowledge injection
   - `netlify/functions/owner-copilot-core.ts` — lead intelligence scoring
   - `src/components/AdminPanel.tsx` — 3,700-line admin panel with chat, knowledge, pending, deploy
   - `src/components/SiteChatWidget.tsx` — customer chat widget with mobile keyboard adaptation
   - `SCRIPTS/build-product-catalogue.mjs` — build-time catalogue + knowledge + llms generator
   - `netlify/functions/ai-guardrails-core.ts` — regex validation blocking risky AI outputs

4. **Notable technical decisions**:
   - Chose Astro over Next.js for static-first approach (RV site doesn't need SSR)
   - Used OpenAI Responses API (not Chat Completions) for tool calling
   - No database — everything persisted in Netlify Blobs (simpler, cheaper, no cold starts)
   - Safety judge is itself an AI model evaluating another AI's proposals
   - llms.txt auto-generated at build time to stay in sync with products
