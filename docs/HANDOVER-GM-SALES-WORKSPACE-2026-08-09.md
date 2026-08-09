# Beyond RV GM Sales Workspace — Complete Engineering Handover

**Handover date:** 9 August 2026

**Repository:** `github.com/Thabonel/beyondrv-site`

**Local workspace:** `/Users/thabonel/Code/Byond_RV`

**Current branch:** `staging`

**Implementation base:** `8227ed5` (`test: support Netlify deploy preview checks`)

**Implementation state:** Saved in a local checkpoint commit on `staging`; use `git log -1` for its current commit ID

**Deployment state:** Not pushed and not deployed

**Production authorisation:** Not granted

---

## 1. Executive summary

Beyond RV's sales process happens primarily by phone and on the workshop floor. The GM answers calls, discusses the customer's vehicle and desired camper, negotiates products, prices and alterations, invites customers to inspect samples or sends photographs, prepares the existing approved agreement, and waits for a bank-transfer deposit. Most of that work was not being captured in the website admin because using the old admin required the GM to recreate work he had already completed.

The approved product direction is therefore not a conventional CRM task system and not a covert owner-monitoring dashboard. It is a small, mobile-first sales workspace designed around the GM's real workflow. The agreement is the main adoption point: the system must be faster and safer than the existing Word-document process, while the same actions automatically create the necessary structured sales history.

The local implementation now includes:

1. Actor-aware authentication for GM, owner, site administrator and temporary legacy administrator sessions.
2. Server-enforced roles and capabilities for the new sales and agreement paths.
3. A separate four-area GM interface: **Today**, **Customers**, **Agreements** and **Builds**.
4. A commercially ranked Today queue built from existing enquiries, agreements and builds.
5. Direct phone links and mobile touch targets suitable for an iPhone SE-class viewport.
6. The existing business-approved agreement editor inside the GM workspace.
7. One-click website enquiry → agreement conversion.
8. Server-side duplicate protection for enquiry conversion.
9. Trustworthy customer, product and base-price prefill.
10. Explicit isolation of free-text customer requests as **not yet contractual**.
11. Actor-attributed audit, timeline and sales-activity events.
12. Session logout and emergency revocation controls.

The implementation has passed local type checking, unit testing, production builds, Netlify function/edge packaging, a full Chromium regression suite, and the new GM workflow across all five configured browser/device projects.

The system is not ready for production promotion yet. It still needs staging configuration and acceptance testing, completion of older endpoint capability migration, one-touch follow-up outcomes, automatic next follow-ups, further agreement acceleration, workshop voice capture and the later deposit/build-release workflow.

---

## 2. Product decision and operating principles

The following decisions are authoritative for continued implementation.

### 2.1 The GM is the primary operational user

- The owner does not normally operate the admin.
- The owner may still receive and handle occasional customer calls ad hoc.
- The business cannot depend on the owner re-entering or policing the GM's work.
- The GM interface must provide immediate operational value during the real sales process.
- Normal GM navigation must remain small and must not expose technical website administration.

### 2.2 The approved agreement is the central record

- The agreement already in the application is the agreement used by Beyond RV.
- Do not redesign or rewrite its customer-facing wording without explicit authorisation.
- New internal metadata may be added, but it must not silently change the customer document.
- Price, inclusions, alterations, delivery promises and other commercial commitments require deliberate human confirmation.
- The agreement must remain compatible with its existing validation, immutable final copy, revision, addendum and acceptance-evidence controls.

### 2.3 The system records work as the GM performs it

- Do not require manual task creation.
- Completing the real business action should update the relevant state and activity history.
- Follow-ups should be derived from unresolved promises and lifecycle events.
- The label **Tasks** must not appear in normal GM navigation.
- Avoid red compliance-style overdue counters; use commercially useful language such as people waiting and value in play.

### 2.4 AI remains an assistant, not a commercial decision-maker

AI may later transcribe, match, extract, summarise and propose changes. It must not independently:

- invent or approve prices;
- turn uncertain customer wording into contractual inclusions;
- approve or send an agreement;
- verify a deposit;
- approve a drawing;
- release a build to production.

### 2.5 Monitoring must be transparent

- Do not build a secret owner-monitoring dashboard.
- Owner and GM views may use the same disclosed operational history, subject to their roles.
- The goal is a reliable shared pipeline, not surveillance.

---

## 3. Source documents

Continue from these documents rather than reconstructing the design from chat history:

- [`plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md`](./plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md) — complete product requirements document.
- [`GM-SALES-PHASE-0-OPERATIONS.md`](./GM-SALES-PHASE-0-OPERATIONS.md) — authentication, environment, revocation, rollout and rollback operations.
- [`GM-SALES-PHASE-1-WORKSPACE.md`](./GM-SALES-PHASE-1-WORKSPACE.md) — implementation note for the GM shell and first conversion slice.
- [`CONTRACT-WORKFLOW-RUNBOOK.md`](./CONTRACT-WORKFLOW-RUNBOOK.md) — approved agreement preparation, sending, acceptance, revision and addendum procedure.
- [`PROJECT_ROADMAP.md`](./PROJECT_ROADMAP.md) — active implementation queue and deferred work.
- [`CONFIGURATOR-PHASE-2-OPERATIONS.md`](./CONFIGURATOR-PHASE-2-OPERATIONS.md) — related drawing/configuration/build workflow.

This handover describes the current engineering state. If it conflicts with a later explicit owner decision, the later decision wins and should be recorded in the PRD and roadmap.

---

## 4. Git and deployment truth

At the completed checkpoint:

- The checked-out branch is `staging`.
- The implementation started from `origin/staging` at `8227ed5`.
- All GM workspace work described here is saved in one local checkpoint commit on top of that base.
- The checkpoint has not been pushed.
- No Netlify Deploy Preview contains this complete local implementation.
- Production remains on its previously deployed code.
- Do not interpret the successful local `npx netlify build` as a deployment; it only validates Netlify packaging locally.

Before any future commit, review the complete working tree carefully. The workspace remains dirty with unrelated files that were deliberately excluded from the GM workspace checkpoint:

- `playwright-report/index.html` — generated/modified browser-test report; it was already dirty during this work.
- `work/` — untracked workspace directory; ownership/content is outside this feature and must not be committed automatically.
- `docs/ByondRV-Configurator-PRD-and-Database-Design.md` — unrelated untracked document; preserve it and do not assume it belongs in the GM workspace commit.

Use focused staging. Do not use blanket commands such as `git add .` until every untracked and modified file has been classified.

---

## 5. Implemented architecture

### 5.1 Request and UI flow

```text
/admin
  |
  v
Edge admin gate validates signed session
  |
  v
AdminApp calls admin-session
  |
  +-- role = gm -----------------> GmSalesWorkspace
  |                                  |-- Today
  |                                  |-- Customers
  |                                  |-- Agreements
  |                                  `-- Builds
  |
  `-- owner/site_admin/legacy ----> Existing AdminPanel

GM taps Create agreement
  |
  v
POST admin-enquiry-agreement
  |-- verify actor and capabilities
  |-- recover previous idempotent result if present
  |-- find source website enquiry
  |-- return active linked agreement if one exists
  |-- match only a trustworthy catalogue product
  |-- create deterministic draft agreement
  |-- store idempotency result
  |-- append audit, timeline and sales activity
  `-- return draft
       |
       v
GM workspace opens that draft in ContractManager
```

### 5.2 Browser bundle separation

The role-specific applications are loaded separately:

- `AdminApp` is the lightweight role router.
- `GmSalesWorkspace` is lazy-loaded only for the GM.
- `AdminPanel` is lazy-loaded only for owner, site administrator and legacy sessions.
- `ContractManager` is lazy-loaded only when the GM opens Agreements.

This separation matters. The technical admin is not merely hidden with CSS, and opening the GM Today screen does not download the large technical admin application.

### 5.3 Source-store projection

The GM workspace currently projects existing records. It does not perform a destructive migration.

Inputs:

| Store/source | Purpose |
|---|---|
| `customer-enquiries` | Website enquiry identity, contact details and requested product/context |
| `customer-lead-status` | Current lead state, last contact and next follow-up date |
| `byondrv-contracts` | Agreement status, value, customer and source links |
| `customer-orders` | Deposit/build state and operational dates |
| generated `product-catalogue.json` | Website product identity, category and current base price |

Supporting stores introduced by this work:

| Store | Purpose |
|---|---|
| `sales-activity-events` | Append-only, actor-attributed operational activity |
| `sales-command-idempotency` | Hashed command identities and completed target records |

Existing audit and owner timeline stores are also appended to by agreement conversion. No store is deleted or rewritten in bulk.

---

## 6. Authentication and authorisation

### 6.1 Roles

| Role | Browser experience | Intended authority |
|---|---|---|
| `gm` | New four-area sales workspace | Sales, agreements, configurations, deposits/build operations as capability-gated |
| `owner` | Existing technical/business admin | Full commercial, technical, integration and audit authority |
| `site_admin` | Existing technical admin | Site/integration operations and commercial read access; no commercial commitments |
| `legacy_admin` | Existing admin compatibility route | Temporary full compatibility while shared-password migration remains active |

The capability model is defined in `netlify/functions/admin-auth.ts`. UI visibility is not considered security; each sensitive function must enforce its required capability server-side.

### 6.2 Sessions

- New actor-aware tokens use signed version-2 session payloads.
- Existing version-1 sessions remain temporarily readable during migration.
- Sessions expire after eight hours.
- Unsafe cookie-authenticated mutations require same-origin headers.
- `admin-session` returns the current actor and capabilities.
- `admin-logout` clears the session cookie.
- The Edge Function protects `/admin`, `/admin/` and `/admin/*`.

### 6.3 Required Netlify environment configuration

Configure these in a Deploy Preview context first:

| Variable | Purpose |
|---|---|
| `ADMIN_COOKIE_SECRET` | Long random signing secret; do not reuse a password |
| `ADMIN_GM_PASSWORD` | Temporary GM password |
| `ADMIN_GM_NAME` | GM audit display name |
| `ADMIN_OWNER_PASSWORD` | Temporary owner password |
| `ADMIN_OWNER_NAME` | Owner audit display name |
| `ADMIN_SITE_ADMIN_PASSWORD` | Temporary site-administrator password |
| `ADMIN_SITE_ADMIN_NAME` | Site-administrator audit display name |
| `ADMIN_PASSWORD` | Temporary shared-password rollback compatibility only |
| `CONTRACT_TERMS_APPROVED_VERSION` | Must equal `2026-08-09-v1-business-approved` before preparing/sending new approved-version agreements |

Use distinct high-entropy passwords. Login identifiers are `gm`, `owner` and `site-admin`.

### 6.4 Session revocation controls

Set a current ISO timestamp or Unix epoch in milliseconds and redeploy:

- `ADMIN_SESSION_VALID_AFTER` — revoke all earlier sessions.
- `ADMIN_GM_SESSION_VALID_AFTER`
- `ADMIN_OWNER_SESSION_VALID_AFTER`
- `ADMIN_SITE_ADMIN_SESSION_VALID_AFTER`
- `ADMIN_LEGACY_SESSION_VALID_AFTER`

Do not remove `ADMIN_PASSWORD` until all individual accounts have passed preview testing and the rollback window has ended.

### 6.5 Deferred login change

Phone-number login with a one-time SMS code is intentionally on the future backlog. When implemented, it must reuse the same actor IDs, roles, capabilities, audit attribution and revocation system. It requires an additional threat review for short expiry, single use, replay protection, rate limiting, delivery failure, SIM-swap recovery, privacy, provider cost and emergency account recovery.

---

## 7. GM workspace behaviour

### 7.1 Today

Today displays:

- people waiting;
- estimated pipeline value;
- agreements requiring completion;
- active builds;
- ranked best-next-action cards.

Actions are sorted by:

1. commercial/readiness priority group;
2. estimated value descending;
3. staleness descending;
4. customer name.

Website enquiry values come from matched website base prices. Agreement values come from their line items. Linked enquiries are not counted a second time. POA and untrusted product matches show **Value to confirm**.

### 7.2 Customers

Customers are a non-destructive projection merged by:

1. exact normalised email;
2. otherwise exact normalised phone.

Name-only matching is deliberately not performed. Each customer card may provide Call, Email, Create agreement or Open agreement depending on available data and links.

The current conversion does not yet persist a dedicated canonical customer record. That is a known follow-on item; it must preserve the conservative matching rule and require human resolution for ambiguous duplicates.

### 7.3 Agreements

The GM uses the existing `ContractManager`, including its current:

- buyer and product fields;
- structured line items;
- specifications and exclusions;
- 30/20/50 calculation logic;
- validation and preview;
- business approval control;
- immutable final-copy snapshot;
- Gmail-assisted manual sending procedure;
- acceptance evidence;
- revisions and addenda.

The customer-facing wording was not redesigned. New records use:

- template version `12c-master-v2-manual-acceptance`;
- terms version `2026-08-09-v1-business-approved`;
- business approval version `2026-08-09-v1`.

### 7.4 Builds

The initial GM view is read-focused. It shows active build/order state, deposit verification status, next action, expected arrival and expected handover. New deposit verification and production-release mutations are not yet exposed through this simplified shell.

### 7.5 Mobile behaviour

- Four fixed bottom navigation targets are used on narrow screens.
- Primary touch targets are at least 48px high.
- The layout is tested at 320 × 568 pixels.
- Phone numbers use `tel:` links.
- A `tel:` link records no call duration and cannot detect calls made outside the system. True passive call capture would require a lawful telephony/VOIP integration and separate compliance review.

---

## 8. Enquiry-to-agreement conversion

### 8.1 User behaviour

- An unlinked website enquiry shows **Create agreement**.
- A linked active agreement is opened rather than recreated.
- One tap calls the server conversion endpoint.
- The resulting draft opens immediately in Agreements.
- After linking, the standalone enquiry action is suppressed so Today does not show duplicate enquiry and agreement work.

### 8.2 Duplicate protection

The endpoint uses multiple protections:

1. Idempotency scope: `enquiry:agreement`.
2. Raw command identity: `website-enquiry:<enquiryId>`.
3. The stored key contains a SHA-256 hash, not the raw enquiry ID.
4. Existing idempotent results are recovered first.
5. Existing non-cancelled/non-superseded agreements with the same `sourceEnquiryId` are returned.
6. Newly created agreements use deterministic IDs derived from the enquiry ID.

The deterministic form is:

```text
agreement-enquiry-<first 24 hex characters of SHA-256(enquiryId)>
```

The contract number is stable for the source enquiry and includes the enquiry submission date where it is valid.

Concurrent requests may theoretically append more than one diagnostic event, but they converge on one deterministic agreement record rather than creating separate sale agreements. The UI also disables conversion while a request is in progress.

### 8.3 Prefill trust boundary

Automatically copied:

- source enquiry ID;
- stable opportunity link;
- buyer name;
- buyer email;
- buyer phone;
- exact or uniquely trustworthy catalogue product;
- that product's current website base price at the moment of conversion.

Not automatically converted into contractual terms:

- arbitrary enquiry text;
- requested alterations;
- negotiated extras not represented by a trusted base product;
- delivery dates or promises;
- specifications inferred from customer wording;
- ambiguous product matches;
- POA or unavailable price guesses.

Product matching first attempts an exact normalised title or slug. A contained-text match is accepted only when it is sufficiently specific and uniquely identifies one product. Ambiguous or short wording produces an empty product/line-item selection for GM confirmation.

### 8.4 Non-contractual sales context

Agreement records may contain an internal `salesContext` object:

```ts
{
  source: string;
  sourceReference: string;
  enquiryMessage: string;
  statedProductInterest: string;
  submittedAt: string;
  capturedAt: string;
}
```

The editor renders this in an amber panel titled **Website enquiry context — not yet contractual**. It explains that the content becomes part of the customer agreement only if the GM deliberately transfers it into structured product, pricing, specification or delivery fields.

`salesContext` is not rendered by `renderContractHtml`. Automated tests explicitly verify that customer free text remains preserved internally but absent from the customer-facing agreement output.

### 8.5 Activity created on successful conversion

A new conversion appends:

- an owner audit event;
- an owner timeline event;
- a shared sales activity event with actor, source enquiry, opportunity and agreement links.

The system does not autonomously approve, prepare or send the agreement.

---

## 9. File-level implementation map

### 9.1 New files

| File | Responsibility |
|---|---|
| `src/components/AdminApp.tsx` | Loads session actor and routes GM to the sales workspace; other roles to the existing panel |
| `src/components/GmSalesWorkspace.tsx` | Four-area mobile GM UI, workspace loading, calls, customer search and enquiry conversion |
| `netlify/functions/admin-session.ts` | Returns authenticated actor and capabilities |
| `netlify/functions/admin-logout.ts` | Clears admin session |
| `netlify/functions/admin-sales-workspace.ts` | Authenticated read-only workspace projection endpoint |
| `netlify/functions/sales-workspace-core.ts` | Pure customer/action/agreement/build projection, valuation and ranking |
| `netlify/functions/admin-enquiry-agreement.ts` | Authenticated, idempotent enquiry → agreement command |
| `netlify/functions/enquiry-agreement-core.ts` | Trustworthy product matching and safe draft prefill |
| `netlify/functions/command-idempotency-core.ts` | Hashed idempotency records |
| `netlify/functions/sales-activity-core.ts` | Shared actor-attributed activity events |
| `tests/admin-auth.test.ts` | Actor sessions, roles, CSRF/origin and revocation tests |
| `tests/sales-foundation.test.ts` | Idempotency and activity-event tests |
| `tests/sales-workspace-core.test.ts` | Workspace ranking, customer merge, closed-work and linked-action tests |
| `tests/enquiry-agreement-core.test.ts` | Trusted/ambiguous product and non-contractual rendering tests |
| `tests/e2e/gm-sales-workspace.spec.ts` | Mobile GM shell and one-click conversion browser workflow |
| `docs/GM-SALES-PHASE-0-OPERATIONS.md` | Environment, rollout and rollback runbook |
| `docs/GM-SALES-PHASE-1-WORKSPACE.md` | Implemented workspace/conversion notes |
| `docs/plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md` | Full approved product requirements |

### 9.2 Important modified files

| File/group | Change |
|---|---|
| `src/pages/admin.astro` | Mounts `AdminApp` instead of loading the technical panel directly |
| `src/components/ContractManager.tsx` | Accepts an initial agreement ID and displays non-contractual enquiry context |
| `netlify/functions/admin-auth.ts` | Actor-aware v2 sessions, roles, capabilities, v1 compatibility, origin checks and revocation |
| `netlify/edge-functions/admin-gate.ts` | Validates v1/v2 sessions and role/global revocation for all admin paths |
| `netlify/functions/contract-core.ts` | Accurate business-approved identifiers, stable source/actor links and internal `salesContext` |
| `netlify/functions/admin-contracts.ts` | Capability enforcement, actor attribution, idempotency and sales activity |
| agreement acceptance/revision/addendum/preview functions | Capability and actor-aware safety updates |
| configuration-contract function | Capability and actor linkage updates |
| `netlify/functions/owner-copilot-store-utils.ts` | Actor identity in audit records |
| `docs/PROJECT_ROADMAP.md` | Current local implementation state and next gate |
| `docs/CONTRACT-WORKFLOW-RUNBOOK.md` | Correct business-approval version and rollout steps |
| `tests/contract-core.test.ts` | Business approval, source links and actor metadata coverage |

Do not assume every older admin endpoint has completed capability migration. Search for remaining uses of legacy-only `isAdminAuthorized` before staging adoption, classify each endpoint by required capability, and add server-side tests for commercial mutations.

---

## 10. Automated verification completed

The following checks passed on 9 August 2026 after the implementation described here.

### 10.1 Type checking

```bash
npm run check
```

Result: **0 errors**. Astro reports existing hints from legacy/generated files; those were not introduced as blocking errors.

### 10.2 Unit tests

```bash
npm test
```

Result: **152 passed, 0 failed**.

After the final non-contractual-render assertion was added, the two directly affected test files were rerun:

```bash
node --test --experimental-strip-types \
  tests/enquiry-agreement-core.test.ts \
  tests/sales-workspace-core.test.ts
```

Result: **6 passed, 0 failed**.

### 10.3 Astro production build

```bash
npm run build
```

Result: passed; 41 pages built. Vite reports an existing large-chunk advisory. The GM route itself is separated through lazy loading; the advisory should still be tracked but did not fail the build.

### 10.4 New GM workflow across all configured projects

```bash
npx playwright test tests/e2e/gm-sales-workspace.spec.ts
```

Result: **10 passed** across:

- Chromium desktop;
- Firefox desktop;
- WebKit desktop;
- mobile Chrome;
- mobile Safari.

The spec uses a 320 × 568 viewport for its GM mobile checks.

### 10.5 Full Chromium regression

```bash
npx playwright test --project=chromium-desktop
```

Result: **75 passed, 0 failed**. This includes technical admin, enquiry, voice, public layout, shop, cart, performance, smoke and GM tests.

The entire repository suite was not rerun across all five browser projects. Only the new GM spec ran in all five; the complete regression suite ran in Chromium. Maintain this distinction in release reporting.

### 10.6 Netlify packaging

```bash
npx netlify build
```

Result: passed. Astro build, Netlify Functions and Edge Functions were packaged successfully, including:

- `admin-enquiry-agreement`;
- `admin-sales-workspace`;
- `admin-session`;
- `admin-logout`;
- `admin-gate`.

### 10.7 Diff integrity

```bash
git diff --check
```

Result: passed.

---

## 11. Known gaps and risks

### 11.1 Must address before a GM staging pilot

1. Complete the audit of older admin Functions still using legacy `isAdminAuthorized` and enforce the correct capability on every commercial mutation.
2. Create a focused commit or commit series without including unrelated dirty files.
3. Push a non-production branch and create a Netlify Deploy Preview.
4. Configure individual preview accounts and the exact agreement approval version.
5. Test real Netlify Blob read/write behaviour; browser mocks and local packaging do not prove production Blob configuration.
6. Test the complete agreement prepare/download/Gmail/mark-sent/acceptance workflow using marked internal data.
7. Confirm the GM, owner and site-administrator permission boundaries in the deployed preview.
8. Verify rollback using the previous deploy and legacy login compatibility.

### 11.2 Product gaps in the active PRD

- No one-touch call outcome buttons yet.
- No automatic replacement/next follow-up after an outcome.
- No automatic new-enquiry follow-up persisted at `+1 business day` yet; the current projection derives attention from existing data.
- No customer appointment mini-calendar in the GM shell.
- No persisted canonical customer creation during enquiry conversion.
- No persistent create-agreement action for phone-only or walk-in customers across all four areas.
- Product-specific approved inclusion sets are incomplete in the fast agreement flow.
- Custom alterations still need structured price, factory-confirmation, drawing, weight and delivery-readiness fields.
- No workshop voice-note shortcut, transcription or proposed-action confirmation flow.
- No phone-click/outcome recovery or SMS fallback.
- No new deposit verification control in the simplified shell.
- No automated accepted-agreement → deposit milestones → immutable build input → China/shipping/local finishing release flow in this workspace.
- Source CAD/GLB model bindings remain dependent on files from China and the separate configurator workflow.
- The three POA Unimog products remain blocked on owner-supplied base prices.
- Phone/SMS-code login is deferred.

### 11.3 Data limitations

- Existing records may contain duplicate customers, future/test timestamps or incomplete links.
- Customer projection merging is conservative and may leave duplicates rather than risk joining different people.
- Website prices are trusted only as the captured base starting price. Negotiated changes and all alterations must be explicitly entered.
- Later website price changes do not change an existing agreement line item after creation.
- A `tel:` click cannot prove that a conversation occurred or capture calls made directly from personal contacts.
- Bank deposits are not verified automatically. Customer-reported payment and verified payment must remain separate states.

### 11.4 Legal, privacy and operational boundaries

- Do not add call recording without Australian legal/privacy review and clear notice/consent requirements.
- Automated SMS/calling may engage Australian Spam Act, Privacy Act, Do Not Call Register and telecommunications obligations; verify before deployment.
- Do not put bank details, access tokens, full private correspondence or unnecessary customer data into activity summaries.
- Do not send customer agreements autonomously.
- Do not release production from reported but unverified payment.

---

## 12. Recommended continuation sequence

### Step 1 — Finish capability migration

1. Search all `netlify/functions/admin-*.ts` files for `isAdminAuthorized`.
2. Classify each endpoint as read-only sales, sales mutation, agreement read/write/approve/send/acceptance, site operation, integration, deposit verification or build release.
3. Replace legacy-only checks with `getAdminActor` plus the narrowest appropriate capability.
4. Pass the actor into every audit-producing mutation.
5. Add negative tests proving `site_admin` cannot make commercial commitments.

Do this before adding more GM mutation controls.

### Step 2 — One-touch outcome logging

Add server commands and large card actions that resolve the current sales action and write one activity event in the same operation. Suggested initial outcomes:

- **No answer** — record attempt and schedule the next follow-up for two days later.
- **Spoke — follow up** — record contact and select/confirm the promised follow-up date.
- **Not proceeding** — close as lost after one-tap reason: price, timing, product fit or other.
- **Visit booked** — record appointment date/time and make the appointment the next Today item.
- **Agreement in progress** — open/create the linked agreement rather than creating a separate task.

Use idempotency on each command. A repeated outcome tap must not produce multiple next follow-ups or activity events.

### Step 3 — Derive follow-ups automatically

Follow-ups should be projections of unresolved lifecycle events, including:

- new enquiry;
- promised callback;
- photos/information promised;
- booked visit;
- agreement sent and awaiting response;
- customer-requested change;
- customer-reported deposit awaiting verification;
- build clarification or delivery milestone.

Completing the underlying action must close or replace the follow-up automatically. Do not introduce a separate task-completion gesture.

### Step 4 — Make the agreement decisively faster than Word

1. Add a persistent **Create agreement** entry point for phone-only and walk-in customers.
2. Persist or resolve a canonical customer safely.
3. Load product-specific approved base inclusions when they are actually verified.
4. Add structured alterations with price/reason/factory/drawing/weight/delivery state.
5. Present one readiness review before approval/preparation.
6. Preserve the existing immutable final-copy, revision, addendum and evidence model.

### Step 5 — Workshop voice capture

Implement only after the deterministic manual commands exist. The voice feature should propose those same validated commands rather than bypass them.

Target flow:

1. GM opens an installed phone Home Screen shortcut.
2. GM taps a large microphone button and dictates a short post-call summary.
3. Server transcribes and extracts a strict structured proposal.
4. The UI shows **Here is what I understood**.
5. Customer match, money, dates, contractual fields and production effects remain explicit confirmations.
6. One confirmed command applies all linked updates idempotently.
7. Audio is deleted according to an approved short retention policy.

### Step 6 — Deposit and build handoff

After agreement acceptance:

- record customer-reported payment separately;
- require authorised deposit verification with amount, date and bank reference;
- require current agreement/configuration/drawing readiness;
- create one immutable build-input snapshot;
- create/link China manufacture, shipping, local finishing and handover stages;
- create/link 20% arrival and 50% delivery payment milestones;
- make release idempotent and explicitly authorised.

---

## 13. Staging deployment procedure

Do not push directly to `main`.

1. Review `git status` and separate unrelated files.
2. Rerun:

   ```bash
   npm run check
   npm test
   npm run build
   npx playwright test --project=chromium-desktop
   npx playwright test tests/e2e/gm-sales-workspace.spec.ts
   npx netlify build
   git diff --check
   ```

3. Create focused commits on `staging` or a `codex/...` feature branch according to the team's chosen review workflow.
4. Push the non-production branch.
5. Confirm Netlify creates a Deploy Preview. Do not rely on a previous preview URL.
6. Add preview-scoped environment variables from Section 6.
7. Trigger a fresh preview build after environment changes.
8. Run the acceptance checklist below against the exact generated preview URL.
9. Record the deploy ID, commit SHA, tester, date and results.
10. Promote only after explicit owner authorisation.

Production auto-publishes from `main`. Merging to `main` is therefore a production action and must not be treated as a harmless code merge.

---

## 14. Deploy Preview acceptance checklist

### 14.1 Authentication and roles

- [ ] GM signs in as `gm` and lands on the four-area workspace.
- [ ] Owner signs in as `owner` and sees the existing full admin.
- [ ] Site administrator signs in as `site-admin` and sees technical admin.
- [ ] Site administrator receives `403` for agreement mutation/approval/send, deposit verification and build release.
- [ ] Sign out clears the session.
- [ ] Old legacy login works only during the deliberate rollback window.
- [ ] A GM-specific session cutoff rejects the old GM session but not the owner session.

### 14.2 GM shell

- [ ] Today loads real preview Blob data without a 503.
- [ ] Counts and values reconcile with representative source records.
- [ ] Linked enquiry/agreement value is not counted twice.
- [ ] POA/unmatched items show **Value to confirm**.
- [ ] Customers can be found by name, email, phone and product text.
- [ ] Phone links open the device dialler.
- [ ] The four-area bottom navigation fits at 320px width.
- [ ] No technical-admin menu noise appears for the GM.

### 14.3 Enquiry conversion

- [ ] A marked test website enquiry displays **Create agreement**.
- [ ] One tap creates and immediately opens the draft.
- [ ] Name, email and phone are correct.
- [ ] An exact standard product and current base price are correct.
- [ ] An ambiguous/POA product does not receive a guessed price.
- [ ] The enquiry message appears only in the amber non-contractual panel.
- [ ] The enquiry message is absent from agreement preview/final HTML unless manually entered in a structured field.
- [ ] Repeated taps/refresh/retry return the same agreement ID.
- [ ] After conversion the customer shows **Open agreement**, not another create action.
- [ ] Audit, timeline and sales activity identify the GM actor.

### 14.4 Agreement regression

- [ ] Validate 30/20/50 calculations against a known value.
- [ ] Verify custom extras and discounts calculate correctly and require their existing reason controls.
- [ ] Confirm the approved seller identity and Mutdapilly address.
- [ ] Confirm the exact customer-facing wording has not changed.
- [ ] Save, review and approve a marked test agreement.
- [ ] Set/verify `CONTRACT_TERMS_APPROVED_VERSION=2026-08-09-v1-business-approved`.
- [ ] Prepare the immutable final copy and verify its digest.
- [ ] Download and inspect the document.
- [ ] Open the Gmail draft and use only internal test recipients.
- [ ] Mark sent and record test acceptance evidence.
- [ ] Verify prepared/sent records cannot be overwritten.
- [ ] Verify pre-acceptance revisions and post-acceptance addenda.

### 14.5 Regression and rollback

- [ ] Existing public pages, enquiry form, shop and cart remain functional.
- [ ] Existing technical admin operations remain accessible to authorised roles.
- [ ] Configuration/drawing links and production tracking still load.
- [ ] Previous known-good deploy is identified before promotion.
- [ ] Blob-store recovery/export controls have been checked in the Netlify account.

---

## 15. Rollback procedure

If the Deploy Preview fails:

1. Do not promote it.
2. Fix the preview branch or redeploy the last known-good commit.
3. Retain `ADMIN_PASSWORD` while the compatibility window is needed.
4. Do not delete `sales-activity-events` or `sales-command-idempotency`; they are additive diagnostic/history stores.
5. Do not delete or rewrite source enquiry, lead, agreement, configuration, order or build stores.
6. Restore a previous agreement approval environment value only with code that uses that exact matching version. Never force agreement preparation by setting an unrelated identifier.

If a production promotion later fails, restore the previous known-good production deploy in Netlify and revoke affected sessions if the failure involves access control.

---

## 16. Definition of done for the wider PRD

The full initiative is complete only when:

- the GM chooses the system because it is faster than the Word/manual workflow;
- every inbound enquiry appears in the sales workspace promptly;
- website, phone-only and walk-in customers can enter the same agreement workflow;
- real actions automatically create disclosed shared activity and next follow-ups;
- a standard agreement can be prepared in roughly 60–90 seconds without retyping known data;
- unconfirmed alterations cannot silently become contractual or production instructions;
- voice capture proposes safe structured actions and normally completes in under 30 seconds excluding dictation;
- sent agreements, revisions, addenda, acceptance evidence and build inputs remain immutable and retrievable;
- reported and verified deposits remain separate;
- one authorised release creates exactly one build and payment-milestone set;
- China manufacture, shipping, Mutdapilly finishing and handover are linked and visible;
- the owner can understand the same disclosed pipeline without operating a separate surveillance system;
- production rollout and rollback have passed owner acceptance testing.

---

## 17. Immediate next action

The safest next engineering action is to finish capability migration for remaining legacy admin endpoints before exposing more GM mutation controls. After that, implement one-touch call outcomes and automatic replacement follow-ups as idempotent server commands using the existing actor, activity and source-link foundations.

Do not deploy the current working tree directly to production.
