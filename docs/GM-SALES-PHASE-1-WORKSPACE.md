# GM Sales Workspace — Phase 1 Workspace and Initial Phase 2 Conversion

Updated: 9 August 2026

## Implemented in this slice

Authenticated GM sessions now receive a separate, mobile-first sales workspace at `/admin`. The technical admin panel is not merely hidden with CSS; it is a separately loaded application retained for owner, site-administrator, and legacy rollback sessions.

The GM workspace has four destinations only:

1. **Today** — commercially ranked actions from current enquiries, agreements, deposits, and builds.
2. **Customers** — one searchable projection of existing customer details with direct call and email actions.
3. **Agreements** — the existing approved agreement editor embedded directly in the GM shell.
4. **Builds** — active order/build status, deposit verification state, dates, and direct customer calling.

Today displays people waiting, estimated pipeline value, agreements requiring completion, and active builds. Actions are ranked by readiness/urgency, then estimated deal value, staleness, and customer name. Telephone actions use `tel:` links.

Website enquiries now show **Create agreement** in Today and Customers when no active linked agreement exists. One tap runs a server-side conversion and opens the resulting draft in the approved agreement editor. When an active agreement already exists, the customer displays **Open agreement** instead.

The conversion is repeat-safe. It uses a deterministic agreement identity, a stored idempotency record, and an active source-link check. Repeated taps, refreshes, and recoverable retries return the same agreement instead of creating duplicates. Successful creation writes actor-aware audit, timeline, and sales-activity events.

Customer identity fields prefill directly. Product and website base price prefill only when the product match is exact or uniquely trustworthy. The original product wording and message remain in an amber **Website enquiry context — not yet contractual** panel. They are not rendered into the customer agreement and do not become specifications, alterations, pricing, or delivery promises unless the GM deliberately enters them into the structured fields.

## Data behaviour

`admin-sales-workspace` is a read-only projection over existing source stores:

- `customer-enquiries`
- `customer-lead-status`
- `byondrv-contracts`
- `customer-orders`
- the generated product catalogue

It does not migrate, delete, or rewrite source records. Exact normalised email is used first for the customer projection, followed by exact normalised phone. Name-only matching is not performed.

Enquiry pipeline estimates come from the matched website base price. Agreement values come from the agreement line items. An enquiry linked to an agreement is not counted a second time in the headline pipeline estimate. POA or unmatched products show **Value to confirm**.

## Role routing and rollback

- `gm` opens the sales workspace.
- `owner`, `site_admin`, and `legacy_admin` continue to open the existing admin panel.
- The Edge Function protects `/admin/*` and validates both actor-aware and temporary legacy sessions.
- The old shared-password path remains available during the migration window documented in [`GM-SALES-PHASE-0-OPERATIONS.md`](./GM-SALES-PHASE-0-OPERATIONS.md).

The GM shell, technical panel, and agreement editor are separate lazy-loaded browser bundles. Opening Today does not load the technical admin or agreement editor code.

## Verification completed locally

- Pure projection tests cover commercial ranking, exact-contact customer merging, pipeline values, and exclusion of closed work.
- Conversion tests cover exact trusted product/price prefill, ambiguous-product refusal, non-contractual context isolation, and suppression of duplicate enquiry actions after linking.
- The GM mobile workflow passes Chromium, Firefox, and WebKit at a 320 × 568 iPhone SE-class viewport.
- The complete enquiry-to-agreement browser workflow passes all five configured desktop and mobile browser projects.
- Mobile navigation targets are at least 48px high.
- The complete Chromium suite passes, including the existing technical admin, enquiry, voice, public layout, shop, cart, performance, and smoke tests.
- Type checking, the full unit suite, Astro production build, and Netlify Function/Edge Function packaging must remain green before staging.

## Known boundaries before staging adoption

This is the initial GM shell and first conversion slice, not the completed commercial workflow:

- no one-touch follow-up outcome logging yet;
- no automatic creation of the next follow-up yet;
- no workshop voice-note capture yet;
- no dedicated persisted customer record is created during conversion yet; the current exact-contact customer projection and stable enquiry/opportunity/agreement links are retained;
- product-specific approved inclusions and structured alteration readiness still require the next agreement-workflow slice;
- no new deposit verification or build-release mutation from this shell yet;
- no production default change has been deployed;
- role/capability migration for older technical endpoints remains an explicit security gate before production rollout.

The next implementation slice should add one-touch follow-up outcomes and automatic next follow-ups, then continue simplifying agreement preparation around product-specific approved inclusions and structured alterations.
