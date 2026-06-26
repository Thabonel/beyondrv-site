# PRD: ByondRV SMS + Contract Intelligence

Date: 2026-06-25
Owner: Beyond RV
Status: Draft for implementation planning

## Executive Summary

The implementation brief in `DOCS/BYONDRV_IMPLEMENTATION_BRIEF.md` describes two capabilities copied from Tradie Shield:

- contract analysis and contract generation
- SMS and MMS communication with the software

That brief assumes a React plus Vite frontend, a separate Node gateway, Supabase Auth, Supabase Postgres, Supabase Storage, Supabase Edge Functions, Twilio, and Anthropic Claude.

The current ByondRV repo is materially different. It is an Astro site deployed on Netlify, with Netlify Functions, a React admin surface inside Astro, OpenAI Responses API integrations, Netlify Blob-backed operational stores, product markdown content, and owner-copilot records already flowing through the admin system.

This PRD maps the brief onto the actual repository and defines the recommended ByondRV implementation path. The key decision is:

- keep the current Astro plus Netlify plus OpenAI application shape
- extend the existing admin and owner-copilot systems instead of introducing a separate gateway service in phase 1
- use Twilio for SMS ingress and egress
- store operational metadata in Netlify Blobs first where practical
- treat contract files and higher-volume relational querying as a possible trigger for introducing Postgres or external object storage in a later phase

The contract scope is also narrower than the original Tradie Shield brief. ByondRV already has a standard contract. The software does not need to invent a full legal-template system in phase 1. It needs to:

- generate a contract package from the existing standard contract plus the client's selected specifications, inclusions, optional extras, and commercial details
- preserve a clear list of what the client requested and what was quoted
- generate addendum documents when the client requests changes after signing
- keep an audit trail of feature changes, price changes, and approval history

## Source Inputs

- External brief:
  - `/Users/thabonel/.local/share/opencode/worktree/11ac4ce505de5a944c2d05b5166e334e549a4d8f/nimble-squid/DOCS/BYONDRV_IMPLEMENTATION_BRIEF.md`
- Current ByondRV implementation references:
  - `package.json`
  - `src/pages/admin.astro`
  - `src/components/AdminPanel.tsx`
  - `src/components/AdminDashboard.tsx`
  - `netlify/functions/blob-store.ts`
  - `netlify/functions/contact-submit.ts`
  - `netlify/functions/site-chat.ts`
  - `netlify/functions/admin-chat.ts`
  - `netlify/functions/admin-dashboard.ts`
  - `netlify/functions/owner-copilot-core.ts`
  - `netlify/functions/owner-copilot-record-sync.ts`

## Repo Mapping

### Current architecture

The current repository already has these reusable building blocks:

- Public website: Astro pages under `src/pages`
- Admin UI: React components mounted inside Astro, primarily `src/components/AdminPanel.tsx` and `src/components/AdminDashboard.tsx`
- Server logic: Netlify Functions under `netlify/functions`
- AI stack: OpenAI Responses API already used in `site-chat.ts`, `admin-chat.ts`, `admin-dashboard.ts`, `admin-product-recommendations.ts`, `admin-classify-enquiry.ts`, and `admin-generate-enquiry-response.ts`
- Operational persistence: Netlify Blob stores via `blob-store.ts`
- Lead and customer model: owner-copilot stores and sync helpers in `owner-copilot-core.ts` and `owner-copilot-record-sync.ts`
- Enquiry ingestion: `contact-submit.ts`
- Admin auth pattern: existing `x-admin-token` protected Netlify functions

### Architectural mismatch with the brief

The brief does not map one-to-one onto this repo because ByondRV currently does not have:

- Supabase Auth
- Supabase Postgres tables
- Supabase Storage buckets
- Supabase Edge Functions
- a separate Node gateway
- Twilio integration
- an SMS session store
- contract-analysis UI pages
- contract-analysis metadata or file storage

### Recommended mapping table

| Brief component | Brief assumption | Actual ByondRV surface | Recommended ByondRV implementation |
| --- | --- | --- | --- |
| Web contract upload | `/deal-guardian` React page | Astro public pages | Add `src/pages/deal-guardian/index.astro` with upload UI and report status polling |
| Dashboard reporting | Separate dashboard pages | Existing admin and public Astro/React surfaces | Add public customer report pages plus admin monitoring panels inside `AdminPanel.tsx` and `AdminDashboard.tsx` |
| Edge upload function | Supabase Edge Function | Netlify Function | Add `netlify/functions/contract-upload.ts` |
| Background analyser endpoint | Separate gateway route | Netlify Function layer only | Add internal processing function such as `netlify/functions/contract-analyse.ts` |
| Contract creation endpoint | Separate gateway route | Netlify Function layer only | Add `netlify/functions/contract-create.ts` |
| Change review endpoint | Separate gateway route | Netlify Function layer only | Add `netlify/functions/contract-review.ts` |
| SMS webhook | Supabase Edge Function | No current SMS ingress | Add `netlify/functions/sms-webhook.ts` for Twilio inbound |
| Async message processing | Gateway `POST /ingest` | No current message orchestrator | Add `netlify/functions/sms-process.ts` or equivalent deferred internal processor |
| Intent parsing | Claude Haiku | Existing OpenAI prompt pattern | Add `netlify/functions/sms-intent.ts` helper and keep provider consistent with OpenAI unless testing proves otherwise |
| Lead and user lookup | Supabase `users` table | Owner-copilot customer and lead stores | Reuse customer and lead matching logic from `owner-copilot-record-sync.ts` |
| SQL tables | Postgres tables | Blob JSON records today | Start with blob-backed JSON records for operational MVP, but define migration path to Postgres if query complexity or file volume requires it |
| File storage | Supabase Storage | No equivalent yet | Use dedicated object storage for files if blob limits or retention needs make Netlify Blobs unsuitable; keep metadata separate from file binaries |

## Product Direction

### What ByondRV should build first

The current repository is primarily a sales, enquiry, and owner-operations system. Because of that, the first SMS implementation should be customer and owner-copilot oriented, not Tradie Shield style labour logging.

The first ByondRV SMS and contract scope should be:

- inbound customer SMS and MMS to the business number
- AI-assisted classification and routing of product questions, fitment questions, availability questions, and contract-related messages
- contract creation from the standard ByondRV contract plus structured customer specifications
- addendum generation for post-signature changes with clear change and cost history
- owner visibility inside the existing admin and owner-copilot surfaces
- explicit human approval for any outbound legal or commercial commitment that goes beyond a simple acknowledgement

### What must not be copied blindly from Tradie Shield

The contract logic in the brief is trade-contract oriented. It references construction-law concepts such as Security of Payment, sham contracting, WHS obligations, and clause libraries for trade jobs.

ByondRV must not ship a direct copy of that legal prompt or template system.

ByondRV needs a simpler contract domain model focused on:

- the existing ByondRV standard contract
- product model and base configuration
- client-selected specifications and optional extras
- quoted pricing, deposits, and payment schedule
- delivery and handover terms
- payload and suitability disclaimers
- signed-contract snapshot
- addendum handling for later changes
- feature-change and cost-change history

Every output must include a visible disclaimer that it is AI-generated guidance and not legal advice.

## Goals

- Add inbound SMS and MMS as a first-class customer communication channel.
- Route SMS conversations into the existing owner-copilot lead and customer system.
- Generate customer-ready contract packages from the existing ByondRV standard contract and structured specification inputs.
- Allow the business to create signed-after changes as addendum documents with clear cost deltas and approval history.
- Reuse current Netlify, Astro, admin, and OpenAI patterns instead of building a parallel app.
- Keep Twilio-facing endpoints fast and operationally simple.
- Maintain strong auditability for every AI-assisted recommendation.

## Non-Goals

- Replatforming the site to Supabase plus a separate gateway.
- Building a fully autonomous legal document system.
- Allowing AI to send binding legal or commercial commitments without owner review.
- Replacing the current enquiry and owner-copilot model.
- Building a full database-backed CRM before proving the SMS workflow.
- Copying Tradie Shield construction-law prompts directly into production.

## Users

- Website visitors and leads who text the ByondRV business number.
- Existing customers who send follow-up SMS questions, photos, or contract documents.
- The owner and sales/admin staff using the existing admin area.
- Developers maintaining the site, Netlify Functions, and AI prompts.

## Existing Capabilities To Reuse

### Public AI patterns

- `netlify/functions/site-chat.ts` already shows the established pattern for:
  - OpenAI client initialization
  - prompt hardening
  - structured context building
  - analytics capture
  - graceful fallback behaviour

### Admin and owner-copilot patterns

- `netlify/functions/contact-submit.ts` already ingests an enquiry, stores it, emails it, and syncs it into owner-copilot records.
- `netlify/functions/owner-copilot-record-sync.ts` already normalizes customers and leads and appends audit and timeline entries.
- `netlify/functions/admin-dashboard.ts` already aggregates operational records from blob stores and can be extended to show SMS and contract KPIs.
- `src/components/AdminPanel.tsx` already contains tabs for enquiries, customers, leads, drafts, audit, knowledge, Google, matches, and reports.

### Persistence patterns

- `netlify/functions/blob-store.ts` already provides the standard storage abstraction for this repo.
- `owner-copilot-core.ts` already defines typed stores and key patterns suitable for extension.

## Functional Scope

### 1. SMS/MMS Inbound Communication

### Primary user flows

1. Customer sends an SMS or MMS to the ByondRV business number.
2. Twilio posts the webhook to `sms-webhook`.
3. The webhook validates authenticity, normalizes the phone number, stores the inbound event, and returns quickly.
4. Deferred processing classifies the message, links it to a customer and lead, decides the response path, and sends an SMS reply where appropriate.
5. The conversation appears in the admin and owner-copilot views with status, summary, and next action context.

### Initial SMS intents for ByondRV

The initial intent set should match current business operations, not trade-timesheet logging:

- `product_question`
- `availability_check`
- `vehicle_fitment_question`
- `quote_or_price_question`
- `handover_to_human`
- `scan_contract`
- `review_contract_changes`
- `help`
- `unknown`

### Secondary intent set for later phases

- `book_callback`
- `follow_up_existing_quote`
- `share_product_link`
- `owner_internal_command`

Owner internal SMS commands should be treated as phase 2 or later. They are lower priority than inbound customer communication and introduce identity and authorization complexity.

### 2. Standard Contract Assembly

### Web flow

1. Staff selects a customer, product, and base deal record in admin.
2. Staff fills or imports the chosen specifications, optional extras, pricing, deposit, delivery terms, and notes.
3. The system merges that structured data into the standard ByondRV contract package.
4. The system stores a snapshot of the exact specification set that was sent for signing.
5. The owner can regenerate a draft before sending, but signed versions remain immutable.

### SMS/MMS flow

1. Customer sends an SMS asking to add or confirm requested features.
2. `sms-webhook` stores the message and links it to the correct lead or contract thread.
3. Deferred processing summarizes the requested changes for staff review.
4. Staff approves whether the requested items become:
   - pre-signature specification edits inside the draft contract, or
   - post-signature addendum items
5. The approved changes are written back into the contract workflow with audit history.

### 3. Addendum Generation

When a client wants new features after signing, the system should generate an addendum against the signed contract snapshot. The addendum should capture:

- the original signed contract reference
- the newly requested features or scope changes
- added cost, removed cost, and net change
- any delivery-date or build-impact notes
- approval dates and who approved the change
- a generated document that can be signed and attached to the original contract file

This is higher priority than freeform contract generation from scratch because it matches the real paper-trail requirement.

### 4. Contract Change Review

Users should be able to paste proposed changes or send them by SMS. The system should:

- compare proposed changes against the base contract
- determine whether the changes belong in the draft contract or in a signed addendum
- summarize scope and price impact in plain language
- generate a draft internal summary or customer-facing addendum wording
- store the review in admin and link it to the customer, lead, and contract

## Recommended Technical Architecture

### Platform

Keep the existing application shape:

- Astro for public pages
- React components inside Astro for richer admin surfaces
- Netlify Functions for APIs and orchestration
- OpenAI Responses API for AI tasks
- Netlify Blobs for operational metadata where practical

Do not introduce a separate gateway service in phase 1.

### AI provider strategy

The brief uses Anthropic Claude. The current ByondRV repo is already standardized on OpenAI.

Recommended phase 1 decision:

- keep intent parsing and analysis on OpenAI for consistency with the repo
- use a small, cheaper model for classification and intent parsing
- use a stronger model for contract analysis and change review
- validate output quality before considering a second provider

This keeps deployment, secrets management, prompts, and monitoring consistent with the existing codebase.

### Persistence strategy

Recommended phase 1 approach:

- store customer, lead, message session, and analysis metadata as JSON records in Netlify Blobs
- store audit and timeline events using the owner-copilot pattern
- keep file binary storage abstracted behind a file service layer

Recommended phase 1 caution:

- validate whether Netlify Blobs is suitable for the expected file sizes and retention policy for PDF and image uploads
- if not suitable, use external object storage for binaries while keeping metadata in Blob stores

Recommended phase 2 decision checkpoint:

- if contract records need relational filtering, dashboards by status, version history, or reporting beyond simple key-based retrieval, introduce Postgres for the contract domain instead of stretching Blob stores too far

## Proposed Data Model

### Existing stores to reuse

- `customer-enquiries`
- `customer-lead-status`
- `owner-copilot-customers`
- `owner-copilot-leads`
- `owner-copilot-timeline-events`
- `owner-copilot-audit-logs`

### New stores for phase 1

- `sms-messages`
- `sms-sessions`
- `contract-analyses`
- `contract-change-reviews`
- `contract-jobs`

### New stores or services likely needed by phase 2

- `contracts`
- `contract-files` or external file storage bucket
- `contract-template-snapshots`
- `contract-addenda`

### Blob record shapes

If phase 1 stays blob-backed, records should follow explicit JSON shapes close to the SQL entities in the original brief.

Suggested `contract-analyses` record fields:

- `id`
- `customerId`
- `leadId`
- `source`
- `sourceMessageId`
- `fileStorageKey`
- `fileMimeType`
- `status`
- `overallRisk`
- `summary`
- `issues`
- `missingProtections`
- `stateDetected`
- `model`
- `disclaimer`
- `createdAt`
- `updatedAt`

Suggested `contracts` record fields:

- `id`
- `customerId`
- `leadId`
- `productSlug`
- `baseTemplateVersion`
- `status`
- `specifications`
- `optionalExtras`
- `pricing`
- `deposit`
- `deliveryTerms`
- `disclaimers`
- `sentAt`
- `signedAt`
- `signedSnapshot`
- `createdAt`
- `updatedAt`

Suggested `contract-addenda` record fields:

- `id`
- `contractId`
- `customerId`
- `leadId`
- `requestedChanges`
- `approvedChanges`
- `costDelta`
- `deliveryDelta`
- `reason`
- `status`
- `documentStorageKey`
- `approvedBy`
- `sentAt`
- `signedAt`
- `createdAt`
- `updatedAt`

Suggested `sms-messages` record fields:

- `id`
- `direction`
- `phoneE164`
- `customerId`
- `leadId`
- `messageText`
- `media`
- `intent`
- `confidence`
- `status`
- `replyText`
- `twilioSid`
- `createdAt`

Suggested `sms-sessions` record fields:

- `phoneE164`
- `customerId`
- `leadId`
- `lastIntent`
- `lastMentionedProduct`
- `awaitingClarification`
- `messages`
- `updatedAt`

## Security Requirements

The following are mandatory and must be present in the implementation:

- Twilio signature validation on every inbound webhook
- strict phone normalization to E.164 for matching
- internal secret validation for any internal-only processing endpoint
- prompt-injection sanitization for inbound SMS text, uploaded OCR text, and contract text
- explicit AI output validation for structured responses
- clear legal disclaimer on every contract-related output
- no automatic sending of high-risk legal or contract advice without owner review
- audit logging for analysis creation, review generation, and outbound replies

## Proposed Files And Extension Points

### Public pages

- `src/pages/deal-guardian/index.astro`
- `src/pages/deal-guardian/report/[id].astro`
- `src/pages/admin.astro`
- `src/pages/admin/analytics.astro`

### Admin and React surfaces

- `src/components/AdminPanel.tsx`
- `src/components/AdminDashboard.tsx`
- optional new components:
  - `src/components/ContractAnalysisQueue.tsx`
  - `src/components/SmsInboxPanel.tsx`
  - `src/components/ContractReviewPanel.tsx`

### Netlify functions

- new:
  - `netlify/functions/sms-webhook.ts`
  - `netlify/functions/sms-process.ts`
  - `netlify/functions/contract-upload.ts`
- `netlify/functions/contract-analyse.ts`
- `netlify/functions/contract-review.ts`
- `netlify/functions/contracts.ts`
- `netlify/functions/contract-addendum.ts`
- extend:
  - `netlify/functions/admin-dashboard.ts`
  - `netlify/functions/admin-chat.ts`
  - `netlify/functions/contact-submit.ts`
  - `netlify/functions/owner-copilot-record-sync.ts`
  - `netlify/functions/owner-copilot-core.ts`
  - `netlify/functions/blob-store.ts`

### Shared library candidates

- `src/lib/phone.ts`
- `src/lib/sms.ts`
- `src/lib/contracts.ts`
- `src/lib/contract-prompts.ts`
- `src/lib/structured-output.ts`

## Delivery Phases

### Phase 0: Foundation And Design Lock

### Objective

Define the standard-contract data model, addendum workflow, SMS intent model, and persistence boundaries before writing production endpoints.

### Tasks

- Confirm the exact standard ByondRV contract version and source format that will be merged with structured data.
- Define the approved legal disclaimer text.
- Decide whether file binaries stay on Netlify or move to external object storage.
- Define the first SMS intents and example utterances.
- Define owner review rules for contract drafts and addenda.
- Define the specification schema, optional-extras schema, and pricing snapshot shape.
- Add a detailed prompt and output schema specification.

### Acceptance criteria

- No contract automation starts until the standard contract source, specification schema, and disclaimer text are approved.
- Storage decision for file binaries is documented.
- SMS intent list is finalized with examples and fallback rules.

### Phase 1: SMS Plumbing And Inbound Capture

### Objective

Receive inbound SMS and MMS safely and surface them inside owner-copilot.

### Tasks

- Add Twilio webhook function with signature validation.
- Normalize phone numbers and match to existing customer or lead records.
- Persist inbound messages and session context.
- Send simple acknowledgement replies.
- Sync messages into owner timeline and audit.
- Extend admin dashboard with SMS counts and unread or action-needed states.

### Acceptance criteria

- A real SMS reaches ByondRV and is stored with normalized phone, timestamp, and message body.
- A real MMS stores media metadata and appears in admin.
- The owner can see SMS-origin leads alongside website enquiries.

### Phase 2: Intent Parsing And Sales Support Responses

### Objective

Turn inbound SMS into useful lead and support workflows.

### Tasks

- Implement intent classification and confidence scoring.
- Add handlers for product questions, fitment questions, availability, quote questions, and help.
- Reuse product catalogue and chatbot knowledge as grounding context.
- Link high-intent SMS threads into owner-copilot leads automatically when safe.
- Add human-escalation triggers for low confidence or high-risk content.

### Acceptance criteria

- Common product and availability texts receive useful replies.
- Unknown or risky messages are escalated instead of hallucinated.
- Owner timeline shows AI summary, intent, and next action.

### Phase 3: Standard Contract Assembly MVP

### Objective

Allow staff to generate a customer-ready contract package from the standard ByondRV contract plus structured deal data.

### Tasks

- Build contract record creation and versioned draft storage.
- Build admin UI for structured specifications, extras, pricing, and commercial details.
- Merge structured data into the standard contract package.
- Store the exact sent-for-signing snapshot.
- Add admin queue or detail views for draft, sent, and signed states.

### Acceptance criteria

- Staff can generate a contract draft from the approved standard template.
- The sent contract preserves the exact specifications and quoted amounts at that time.
- Admin can see draft, sent, and signed states with audit history.

### Phase 4: Addendum Workflow And Change Review

### Objective

Support post-signature changes through addenda with a clear paper trail and cost trail.

### Tasks

- Add review endpoint and review storage.
- Add review UI for pasted or SMS-received change requests.
- Link reviews to the contract, addendum, and lead records.
- Add structured output for scope delta, cost delta, and delivery impact.
- Generate addendum drafts against the signed contract snapshot.

### Acceptance criteria

- Staff can turn a post-signature change request into a tracked addendum draft.
- Each addendum shows the original contract reference, requested additions, and net cost impact.
- Reviews are visible in admin with customer, lead, and contract linkage.

### Phase 5: Optional Contract Analysis And Upload Enhancements

### Objective

Add optional upload, analysis, and comparison tooling only if the business still needs it after the standard-contract and addendum workflow is live.

### Tasks

- Add document upload and storage for customer-supplied files.
- Add optional analysis of external contract or amendment documents.
- Add comparison views between uploaded documents and the internal structured contract record.
- Keep these tools secondary to the standard contract and addendum flow.

### Acceptance criteria

- Optional uploads and analysis do not replace the structured source of truth in the ByondRV contract record.
- Any analysis output includes disclaimer text and an owner-review step.

## Risks And Decision Points

- The largest product risk is overcomplicating the contract workflow instead of centering it on the existing standard contract plus controlled addenda.
- The largest technical risk is using Blob stores for workloads that really need relational querying or larger binary handling.
- The largest operational risk is slow or brittle Twilio handling if processing is not clearly split into fast ingress and deferred work.
- The largest AI risk is unsupported contract advice or invented terms if schema validation and human review are weak.

## Test Strategy

### Unit tests

- phone normalization
- Twilio signature validation
- SMS intent parsing and structured-output validation
- contract record snapshot validation
- addendum cost-delta validation
- owner-copilot linking rules

### Integration tests

- inbound SMS webhook handling
- MMS metadata capture
- contract draft record creation
- addendum record creation
- admin dashboard aggregation for new stores

### End-to-end tests

- admin contract draft flow
- admin addendum flow
- customer SMS to lead creation path

## Success Metrics

- inbound SMS messages are captured with high reliability and visible in admin
- SMS-origin leads are linked into owner-copilot without duplicate record explosion
- contract drafts preserve the exact agreed specification snapshot
- addenda preserve a clear change and cost trail after signing
- owner response time to inbound leads improves
- no high-risk legal output is sent without disclaimer and review controls

## Implementation Recommendation

Build this as an extension of the current ByondRV app, not as a parallel Supabase or gateway project.

Recommended order:

1. SMS ingress and owner-copilot linkage
2. SMS intent parsing and safe reply handling
3. Standard contract assembly MVP
4. Addendum workflow and change review
5. Optional contract upload and analysis tooling

If the contract domain grows into a high-volume, heavily filtered, or multi-user workflow, promote the contract records into Postgres and keep the current Netlify plus Astro plus admin surfaces as the UI layer.
