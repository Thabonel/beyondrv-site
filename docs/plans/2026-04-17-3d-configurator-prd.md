# ByondRV — 3D Slide-On Camper Configurator
## Product Requirements Document (Phase C)

**Date:** 2026-04-17 (rewritten 2026-04-22 for Astro + Netlify stack)
**Status:** Approved in concept — execution deferred until Phase A and Phase B are live and stable
**Owner:** ByondRV (build by Thabo)
**Depends on:**
- `2026-04-22-phase-a-prd.md` (marketing site, AI admin, Netlify hosting, PostHog)
- `2026-04-17-buy-now-prd.md` (Stripe Checkout deposit flow via Netlify Function)

---

## 1. Overview

A browser-based 3D configurator that lets a customer design their own slide-on camper, see their choices reflected live in a 3D model, track the total price and payload weight in real time, and pay a 30% deposit via Stripe to lock in their build.

**Competitive opportunity:** No major Australian caravan or truck camper manufacturer currently offers an online 3D configurator. ByondRV would be the first in the Australian market. International comparisons (Off Highway Van, VAN-Jorn, Ranger Design) show this is proven technology at similar price points.

**Why this is Phase C, not Phase A or B:** The 3D model itself is the long-pole — it requires an external 3D artist, a complete option/weight catalogue, and significant QA. Shipping the marketing site (A) and online payments (B) first lets ByondRV start selling now and validates the Stripe + email plumbing the configurator depends on.

---

## 2. What the Customer Experiences

```
1. Customer arrives at /configurator/slide-on
2. Sees a 3D model of the base camper rotating slowly — inviting interaction
3. Left/right panel shows:
   - Current price
   - Current payload weight
   - List of upgrade categories (Kitchen, Bed, Power, Storage, Exterior)
4. Customer orbits the model with mouse/touch drag
5. Customer selects an upgrade (e.g. "Queen Bed" instead of "Single")
   → The 3D model updates — the bed visually changes in the model
   → Price increases, weight updates instantly
6. Customer works through each category, building their ideal camper
7. Satisfied, they click "Pay 30% Deposit — $X,XXX"
8. Stripe Checkout opens → payment → `/thank-you/` page (shared with Phase B)
9. ByondRV receives email at `beyondcaravans@gmail.com` with full build spec + customer contact
10. PostHog records the full configurator funnel (option opens, selections, deposit)
```

---

## 3. Goals

| Goal | Success Metric |
|------|---------------|
| Enable self-serve camper customisation | Customer can configure without calling sales |
| Reduce quote time | ByondRV receives a complete spec with deposit — no quote round-trip |
| Increase lead quality | Every deposit comes with a confirmed build spec |
| Competitive differentiation | First Australian truck camper brand with a 3D configurator |
| Accurate weight visibility | Customer knows payload impact of each upgrade before committing |
| Owner can adjust prices/options | Owner can ask AI admin to change `camper-config.json` (e.g. *"add a 300W solar option at $2,400"*) |

---

## 4. Scope

### In Scope
- 3D interactive camper viewer (orbit, zoom)
- Base model display with all options as toggleable parts
- Upgrade selector panel (categories + options)
- Real-time price and weight update
- 30% deposit payment via Stripe (reuses Buy Now flow from `2026-04-17-buy-now-prd.md`)
- Build summary emailed to ByondRV on deposit payment
- Mobile-responsive layout (touch orbit supported)
- One camper model to start: the core slide-on range

### Out of Scope
- Multiple camper models in Phase 1 (add later)
- Full purchase (deposit only — same as Buy Now PRD)
- Finance calculator in configurator (link to main product page for finance)
- Customer accounts / save-and-return
- PDF quote generation (manual follow-up by staff)
- AR (augmented reality) mode
- Real-time stock availability per option

---

## 5. User Stories

### Customer — Configure
> As a prospective buyer,  
> I want to select upgrades and see them appear on the 3D model,  
> so that I can visualise my custom camper before committing.

**Acceptance Criteria:**
- I can orbit/rotate the model freely with mouse drag or touch swipe
- Selecting an upgrade visually changes the relevant part of the 3D model within 200ms
- Price and weight update instantly on every selection
- I can change my mind and deselect/swap any upgrade at any time
- The total price is always clearly visible

### Customer — Pay Deposit
> As a customer happy with my configuration,  
> I want to pay a 30% deposit,  
> so that ByondRV will build my camper to this spec.

**Acceptance Criteria:**
- Deposit amount = 30% of configured total, shown clearly before clicking
- Stripe checkout includes a build summary in the line item description
- After payment I see a confirmation page with my full build spec
- I receive a Stripe receipt email
- ByondRV receives an email with my full build spec + contact details

### ByondRV — Receive Spec
> As a ByondRV team member,  
> I want to receive the customer's complete build spec when their deposit clears,  
> so that I can start procurement and contact the customer with a build timeline.

**Acceptance Criteria:**
- Email includes: customer name, email, phone (if captured), full list of selected options, total price, deposit paid, remaining balance
- No manual data entry required
- Spec is unambiguous — option names match internal product codes

### ByondRV — Maintain Options
> As a ByondRV team member,  
> I want to add, remove, or update upgrade options and prices,  
> so that the configurator reflects our current offering without a developer.

**Acceptance Criteria:**
- Options, prices, and weights are stored in a JSON file — editable directly
- Changing a price in the JSON immediately reflects on the site after deploy
- Adding a new option requires: adding to JSON + adding a named node to the GLB model

---

## 6. Upgrade Categories & Data Model

Options are stored in a single `camper-config.json` file. Structure:

```json
{
  "base": {
    "name": "Slide-On Camper — Base Model",
    "base_price": 45000,
    "base_weight_kg": 980
  },
  "categories": [
    {
      "id": "bed",
      "label": "Sleeping",
      "required": true,
      "options": [
        {
          "id": "bed_single",
          "label": "Single Fixed Bed",
          "description": "Standard fixed single bed",
          "price_delta": 0,
          "weight_delta_kg": 0,
          "model_nodes_show": ["bed_single"],
          "model_nodes_hide": ["bed_queen", "bed_bunk"],
          "default": true
        },
        {
          "id": "bed_queen",
          "label": "Queen Fixed Bed",
          "description": "Full queen size fixed bed",
          "price_delta": 2500,
          "weight_delta_kg": 18,
          "model_nodes_show": ["bed_queen"],
          "model_nodes_hide": ["bed_single", "bed_bunk"]
        }
      ]
    },
    {
      "id": "kitchen",
      "label": "Kitchen",
      "required": true,
      "options": [
        {
          "id": "kitchen_standard",
          "label": "Standard Kitchen",
          "price_delta": 0,
          "weight_delta_kg": 0,
          "model_nodes_show": ["kitchen_standard"],
          "model_nodes_hide": ["kitchen_premium"],
          "default": true
        },
        {
          "id": "kitchen_premium",
          "label": "Premium Kitchen",
          "description": "Induction cooktop, larger fridge, stone benchtop",
          "price_delta": 4200,
          "weight_delta_kg": 35,
          "model_nodes_show": ["kitchen_premium"],
          "model_nodes_hide": ["kitchen_standard"]
        }
      ]
    },
    {
      "id": "power",
      "label": "Power & Solar",
      "required": false,
      "multiple": true,
      "options": [
        {
          "id": "solar_200w",
          "label": "200W Solar Panel",
          "price_delta": 1800,
          "weight_delta_kg": 12,
          "model_nodes_show": ["solar_200w"],
          "model_nodes_hide": []
        },
        {
          "id": "battery_200ah",
          "label": "200Ah Lithium Battery",
          "price_delta": 2400,
          "weight_delta_kg": 28,
          "model_nodes_show": ["battery_200ah"],
          "model_nodes_hide": ["battery_100ah"]
        }
      ]
    }
  ]
}
```

**Key design decisions:**
- `price_delta` and `weight_delta_kg` are deltas from base — never absolute
- `model_nodes_show` / `model_nodes_hide` are the exact node names in the GLB file
- `required: true` means one option in this category must always be selected
- `multiple: true` means customer can select more than one in this category (e.g. solar + battery)
- Default options are pre-selected when the page loads

---

## 7. Technical Architecture

### 7.1 Recommended Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Page | **Astro page** at `/configurator/slide-on/` | Same repo, layout, header/footer as Phase A |
| 3D rendering | **Three.js** (client island, `client:only`) | Best-in-class GLTF node swapping; only loads on this page so doesn't bloat the rest of the site |
| 3D model format | **Single GLB with named nodes** | One file, all variants toggled by visibility — fast swap (<100ms) |
| Model controls | **OrbitControls** (Three.js built-in) | Mouse + touch orbit/zoom, no extra library |
| Model compression | **Draco + WebP textures** | Reduces model from ~20MB to ~1–2MB |
| Configurator logic | **TypeScript** in the client island | Matches Phase A / B codebase |
| Config data | **`src/data/camper-config.yaml`** (or `.json`) | Editable by ByondRV via AI admin chat — same workflow as product markdown |
| Stripe deposit | **Same `/api/checkout` Netlify Function from Phase B**, extended to accept `build_spec` metadata | Single source of truth for checkout logic |
| Hosting | **Netlify** (same account as Phase A / B) | GLB served via Netlify's CDN with long cache headers |
| Analytics | **PostHog** (same project as Phase A) | Configurator funnel surfaces in the existing custom dashboard as a new tab |

### 7.2 GLB Model Structure

The 3D model is a single `.glb` file exported from Blender. All upgrade variants are included as named nodes, with visibility toggled by JavaScript:

```
camper.glb
├── camper_body           (always visible — shell, chassis)
├── camper_windows        (always visible)
├── bed_single            (visible by default)
├── bed_queen             (hidden by default)
├── bed_bunk              (hidden by default)
├── kitchen_standard      (visible by default)
├── kitchen_premium       (hidden by default)
├── solar_200w            (hidden by default)
├── battery_100ah         (visible by default)
├── battery_200ah         (hidden by default)
├── awning                (hidden by default)
└── ...
```

Node toggle in JavaScript:
```javascript
function applyNodes(scene, showNodes, hideNodes) {
  scene.traverse((node) => {
    if (showNodes.includes(node.name)) node.visible = true;
    if (hideNodes.includes(node.name)) node.visible = false;
  });
}
```

### 7.3 Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  BEYOND RV — Design Your Camper                             │
├────────────────────────────────┬────────────────────────────┤
│                                │  Your Build                │
│                                │  ─────────────────────     │
│   [  3D MODEL VIEWER  ]        │  Base Model    $45,000     │
│                                │  Queen Bed      +$2,500    │
│   (customer orbits/rotates)    │  Premium Kitchen +$4,200   │
│                                │  200W Solar     +$1,800    │
│                                │  ─────────────────────     │
│                                │  TOTAL         $53,500     │
│                                │  Weight           1,035kg  │
│                                │                            │
│                                │  ── Upgrade Options ──     │
│                                │                            │
│                                │  SLEEPING                  │
│                                │  ◉ Queen Fixed Bed         │
│                                │  ○ Single Fixed Bed        │
│                                │                            │
│                                │  KITCHEN                   │
│                                │  ◉ Premium Kitchen         │
│                                │  ○ Standard Kitchen        │
│                                │                            │
│                                │  POWER & SOLAR             │
│                                │  ☑ 200W Solar Panel        │
│                                │  ☑ 200Ah Lithium Battery   │
│                                │                            │
│                                │  [Pay $16,050 Deposit]     │
│                                │  (30% of $53,500)          │
└────────────────────────────────┴────────────────────────────┘
```

**Mobile layout:** 3D viewer on top (50vh), upgrade panel scrolls below.

### 7.4 3D Viewer Behaviour

- **Initial load:** Model loads with base configuration. Slow auto-rotate for 3 seconds, then stops and waits for user interaction.
- **Orbit:** Click/drag or touch-drag to orbit. Pinch to zoom.
- **Lighting:** Three-point lighting setup — key light from front-right, fill from left, rim from behind. Gives product photography feel.
- **Camera:** Starts at a 3/4 front angle, slightly elevated. Customer can orbit freely.
- **Reset button:** Small "Reset View" button returns to default angle.
- **On upgrade select:** No camera movement — the node change is subtle and the customer can orbit to inspect it.

### 7.5 Price & Weight Calculation

Pure client-side JavaScript. Runs on every option change:

```javascript
function recalculate(selections, config) {
  let price = config.base.base_price;
  let weight = config.base.base_weight_kg;

  for (const [categoryId, selectedIds] of Object.entries(selections)) {
    const category = config.categories.find(c => c.id === categoryId);
    for (const optionId of selectedIds) {
      const option = category.options.find(o => o.id === optionId);
      price += option.price_delta;
      weight += option.weight_delta_kg;
    }
  }

  return { price, weight, deposit: Math.round(price * 0.30) };
}
```

- Price formatted as AUD with `Intl.NumberFormat`
- Weight shown in kg
- Deposit = `Math.round(price × 0.30)` — same rule as Buy Now PRD

### 7.6 Stripe Integration

Reuses the `/api/checkout` Netlify Function from `2026-04-17-buy-now-prd.md` with an extended payload and a new `mode: "configurator"` flag (so the Function knows to trust the supplied `unit_price` as the configurator-calculated total rather than looking it up from the product manifest):

```
POST /api/checkout
Content-Type: application/json
X-Turnstile-Token: <token>

{
  "mode": "configurator",
  "unit_name": "Slide-On Camper — Custom Build",
  "unit_price": 53500,
  "type": "deposit",
  "build_spec": {
    "bed": "bed_queen",
    "kitchen": "kitchen_premium",
    "power": ["solar_200w", "battery_200ah"]
  }
}
```

**Server-side validation (defence against client-side price tampering):**
- Function recalculates `unit_price` from the bundled `camper-config.json` using the supplied `build_spec`
- Rejects if the recalculated total differs from the supplied `unit_price` by more than $1 (rounding tolerance)
- This means a customer cannot edit dev tools to drop the deposit — the server is the source of truth

The `build_spec` and the resolved option labels are stored as Stripe `PaymentIntent.metadata`, so the build appears in the Stripe dashboard alongside the payment. It is also included in the ByondRV notification email sent by the Phase B webhook handler (which is extended to recognise `mode: "configurator"` and format the email accordingly).

**Stripe line item description:**
```
Slide-On Camper Deposit — Queen Bed, Premium Kitchen, 200W Solar, 200Ah Battery
```

**ByondRV notification email** (sent via Resend by the shared webhook handler):
```
Subject: New configurator deposit — Slide-On Camper

Customer: Jane Smith <jane@email.com>
Deposit paid: $16,050 (30% of $53,500)

Build Specification:
  Base Model:        Slide-On Camper Base
  Sleeping:          Queen Fixed Bed         +$2,500
  Kitchen:           Premium Kitchen         +$4,200
  Power & Solar:     200W Solar Panel        +$1,800
                     200Ah Lithium Battery   +$2,400

Total Build Price:   $53,500
Remaining Balance:   $37,450
Estimated Weight:    1,035 kg

Stripe Payment ID: pi_xxxxxxxx
```

---

## 8. 3D Model — Sourcing & Production

### 8.1 What Needs to Be Built

The 3D model is the most critical and most time-consuming part of this project. It must be:

- A detailed exterior + interior model of the slide-on camper
- All upgrade variants modelled as separate named nodes in one GLB file
- Optimised for web: Draco compressed, WebP textures, target <2MB
- Accurate enough to be a sales tool (proportions, materials, colours must look right)

### 8.2 Recommended Approach: Outsource to Blender Freelancer

**Do not attempt to create the 3D model in-house unless someone at ByondRV already knows Blender.**

**Recommended path:**
1. Hire a Blender specialist via Fiverr or Upwork
2. Provide them with: CAD drawings or detailed photos of the camper, dimensions, a list of all upgrade nodes needed, and the naming convention from `camper-config.json`
3. Request delivery in `.blend` (source) + `.glb` (web export) format
4. Request Draco compression applied to the GLB

**Brief to give the 3D artist:**
```
We need a 3D model of a slide-on truck camper for a web configurator.

Requirements:
- Exterior and interior fully modelled
- All variants as separate named mesh nodes (list attached)
- Export as single .glb file with Draco compression
- Textures: WebP, max 1024×1024
- Target file size: under 2MB
- Tested in Three.js (provide a simple HTML test page)
- Deliver: .blend source file + .glb web export

Node naming convention: [component]_[variant]
Example: bed_single, bed_queen, kitchen_standard, kitchen_premium, solar_200w
```

### 8.3 Cost Estimates

| Option | Cost | Timeline | Quality |
|--------|------|----------|---------|
| Fiverr freelancer (mid-tier) | $1,500–$3,000 | 3–6 weeks | Good |
| Upwork specialist | $3,000–$6,000 | 4–8 weeks | Very Good |
| Australian 3D studio | $8,000–$15,000 | 6–12 weeks | Excellent |
| DIY (learn Blender) | $0 + ~150 hours | 3–6 months | Variable |

**Recommendation:** Upwork specialist at $3,000–$5,000. Brief them with exact node naming requirements from the start to avoid rework.

### 8.4 Model Delivery Checklist

Before accepting delivery from the 3D artist:

- [ ] All nodes named exactly as in `camper-config.json`
- [ ] GLB loads in Three.js without errors (test with provided HTML)
- [ ] File size under 2MB with Draco compression
- [ ] Textures look accurate on screen (no washed-out or overly shiny materials)
- [ ] Interior visible through door/windows or interior camera angle works
- [ ] `.blend` source file included for future edits

---

## 9. Implementation Plan

> No timelines. Tasks listed in execution order. The 3D model production runs in parallel with the foundation work — the artist starts as soon as the option catalogue and node naming list are signed off.

### Track A — Web Build (foundation, in parallel with 3D artist)

#### Task 1: Astro page + Three.js island scaffold
- Create `src/pages/configurator/slide-on.astro`
- Add `<ConfiguratorViewer client:only="react" />` (or vanilla TS island)
- Include Three.js + GLTFLoader + DRACOLoader + OrbitControls
- Load a placeholder GLB (free Sketchfab model or a Blender block-out)
- Orbit controls, three-point lighting, slow auto-rotate until first interaction

#### Task 2: Load and render config catalogue
- Read `src/data/camper-config.yaml` at build time, hand it to the island as a typed prop
- Render upgrade categories and options dynamically
- Set default selections on load
- Wire up price/weight calculation

#### Task 3: Connect options to 3D model
- On option select: call `applyNodes()` to show/hide GLB nodes
- Verify with placeholder model that node toggling works
- Performance budget: node swap completes in <200ms

#### Task 4: Build the UI panel
- Price summary (base + line items + total)
- Weight display with optional payload warning threshold
- Upgrade category panels (accordion or scrollable list)
- Radio inputs for single-select, checkboxes for multi-select
- Mobile responsive layout (3D viewer 50vh on top, panel scrolls below)

#### Task 5: Extend `/api/checkout` Function for configurator mode
- Add `mode: "configurator"` branch to the Phase B function
- Server-side recalculation of total from `build_spec` against the bundled config
- Reject mismatches (>$1 delta)
- Pass `build_spec` and resolved labels into Stripe `metadata`

#### Task 6: Extend webhook handler for configurator emails
- Detect `metadata.mode === "configurator"`
- Format email with the full build summary (as in §7.6 above)
- Same Resend sender as Phase B

#### Task 7: Extend `/thank-you/` page
- If session metadata contains `build_spec`, render the full build summary
- Reuse existing personalised-thank-you mechanics from Phase B

#### Task 8: PostHog instrumentation
- Events: `configurator_loaded`, `option_selected` (`category`, `option_id`, `price_delta`), `weight_warning_shown`, `deposit_clicked`, `payment_completed` (server-side, already from Phase B)
- New tab in the custom analytics dashboard for configurator funnel

### Track B — 3D Model Production (in parallel with Track A)

#### Task 9: Compile complete option catalogue
- ByondRV provides every variant + price + weight + node name
- Owner can add later via AI admin, but the launch set must be locked before brief

#### Task 10: Brief and engage 3D artist
- Use the brief in §8.2
- Hold a kickoff call to walk through node naming convention
- Milestone payments tied to: blockout review, materials review, final delivery

#### Task 11: Integrate delivered GLB
- Replace placeholder model with `camper.glb`
- Verify every node name matches `camper-config.yaml` (automated check script)
- Tune camera start position and lighting for the real geometry

#### Task 12: Performance optimisation
- Verify file size <2MB post-Draco
- 4G mobile load test (Chrome DevTools throttle)
- Loading skeleton + progress bar during GLB fetch
- Long-cache headers for `/models/camper.glb` in `netlify.toml`

#### Task 13: QA pass
- Test every legal upgrade combination — no broken node references
- End-to-end deposit flow in Stripe test mode
- Browsers: iPhone Safari, Android Chrome, desktop Chrome / Firefox / Safari
- 3G throttle to confirm graceful loading

#### Task 14: Launch
- Soft launch behind a hidden URL (no nav link) for owner sign-off
- Add nav link from "Our Slide-On Campers" page: *"Or design your own →"*
- Switch to live Stripe keys (already done in Phase B)
- Monitor PostHog dashboard + Stripe + console errors

---

## 10. File Structure (within the existing Phase A repo)

```
src/
├── pages/
│   └── configurator/
│       └── slide-on.astro              ← page wrapper, header/footer, SEO
├── components/
│   └── ConfiguratorViewer.tsx          ← Three.js client island
├── data/
│   └── camper-config.yaml              ← options, prices, weights, node names
└── ...

public/
└── models/
    └── camper.glb                      ← Draco-compressed 3D model (<2MB)

netlify/functions/
├── checkout.ts                         ← (extended from Phase B for configurator mode)
└── stripe-webhook.ts                   ← (extended from Phase B for configurator emails)
```

`camper-config.yaml` is the single source of truth. The owner can ask the AI admin to edit it (e.g. *"Drop the price of the premium kitchen by $500"*) — same workflow as the product markdown files in Phase A. No developer needed for routine catalogue maintenance.

---

## 11. Research Findings: Build vs Buy

Based on research into the market:

### SaaS Configurator Platforms (Evaluated)

| Platform | Cost | Verdict for ByondRV |
|----------|------|-----------------------|
| Threekit | $50K+/year | Enterprise only — not suitable |
| Expivi | Custom quote | Enterprise only — not suitable |
| Zakeke | $1,529–$3,059/year + 1.7% per transaction | Transaction fees on $50K campers = $850/sale — unacceptable |
| Kickflip | $59/month + 0.5–1.95% per transaction | Same transaction fee problem |

**Conclusion: Build custom.** Transaction fees on high-value items ($45K–$80K campers) make SaaS platforms economically unviable. At 1.5% per transaction on a $60K camper = $900 per deposit. Custom build pays for itself in 5–10 sales.

### Competitive Landscape

No Australian caravan or truck camper manufacturer currently offers an online 3D configurator. This is a genuine first-mover opportunity in the Australian market.

International precedents (same price bracket):
- **Off Highway Van** (USA, $164K–$349K Sprinter conversions) — full 3D web configurator
- **VAN-Jorn** (Netherlands) — drag-and-drop modular configurator
- **Ranger Design** (North America) — 3D upfit configurator for commercial vans

All use browser-based 3D (Three.js or Babylon.js) with real-time pricing.

---

## 12. Open Questions

| # | Question | Owner | Impact |
|---|----------|-------|--------|
| 1 | Which slide-on model(s) to configure first? One model to start, or multiple variants? | ByondRV | Scope of 3D model brief |
| 2 | What are all the upgrade categories and options for the slide-on? (Need complete list for `camper-config.yaml` and 3D model brief) | ByondRV | Critical — blocks 3D artist brief |
| 3 | What is the base weight of the slide-on, and what are the weight deltas for each upgrade? | ByondRV | Critical — affects legal payload advice |
| 4 | Should weight display include a GVM/payload warning if the build exceeds a threshold? | ByondRV | Safety / legal consideration |
| 5 | Does ByondRV have any existing CAD files, drawings, or reference photos to give the 3D artist? | ByondRV | Affects 3D model quality and artist cost |
| 6 | Should the configurator be password-protected initially (soft launch) or public from day one? | ByondRV | Launch strategy |
| 7 | What is the approved budget for the 3D model? ($3K–$5K recommended) | ByondRV | Determines artist tier |

---

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 3D model takes longer than expected from artist | High | High | Track A web build proceeds in parallel against placeholder model |
| 3D artist delivers nodes with wrong naming convention | Medium | High | Provide exact node list upfront; automated rename-check script before final payment |
| GLB file too large for mobile load times | Medium | Medium | Draco compression reduces ~20MB → <2MB; test before launch |
| Customer selects combination that exceeds truck payload | Medium | High | Weight warning when total exceeds configurable threshold |
| Price mismatch between configurator and actual quote | Low | High | `camper-config.yaml` is single source of truth — owner updates via AI admin when prices change |
| Customer manipulates client-side price before deposit | Medium | High | Server-side recalculation in `/api/checkout` (>$1 mismatch = reject) |
| Configurator used as a quote tool but ByondRV can't deliver that spec | Low | Medium | Disclaimer: *"Final specifications subject to confirmation"* (see §15) |

---

## 14. Success Metrics (First 90 Days)

- Number of configurations started
- Number of configurations completed (all categories selected)
- Deposit conversion rate (configurations → deposits paid)
- Average configured price vs base model price (measures upsell effectiveness)
- Time spent in configurator per session
- Mobile vs desktop usage split
- Most and least selected upgrades (informs product decisions)

---

## 15. Disclaimer Copy (Legal)

Display below the deposit button:

> *Pricing and weight figures are indicative based on your selected options. Final build specification, pricing, and payload capacity will be confirmed in writing by ByondRV following receipt of your deposit. ByondRV reserves the right to substitute equivalent components where specified options are unavailable. Deposit is non-refundable if the customer cancels after build commences.*

---

*Document version 2.0 — rewritten for Astro + Netlify stack and aligned to Phase A / Phase B. Pending from ByondRV: upgrade options list, 3D model brief sign-off, 3D artist budget approval. Execution begins after Phase B is live and stable.*
