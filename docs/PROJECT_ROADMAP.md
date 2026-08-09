# Beyond RV Project Roadmap

Last updated: 2026-08-09

This roadmap is the working queue for Codex.

Only items in the **Active Roadmap** should be implemented by default.

Do not start anything in **Future Backlog** unless the user explicitly asks for it.

Completed, duplicate, and superseded PRD items are recorded in [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md).

## Active Roadmap

These are the only items Codex should treat as current development.

### 1. GM sales workspace, one-click agreements, and voice capture

Current state: Phase 0 foundations, the Phase 1 GM workspace, and the first Phase 2 enquiry-to-agreement conversion slice are implemented locally. GM sessions open a separate four-area, mobile-first Today/Customers/Agreements/Builds shell. Website enquiries can create or reopen one linked agreement with a single tap; trusted customer/product/base-price fields prefill, while free-text requests remain visibly non-contractual until the GM confirms them. Server-side idempotency, stable source links, actor audit, and sales activity prevent duplicate creation and preserve attribution. The existing technical admin remains the owner/site-admin/legacy rollback path. Nothing has been deployed.

Primary design: [`plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md`](./plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md).

Current implementation gate: complete the remaining role/capability migration for older endpoints, then add one-touch follow-up outcomes and automatic next follow-ups. Continue the fast-agreement slice with product-specific approved inclusions and structured alteration readiness before piloting the GM default in staging.

Acceptance criteria for the current gate: individual GM/owner/site-admin sessions produce actor-aware audit events and server-enforced capabilities; the current agreement wording and calculations remain unchanged; new agreement records use the business-approved version; stable source links and idempotency foundations are tested; existing shared-password sessions remain temporarily compatible for rollback.

Phase 1 implementation note: [`GM-SALES-PHASE-1-WORKSPACE.md`](./GM-SALES-PHASE-1-WORKSPACE.md).

### 2. Inventory and container planning

Why this is still needed: the shared commerce model exposes stock-planning fields, but there is no full operational planning workflow for demand history, reorder planning, or container decision-making.

Files likely to change: `src/content/config.ts`, `netlify/functions/admin-product-edit.ts`, `netlify/functions/admin-dashboard.ts`, `src/components/AdminDashboard.tsx`, and `src/components/AdminPanel.tsx`.

Dependencies: the order lifecycle, shipping status data, and lead/demand signals from enquiries.

Acceptance criteria: owners can see demand history, internal stock estimates, reorder quantities, container ETA cues, and planning signals per product from admin.

### 3. Admin-first visual camper configurator

Current state: Phase 2 is implemented in code. In addition to the Phase 1 pricing and rules foundation, the protected admin now has an operational catalogue editor, versioned drawing uploads/links and approvals, a GLB viewer foundation, secure expiring customer review links, recorded customer decisions, contract/customer approval gates, and a production tracker linked to customer orders. Production status reflects China manufacture and Mutdapilly finishing. The active catalogue contains the four slide-ons plus the priced 3.5m family camper, 4.7m hardtop camper, DIY camper box and Mercedes Sprinter. Three POA Unimog products remain inactive until base prices are supplied. The build has not been deployed.

Still needed: owner/factory validation of technical compatibility rules, internal costs and option weights; receipt and audit of the source CAD files; execution of the implemented GLB conversion pipeline and final node bindings; the three Unimog base prices; then owner acceptance testing and deployment. A broad public self-service configurator remains a later phase; the private customer approval page is implemented.

Primary design: [`plans/2026-08-08-admin-first-visual-configurator-prd.md`](./plans/2026-08-08-admin-first-visual-configurator-prd.md).

Acceptance criteria for the next gate: the owner approves a versioned internal catalogue, representative drawing → customer approval → snapshot → contract → deposit → production flows pass owner acceptance testing, and at least one supplied CAD asset passes the documented GLB conversion and binding workflow.

Operations: [`CONFIGURATOR-PHASE-2-OPERATIONS.md`](./CONFIGURATOR-PHASE-2-OPERATIONS.md).

## Completed

### Unified admin lifecycle view

Stage 1 is complete.

Status: the dashboard now shows Stripe orders and enquiries together through a shared normalized projection, with source labels, consistent status labels, safe date sorting, and tests for the normalization logic.

Source stores remain intact:

- `customer-orders`
- `customer-enquiries`

Design note: see [`UNIFIED-LIFECYCLE-DESIGN.md`](./UNIFIED-LIFECYCLE-DESIGN.md) for the remaining lifecycle follow-through stages.

## Launch Ops

These items are verified in code but still need external follow-through after deployment.

### Sitemap freshness and search recrawl

Current state: the build emits `lastmod` in `sitemap-0.xml`, and the SEO tooling already checks sitemap freshness.

Still needed: submit or verify the sitemap in Google Search Console and Bing Webmaster Tools, request recrawl for priority pages, and complete the launch checklist against the live domain.

Files likely to change: `docs/SEO-LAUNCH-CHECKLIST.md` and `docs/plans/2026-06-04-google-ai-search-growth-plan.md`.

Dependencies: a production deploy and verified search-console accounts.

Acceptance criteria: sitemap submission is confirmed in Google and Bing, representative pages are recrawled, and the launch checklist is fully checked off.

## Future Backlog

Do not implement these unless the user explicitly asks for them.

- Experimental features
- Nice-to-have UX enhancements
- AI Owner Copilot
- SMS & Contract Intelligence
- Phone-number login with a one-time SMS code. Replace password entry with an approved phone number plus short-lived single-use code, while retaining the Phase 0 user identity, role/capability checks, session revocation, audit attribution, rate limiting, expiry, replay protection, and recovery path. Do not implement until explicitly scheduled.
