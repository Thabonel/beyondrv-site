# Beyond RV — Buy Now Feature
## Product Requirements Document (Phase B)

**Date:** 2026-04-17 (rewritten 2026-04-22 for new Astro + Netlify stack)
**Status:** Approved — implementation deferred until Phase A is live
**Owner:** ByondRV (build by Thabo)
**Depends on:** `2026-04-22-phase-a-prd.md` (marketing site, AI admin, Netlify hosting)

---

## 1. Problem Statement

Beyond RV sells high-value truck campers and motorhomes online but currently has no way for a customer to transact on the website. Interested buyers must contact the business and wait for a callback, creating friction and drop-off. Competitors increasingly offer online purchase initiation.

The goal is to allow customers browsing in-stock inventory to begin a purchase immediately — via a deposit, full payment, or finance application — without leaving the website or waiting for a callback.

This PRD describes the bolt-on to the Phase A site. Phase A ships with placeholder "Buy Now" buttons routing to the enquiry form; Phase B replaces those placeholders with the real Stripe flow specified below.

---

## 2. Goals

| Goal | Success Metric |
|------|---------------|
| Reduce time-to-first-payment for in-stock units | Customer can pay deposit within 5 minutes of landing on a product page |
| Increase conversion of in-stock browsing sessions | Track deposit + full payment completions per month in PostHog |
| Offer finance as a first-class option | Finance calculator visible on every in-stock product |
| Minimal operational overhead | ByondRV staff receive a single email per transaction — no manual Stripe setup per unit |
| Owner can change deposit % without code | `DEPOSIT_PERCENT` editable via AI admin chat |

---

## 3. Scope

### In Scope
- "Pay Deposit" button (default 30% of unit price) via Stripe Checkout
- "Buy Now — Full Price" button (100% of unit price) via Stripe Checkout
- "Finance This Camper" panel with repayment calculator and broker link
- Buy Now buttons on inventory grid cards and individual product pages
- Stock status gating via Markdown frontmatter (`status: in-stock | sold | on-order`)
- Email notification to ByondRV on successful payment (Stripe webhook → Netlify Function → email)
- Customer receipt via Stripe (built-in)
- Astro `/thank-you/` confirmation page
- PostHog event tracking for the full funnel
- Cloudflare Turnstile on the checkout endpoint (block headless bots)

### Out of Scope
- Customer accounts or purchase history
- Inventory management / automatic stock status updates (owner toggles via AI admin)
- Refund processing (handled manually via Stripe dashboard)
- Finance application processing (handled entirely by broker)
- Multiple currencies (AUD only)
- Buy Now Pay Later (Afterpay etc.) — not appropriate for $80k+ items
- Apple Pay / Google Pay configuration beyond Stripe Checkout defaults

---

## 4. User Stories

### Buyer — Deposit
> As a customer who has found a camper I want to reserve,
> I want to pay a holding deposit online immediately,
> so that I can secure the unit before someone else buys it.

**Acceptance Criteria:**
- I can see the deposit amount (30% of price) clearly displayed before clicking
- I am taken to a Stripe-hosted checkout page with the unit name and deposit amount
- After payment I see a confirmation page telling me ByondRV will contact me within 1 business day
- I receive a Stripe receipt to my email
- ByondRV receives an email with my name, email, unit, and amount paid

### Buyer — Full Purchase
> As a customer who is ready to buy outright,
> I want to pay the full price online,
> so that I can complete the purchase without back-and-forth.

**Acceptance Criteria:**
- I can see the full price clearly before clicking Buy Now
- Stripe checkout shows the full unit price with the unit name
- Confirmation page and email receipt are identical to the deposit flow (with "full payment" wording)
- ByondRV is notified immediately

### Buyer — Finance
> As a customer who wants to finance,
> I want to see estimated repayments for this specific unit,
> so that I can understand the weekly cost before applying.

**Acceptance Criteria:**
- Clicking "Finance This Camper" reveals a panel without navigating away from the page
- I can enter an optional deposit amount and the loan amount updates in real time
- I can select a 3, 5, or 7 year loan term
- I can see estimated weekly repayments based on ~9.5% p.a.
- A clear disclaimer states repayments are indicative only
- "Apply Now" opens Yes Caravan Loans in a new tab

### Owner — Operations
> As the ByondRV owner,
> I want to be notified instantly when a deposit or full payment is received,
> so that I can contact the buyer and arrange next steps.

**Acceptance Criteria:**
- Email arrives at `beyondcaravans@gmail.com` within 2 minutes of successful payment
- Email includes: customer name, customer email, unit name, amount paid, payment type (deposit / full), Stripe payment ID
- No action in Stripe dashboard is needed to set up a new unit for sale

### Owner — Maintenance
> As the ByondRV owner updating inventory,
> I want stock status to control whether buy buttons appear,
> so that sold units never show an active Buy Now button.

**Acceptance Criteria:**
- Setting a unit to "Sold" or "On Order" via the AI admin chat (e.g. *"Mark the Sunpatch 15-XC as sold"*) disables all buy buttons within 30 seconds of deploy
- Sold/On-Order units show the appropriate badge in place of the buttons
- No code changes required

---

## 5. Functional Requirements

### 5.1 Button Display Rules

| Frontmatter `status` | Deposit Button | Buy Now Button | Finance Panel |
|----------------------|---------------|----------------|---------------|
| `in-stock` | Active | Active | Active |
| `sold` | Replaced by "Sold" badge | Hidden | Hidden |
| `on-order` | Replaced by "On Order" badge | Hidden | Hidden |
| `coming-soon` | Hidden | Hidden | Hidden — show "Register Interest" link to enquiry form |

### 5.2 Deposit Calculation

- Deposit = `unit_price × DEPOSIT_PERCENT` (rounded to nearest dollar)
- Default `DEPOSIT_PERCENT` = 0.30
- Stored in `src/data/site-config.yaml` (single value, AI-editable)
- Example: $78,999 × 0.30 = $23,699.70 → displayed as $23,700
- Displayed on the button: `Pay Deposit $23,700`

### 5.3 Stripe Checkout — Dynamic Pricing

No Stripe products are pre-created. Each Checkout Session is created on demand by a Netlify Function.

**Frontend → backend request:**
```
POST /api/checkout
Content-Type: application/json
X-Turnstile-Token: <token>

{
  "unit_slug": "3-5m-cabover",
  "type": "deposit" | "full"
}
```

> The frontend sends only the slug and intent. **Price is read server-side from the markdown source of truth, never trusted from the client** — eliminates the "customer changes price in dev tools" attack.

**Function behaviour (`netlify/functions/checkout.ts`):**
1. Verify Cloudflare Turnstile token
2. Look up the product by slug from the bundled JSON manifest (built at deploy time from `src/content/products/*.md`)
3. Reject if `status !== "in-stock"`
4. Calculate amount: `deposit = price × DEPOSIT_PERCENT`, `full = price`
5. Create Stripe Checkout Session:
   - `line_items[0].price_data.unit_amount` = amount in cents (AUD)
   - `line_items[0].price_data.currency` = `"aud"`
   - `line_items[0].price_data.product_data.name` = `"<Unit Name> — <Deposit | Full Payment>"`
   - `mode` = `"payment"`
   - `metadata` = `{ unit_slug, type, unit_name }`
   - `success_url` = `https://beyondrv.com.au/thank-you/?unit=<slug>&type=<type>&session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url` = referring page URL (sent in request)
   - `payment_intent_data.description` = `"<Unit Name> (<Deposit | Full Payment>)"`
6. Return `{ "url": "https://checkout.stripe.com/..." }`
7. Frontend redirects with `window.location.href = url`

**Security:**
- `STRIPE_SECRET_KEY` set as Netlify env var, scoped to functions only
- Server-side price lookup (no client-supplied amounts)
- Cloudflare Turnstile blocks scripted abuse
- Rate limit: 5 checkout creations / IP / minute (in-memory bucket on the function)

### 5.4 Stripe Webhook Handler

`POST /api/stripe-webhook` — Netlify Function

1. Verify signature using `STRIPE_WEBHOOK_SECRET`
2. On `checkout.session.completed`:
   - Extract `metadata.unit_slug`, `metadata.type`, `metadata.unit_name`
   - Extract `customer_details.email`, `customer_details.name`, `amount_total`, `payment_intent`
   - Send email to `beyondcaravans@gmail.com` via Resend (preferred) or SendGrid
   - Emit PostHog event `payment_completed` (server-side capture, identified by email hash)
3. On `checkout.session.expired` or `payment_intent.payment_failed`: log to PostHog only
4. Return `200` for processed events, `400` for invalid signatures

### 5.5 Finance Calculator (Client-Side Only)

- Astro client island (`<FinanceCalculator client:visible price={price} />`)
- Inputs:
  - Loan amount (pre-filled from unit price, read-only display)
  - Optional deposit (numeric input, reduces loan amount in real time)
  - Loan term selector: 3yr / 5yr / 7yr tabs
- Output: `~ $XXX / week` — recalculated on every input change
- Formula:
  - `r = 0.095 / 52` (weekly rate at 9.5% p.a.)
  - `n = term_years × 52`
  - `P = unit_price - deposit`
  - `repayment = P × (r(1+r)^n) / ((1+r)^n - 1)`
  - Round up to the nearest dollar
- Rate constant lives in `src/data/site-config.yaml` (`finance_rate_pa: 0.095`) — owner can ask AI admin to update it
- Disclaimer: *"Repayments shown are indicative only. Final rate and terms are set by the lender based on your individual credit profile. ByondRV is not a credit provider."*
- CTA: *"Apply Now with Yes Caravan Loans"* → opens `https://yescaravanloans.com.au/` in a new tab with `rel="noopener noreferrer"` and UTM params (`utm_source=beyondrv&utm_medium=referral&utm_campaign=finance_panel`)
- All calculation client-side — no network call

### 5.6 Thank-You Page

Astro page at `/thank-you/` (`src/pages/thank-you.astro`). Reads query params via small client script.

**Content (when params valid):**
```
Payment Confirmed

Thank you! Your [deposit / full payment] for the [Unit Name] has been received.

Our team will contact you within 1 business day to arrange next steps.

A receipt has been sent to your email address.

[Back to Inventory]   [View other slide-on campers]
```

- If query params are missing/invalid → generic "Thank you for your payment" with link back to home
- Server-side, on first render, the page calls Stripe (`stripe.checkout.sessions.retrieve(session_id)`) via a small Netlify Function `/api/session-status` to confirm the session is genuine before showing the personalised content (prevents people forging the URL to fake confirmations)
- PostHog event `thank_you_viewed` with `unit_slug`, `type`, `amount`

### 5.7 Email Notifications

**Customer:** Handled automatically by Stripe (receipt to email entered at checkout). No custom email needed.

**ByondRV:** Triggered by webhook handler.

```
Subject: New payment received — <Unit Name>

Payment type: <Deposit | Full Payment>
Unit: <Unit Name>
Amount: $XX,XXX AUD
Customer name: <name>
Customer email: <email>
Stripe payment ID: <pi_xxxxx>

View in Stripe: https://dashboard.stripe.com/payments/<pi_xxxxx>
```

Sent via **Resend** (preferred — simple API, generous free tier, good deliverability). Sender: `noreply@beyondrv.com.au` with reply-to `beyondcaravans@gmail.com`.

---

## 6. UI / UX Specifications

### 6.1 Button Group — Inventory Grid Card (Compact)

Below the price on each product card; only when `status === "in-stock"`:

```
[Deposit $23,700]   [Buy Now $78,999]
[      Finance This Camper        ]
```

- Deposit: background `var(--color-ink)` (#0F0F0F), text white, weight 600
- Buy Now: background `var(--color-accent)` (#FF6B35), text white, weight 600
- Finance: 1px outline `var(--color-ink)`, transparent fill
- Min height: 44px (touch target)
- Border radius: matches global card radius (8px)
- Sold / On-Order: replace the entire group with a single status badge

### 6.2 Button Group — Individual Product Page (Full)

Stacked, full width, in the purchase block:

```
[       Pay $23,700 Deposit         ]   ← black
[   Buy Now — Full Price $78,999    ]   ← orange
[       Finance This Camper         ]   ← outlined
🔒 Secure checkout via Stripe
```

- Full width on mobile and desktop
- "Secure checkout via Stripe" — 12px, muted, with lock icon
- Optional: small Stripe wordmark using their official asset

### 6.3 Finance Panel

Slides open below the buttons (max-height transition 0 → auto).

```
┌─────────────────────────────────────────────────┐
│ Finance This Camper                             │
│ ─────────────────────────────────────────────── │
│ Vehicle price:  $78,999                         │
│                                                 │
│ Your deposit (optional):  [$___________]        │
│ Loan amount:  $78,999                           │
│                                                 │
│ Loan term:  [ 3 years ] [ 5 years ] [ 7 years ]│
│                                                 │
│ Estimated weekly repayments                     │
│ ~ $312 / week                                   │
│                                                 │
│ Based on ~9.5% p.a. indicative rate             │
│                                                 │
│ * Repayments are indicative only. Final rate    │
│   and terms are set by the lender based on      │
│   your individual credit profile. ByondRV       │
│   is not a credit provider.                     │
│                                                 │
│ [ Apply Now with Yes Caravan Loans →  ]         │
└─────────────────────────────────────────────────┘
```

- Background `#F9F9F9`, 1px `#E0E0E0` border, radius 8px
- Term tabs: active = filled black, inactive = outlined
- Repayment figure: large, bold, accent orange
- Apply Now: black, full width

### 6.4 Loading and Error States

- Deposit / Buy Now click → button shows spinner + disabled (prevents double-submit)
- If checkout creation fails → inline error: *"Something went wrong creating your checkout. Please try again or call 0430 863 819."* — never navigate away
- Finance panel: no loading state (all client-side)
- Thank-you page while session lookup pending: skeleton text for ~500ms

---

## 7. Technical Architecture

### 7.1 Stack (consistent with Phase A)

```
beyondrv.com.au  ── Netlify (Astro static + Functions)
│
├── src/
│   ├── pages/
│   │   ├── thank-you.astro                ← confirmation page
│   │   └── ... (all Phase A pages)
│   ├── components/
│   │   ├── BuyNowButtons.astro            ← server-rendered button group
│   │   └── FinanceCalculator.tsx          ← client island
│   ├── content/products/*.md              ← source of truth (price, status)
│   └── data/site-config.yaml              ← deposit %, finance rate
│
├── netlify/functions/
│   ├── checkout.ts                        ← POST /api/checkout
│   ├── stripe-webhook.ts                  ← POST /api/stripe-webhook
│   └── session-status.ts                  ← GET /api/session-status?id=…
│
├── netlify.toml                           ← redirects + function bundling
└── .env (Netlify dashboard)
    ├── STRIPE_SECRET_KEY
    ├── STRIPE_WEBHOOK_SECRET
    ├── RESEND_API_KEY
    ├── TURNSTILE_SECRET_KEY
    └── POSTHOG_PROJECT_API_KEY (server)
```

No WordPress, no PHP, no plugin. Same repo and CI/CD pipeline as Phase A.

### 7.2 Data Flow

```
Customer browser
   │
   ├─[click Deposit / Buy Now]──────────────────────────────────┐
   │   POST /api/checkout                                        │
   │   { unit_slug, type, turnstile_token }                      ▼
   │                                            Netlify Function: checkout.ts
   │                                              ├─ verify Turnstile
   │                                              ├─ lookup price by slug
   │                                              ├─ verify in-stock
   │                                              └─ Stripe API → create session
   │   ◄──────────────────── { url: checkout.stripe.com/... } ───┘
   │
   ├─[redirect]──► Stripe Checkout (hosted)
   │                    │
   │              customer pays
   │                    │
   │   ◄────────── redirect to /thank-you/?unit=…&type=…&session_id=…
   │
   └─[thank-you page]
        │
        ├─ GET /api/session-status?id=… (verify session)
        └─ render confirmation

Stripe (async)
   │
   └─[webhook: checkout.session.completed]──► Netlify Function: stripe-webhook.ts
                                                ├─ verify signature
                                                ├─ Resend → email beyondcaravans@gmail.com
                                                └─ PostHog server-side capture
```

### 7.3 Stock Status Mechanism

```yaml
# src/content/products/sunpatch-15-xc.md
---
title: Sunpatch 15-XC
price_aud: 78999
status: in-stock          # in-stock | sold | on-order | coming-soon
slug: sunpatch-15-xc
...
---
```

At build time, Astro generates `dist/products.json` (manifest of slug → price + status) which the checkout Function loads. Toggling status via AI admin commits markdown → Netlify rebuild → manifest updated → buttons disappear within ~30s.

### 7.4 PostHog Event Schema

| Event | Properties |
|-------|------------|
| `buy_button_viewed` | `unit_slug`, `type`, `placement` (card / pdp) |
| `buy_button_clicked` | `unit_slug`, `type`, `price`, `deposit_amount` |
| `checkout_session_created` | `unit_slug`, `type`, `amount` |
| `checkout_redirect_failed` | `unit_slug`, `error` |
| `finance_panel_opened` | `unit_slug`, `price` |
| `finance_term_selected` | `unit_slug`, `term_years`, `weekly_repayment` |
| `finance_apply_clicked` | `unit_slug`, `weekly_repayment` |
| `payment_completed` | `unit_slug`, `type`, `amount` (server-side) |
| `thank_you_viewed` | `unit_slug`, `type`, `amount` |

These feed the existing Phase A custom dashboard (Buy Now becomes a new dashboard tab).

---

## 8. Implementation Plan

> No timelines. Tasks listed in execution order.

### Task 1 — Stripe Account Setup (ByondRV)
- Create / verify Stripe account in test mode
- Capture `STRIPE_SECRET_KEY` (test) and configure as Netlify env var on a dedicated `staging` deploy context
- Create webhook endpoint pointing at `https://staging--beyondrv.netlify.app/api/stripe-webhook` for test events; capture `STRIPE_WEBHOOK_SECRET`

### Task 2 — Product Manifest Build Step
- Add Astro integration that emits `dist/products.json` from `src/content/products/*.md`
- Schema: `{ slug, name, price_aud, status }`
- Functions read the bundled file at cold start

### Task 3 — `/api/checkout` Function
- TypeScript Netlify Function
- Verify Turnstile token
- Lookup price/status from manifest, reject if not in-stock
- Create Stripe session (deposit / full)
- Unit tests for: missing slug, sold unit, manipulated price attempt, valid happy path

### Task 4 — `/api/stripe-webhook` Function
- Verify signature with `STRIPE_WEBHOOK_SECRET`
- Handle `checkout.session.completed`
- Send email via Resend
- Server-side PostHog capture
- Log unhandled event types for visibility

### Task 5 — `BuyNowButtons.astro` Component
- Props: `slug`, `name`, `price`, `status`
- Render compact (card) or full (PDP) variant via prop
- Compute deposit display from `site-config.yaml.deposit_percent`
- Status badges for sold / on-order / coming-soon

### Task 6 — `FinanceCalculator.tsx` Island
- React (or Preact, smaller) island, hydrated `client:visible`
- Reads `finance_rate_pa` from passed prop
- Yes Caravan Loans link with UTMs

### Task 7 — `/thank-you/` Page + `/api/session-status` Function
- Astro page reads query params
- Client fetches `/api/session-status?id=…` to verify and personalise
- Falls back to generic message on missing/invalid params

### Task 8 — Integrate Buttons into Phase A Pages
- Inventory grid (`OnSale.astro`, `OurCaravans.astro`, `OurSlideOnCampers.astro`, `Expedition.astro`) — compact variant
- Each product detail page — full variant
- Replace Phase A placeholder "Buy Now → enquiry form" CTAs

### Task 9 — End-to-End Test (Stripe Test Mode)
- `4242 4242 4242 4242` happy path: deposit, full, finance click
- Sold-unit attempt: button hidden, direct API call rejected
- Webhook fires → email arrives at `beyondcaravans@gmail.com`
- Thank-you page renders correct unit/amount
- PostHog events appear in dashboard

### Task 10 — Go Live
- Switch Netlify env vars to live Stripe keys (production deploy context)
- Add live webhook endpoint in Stripe dashboard pointing at `https://beyondrv.com.au/api/stripe-webhook`
- Smoke test with a real $1 charge to a unit then refund
- Announce internally that Buy Now is live

---

## 9. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Does ByondRV have an existing Stripe account, or do we create one? | ByondRV | Open |
| 2 | Is the 30% deposit refundable, partially refundable, or non-refundable? Wording on checkout description and thank-you page depends on this. | ByondRV | Open |
| 3 | Confirm Yes Caravan Loans as the single broker, or list multiple (Easy Caravan Finance, Fido) with comparison? | ByondRV | Open |
| 4 | Confirm `beyondcaravans@gmail.com` is the right inbox for payment notifications, or set up a dedicated `payments@`? | ByondRV | Open |
| 5 | Display deposit as rounded ($23,700) or exact ($23,699.70)? | ByondRV | Recommended: rounded |
| 6 | Is Resend acceptable as the transactional email provider, or prefer SendGrid / Mailgun? | Build team | Recommended: Resend |

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Customer pays deposit for already-sold unit | Low | High | Server-side stock check in `/api/checkout`; status badge replaces button on UI |
| Stripe session creation fails (network / API) | Low | Medium | Inline error with phone fallback; PostHog event for monitoring |
| Finance rate becomes misleading if market shifts | Medium | Low | Disclaimer; rate stored in `site-config.yaml`, owner can update via AI admin |
| Refund dispute for deposit | Low | Medium | Clear T&Cs in checkout description and thank-you page; deposit terms in Phase A footer |
| Webhook delivery failure (email never sent) | Low | High | Stripe automatic retry (72h); also log to PostHog so missing emails can be reconciled |
| Bot abuse of `/api/checkout` (Stripe session spam) | Medium | Low | Cloudflare Turnstile + rate limit |

---

## 11. Success Metrics (First 90 Days After Launch)

- Number of deposits received per month
- Number of full payments received per month
- Finance calculator open rate (% of PDP visitors)
- Finance "Apply Now" click-through rate
- Conversion: PDP view → checkout session created
- Conversion: checkout session created → payment completed
- Average time from PDP load to deposit paid

---

*Document version 2.0 — rewritten for Astro + Netlify stack (was WordPress + PHP). Ready for implementation once Phase A is live.*
