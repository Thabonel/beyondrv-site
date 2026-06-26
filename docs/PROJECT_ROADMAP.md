# Beyond RV Project Roadmap

Last updated: 2026-06-26

This roadmap is the working queue for Codex.

Only items in the **Active Roadmap** should be implemented by default.

Do not start anything in **Future Backlog** unless the user explicitly asks for it.

Completed, duplicate, and superseded PRD items are recorded in [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md).

## Active Roadmap

These are the only items Codex should treat as current development.

### 1. Inventory and container planning

Why this is still needed: the shared commerce model exposes stock-planning fields, but there is no full operational planning workflow for demand history, reorder planning, or container decision-making.

Files likely to change: `src/content/config.ts`, `netlify/functions/admin-product-edit.ts`, `netlify/functions/admin-dashboard.ts`, `src/components/AdminDashboard.tsx`, and `src/components/AdminPanel.tsx`.

Dependencies: the order lifecycle, shipping status data, and lead/demand signals from enquiries.

Acceptance criteria: owners can see demand history, internal stock estimates, reorder quantities, container ETA cues, and planning signals per product from admin.

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

- 3D Configurator
- Experimental features
- Nice-to-have UX enhancements
- AI Owner Copilot
- SMS & Contract Intelligence
