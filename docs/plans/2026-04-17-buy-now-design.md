# Buy Now — Design Document
**Date:** 2026-04-17  
**Project:** Beyond RV Website  
**Scope:** In-stock purchase flow — deposit, full payment, and caravan finance

---

## Overview

Add a "Buy Now" purchase flow to all in-stock units across two sites:

1. **Phase 1 — Existing WordPress site** (beyondrv.com.au on SiteGround)
2. **Phase 2 — New HTML site** (port of Phase 1, minimal changes)

Three payment paths available on every in-stock unit:

| Path | Amount | Processor |
|------|--------|-----------|
| Pay Deposit | 30% of unit price (dynamic) | Stripe |
| Buy Now — Full Price | 100% of unit price | Stripe |
| Finance This Camper | N/A — redirects to broker | Yes Caravan Loans |

---

## Button Placement

Buttons appear in **two locations**:

### 1. Inventory Grid Cards
Compact button group below the price on each product card:

```
┌─────────────────────────────────────┐
│  [image]                            │
│  3.5m Truck Camper with Cabover     │
│  $78,999                            │
│  ────────────────────────────────── │
│  [Deposit $23,700]  [Buy Now]       │
│  [Finance This Camper]              │
└─────────────────────────────────────┘
```

### 2. Individual Product Pages
Full button group in the purchase section, more prominent:

```
┌──────────────────────────────────────────┐
│  Price: $78,999                          │
│                                          │
│  [  Pay $23,700 Deposit  ]  ← black     │
│  [  Buy Now — Full Price  ]  ← orange   │
│  [  Finance This Camper   ]  ← outlined │
│                                          │
│  🔒 Secure checkout via Stripe           │
└──────────────────────────────────────────┘
```

### Stock Status Logic
- `data-status="in-stock"` → all three buttons active
- `data-status="sold"` → buttons replaced by grey "Sold" badge
- `data-status="on-order"` → buttons replaced by "On Order" badge

---

## Button Styling

| Button | Style | Colour |
|--------|-------|--------|
| Pay Deposit | Filled | Black (`#000000`) with white text |
| Buy Now — Full Price | Filled | Orange (`#FF6B35`) with white text |
| Finance This Camper | Outlined/ghost | Black border, black text |

Desktop: Deposit + Buy Now side-by-side, Finance full-width below.  
Mobile: All three stacked full-width.

---

## Stripe Integration — Dynamic Pricing

No products are pre-created in Stripe. Each checkout session is generated on-the-fly.

**Data flow:**
```
1. Page HTML contains: data-unit-name="3.5m Cabover" data-price="78999"
2. Customer clicks "Pay Deposit"
3. JS reads unit name + price from page data attributes
4. JS posts to WordPress endpoint: { name, price, type: "deposit" | "full" }
5. PHP endpoint calculates amount (deposit = price × 0.30)
6. PHP creates Stripe Checkout Session with:
   - line_items: [{ price_data: { unit_amount, currency: "aud", product_data: { name } } }]
   - mode: "payment"
   - success_url: /thank-you?unit=...&type=...
   - cancel_url: [current page]
7. Returns session URL to JS
8. JS redirects customer to Stripe hosted checkout
```

**WordPress configuration:**
- Stripe secret key stored in `wp-config.php` (never in page HTML)
- Deposit percentage (30%) stored as a single WordPress option — changeable site-wide without code edits
- One WordPress endpoint (REST route or admin-ajax) handles session creation

**Stripe dashboard:**
- No per-unit setup required
- Each payment appears with unit name and type (deposit/full) in the description
- Webhooks notify Beyond RV on successful payment

---

## Finance Calculator Panel

Triggered by clicking "Finance This Camper". Slides open below the button group — no page navigation.

```
┌─────────────────────────────────────────────┐
│  Finance This Camper                        │
│                                             │
│  Loan Amount:  $78,999                      │
│  Deposit:      [_________] (optional)       │
│                                             │
│  Loan Term:    [3yr] [5yr] [7yr]           │
│                                             │
│  Estimated repayments:                      │
│  ~ $312 / week  (based on ~9.5% p.a.)     │
│                                             │
│  * Indicative only. Final rate set by       │
│    lender based on your credit profile.     │
│                                             │
│  [  Apply Now with Yes Caravan Loans  ]     │
└─────────────────────────────────────────────┘
```

**Calculator details:**
- Loan amount: pre-filled from unit price, reduced by optional deposit entry
- Terms: 3, 5, 7 years (tab selection)
- Rate used for estimate: 9.5% p.a. (mid-range secured RV loan, AU market)
- Repayment formula: standard amortisation, calculated client-side in JS
- All calculation happens in the browser — no server call needed
- "Apply Now" opens Yes Caravan Loans in a new tab

**Compliance:**
- Disclaimer required: "Repayments shown are indicative only. Final rate and terms are set by the lender based on your individual credit profile. Beyond RV is not a credit provider."

---

## Checkout Confirmation Flow

**Success redirect:** `/thank-you?unit=3.5m-cabover&type=deposit`

**Thank you page content:**
```
┌─────────────────────────────────────────────┐
│  Payment Confirmed                          │
│                                             │
│  Thank you! Your deposit for the            │
│  3.5m Truck Camper has been received.       │
│                                             │
│  Our team will contact you within           │
│  1 business day to arrange next steps.      │
│                                             │
│  📧 A receipt has been sent to your email   │
│                                             │
│  [  Back to Inventory  ]                    │
└─────────────────────────────────────────────┘
```

**Notifications:**
- Customer: automatic Stripe receipt email
- Beyond RV: Stripe webhook triggers email notification (unit name, amount, customer email)

---

## Phase 2 — New HTML Site Port

The new site version is simpler — no WordPress plugin needed.

| Component | WordPress (Phase 1) | New Site (Phase 2) |
|-----------|--------------------|--------------------|
| Button UI | Same HTML/CSS | Same HTML/CSS |
| Finance calculator | Same JS | Same JS |
| Stripe endpoint | WordPress REST route (PHP) | Single PHP file or serverless function (Netlify/Vercel) |
| Config | wp-config.php | Environment variable |

The Stripe session creation logic is identical — only the wrapper changes.

---

## Implementation Checklist

### Phase 1 — WordPress

- [ ] Create Stripe account + get API keys (test mode first)
- [ ] Build WordPress plugin with Stripe session endpoint
- [ ] Add deposit percentage setting to WordPress admin
- [ ] Build button HTML/CSS component
- [ ] Build finance calculator JS panel
- [ ] Add buttons to inventory grid (Elementor HTML widget or shortcode)
- [ ] Add buttons to each individual product page
- [ ] Create thank-you page
- [ ] Set up Stripe webhook → email notification
- [ ] Test full flow in Stripe test mode
- [ ] Switch to live Stripe keys

### Phase 2 — New HTML Site

- [ ] Port button HTML/CSS (no changes)
- [ ] Port finance calculator JS (no changes)
- [ ] Create serverless endpoint for Stripe session
- [ ] Wire up environment variables
- [ ] Test and go live

---

## Open Questions

1. **Finance broker:** Confirm Yes Caravan Loans as preferred broker, or add Easy Caravan Finance / Fido Finance as additional options later
2. **Deposit wording:** "Deposit" implies it's refundable — confirm refund policy for the thank-you page and Stripe description
3. **Stripe account:** Does Beyond RV already have a Stripe account, or does one need to be created?
