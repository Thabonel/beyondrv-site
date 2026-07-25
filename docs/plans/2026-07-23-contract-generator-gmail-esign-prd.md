# Product Requirements Document: ByondRV Contract Generator, Gmail Change Intake, Addendums, and Customer Acceptance

Date: 2026-07-23
Owner: Beyond RV
Status: Implementation complete; final Terms legal approval and production activation pending
Primary implementation target: Existing ByondRV Astro/React admin on Netlify
Supersedes for contract scope: Contract portions of `2026-06-25-sms-contracts-prd.md`

## 1. Executive Summary

Beyond RV needs a simple, fast, and accurate way to prepare customer contracts, respond to requested changes, generate addendums, and record customer acceptance without creating a second application or forcing the owner to learn a complex contract-management system.

The solution will extend the existing website admin and Owner Copilot. It will use:

- the existing 12C sales agreement as the master source template;
- the existing 15XC sales agreement as a model-variation and completeness reference;
- structured contract and pricing data as the source of truth;
- the existing OpenAI integration to classify messages, extract proposed changes, and draft plain-language summaries;
- a cost-aware OpenAI model router that uses GPT-5.4 nano for routine triage, recommends GPT-5.6 Luna for material contract work, and prompts the owner before escalating difficult cases to GPT-5.6 Terra;
- the existing Gmail OAuth integration to ingest customer emails and link them to customers, leads, and contracts;
- a new owner-facing contract workspace for manual creation, review, phone-call notes, revisions, and addendums;
- Gmail compose links and downloadable immutable documents for owner-controlled delivery;
- customer acceptance by returned signed copy/photo, explicit acceptance email, or—only for the original agreement—payment of the stated 30% deposit after the complete agreement was supplied;
- Netlify Functions for orchestration and Netlify Blobs for the initial metadata implementation;
- immutable sent/accepted snapshots and append-only evidence/audit events for traceability.

The AI will perform clerical and drafting work, but it will not autonomously create commercial commitments. The owner must approve every contract, price, delivery impact, addendum, recipient, and send action.

### 1.1 Superseding owner decision — 23 July 2026

This section is normative and supersedes every older SignWell or third-party electronic-signature requirement retained in historical passages of this PRD.

- No SignWell, DocuSign, paid signing provider, provider account, or company credit card is required.
- The owner downloads the final contract, opens a pre-addressed Gmail draft, attaches the contract and approved Terms, checks the recipient, and sends it.
- Original-contract acceptance may be evidenced by a returned hand-signed copy/photo, an explicit acceptance email, or receipt of the exact stated deposit after the customer received the complete agreement and was clearly told that payment indicates acceptance.
- Addenda require a returned signed copy/photo or explicit email acceptance. Payment alone does not accept an addendum.
- Every acceptance requires the accepting customer name/email, timestamp, method, and a durable Gmail, file, receipt, or bank-reference evidence pointer.
- Preparing a final document creates an immutable HTML snapshot and SHA-256 digest. The owner cannot edit that version after preparation.
- Customer delivery and acceptance actions remain blocked until `CONTRACT_TERMS_APPROVED_VERSION` exactly matches the contract's Terms version.
- Gmail access remains read-only. The system opens Gmail compose in the owner's authenticated browser; it does not send autonomously.
- The fixed clause is: “By signing this Agreement, or where permitted by this Agreement by paying the Deposit after receiving the complete Agreement, you confirm that you have read and agree to all terms and conditions forming part of it.”

### 1.2 Implementation progress — 23 July 2026

The Phase 0/1 foundation, Phase 2 change management, and the first Phase 3 Gmail intake slice are implemented:

- contract domain model and Netlify Blob storage;
- approved seller identity with the Mutdapilly address;
- deterministic 30% / 20% / 50% payment calculations;
- 12C-based specification seed data;
- authenticated create, update, list, validate, preview, review, and approve APIs;
- Contracts admin workspace;
- immutable HTML snapshots with SHA-256 digests when a final document is prepared;
- manual customer-delivery and acceptance evidence workflow with exact Terms-version approval gating;
- contract audit and customer/lead timeline events;
- contract calculation, validation, rendering, escaping, and provider-payload tests;
- immutable pre-signature revisions with preserved version history and recorded revision reasons;
- signed-contract-only, sequential addenda for phone, in-person, owner-entered, or Gmail-sourced changes;
- explicit owner confirmation of every change, payment impact, and delivery impact;
- deterministic added, removed, net-change, revised-total, and effective signed-deal calculations;
- addendum validation, preview, review, approval, and immutable signed-state handling in the Contracts workspace;
- prepared/sent/accepted lifecycle, preview/download, Gmail compose links, and SHA-256 snapshot support for addenda; and
- automated coverage for revision resets/comparisons, addendum validation/pricing/effective state/rendering, and acceptance evidence rules;
- five-minute scheduled read-only Gmail polling using the owner-approved Gmail query;
- safe multipart plain-text/HTML message extraction, inbound-message exclusions, per-message deduplication, and internal processing state;
- exact contract-number and buyer-email matching with ambiguity blocking;
- central environment-driven Nano/Luna/Terra configuration, structured outputs, recorded reasoning/model usage, and explicit owner model-change prompts;
- AI Draft Action review with original-message evidence, editable extracted changes, reject/defer/informational states, and owner-approved conversion; and
- conversion into draft revisions or draft addenda without AI-controlled pricing, delivery confirmation, document approval, or sending.

Production customer delivery remains deliberately disabled until the approved Terms have their final version identifier and that exact value is configured in Netlify. A real Gmail change email must still pass the Phase 3 gate in the deployed environment.

The MVP should prioritise the shortest dependable workflow:

1. Select a customer and product.
2. Fill or confirm structured deal details.
3. Preview a contract generated from the approved template.
4. Prepare the immutable final copy and send it from Gmail.
5. Detect later customer change requests from Gmail.
6. Convert requested changes into an owner-reviewable draft action.
7. Generate either a revised unsigned contract or a signed-contract addendum.
8. Allow the same addendum workflow to begin from an owner-entered phone-call note.
9. Send the approved document and preserve the acceptance evidence.

## 2. Product Decision Summary

### 2.1 Master contract decision

The source documents are:

- Master template: [12C sales agreement email](https://mail.google.com/mail/#all/19a954d582d2fca2), received 18 November 2025.
- Validation reference: [15XC Sales Agreement email](https://mail.google.com/mail/#all/19a90f19d2550bd4), received 17 November 2025.

The 12C agreement is the canonical starting point because it contains a complete four-page structure with:

- seller and buyer information;
- product model;
- dimensions and weights;
- internal features;
- external features;
- electrical features;
- plumbing features;
- build and construction features;
- price;
- payment stages; and
- signature fields.

The 15XC agreement will be used to identify legitimate differences between product contracts and to verify that the generated template supports model-specific inclusions without copying stale model data into unrelated contracts.

### 2.2 Template architecture decision

The implementation must separate the contract into three layers:

1. **Approved fixed wording**
   - seller identity;
   - legal and commercial clauses;
   - payment-policy wording;
   - consumer-law wording;
   - signature and consent wording;
   - general disclaimers.

2. **Structured deal data**
   - customer identity and contact details;
   - product and model;
   - dimensions, weights, specifications, inclusions, and exclusions;
   - optional extras;
   - price components and totals;
   - deposit and payment schedule;
   - delivery or handover notes;
   - suitability and compliance notes.

3. **Versioned changes**
   - proposed pre-signature changes;
   - revised-contract snapshots;
   - post-signature addendums;
   - price and delivery deltas;
   - approval and signature history.

The master Gmail attachments must be retained unchanged as source records. The production template will be a controlled representation of those documents, not an in-place modification of the originals.

### 2.3 Customer-acceptance decision

Use an internal, provider-free workflow for the MVP:

- create and lock the final agreement in the admin;
- download the agreement and attach the approved Terms;
- open the pre-addressed Gmail draft and send only after checking the recipient and attachments;
- record when it was sent;
- record the returned signed copy/photo, explicit acceptance email, or qualifying deposit receipt;
- retain durable evidence references and the immutable document digest;
- use the same workflow for addenda, except that deposit payment is not an addendum-acceptance method.

### 2.4 Gmail event decision

Use scheduled Gmail polling for the MVP rather than Gmail push notifications.

Reasons:

- the repository already has a Gmail read-only sync;
- scheduled polling is simpler to deploy and support;
- it avoids Cloud Pub/Sub provisioning, notification verification, history recovery, and watch renewal;
- a five-minute detection window is acceptable for contract-change requests;
- records can be deduplicated by Gmail message ID in ByondRV storage.

Gmail push notifications can replace polling later without changing the contract-domain model.

## 3. Problem Statement

The current workflow depends on manually finding a previous agreement, copying it, changing customer and product details, interpreting customer emails or phone calls, keeping track of what changed, and manually coordinating signatures. This creates several risks:

- old customer or product information can be copied forward;
- prices or totals can be inconsistent;
- requested features can be missed or misunderstood;
- post-signature changes can be made without a clear addendum;
- the signed document may not match the final agreed specification;
- email and phone decisions may not be attached to the customer record;
- the owner can lose time recreating the same document structure;
- the business may lack a complete version and approval trail.

The existing admin can track customers, leads, enquiries, statuses, tasks, timelines, Gmail matches, and AI actions, but it does not generate or sign contracts.

## 4. Goals

### 4.1 Business goals

- Reduce the time required to prepare a contract or addendum.
- Reduce copying and arithmetic errors.
- Make every current deal state visible from one customer/contract workspace.
- Ensure email and phone-requested changes follow the same controlled process.
- Make acceptance easy by signed copy/photo, explicit email, or qualifying deposit payment.
- Preserve a complete record of what was sent, approved, changed, and accepted.
- Reuse the current website stack and avoid a separate CRM or contract platform.

### 4.2 User goals

The owner must be able to:

- create a contract from an existing customer or lead;
- create a customer while starting a contract if one does not exist;
- select a product and load current specifications;
- add, remove, or override deal-specific inclusions;
- enter price and payment information;
- preview the exact customer document;
- correct any field before sending;
- download the final document and open a pre-addressed Gmail draft;
- record when the document was sent and how it was accepted;
- record a requested change from an email;
- record a requested change from a phone conversation;
- approve, edit, or reject the AI interpretation;
- regenerate an unsigned contract when appropriate;
- create an addendum when the original contract is already signed;
- follow up from Gmail when acceptance is outstanding;
- download the accepted contract, addenda, and audit/evidence record;
- see the whole history on the customer and lead timeline.

### 4.3 Technical goals

- Extend the existing Astro, React, Netlify Functions, OpenAI, and Blob-store architecture.
- Reuse existing customer, lead, timeline, audit, task, Gmail, and AI-action patterns.
- Keep contract rendering deterministic.
- Keep AI results schema-constrained and reviewable.
- Store immutable prepared, sent, and accepted snapshots.
- Make all acceptance lifecycle actions idempotent and auditable.

## 5. Non-Goals

The MVP will not:

- provide autonomous contract sending;
- let AI invent clauses, pricing, specifications, totals, discounts, delivery dates, or compliance claims;
- replace qualified legal advice;
- create a general-purpose legal document platform;
- analyse arbitrary third-party contracts for legal risk;
- implement SMS/MMS intake;
- implement customer self-service contract editing;
- require customers to create ByondRV website accounts;
- introduce Supabase, a separate gateway, or another full application;
- provide payment collection through the signing screen;
- support complex multi-entity or multi-currency contracts in phase 1;
- overwrite or mutate a completed signed document;
- treat a Gmail message as approval to change a signed contract without owner review.

## 6. Users and Roles

### 6.1 Owner/admin

Primary operator. Can create, edit, approve, send, cancel, and download contracts and addendums. Can accept or reject AI Draft Actions. Can record phone conversations.

### 6.2 Customer

Receives the complete agreement and Terms by email, reviews them, and accepts by returning a signed copy/photo, explicitly accepting by email, or paying the stated deposit where the original agreement permits that method.

### 6.3 Beyond RV representative

May countersign the printable agreement where the approved document requires it and retains the resulting copy with the acceptance evidence.

### 6.4 Website AI

Assists with extraction, classification, matching, summarisation, and draft wording. It does not possess approval authority.

### 6.5 System integration

Processes scheduled Gmail syncs, generates deterministic documents, validates acceptance evidence, updates records, and creates timeline/audit events.

## 7. Legal and Policy Gates

Before production sending is enabled:

- the fixed contract, cancellation, refund, warranty, Australian Consumer Law, and addendum wording is owner-confirmed as legally reviewed and approved;
- the legal seller name and ABN shown in the 12C master agreement are the approved seller identity;
- the approved current business address is `77 Coleyville Rd, Mutdapilly QLD 4307`, replacing any older address in the source agreement;
- the approved standard payment schedule is 30% deposit due on signing the contract, 20% due when the camper arrives in Australia, and the remaining 50% due on taking delivery;
- Beyond RV must confirm retention requirements for contracts and acceptance evidence;
- the privacy policy must disclose relevant processing and external providers where required;
- the owner must approve the signature/deposit-acceptance wording and the final versioned Terms;
- the system must not imply that AI output is legal advice.

The implementation must preserve the complete terms supplied, customer identity and intention, document integrity, timestamps, delivery record, and acceptance evidence. Payment acceptance must never be inferred from a partial, mismatched, or unexplained payment. Product acceptance testing does not replace legal review.

## 8. User Experience

### 8.1 New admin navigation

Add a `Contracts` tab to the existing admin navigation.

The Contracts tab must contain:

- dashboard summary;
- contract search and filters;
- new-contract action;
- awaiting-owner-review queue;
- awaiting-signature queue;
- completed contracts;
- addendum queue;
- failed, declined, expired, or bounced items;
- provider connection/configuration status.

### 8.2 Contract dashboard summary

Show:

- Draft contracts
- Awaiting owner approval
- Sent for signature
- Viewed but unsigned
- Signed this month
- Addendums awaiting approval
- Addendums awaiting signature
- Email changes awaiting review
- Failed or bounced signature requests

### 8.3 Contract list filters

Support filtering by:

- customer name;
- customer email;
- contract number;
- product model;
- status;
- date range;
- unsigned, signed, or addendum;
- owner action required;
- Gmail-linked change present.

### 8.4 Contract detail page/panel

The detail view must show:

- contract number and version;
- customer and lead links;
- product and pricing summary;
- current lifecycle status;
- last owner action;
- next recommended action;
- exact specification snapshot;
- optional extras and price breakdown;
- payment schedule;
- delivery notes;
- rendered preview;
- all revisions;
- all addendums;
- Gmail messages linked to the contract;
- AI Draft Actions;
- delivery/acceptance status and evidence;
- downloadable prepared and accepted files;
- append-only timeline.

### 8.5 Owner language

The UI must use plain business language:

- `Draft`
- `Ready for review`
- `Ready to send`
- `Waiting for signature`
- `Signed`
- `Customer requested a change`
- `Addendum required`
- `Needs your price confirmation`
- `Delivery impact not confirmed`

Avoid legal-technology jargon and provider-specific terminology in the primary workflow.

## 9. Core Workflows

### 9.1 Create a new contract

1. Owner selects `New contract`.
2. Owner selects an existing customer/lead or creates a new customer.
3. Owner selects a product model.
4. System loads approved current product data.
5. Owner confirms or edits deal-specific specifications and inclusions.
6. Owner selects optional extras or adds a clearly marked custom item.
7. Owner enters or confirms pricing, discounts, deposit, payment stages, and delivery notes.
8. System validates required fields and calculates totals.
9. AI may create a plain-language summary and flag contradictions, missing information, or unusual deviations.
10. System renders a preview from the approved template.
11. Owner reviews the full preview and confirms recipient email addresses.
12. Owner approves and prepares the final immutable copy.
13. System records the Terms version, snapshot digest, and preparation timestamp.
14. Owner downloads the document, opens the Gmail draft, attaches the document and approved Terms, verifies the recipient, and sends.
15. Owner records the sent action.
16. When evidence arrives, owner records the acceptance method, customer identity, timestamp, and durable evidence reference; the system updates the customer timeline.

### 9.2 Revise a contract before signing

1. Customer or owner requests a change while the contract is unsigned.
2. System creates a proposed-change record.
3. Owner reviews the affected fields, price delta, and delivery impact.
4. Owner approves the change.
5. System creates a new contract version.
6. Previous sent version is marked superseded and cannot be edited.
7. If a signature request is still active, the owner is prompted to cancel it before sending the new version.
8. System sends the replacement version for signature.

### 9.3 Create an addendum from a customer email

1. Scheduled Gmail sync detects a new inbound customer message.
2. System retrieves the full message and enough thread context to interpret it.
3. System matches the message to a customer, lead, and contract using deterministic identifiers first.
4. AI classifies the message as one of:
   - no contract change;
   - possible clarification;
   - pre-signature change;
   - post-signature addendum request;
   - cancellation or removal request;
   - price/delivery question;
   - ambiguous and needs owner review.
5. AI extracts only proposed facts and marks uncertainties.
6. System creates an AI Draft Action linked to the Gmail message and contract.
7. Owner sees the original message beside the extracted change.
8. Owner approves, edits, rejects, or marks it as informational only.
9. Owner confirms price delta and delivery impact. AI cannot confirm these values.
10. System generates an addendum preview against the immutable signed contract snapshot.
11. Owner approves recipients and sends it for signature.
12. Completion events and signed files are attached to the original contract chain.

### 9.4 Create an addendum from a phone conversation

1. Owner opens the contract and selects `Record customer change`.
2. Owner chooses `Phone conversation` as the source.
3. Owner enters a short factual note and call date/time.
4. AI extracts proposed structured changes.
5. Owner reviews and corrects the extraction.
6. Owner confirms commercial and delivery impacts.
7. System creates the same addendum draft used by the Gmail flow.
8. Owner previews, approves, and sends for signature.

### 9.5 Customer asks a question but does not request a change

1. AI classifies the email as a question or clarification.
2. System must not modify the contract.
3. System may create a draft reply or owner task.
4. Owner can explicitly convert the item into a proposed contract change if needed.

### 9.6 Signed addendum changes again

Never edit a signed addendum. Create another sequential addendum that references the original contract and all prior addenda relevant to the current total and specification state.

## 10. Contract Document Requirements

### 10.1 Required header fields

- Beyond RV legal seller name
- Trading name
- ABN
- Business address
- Phone
- Email
- Website
- Contract number
- Contract version
- Contract date
- Document type: Sale Agreement or Addendum

### 10.2 Buyer fields

- Full legal name
- Organisation name, if applicable
- Address
- Phone
- Email
- Additional signer name/email, if applicable

### 10.3 Product fields

- Product/model name
- Product category
- Build or stock identifier, if applicable
- Dimensions
- Weight values relevant to the product
- Base specifications
- Included features grouped by approved category
- Exclusions
- Custom specifications
- Optional extras

### 10.4 Commercial fields

- Base price
- Optional-extra line items
- Custom-item line items
- Discount line items with reasons
- Taxes/inclusions statement
- Total contract value
- Deposit amount or percentage
- Payment-stage amounts or percentages
- Payment due triggers
- Delivery/handover notes
- Quote/contract validity date if used

Default payment stages:

1. 30% of the total contract value is due on signing the contract.
2. 20% of the total contract value is due when the camper arrives in Australia.
3. The remaining 50% of the total contract value is due on taking delivery.

The renderer must calculate each stage deterministically from the approved total contract value. Any exception to this schedule must be entered explicitly, justified, and approved by the owner before sending.

### 10.5 Signature and acceptance fields

- Buyer name and signature
- Buyer signature date
- Seller name and signature if required
- Seller signature date
- Signature/deposit-acceptance statement
- Contract/addendum reference shown near signatures

### 10.6 Rendering rules

- Use a controlled HTML/CSS template for deterministic output.
- Maintain readable page breaks and headings.
- Never split a pricing line item from its price where avoidable.
- Show currency as AUD.
- Format all calculated money values consistently.
- Hide unused optional sections rather than showing empty placeholders.
- Preserve a rendered immutable snapshot for every sent version.
- Store a SHA-256 digest of the sent document bytes when accessible.
- The customer copy and recorded acceptance must reference the same approved content.

## 11. Addendum Document Requirements

Every addendum must include:

- addendum number;
- original contract number;
- original contract accepted date;
- customer identity;
- product/model;
- source of request: email, phone, in-person, or owner-entered;
- request date;
- plain-language change summary;
- previous specification or scope;
- revised specification or scope;
- additions;
- removals;
- added cost;
- removed cost;
- net price change;
- previous contract total;
- revised contract total;
- deposit/payment impact;
- delivery or handover impact;
- explicit statement when no delivery impact is confirmed;
- statement that unchanged original terms remain effective;
- accepting-customer details, method, evidence reference, and dates.

An addendum cannot be sent while any required commercial-impact field is unknown. `No change` must be an explicit confirmed value, not an omitted value.

## 12. Functional Requirements

### 12.1 Contract management

- **FR-CON-001:** Admin can create a contract linked to a customer and lead.
- **FR-CON-002:** Admin can select an approved product as the contract base.
- **FR-CON-003:** System loads current product data but stores a deal-specific snapshot.
- **FR-CON-004:** Owner can add, edit, remove, and reorder inclusions before approval.
- **FR-CON-005:** System calculates totals from structured line items.
- **FR-CON-006:** Owner can save a draft without sending.
- **FR-CON-007:** System validates required fields before preview and send.
- **FR-CON-008:** Owner can preview the full generated document.
- **FR-CON-009:** Sent contract versions are immutable.
- **FR-CON-010:** Owner can clone a draft, but the clone receives a new identity/version.
- **FR-CON-011:** System assigns human-readable contract numbers.
- **FR-CON-012:** Contract search supports customer, email, product, number, and status.

### 12.2 Revisions

- **FR-REV-001:** Unsigned contracts can produce new revisions.
- **FR-REV-002:** A new revision records the parent version.
- **FR-REV-003:** System displays field and price differences before approval.
- **FR-REV-004:** A prepared or sent obsolete version remains immutable and is superseded by a replacement revision.
- **FR-REV-005:** Superseded versions remain downloadable and auditable.

### 12.3 Addendums

- **FR-ADD-001:** Signed contracts can produce sequential addendums.
- **FR-ADD-002:** Addendums must reference the immutable signed contract.
- **FR-ADD-003:** Addendum totals are calculated in code.
- **FR-ADD-004:** Price and delivery impacts require owner confirmation.
- **FR-ADD-005:** Addendums support additions, removals, substitutions, and clarifications.
- **FR-ADD-006:** Completed addendums update the effective contract-state summary.
- **FR-ADD-007:** Signed addendums are immutable.
- **FR-ADD-008:** Owner can generate an addendum from a manual phone note.

### 12.4 Gmail intake

- **FR-GML-001:** System periodically checks approved Gmail search scope for new inbound messages.
- **FR-GML-002:** System retrieves the full message body and relevant thread context.
- **FR-GML-003:** System deduplicates by Gmail message ID.
- **FR-GML-004:** System matches exact customer email addresses before using fuzzy matching.
- **FR-GML-005:** Ambiguous matches require owner selection.
- **FR-GML-006:** AI classifies whether a message proposes a contract change.
- **FR-GML-007:** AI output uses a validated structured schema.
- **FR-GML-008:** Every extracted statement retains source message ID and supporting excerpt.
- **FR-GML-009:** Email interpretation creates a draft action, never an automatic contract mutation.
- **FR-GML-010:** Owner can mark a message processed, rejected, duplicated, or informational.
- **FR-GML-011:** Processing status is stored internally without requiring Gmail label mutation.
- **FR-GML-012:** System can create an owner-reviewable Gmail reply draft in a later subphase.

### 12.5 Customer acceptance

- **FR-ACC-001:** System creates an immutable final snapshot only from an approved and valid contract/addendum.
- **FR-ACC-002:** System records the snapshot digest, Terms version, preparation time, sent time, and accepting customer identity.
- **FR-ACC-003:** Original contracts support returned signed copy/photo, explicit email acceptance, and qualifying deposit payment.
- **FR-ACC-004:** Addenda support returned signed copy/photo or explicit email acceptance; deposit payment is rejected.
- **FR-ACC-005:** Every accepted record requires a durable evidence reference.
- **FR-ACC-006:** Deposit acceptance requires the amount and bank/payment reference and warns on a mismatch from the calculated 30% deposit.
- **FR-ACC-007:** Customer delivery and acceptance actions are blocked unless the configured approved Terms version exactly matches the record.
- **FR-ACC-008:** System supplies a downloadable final document and pre-addressed Gmail compose link but never sends autonomously.
- **FR-ACC-009:** Prepared, sent, and accepted actions append audit and customer-timeline events.
- **FR-ACC-010:** A prepared version is locked; changes require a replacement revision or addendum.

### 12.6 AI Draft Actions

- **FR-AI-001:** Contract-related email extraction appears in the existing AI Drafts workflow.
- **FR-AI-002:** Draft actions show original source, proposed interpretation, confidence, and unresolved fields.
- **FR-AI-003:** Owner can approve, edit, reject, or defer a draft action.
- **FR-AI-004:** Approval creates a proposed revision/addendum, not a signed or sent document.
- **FR-AI-005:** Every action and status change creates an audit event.
- **FR-AI-006:** Routine Gmail classification uses `gpt-5.4-nano` by default.
- **FR-AI-007:** When a message requires material contract extraction or drafting, admin prompts the owner to run the task with `gpt-5.6-luna` unless the owner has explicitly enabled pre-approved Nano-to-Luna routing.
- **FR-AI-008:** When a Luna result is ambiguous, low confidence, contradictory, or commercially complex, admin prompts the owner before rerunning with `gpt-5.6-terra`.
- **FR-AI-009:** Every model-change prompt explains the reason, current model, recommended model, relative cost tier, and available alternatives.
- **FR-AI-010:** Every AI action records the model, reasoning effort, routing decision, owner decision, and any escalation reason.

## 13. AI Responsibilities and Boundaries

### 13.1 AI may

- identify likely customer and contract references;
- classify message intent;
- extract requested additions, removals, substitutions, and clarifications;
- summarise email or phone notes;
- compare proposed changes with the current structured specification;
- identify missing information;
- draft customer-facing descriptive wording;
- suggest whether the workflow should be a revision or addendum based on contract status;
- draft a non-binding owner reply;
- flag possible contradictions.

### 13.2 AI must not

- calculate or invent prices;
- select discounts;
- promise availability or delivery dates;
- assert product fitment or regulatory compliance;
- create legal clauses outside the approved library;
- remove mandatory wording;
- identify an ambiguous customer as certain;
- send emails or signature requests without owner approval;
- mutate a signed contract or addendum;
- treat silence or a question as acceptance;
- expose unrelated customer information to the model.

### 13.3 Required structured extraction shape

```ts
interface ContractChangeExtraction {
  classification:
    | 'no_change'
    | 'clarification'
    | 'pre_signature_change'
    | 'post_signature_addendum'
    | 'cancellation_or_removal'
    | 'price_or_delivery_question'
    | 'ambiguous';
  confidence: number;
  customerEmail: string;
  mentionedContractNumber: string;
  mentionedProduct: string;
  requestedChanges: Array<{
    action: 'add' | 'remove' | 'replace' | 'clarify';
    item: string;
    previousValue: string;
    requestedValue: string;
    sourceExcerpt: string;
    needsPriceConfirmation: boolean;
    needsDeliveryConfirmation: boolean;
  }>;
  unresolvedQuestions: string[];
  ownerSummary: string;
}
```

All values must be validated, length-limited, and treated as untrusted input.

### 13.4 Required model-routing policy

The contract workflow must use a cost-aware model router rather than one model for every task.

| Workload | Default model | Default reasoning | Owner prompt |
| --- | --- | --- | --- |
| Gmail filtering, sender/topic classification, obvious non-contract messages, and first-pass intent detection | `gpt-5.4-nano` | `none` or `low` | No prompt for routine triage |
| Contract-change extraction, phone-note conversion, contract/addendum comparison, owner summary, and customer-facing descriptive draft | `gpt-5.6-luna` | `low` | Prompt before changing from Nano unless pre-approved routing is enabled |
| Ambiguous customer or contract match, conflicting instructions, multiple interacting changes, repeated schema failure, or low-confidence Luna output | `gpt-5.6-terra` | `low` or `medium` | Always prompt before escalation |
| Prices, totals, contract numbering, versioning, template rendering, lifecycle transitions, and sending | No AI model | Not applicable | Deterministic code and owner approval only |

The workflow must not use `gpt-5.6-sol` by default. Sol is reserved for a future explicitly approved workflow that demonstrates a measurable quality benefit over Terra on representative Beyond RV evaluations.

Model configuration must be environment-driven:

```env
OPENAI_CONTRACT_TRIAGE_MODEL=gpt-5.4-nano
OPENAI_CONTRACT_WORK_MODEL=gpt-5.6-luna
OPENAI_CONTRACT_ESCALATION_MODEL=gpt-5.6-terra
OPENAI_CONTRACT_TRIAGE_REASONING=none
OPENAI_CONTRACT_WORK_REASONING=low
OPENAI_CONTRACT_ESCALATION_REASONING=medium
```

The model IDs must not be scattered across UI components or function files. A single server-side contract AI configuration module must own the defaults, allowlisted models, reasoning settings, and routing thresholds.

### 13.5 Owner model-change prompt

When the router recommends changing models, the admin must pause the model-dependent step and show a plain-language prompt before incurring the higher-tier request.

Example Nano-to-Luna prompt:

> **Use the contract-work model?**
>
> This email appears to request a material contract change. GPT-5.4 nano identified the message, but GPT-5.6 Luna is recommended to extract the exact additions, removals, and unresolved questions more accurately.
>
> Current model: GPT-5.4 nano (lowest cost)
> Recommended model: GPT-5.6 Luna (low-cost contract work)
> Reason: Customer requested multiple specification changes.

Example Luna-to-Terra prompt:

> **Run a more careful contract review?**
>
> The current result contains conflicting or uncertain instructions. GPT-5.6 Terra is recommended for this review before an addendum is prepared.
>
> Current model: GPT-5.6 Luna
> Recommended model: GPT-5.6 Terra
> Reason: Two emails appear to request different battery specifications, and the requested delivery impact is unclear.

Every prompt must offer:

- `Use recommended model`
- `Continue with current model`
- `Review manually`
- `Cancel`

Prompt rules:

- Never describe a model change as mandatory unless the current model failed validation and the action cannot safely continue.
- Never show raw token pricing as a guaranteed task cost.
- Show a relative cost label: `lowest`, `low`, or `higher`.
- Preserve the owner's selection for the current action only by default.
- Provide a separate admin setting for pre-approving Nano-to-Luna routing.
- Terra escalation always requires an explicit per-action owner decision in the MVP.
- Continuing with the lower model must not bypass schema validation, owner approval, or unresolved-field checks.
- `Review manually` must preserve the source and open the structured change editor without another model call.

### 13.6 Routing and escalation criteria

Nano should recommend Luna when one or more of the following is true:

- the email is likely a pre-signature contract change;
- the email is likely a post-signature addendum request;
- more than one addition, removal, replacement, or clarification is detected;
- a phone note must be converted into structured contract changes;
- a customer-facing change summary must be drafted;
- the requested value must be compared with the current contract snapshot;
- the Nano output is relevant but incomplete.

Luna should recommend Terra when one or more of the following is true:

- confidence is below the configured evaluation-backed threshold;
- customer, lead, product, or contract matching remains ambiguous;
- multiple messages contain conflicting requested values;
- the change affects several dependent contract sections;
- requested additions and removals interact with price or delivery impacts in unclear ways;
- the structured response fails schema validation after one controlled retry;
- the owner selects `Analyse more carefully`;
- the system cannot produce a source-supported change list without inference.

Initial confidence thresholds may be configured during development, but production values must be chosen from evaluation results using representative anonymised Beyond RV emails. Thresholds must not be treated as proof of correctness.

### 13.7 Model cost controls

- Do not send obvious non-contract messages to Luna or Terra.
- Send only the minimum relevant email/thread context.
- Reuse a stable system prompt so prompt caching can apply where supported.
- Limit output to the structured schema and a concise owner summary.
- Allow only one automatic schema-repair retry on the same model.
- Require an owner decision before changing to Terra.
- Record input/output token usage and estimated API cost per AI action when returned by the API.
- Show monthly usage by triage, work, and escalation model in private admin reporting.
- Allow an owner-configurable monthly warning threshold, but never silently downgrade a safety-critical review because a budget threshold was reached.
- If the configured model is unavailable, stop the action and prompt the owner to retry, select an allowlisted alternative, or review manually.

### 13.8 Model output quality evaluation

Before production routing is enabled, create an anonymised evaluation set containing:

- clearly unrelated messages;
- simple one-item contract changes;
- multi-item changes;
- removals and cancellations;
- ambiguous model names;
- conflicting email-thread instructions;
- phone-note examples;
- pre-signature revisions;
- post-signature addendums;
- messages containing prompt-injection-like instructions.

Measure each candidate model on:

- contract-change classification precision and recall;
- exact extraction of requested changes;
- unsupported-fact rate;
- source-excerpt accuracy;
- correct revision-versus-addendum recommendation;
- schema-valid response rate;
- owner edit rate;
- latency; and
- cost per accepted action.

The routing policy is accepted only when Nano reliably filters routine mail, Luna meets the agreed contract-extraction quality target, and Terra materially improves the difficult-case set. If Luna does not meet the target, the default work model must be changed through configuration and the PRD decision revisited.

## 14. Data Model

### 14.1 Contract record

```ts
interface ContractRecord {
  id: string;
  contractNumber: string;
  version: number;
  parentContractId?: string;
  customerId: string;
  leadId?: string;
  productSlug: string;
  templateVersion: string;
  status:
    | 'draft'
    | 'owner_review'
    | 'ready_to_send'
    | 'sent'
    | 'viewed'
    | 'partially_signed'
    | 'signed'
    | 'declined'
    | 'expired'
    | 'cancelled'
    | 'superseded'
    | 'error';
  buyer: BuyerSnapshot;
  seller: SellerSnapshot;
  product: ProductSnapshot;
  specificationGroups: SpecificationGroup[];
  lineItems: ContractLineItem[];
  pricing: PricingSnapshot;
  paymentSchedule: PaymentStage[];
  deliveryTerms: DeliveryTerms;
  disclaimers: string[];
  ownerNotes: string;
  renderedFile?: StoredFileReference;
  sentSnapshot?: StoredFileReference;
  signedFile?: StoredFileReference;
  signatureAuditFile?: StoredFileReference;
  signProvider?: SignatureProviderState;
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 14.2 Addendum record

```ts
interface ContractAddendumRecord {
  id: string;
  addendumNumber: string;
  contractId: string;
  originalSignedContractId: string;
  sequence: number;
  sourceType: 'gmail' | 'phone' | 'in_person' | 'owner_manual';
  sourceReference?: string;
  requestedAt: string;
  requestedChanges: ContractChange[];
  approvedChanges: ContractChange[];
  previousTotalCents: number;
  addedCostCents: number;
  removedCostCents: number;
  netChangeCents: number;
  revisedTotalCents: number;
  paymentImpact: string;
  deliveryImpact: string;
  status: ContractRecord['status'];
  renderedFile?: StoredFileReference;
  signedFile?: StoredFileReference;
  signProvider?: SignatureProviderState;
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 14.3 Contract change record

```ts
interface ContractChange {
  id: string;
  action: 'add' | 'remove' | 'replace' | 'clarify';
  category: string;
  item: string;
  previousValue: string;
  revisedValue: string;
  priceDeltaCents: number;
  deliveryImpact: string;
  sourceExcerpt?: string;
  ownerConfirmed: boolean;
}
```

### 14.4 Acceptance state

```ts
interface AgreementAcceptance {
  status: 'not_prepared' | 'prepared' | 'sent' | 'accepted' | 'declined' | 'cancelled';
  method: '' | 'hand_signed_copy' | 'deposit_payment' | 'email_confirmation';
  preparedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  acceptedByName?: string;
  acceptedByEmail?: string;
  evidenceReference?: string;
  evidenceNotes?: string;
  depositAmountCents?: number;
  depositReference?: string;
}
```

### 14.5 Storage names

Initial Netlify Blob stores:

- `owner-copilot-contracts`
- `owner-copilot-contract-addenda`
- `owner-copilot-contract-change-intake`
- `owner-copilot-contract-templates`
- `byondrv-contract-files`

Reuse:

- `owner-copilot-customers`
- `owner-copilot-leads`
- `owner-copilot-timeline-events`
- `owner-copilot-ai-actions`
- `owner-copilot-audit-logs`
- `owner-copilot-gmail-threads`

Binary files must be accessed through a file-storage service abstraction. Before production, confirm whether Netlify Blobs meets size, retention, backup, and retrieval needs. If not, place binary files in dedicated object storage while retaining metadata and keys in the Blob records.

## 15. Contract Numbering and Versioning

Recommended human-readable format:

- Contract: `BRV-YYYY-NNNN`
- Version: `BRV-YYYY-NNNN-V2`
- Addendum: `BRV-YYYY-NNNN-A01`

Rules:

- contract number allocation must be atomic enough to prevent duplicates;
- internal UUIDs remain the technical identifiers;
- every sent revision receives its own immutable snapshot;
- signed versions cannot be deleted through normal admin actions;
- addendum sequence numbers cannot be reused;
- the effective deal state is the signed base contract plus all completed signed addendums in sequence.

## 16. Pricing Rules

- Store money as integer cents.
- Perform all totals in application code.
- Display a line-item breakdown.
- Store both previous and revised totals for addendums.
- Require an owner-entered reason for discounts or manual price overrides.
- Do not silently refresh an existing deal from a changed public product price.
- Product catalogue values are starting inputs only; the contract snapshot controls the deal after creation.
- AI must never supply numeric commercial values unless merely extracting explicitly stated source text, and extracted numbers must still require owner confirmation.
- Reject documents where line-item totals and displayed totals do not match.
- Apply the approved 30% / 20% / 50% payment schedule by default.
- Calculate the 30% signing payment and 20% arrival payment from the total contract value; calculate the delivery payment as the remaining balance so rounding cannot cause the stages to differ from the total.
- Label the triggers exactly as `On signing the contract`, `When the camper arrives in Australia`, and `On taking delivery`.

## 17. Gmail Integration Requirements

### 17.1 Existing implementation to extend

The current repository already provides:

- encrypted OAuth token storage;
- token refresh;
- Gmail read-only scope;
- owner-configurable Gmail search query;
- sender exclusions;
- Gmail message metadata ingestion;
- customer and lead matching suggestions;
- Gmail match administration;
- audit records.

### 17.2 MVP changes

- Fetch full plain-text/HTML body content for candidate messages.
- Normalise multipart bodies into safe text for AI processing.
- Store only the minimum body content required by the workflow.
- Link each processed message to its Gmail message and thread IDs.
- Add a scheduled function, recommended every five minutes.
- Maintain an internal last-seen state and per-message idempotency record.
- Restrict processing to inbound messages matching the owner-approved query.
- Exclude sent mail, automated notifications, newsletters, spam, trash, and signing-provider notifications from customer-change classification unless intentionally processed.
- Prefer exact email and contract-number matching.
- Require owner resolution for ambiguous matches.

### 17.3 OAuth scopes

Phase 1 contract intake can remain on `gmail.readonly`.

If creating Gmail drafts is added, request the narrowest Google scope that supports draft creation and sending, and clearly explain the permission during reconnection. Do not request mailbox modification permission merely to mark internal processing state; store processing state in ByondRV.

### 17.4 Polling failure behaviour

- A failed poll must not lose the previous cursor/state.
- A later successful poll must catch up within the configured date window.
- Repeated message IDs must not create duplicate actions.
- Sync failures must appear on the admin dashboard.
- Owner must be able to run the sync manually.

## 18. Manual Delivery and Acceptance Requirements

### 18.1 Configuration

Environment variables:

- `CONTRACT_TERMS_APPROVED_VERSION`: must exactly equal the legally approved Terms version embedded in the record.
- Existing Gmail OAuth may remain `gmail.readonly`; compose opens in the owner's signed-in browser.

Never put a draft version in `CONTRACT_TERMS_APPROVED_VERSION`. After legal approval, update the Terms text/version in code, deploy it, and set the environment variable to that exact final version.

### 18.2 Delivery model

- render the approved contract/addendum as controlled HTML;
- save the immutable content and SHA-256 digest;
- make the final HTML available to view or download;
- create a pre-addressed Gmail compose URL with clear owner instructions;
- require the owner to attach the final document and matching approved Terms;
- require recipient and attachment checking before the owner sends;
- record `sent` only after the owner confirms the email was actually sent.

### 18.3 Acceptance evidence

The acceptance endpoint must:

- require the expected customer name and a valid email;
- require acceptance time, method, and durable evidence reference;
- require amount and payment reference for deposit acceptance;
- warn if the deposited amount differs from the calculated 30%;
- reject deposit acceptance for addenda;
- retain evidence pointers rather than copying unnecessary sensitive Gmail content;
- append owner audit and customer/lead timeline events.

### 18.4 Allowed lifecycle

`approved → prepared → sent → accepted`. Preparing locks the commercial content. An incorrect prepared or sent original contract requires a replacement revision; an accepted contract requires an addendum.

## 19. Proposed APIs and Functions

### 19.1 Admin contract functions

- `admin-contracts.ts`
  - `GET`: list/search contracts
  - `POST`: create contract draft
- `admin-contract.ts`
  - `GET`: get full contract
  - `PATCH`: edit allowed draft fields
- `admin-contract-preview.ts`
  - render and return preview metadata/file
- `admin-contract-approve.ts`
  - validate and lock approved draft
- `admin-contract-acceptance.ts`
  - prepare immutable copy, mark sent, and record acceptance evidence
- `admin-contract-revise.ts`
  - create a new pre-signature version
- `admin-contract-preview.ts`
  - view/download the immutable prepared copy

### 19.2 Addendum functions

- `admin-contract-addenda.ts`
  - list/create addendum drafts
- `admin-contract-addendum.ts`
  - read/update one draft
- `admin-contract-addendum-preview.ts`
- `admin-contract-addendum-approve.ts`
- `admin-contract-addendum-send.ts`

### 19.3 Gmail functions

- extend `google-gmail-sync.ts` for safe full-message retrieval or add a dedicated helper;
- `google-gmail-contract-sync.ts` scheduled function;
- `admin-contract-change-intake.ts` list/read/update review items;
- `admin-contract-change-extract.ts` explicit re-run with structured AI output.

### 19.4 Acceptance functions

- `admin-contract-acceptance.ts`
- `admin-addendum-acceptance.ts`
- `admin-contract-preview.ts`
- `admin-addendum-preview.ts`
- `agreement-acceptance-core.ts`

### 19.5 Shared libraries

- `src/lib/contracts.ts`
- `src/lib/contract-numbering.ts`
- `src/lib/contract-pricing.ts`
- `src/lib/contract-renderer.ts`
- `src/lib/contract-diff.ts`
- `src/lib/contract-validation.ts`
- `src/lib/contract-change-schema.ts`

## 20. Status Models and Transitions

### 20.1 Contract transitions

Allowed primary transitions:

- `draft -> owner_review`
- `owner_review -> draft`
- `owner_review -> ready_to_send`
- `ready_to_send -> sent`
- `sent -> viewed`
- `sent/viewed -> partially_signed`
- `sent/viewed/partially_signed -> signed`
- `sent/viewed/partially_signed -> declined`
- `sent/viewed/partially_signed -> expired`
- `sent/viewed/partially_signed -> cancelled`
- `sent/viewed/partially_signed -> error`
- `draft/owner_review/ready_to_send/sent/viewed -> superseded`

No transition may leave `signed` except creating a linked addendum or operational archive marker. The signed record remains signed.

### 20.2 Change-intake transitions

- `new`
- `extracting`
- `needs_match`
- `needs_owner_review`
- `approved_for_revision`
- `approved_for_addendum`
- `informational`
- `rejected`
- `duplicate`
- `converted`
- `error`

## 21. Audit and Timeline Requirements

Audit events must include actor, timestamp, target, action, and relevant identifiers.

Required events:

- contract created;
- contract edited;
- price override entered;
- preview generated;
- owner approved;
- send requested;
- sent;
- viewed;
- signed by each signer;
- completed;
- declined;
- expired;
- bounced;
- cancelled;
- superseded;
- Gmail message ingested;
- AI change extraction created;
- extraction edited;
- extraction approved/rejected;
- phone conversation recorded;
- addendum created;
- addendum approved;
- acceptance evidence stored/linked;
- Gmail or storage error.

Do not place secrets, full access tokens, payment-card information, or unnecessary email content in audit records.

## 22. Security and Privacy Requirements

- All admin endpoints use the existing admin authorization pattern.
- Google tokens remain encrypted at rest using the existing mechanism.
- Validate all IDs and prevent cross-customer record access.
- Escape all rendered user input.
- Treat email bodies and attachments as untrusted content.
- Defend AI prompts against instructions contained in customer emails.
- Send only the minimum customer and contract data required to AI.
- Do not include bank/card information in AI prompts.
- Verify recipient email immediately before send.
- Use least-privilege Google scopes.
- Define file retention and deletion rules.
- Ensure prepared and accepted records cannot be silently overwritten.
- Create and document a data-breach response path.
- Do not log generated documents or private customer data to console output.

## 23. Reliability and Idempotency

- Contract creation accepts an idempotency key.
- Lifecycle endpoints reject invalid or repeated state transitions for the same version.
- Gmail ingestion deduplicates by message ID.
- Preview/download can be safely retried.
- Number allocation prevents duplicate human-readable references.
- Partial failures preserve enough state for owner recovery.
- The admin displays retryable errors with a clear next action.

## 24. Validation Rules

Before preview:

- customer name and email present;
- product selected;
- seller identity complete;
- at least one specification/inclusion section present;
- price structure complete;
- payment schedule arithmetically consistent;
- template version active.

Before send:

- preview generated from current approved data;
- owner approval recorded after the latest material edit;
- recipient email re-confirmed;
- no unresolved price field;
- no unresolved delivery-impact field where required;
- totals match;
- provider configured;
- production/test mode visibly confirmed;
- legal template version approved.

Before addendum send:

- base contract signed;
- original contract snapshot available;
- addendum sequence allocated;
- every change has previous and revised values where applicable;
- all price deltas owner-confirmed;
- revised total matches calculated total;
- delivery impact explicitly confirmed;
- unchanged-terms statement present.

## 25. Notifications

Owner-facing notifications:

- Gmail change awaiting review;
- ambiguous customer/contract match;
- contract ready for owner review;
- customer email bounced;
- customer declined;
- contract accepted;
- addendum accepted;
- Gmail sync disconnected or failing;
- contract-file storage error.

The MVP may show these in the admin dashboard and daily summary. External owner SMS/push notifications are out of scope.

## 26. Analytics and Operational Metrics

Track:

- contracts created per month;
- median time from draft creation to send;
- median time from send to acceptance;
- contracts requiring revision;
- addendums per accepted contract;
- email-generated vs phone-generated addendums;
- AI extraction approval/edit/rejection rates;
- AI requests, tokens, estimated cost, latency, and accepted-action rate by configured model;
- Nano-to-Luna recommendations and owner choices;
- Luna-to-Terra recommendations and owner choices;
- manual-review selections after a model-change prompt;
- ambiguous Gmail match rate;
- customer-email bounce rate;
- declined and expired rate;
- sync/storage error counts;
- owner time-to-review for contract-change actions.

Do not use customer contract values in public analytics. Admin commercial summaries must remain private.

## 27. Testing Strategy

### 27.1 Unit tests

- contract-number generation;
- money calculations;
- payment-stage validation;
- addendum price deltas;
- contract status transitions;
- addendum status transitions;
- diff generation;
- template escaping;
- required-field validation;
- Gmail MIME/body normalisation;
- customer/contract deterministic matching;
- AI output schema validation;
- model router task classification;
- Nano-to-Luna escalation criteria;
- Luna-to-Terra escalation criteria;
- model allowlist and environment fallback validation;
- model-change prompt state and owner-decision persistence;
- acceptance evidence validation;
- Terms-version approval gating.

### 27.2 Integration tests

- create and retrieve contract draft;
- render 12C-based preview;
- create a 15XC variation without leaking 12C-specific features;
- prepare and retrieve an immutable contract copy;
- record hand-signed, email, and deposit acceptance;
- reject deposit acceptance for addenda;
- process a Gmail change request;
- verify routine Gmail classification uses the configured triage model;
- verify material contract extraction recommends the configured work model;
- verify ambiguous Luna output recommends but does not automatically call the escalation model;
- verify manual review performs no additional model call;
- verify pre-approved Nano-to-Luna routing never pre-approves Terra;
- convert Gmail intake to revision;
- convert Gmail intake to addendum;
- create addendum from phone note;
- repeated Gmail message does not duplicate action;
- repeated lifecycle calls do not corrupt evidence or duplicate events.

### 27.3 End-to-end tests

- owner creates, previews, approves, and sends a test contract;
- owner fixes a validation error;
- sent status appears;
- recorded acceptance updates contract and timeline;
- unsigned contract revision cancels/supersedes correctly;
- signed contract creates addendum;
- AI Draft Action can be edited before conversion;
- owner receives the correct model-change prompt with reason and relative cost tier;
- owner can use the recommended model, continue with the current model, choose manual review, or cancel;
- Terra is not called without an explicit per-action owner decision;
- ambiguous Gmail match blocks conversion;
- test mode is clearly visible;
- mobile admin layout remains usable.

### 27.4 Golden-document tests

Create approved golden fixtures from the 12C and 15XC samples.

Verify:

- section order;
- required seller/buyer fields;
- product-specific specifications;
- pricing and payment layout;
- signature content;
- page-break quality;
- no data leakage between fixtures;
- addendum references and totals.

Rendered document tests should compare extracted text and selected visual snapshots rather than fragile byte equality.

## 28. Acceptance Criteria

The MVP is accepted when:

1. Owner can create a contract from an existing customer and product.
2. Generated output follows the approved 12C-derived structure.
3. A 15XC contract can be generated with correct model-specific data and without 12C-only features.
4. All pricing totals are calculated deterministically and validated.
5. Owner can preview the exact document before sending.
6. No send occurs without an owner approval event.
7. Customer can return a signed copy/photo, explicitly accept by email, or pay the qualifying original-contract deposit without a ByondRV account.
8. Prepared file and acceptance evidence reference are retrievable from the contract.
9. Prepared and accepted contracts are immutable.
10. A customer email requesting a change produces an owner-reviewable AI Draft Action.
11. The AI Draft Action cannot change or send a document on its own.
12. Owner can record a phone conversation and create the same structured change workflow.
13. An accepted contract change produces a numbered addendum.
14. Addendum shows original reference, exact changes, price delta, revised total, and delivery impact.
15. Accepted addendum is stored and linked to the base contract.
16. Duplicate Gmail messages and repeated lifecycle actions do not create duplicate records.
17. Failures are visible and recoverable from admin.
18. Legal template and addendum wording have recorded approval before production mode is enabled.
19. Routine Gmail triage uses `gpt-5.4-nano` through central configuration.
20. Material contract extraction prompts for `gpt-5.6-luna` unless the owner has explicitly enabled pre-approved Nano-to-Luna routing.
21. Difficult-case escalation prompts for `gpt-5.6-terra` and never runs automatically in the MVP.
22. Model-change prompts explain the reason, current model, recommended model, and relative cost tier.
23. Every AI action records model, reasoning effort, routing decision, owner decision, token usage when available, and escalation reason.
24. Evaluation fixtures demonstrate that the configured routing meets the approved quality and cost thresholds before production enablement.

## 29. Delivery Plan

### Phase 0: Template and policy lock

Estimated effort: 1-2 development days plus owner/legal review.

Deliverables:

- preserve source attachments;
- extract 12C and 15XC structure;
- build canonical field map;
- encode the approved master-agreement seller name and ABN and replace the source address with `77 Coleyville Rd, Mutdapilly QLD 4307`;
- encode the owner-confirmed legally reviewed wording and approved 30% / 20% / 50% payment rules;
- approve contract and addendum templates;
- choose file storage;
- create the Terms-version approval environment gate;
- create anonymised contract-email evaluation fixtures;
- configure triage, work, and escalation model environment variables;
- define initial routing thresholds and owner model-change prompt wording.

Gate: no production sending until fixed wording is approved.

### Phase 1: Manual contract generation and acceptance

Estimated effort: 3-5 development days.

Deliverables:

- contract data model and stores;
- Contracts admin tab;
- create/edit/validate/preview workflow;
- deterministic renderer;
- immutable prepare/download/Gmail-compose workflow;
- sent and acceptance-evidence workflow;
- timeline and audit events.

Gate: owner can complete a full test contract delivery and acceptance-evidence cycle.

### Phase 2: Revisions and manual addendums

Estimated effort: 2-4 development days.

Deliverables:

- immutable sent/signed versions;
- pre-signature revisions;
- manual/phone change intake;
- addendum diff and calculation;
- addendum preview, delivery, acceptance, and storage;
- effective deal-state summary.

Gate: owner can create and complete an accepted addendum from a phone note.

### Phase 3: Gmail AI change intake

Estimated effort: 3-5 development days.

Deliverables:

- scheduled Gmail contract sync;
- full-body safe extraction;
- deterministic and AI-assisted matching;
- structured contract-change classifier;
- cost-aware Nano-to-Luna-to-Terra model router;
- owner model-change prompts and manual-review path;
- model usage and cost audit metadata;
- AI Draft Action integration;
- owner conversion to revision/addendum;
- sync status and recovery.

Gate: a real test email creates exactly one correct owner-review action and does not change a contract automatically.

### Phase 4: Hardening and production rollout

Estimated effort: 2-3 development days.

Deliverables:

- security and privacy review;
- test coverage;
- production provider approval/configuration;
- operational runbook;
- backup/export verification;
- owner training;
- limited pilot with selected customers;
- post-pilot corrections.

Indicative total: 11-19 development days plus remaining owner decisions and third-party account approval. The owner has confirmed the required legal review as complete.

## 30. Rollout Strategy

1. Run all signing in provider test mode.
2. Generate 12C and 15XC golden documents.
3. Complete internal signature tests with non-customer email addresses.
4. Pilot manual contract creation without Gmail automation.
5. Pilot one real contract with owner double-check.
6. Enable manual addendums.
7. Enable Gmail classification in observe-only mode.
8. Compare AI extraction with owner interpretation for at least ten representative messages.
9. Enable owner-review AI Draft Actions.
10. Keep automatic sending permanently disabled unless a later PRD explicitly changes that policy.

## 31. Operational Runbook Requirements

Document:

- how to connect/reconnect Gmail;
- how to configure Gmail search scope;
- how to configure the exact approved Terms version;
- how to create and send a contract;
- how to cancel and replace an unsigned version;
- how to create a phone addendum;
- how to process an email change;
- how to recover from a bounced customer email;
- how to follow up from Gmail;
- how to file a returned signed copy/photo or acceptance email;
- how to handle incorrect customer matching;
- how to handle provider downtime;
- how to export a complete customer contract chain;
- how to revoke integration credentials.

## 32. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Stale or legally inadequate master wording | High | Legal approval gate and versioned template registry |
| AI misreads customer intent | High | Original source shown, structured schema, confidence, owner approval |
| AI invents commercial facts | High | Explicit prompt boundaries, no AI calculations, owner-confirmed values |
| Wrong customer/contract match | High | Exact matching first; ambiguous items blocked for owner selection |
| Old product data copied into a new deal | High | Structured product snapshot and 12C/15XC golden tests |
| Duplicate email/acceptance processing | Medium | Message IDs and idempotent lifecycle actions |
| Contract sent to wrong email | High | Recipient confirmation immediately before send |
| Accepted document later overwritten | High | Immutable prepared/accepted records, separate addenda, storage controls |
| Missing or weak acceptance evidence | High | Mandatory identity, time, method, and durable evidence reference |
| Gmail OAuth disconnection | Medium | Visible connection health, manual sync, reconnect workflow |
| File loss or inaccessible signed records | High | File-service abstraction, retention decision, backup/export tests |
| Privacy breach | High | Data minimisation, access controls, secure providers, no document logging |
| Owner workflow feels too complex | High | Plain-language UI, single Contracts workspace, phased rollout |

## 33. Owner Decisions

### 33.1 Resolved decisions

1. The legal seller name and ABN remain exactly as shown in the 12C master agreement.
2. The current seller address is `77 Coleyville Rd, Mutdapilly QLD 4307`; this supersedes any older address in the source agreement.
3. The fixed contract, cancellation, refund, warranty, Australian Consumer Law, and addendum wording is accepted as legally reviewed and approved.
4. The standard payment schedule is:
   - 30% deposit on signing the contract;
   - 20% when the camper arrives in Australia; and
   - the remaining 50% on taking delivery.

### 33.2 Remaining decisions

1. Confirm the current seller phone numbers, email, and website to print on contracts.
2. Confirm whether any product or deal type may use a payment schedule other than the approved standard schedule.
3. Confirm whether Beyond RV signs before or after the customer.
4. Confirm whether a witness is ever required.
5. Confirm whether model prices come from the public catalogue, an internal list, or owner entry.
6. Confirm approved optional extras and their source of truth.
7. Confirm who may approve and send contracts besides the owner.
8. Confirm the owner filing location for returned signed copies/photos, deposit receipts, and acceptance emails.
9. Confirm contract and signed-document retention period.
10. Confirm whether signed files should also be stored in a dedicated Google Drive folder.
11. Confirm exact wording for delivery impacts that are not yet known.

## 34. Future Enhancements

Not required for MVP:

- Gmail push notifications using Google Cloud Pub/Sub;
- optional electronic-signature provider if the business later changes this decision;
- customer contract portal;
- SMS/MMS change intake;
- automatic Google Drive filing;
- payment/deposit collection after signing;
- multi-language contracts;
- advanced template library;
- analytics-based follow-up automation;
- owner voice-note transcription;
- accounting-system sync;
- migration from Netlify Blobs to relational contract storage;

## 35. Implementation Reference Map

Existing files to reuse or extend:

- `src/pages/admin.astro`
- `src/components/AdminPanel.tsx`
- `src/components/AdminDashboard.tsx`
- `netlify/functions/blob-store.ts`
- `netlify/functions/owner-copilot-core.ts`
- `netlify/functions/owner-copilot-record-sync.ts`
- `netlify/functions/owner-copilot-store-utils.ts`
- `netlify/functions/admin-owner-copilot-ai-actions.ts`
- `netlify/functions/admin-owner-copilot-timeline.ts`
- `netlify/functions/google-oauth-core.ts`
- `netlify/functions/google-gmail-sync.ts`
- `netlify/functions/admin-gmail-matches.ts`
- `netlify/functions/admin-auth.ts`
- `netlify/functions/security-utils.ts`

Related planning documents:

- `docs/plans/2026-06-25-sms-contracts-prd.md`
- `docs/plans/2026-06-06-byondrv-owner-copilot-implementation-plan.md`
- `docs/byondrv-owner-copilot-prd.md`
- `docs/PROJECT_AUDIT.md`
- `docs/PROJECT_ROADMAP.md`

## 36. External Technical References

- Gmail push notifications and history synchronisation: `https://developers.google.com/workspace/gmail/api/guides/push`
- Gmail message sending: `https://developers.google.com/workspace/gmail/api/guides/sending`
- Netlify Scheduled Functions: `https://docs.netlify.com/build/functions/scheduled-functions/`
- Queensland electronic-signature requirements: `https://www.legislation.qld.gov.au/view/html/inforce/current/act-2001-042/lh`
- ACCC contracts guidance: `https://www.accc.gov.au/business/selling-products-and-services/contracts`
- OAIC guidance on securing personal information: `https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/handling-personal-information/guide-to-securing-personal-information`

## 37. Definition of Done

This initiative is complete when Beyond RV can reliably perform the following without developer assistance:

1. Create a correct customer contract from the approved 12C-derived template.
2. Generate a correct model variation validated against the 15XC reference.
3. Prepare, download, and send the complete contract and approved Terms from Gmail.
4. Record sent status and durable customer-acceptance evidence.
5. Receive a customer contract-change email as an owner-reviewable draft action.
6. Record the same type of change from a phone conversation.
7. Create a revised unsigned contract or signed-contract addendum as appropriate.
8. Review all commercial impacts before sending.
9. Collect addendum acceptance by signed copy/photo or explicit email and preserve the complete chain.
10. Explain from the audit and timeline records what happened, when, from which source, and who approved it.
