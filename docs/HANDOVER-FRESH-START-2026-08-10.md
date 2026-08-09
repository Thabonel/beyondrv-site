# Beyond RV — Fresh Conversation Handover

**Date:** 10 August 2026  
**Workspace:** `/Users/thabonel/Code/Byond_RV`  
**Repository:** `github.com/Thabonel/beyondrv-site`  
**Branch:** `staging`  
**Current pushed commit:** `8806f66` — `fix: distinguish GM agreement actions`

## Start here

The staging branch is pushed and up to date with `origin/staging`. The current work is the GM sales workspace and agreement workflow. Continue that work without changing public production, agreement wording, or commercial data that has not been approved by the GM.

Read these first:

1. [`PROJECT_ROADMAP.md`](./PROJECT_ROADMAP.md)
2. [`HANDOVER-GM-SALES-WORKSPACE-2026-08-09.md`](./HANDOVER-GM-SALES-WORKSPACE-2026-08-09.md) — architecture and operational detail; its deployment-status section is historical and superseded by this document.
3. [`plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md`](./plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md)
4. [`CONTRACT-WORKFLOW-RUNBOOK.md`](./CONTRACT-WORKFLOW-RUNBOOK.md)

Suggested fresh-conversation prompt:

> Work in `/Users/thabonel/Code/Byond_RV` on branch `staging`. Read `docs/HANDOVER-FRESH-START-2026-08-10.md`, the GM sales PRD and the project roadmap. Continue the GM sales workspace build without waiting for GM-supplied commercial data. Preserve unrelated dirty files, make focused commits, push verified work to `staging`, and do not deploy production.

## What is already complete and pushed

### GM sales workspace

- Actor-aware authentication, sessions, audit attribution, role/capability checks, logout and revocation controls.
- Separate mobile-first GM interface with **Today**, **Customers**, **Agreements** and **Builds**.
- Existing technical admin remains the owner/site-admin/legacy route.
- Today projects live enquiries, agreements and build signals into a commercially ranked queue.
- Phone and email actions, customer context and agreement access are available from the GM workspace.

### Agreements

- Website enquiry → agreement conversion is one click and server-side idempotent.
- Trusted customer, catalogue product and base-price data prefill the draft.
- Free-text customer requests remain visibly non-contractual until deliberately confirmed.
- Actor-attributed audit, owner timeline and sales-activity events are recorded.
- The header **New agreement** action intentionally opens a blank agreement for phone/walk-in customers; a card-level **Create agreement** action converts a specific website enquiry. This wording avoids ambiguity and is covered by browser testing.

### Sales outcomes

- `POST /.netlify/functions/admin-sales-outcome` is capability-gated by `sales:write` and idempotent.
- Supported outcomes are `no_answer`, `follow_up`, `visit_booked`, `not_proceeding` and `agreement_in_progress`.
- No answer schedules a replacement follow-up two days later.
- Follow-up and visit outcomes require a date; not proceeding requires a reason and closes the follow-up state.
- The implementation writes lead status, audit/timeline and sales activity together.

### Other confirmed website work

- The four slide-on product pages now state the confirmed sleeping layout: **2 in cabover + 1 in converted dinette**.
- All existing `admin-*` functions have been migrated to server-enforced capability checks; UI visibility is not relied on for security.

## Current code landmarks

| Area | Main files |
|---|---|
| GM UI | `src/components/GmSalesWorkspace.tsx` |
| Role and capabilities | `netlify/functions/admin-auth.ts` |
| Outcome command | `netlify/functions/admin-sales-outcome.ts` |
| Outcome rules | `netlify/functions/sales-outcome-core.ts` |
| Activity history | `netlify/functions/sales-activity-core.ts` |
| Enquiry-to-agreement conversion | `netlify/functions/admin-enquiry-agreement.ts` |
| Agreement editor | `src/components/ContractManager.tsx` |
| GM browser tests | `tests/e2e/gm-sales-workspace.spec.ts` |
| Outcome unit tests | `tests/sales-outcome-core.test.ts` |

## Next implementation priority

Build the larger workflow foundations that do not depend on the GM’s commercial data, in this order:

1. Replace the temporary browser `window.prompt()` outcome collection in `GmSalesWorkspace.tsx` with proper mobile controls:
   - date input for follow-up and visit;
   - reason selector/input for not proceeding;
   - cancel/save state and clear success/error feedback;
   - retain one idempotency key for a retry of the same pending command.
2. Add browser coverage for those controls and broaden the outcome-rule unit tests.
3. Improve agreement entry for phone/walk-in customers while keeping customer requests non-contractual and leaving pricing/inclusions for explicit human confirmation.
4. Extend safe workflow foundations for deposits, build readiness and workshop voice capture only where they do not invent, approve or verify commercial facts. Voice should propose validated actions for a human to confirm; it must not bypass the normal commands.

Do **not** invent product-specific inclusions, alteration prices, weights, delivery commitments, factory approvals, drawing rules or customer-facing agreement wording. Those require the GM’s response.

## Information still required from the GM (Alex)

The build can continue without this information, but these inputs are required before the related workflow can be considered production-ready:

- approved standard inclusions and optional extras by product;
- alteration catalogue, price treatment, factory approval/drawing/weight implications and delivery-impact rules;
- accepted reasons/outcomes and preferred sales wording;
- examples of approved agreements and all data required to create one accurately;
- deposit/payment verification procedure and evidence requirements;
- current workshop/factory photos, drawings, CAD assets and handover points;
- the slowest or most frequently missed real-world steps.

## Verification already completed

At the current staging checkpoint:

- `node --test --experimental-strip-types tests/sales-outcome-core.test.ts` — **3 passed**.
- `npm run check` — passed with only existing legacy hints.
- `npm run build` — passed; the existing large-chunk warning remains non-blocking.
- `npx playwright test tests/e2e/gm-sales-workspace.spec.ts --project=chromium-desktop` — **2 passed**.

Run focused tests for any new slice, then at least `npm run check` and `npm run build` before pushing. Preserve the existing test setup unless a test is deliberately expanded.

## Git, staging and deployment rules

- `staging` is pushed through `8806f66`.
- Commit relevant implementation and documentation with focused `git add` paths; do not use `git add .`.
- Push verified commits to `origin/staging` so they can be inspected in the staging/deploy-preview environment.
- Do not deploy or promote to production without explicit authorisation.
- Configure and test the role-specific Netlify environment values in a deploy preview before a real GM pilot. The required names are listed in the historical GM handover, section 6.3.

## Working-tree boundaries

These items are user-owned or generated and must be preserved unless explicitly requested otherwise:

- `playwright-report/index.html` — generated report, currently modified.
- `docs/ByondRV-Configurator-PRD-and-Database-Design.md` — untracked document outside this GM slice.
- `work/` — untracked user workspace directory.

Check `git status --short` before every commit. Never reset, clean, overwrite or blanket-stage these paths.

## Definition of done for the current GM workflow gate

- The GM can record real outcomes on mobile without browser prompts.
- Follow-up/visit/lost outcomes reliably update the shared queue and activity history.
- A website enquiry and a phone/walk-in conversation can both start a safe agreement workflow.
- The system keeps uncertain customer requests and unapproved commercial information out of contractual commitments.
- The owner/GM can test the flow in staging with separate credentials and capability enforcement.
- The GM-provided catalogue/process data is then added, reviewed and accepted before production promotion.
