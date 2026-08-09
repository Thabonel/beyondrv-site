# Product Requirements Document: GM Sales Workspace, One-Click Agreements, Voice Capture, and Build Handoff

- Date: 2026-08-09
- Owner: Beyond RV
- Status: Approved product direction; Phase 0 foundation, Phase 1 GM workspace, and initial Phase 2 idempotent enquiry-to-agreement conversion implemented locally 9 August 2026; not deployed
- Primary user: General Manager (GM)
- Secondary users: Beyond RV owner and authorised operational staff
- Primary implementation target: Existing Beyond RV Astro/React admin on Netlify
- Product principle: Talk once, confirm once, update everything

Related documents:

- [`2026-07-23-contract-generator-gmail-esign-prd.md`](./2026-07-23-contract-generator-gmail-esign-prd.md)
- [`2026-08-08-admin-first-visual-configurator-prd.md`](./2026-08-08-admin-first-visual-configurator-prd.md)
- [`../CONTRACT-WORKFLOW-RUNBOOK.md`](../CONTRACT-WORKFLOW-RUNBOOK.md)
- [`../UNIFIED-LIFECYCLE-DESIGN.md`](../UNIFIED-LIFECYCLE-DESIGN.md)
- [`../CONFIGURATOR-PHASE-2-OPERATIONS.md`](../CONFIGURATOR-PHASE-2-OPERATIONS.md)

---

## 1. Executive Summary

Beyond RV's sales process is effective but largely invisible to the website admin. Most sales work happens through phone calls, workshop-floor conversations, customer visits, exchanged photographs, manually prepared agreements, and bank-transfer deposits. The GM performs the work, but the system currently asks him to separately recreate that work as administrative data. That duplication is the core adoption problem.

The solution is not a secret owner-monitoring dashboard and not a conventional CRM task system. Beyond RV will redesign the admin around the GM's real sales motion and make the agreement the central operational record.

The new GM experience will provide:

1. A simplified four-area workspace: **Today**, **Customers**, **Agreements**, and **Builds & Orders**.
2. A persistent **Create Agreement** action.
3. A contextual **Create Agreement** button on every website enquiry.
4. One-click transfer of relevant enquiry, customer, product, price, and configuration information into an agreement draft.
5. A fast agreement editor that is easier and safer than the existing Word-document workflow.
6. A secure customer review, acceptance, and deposit-instruction experience.
7. A controlled transition from verified deposit to order, build specification, China production, shipment, and local finishing.
8. A phone Home Screen shortcut that lets the GM dictate what happened after a call, confirm the AI's interpretation, and update all relevant records at once.
9. Automatically generated follow-ups from real sales events, without requiring the GM to create tasks.
10. A separate technical/site-management area so website administration does not compete with sales work.

The system will use structured deal data as the single source for the agreement, customer record, sales status, follow-up, configuration, payment milestones, and build record. It will not generate a document and then attempt to parse that document back into the admin.

The AI is a clerical assistant, not a commercial decision-maker. It may transcribe, match, extract, prefill, summarise, and propose updates. It must not invent prices, convert uncertain requests into contractual promises, send an agreement, verify a deposit, approve a drawing, or start production without an explicit authorised human action.

The target outcome is simple: the fastest way for the GM to perform his job must also become the easiest way to keep the business system accurate.

---

## 2. Authoritative Product Decisions

The following decisions are settled for this PRD.

### 2.1 The current agreement is the approved business template

- The agreement currently implemented in the system is the agreement Beyond RV uses.
- Its wording must be treated as the business-approved baseline.
- This project must not initiate a wording review or rewrite as a prerequisite.
- Existing wording may only change through a separately authorised business decision.
- The implementation must replace outdated labels such as `legal-review-draft` with an accurate business-approved version identifier without changing the approved wording.
- “Business approved” must not be represented as independent legal advice or solicitor approval.

### 2.2 The GM experience is the primary admin experience

- `/admin` must open to the GM's sales workspace, not the current broad business dashboard.
- The interface must be useful to the GM during real customer work.
- The interface must not be designed primarily as an owner surveillance tool.
- Owner visibility should be a natural result of shared operational records, not covert monitoring.

### 2.3 The agreement is the adoption wedge

- The first behavioural objective is replacing the Word agreement process.
- Agreement creation must be faster than finding, copying, editing, saving, attaching, and tracking a Word file.
- Website enquiries, phone-only customers, configurations, and later changes must all be able to enter the same agreement workflow.

### 2.4 No manual task creation for routine sales work

- The GM must not be required to create tasks for inbound enquiries, sent agreements, promised callbacks, appointments, deposits, or customer-requested changes.
- Follow-ups are generated from lifecycle events and explicit dates captured during the sales process.
- The word **Tasks** must not appear in the normal GM navigation.

### 2.5 Made-to-order operating model

- Slide-on campers are made to order; the website must not imply stock availability where none exists.
- After the required deposit is verified, the build begins in China.
- The camper is then shipped to the local Beyond RV factory for finishing and handover.
- Custom alterations are chargeable unless explicitly recorded otherwise.
- Alterations that affect the physical build must be represented in the approved configuration and, where applicable, the 3D drawing/CAD-derived visual record.

### 2.6 Human confirmation remains mandatory for commercial commitments

The AI must not autonomously:

- set or change a price;
- approve a discount;
- make a customer request contractually binding;
- send an agreement;
- record acceptance;
- verify bank receipt;
- approve drawings or engineering changes;
- release a build to production.

---

## 3. Current Business Workflow

The typical current workflow is:

1. A customer calls Beyond RV.
2. The GM answers, often while on the workshop floor.
3. The GM discusses product suitability, requirements, prices, options, and alterations.
4. The GM invites the customer to inspect samples or sends photographs if a visit is impractical.
5. The parties negotiate and agree on the product, specification, alterations, and total price.
6. The GM prepares and sends the existing agreement, currently using a Word-document process.
7. The customer transfers the deposit to the Beyond RV bank account.
8. Beyond RV verifies the deposit.
9. The build begins in China.
10. The unit is shipped to Australia and taken to the local factory for finishing.
11. Arrival and final delivery payments are collected according to the approved payment schedule.

The commercial work occurs, but much of the useful information remains in the GM's memory, phone, photos, Word documents, and bank activity rather than the shared system.

---

## 4. Problem Statement

### 4.1 Adoption problem

The current admin contains approximately twenty top-level destinations covering sales, operations, website content, analytics, integrations, audit data, and deployment. The GM must decide where to go before receiving value. The interface asks him to manage the system rather than helping him complete the sale.

### 4.2 Capture problem

Most business is conducted by phone. Capturing that activity in a separate form after the conversation feels like duplicate work, particularly on a workshop floor where typing is inconvenient.

### 4.3 Agreement problem

The system agreement already has valuable foundations—structured pricing, payment calculations, validation, immutable snapshots, revisions, addenda, acceptance evidence, and audit history—but the current workflow contains too many separate steps and too much re-keying. Customer and lead links are optional, product-specific defaults are incomplete, and agreement progress does not yet drive the complete deposit-to-build lifecycle.

### 4.4 Data fragmentation problem

Enquiries, customers, leads, agreements, configurations, payments, orders, and build records exist in separate stores or views. Without a common sales identity and explicit links, the business can create duplicates or lose the relationship between what was requested, what was sold, what was paid, and what must be built.

### 4.5 Operational-risk problem

Free-text customer requests can be ambiguous. If AI extraction or hurried data entry silently turns them into inclusions, Beyond RV can create an unpriced obligation or a build mismatch. Phone capture must reduce effort without removing commercial control.

---

## 5. Goals

### 5.1 Business goals

- Capture normal sales activity as a by-product of doing the work.
- Reduce enquiry-to-agreement preparation time.
- Increase the proportion of enquiries linked to a customer and agreement state.
- Reduce missed follow-ups without introducing manual task administration.
- Preserve negotiated price, inclusions, exclusions, alterations, and decisions in one shared record.
- Create a dependable handoff from accepted agreement to production.
- Make agreement and build data usable even while source CAD files are still pending.
- Give the owner dependable operational visibility without requiring daily owner administration.

### 5.2 GM goals

The GM must be able to:

- open admin and immediately see the most useful next sales action;
- turn a website enquiry into a prefilled agreement draft with one tap;
- create an agreement for a phone-only or walk-in customer without first navigating to another module;
- change the prefilled details to reflect the negotiated phone discussion;
- add custom alterations and their prices quickly;
- send or prepare an agreement faster than using Word;
- dictate a call outcome on the workshop floor;
- correct the AI by voice or a few taps;
- have the system update the customer, sales state, agreement, appointment, and follow-up together;
- verify a deposit and release the correct immutable specification into the build process;
- find current agreements and builds without understanding the underlying storage model.

### 5.3 Customer goals

The customer must be able to:

- receive a clear agreement matching the negotiated deal;
- review the agreement on a phone without creating an account;
- request a change or accept using a secure link;
- download the final document;
- see the exact deposit amount and payment reference;
- report that payment has been made without falsely causing production to begin;
- see clear next steps after acceptance and deposit verification.

### 5.4 Technical goals

- Reuse the existing Astro, React, Netlify Functions, Netlify Blobs, OpenAI, Gmail, agreement, configuration, lifecycle, and audit foundations.
- Introduce stable links between enquiry, customer, lead/opportunity, agreement, configuration, payment milestones, order, and build.
- Make all conversion and lifecycle commands idempotent.
- Use deterministic server-side pricing and payment calculations.
- Use schema-constrained AI extraction with field-level confidence and source evidence.
- Keep immutable agreement and build snapshots.
- Support a mobile Home Screen web app without initially requiring an App Store application.

---

## 6. Non-Goals

The first release will not:

- record live customer calls;
- listen continuously in the workshop;
- covertly monitor the GM;
- require VOIP or Twilio integration;
- send automated marketing calls or SMS messages;
- replace bank reconciliation software;
- infer that a reported payment is verified;
- allow AI to make commercial commitments;
- expose private costs, margins, factory notes, CAD files, or internal rules to customers;
- consolidate or delete existing source stores before the new projections are proven;
- make manufacturing claims from incomplete CAD or unapproved technical data;
- build a generic enterprise CRM;
- redesign the business-approved agreement wording;
- require the owner to use the admin daily.

Future telephony integration may be considered only if post-call voice capture and the redesigned workspace do not achieve sufficient adoption.

---

## 7. Users, Roles, and Access

### 7.1 General Manager

Primary responsibilities:

- receive and make customer calls;
- qualify enquiries;
- discuss products, configurations, pricing, and alterations;
- invite customers to visit or send photographs;
- prepare and send agreements;
- record agreement changes;
- confirm appointments and follow-ups;
- verify deposits when authorised;
- monitor active agreements and build handoffs.

Default access:

- Today
- Customers
- Agreements
- Builds & Orders
- Quick voice capture
- Approved product/configuration information required for sales

### 7.2 Owner

The owner is not expected to operate the admin routinely. The owner may:

- handle occasional calls directly;
- view shared business status when desired;
- enter or dictate an ad hoc customer update;
- approve exceptional commercial, product, or operational decisions;
- access the separate site-management and reporting functions when authorised.

The product must not depend on the owner re-entering GM activity or policing daily tasks.

### 7.3 Site administrator or authorised technical user

May access:

- products and archived products;
- shop catalogue;
- homepage and media;
- website settings;
- analytics and reports;
- audit and knowledge tools;
- Google/Gmail/Drive integration administration;
- deployment and pending website changes.

### 7.4 Customer

Uses a signed, expiring, revocable link for agreement review and related actions. No admin account is required.

### 7.5 Authentication requirement

The current admin authentication is a shared password and signed session with no individual user identity or role. This is insufficient for reliable actor attribution and role-specific navigation.

Before commercial launch of this PRD, the system must add:

- individual authorised user identity;
- role or capability checks enforced by server middleware;
- a GM-specific session/device identity;
- secure session revocation;
- audit actor identifiers;
- protection against cross-customer access;
- a low-friction approved-device login appropriate for the GM's phone.

Interface hiding alone is not authorisation.

Future login direction: Beyond RV intends to replace password entry with an approved phone number and one-time SMS code. This is deliberately deferred. The user identity, role/capability, signed-session, revocation, and audit foundations in Phase 0 must remain authentication-method independent so SMS-code login can be added without changing commercial permissions or actor identifiers.

---

## 8. Experience Principles

### 8.1 Work-first, not record-first

The interface begins with what the GM is trying to accomplish—call, prepare agreement, send photos, book visit, confirm deposit—not with database record types.

### 8.2 One primary action per stage

Each page or card should present one visually dominant next action. Secondary actions remain available but do not compete for attention.

### 8.3 Capture in the same motion

Creating an agreement, sending it, booking a visit, recording a call, and verifying a deposit must create their related records automatically.

### 8.4 Progressive disclosure

Show only the fields needed at the current stage. Technical and uncommon fields open when required.

### 8.5 Confirmation proportional to risk

- Low-risk: saving a note or setting a follow-up can use one confirmation.
- Medium-risk: changing a negotiated date or customer match requires a visible review.
- High-risk: price, contractual inclusion, agreement sending, payment verification, drawing approval, and production release require explicit deliberate confirmation.

### 8.6 No shame-based design

The GM interface must not use red overdue counters as its main motivator. It should use useful commercial language such as:

- “People waiting to hear back”
- “Agreements awaiting a decision”
- “Deposits awaiting verification”
- “Quoted value in progress”

### 8.7 Mobile first

All primary GM actions must work on an iPhone SE-sized viewport and in a noisy workshop environment.

---

## 9. Target Information Architecture

### 9.1 GM navigation

`/admin` redirects the authenticated GM to `/admin/today`.

The GM sees four primary destinations:

1. **Today**
2. **Customers**
3. **Agreements**
4. **Builds & Orders**

A persistent **+ Create Agreement** action is visible throughout the GM workspace.

Mobile bottom navigation:

`Today | Customers | Agreements | Builds`

The quick voice action remains available as a prominent microphone button or separate installed Home Screen shortcut.

### 9.2 Site-management navigation

Technical and website operations move to `/admin/site` or an equivalent capability-protected area:

- Products
- Archived Products
- Shop
- Homepage
- Media
- Settings
- Analytics and Reports
- Audit
- Knowledge
- Google and integration administration
- Matches
- Draft website changes
- Pending deployments

### 9.3 Deep links

Every significant record must have a stable URL:

- `/admin/today`
- `/admin/customers/:customerId`
- `/admin/enquiries/:enquiryId`
- `/admin/agreements/:agreementId`
- `/admin/builds/:buildId`
- `/admin/quick-note`

Tab-only hashes may be supported during migration, but stable routes are the target.

---

## 10. Today Workspace

### 10.1 Purpose

Today is an execution surface, not an analytics dashboard. It answers: **What should I do next to progress sales and builds?**

### 10.2 Required sections

Recommended order:

1. Agreements ready to finish or send
2. Customers expecting contact today
3. Appointments and promised actions
4. Agreements awaiting customer decision
5. Deposits reported but not verified
6. Builds requiring a GM decision

### 10.3 Queue ordering

The system should calculate a recommended order using:

- explicit promised date/time;
- agreement/customer stage;
- estimated or agreed value;
- time since last meaningful contact;
- customer urgency or stated timeframe;
- appointment time;
- blocked production consequence.

The ordering explanation must be visible, for example “Call promised today” or “$148,500 agreement awaiting response for 3 days.”

### 10.4 Follow-up generation

Follow-ups are created or recalculated automatically when:

- a new enquiry arrives;
- the GM promises a callback;
- photos or information are promised;
- a visit is booked;
- an agreement is sent;
- the customer requests a change;
- the customer reports a deposit;
- a deposit requires verification;
- a build requires clarification;
- a delivery milestone approaches.

The GM may change a due date, but does not create a task from scratch.

### 10.5 Completion behaviour

Completing the underlying action resolves or replaces the follow-up. The GM must not separately mark a duplicate task complete.

---

## 11. Enquiry-to-Agreement Conversion

### 11.1 Contextual button on every website enquiry

Every website enquiry must show exactly one agreement action:

- **Create Agreement** when no linked agreement exists;
- **Continue Agreement** when a draft exists;
- **View Agreement** when an agreement has been prepared, sent, accepted, or superseded.

The button state is derived from the enquiry-agreement link, not from text labels or client-side assumptions.

### 11.2 Idempotency

Repeated taps, retries, refreshes, and network timeouts must never create duplicate agreements.

Requirements:

- The conversion request includes an idempotency key derived from enquiry ID and conversion intent.
- The server checks for an existing active linked agreement.
- A successful repeat returns the existing agreement.
- Partial failures can be resumed.
- The audit trail records the first creation and later retries separately.

### 11.3 One-click prefill

The conversion must copy or link all relevant reliable information.

Customer information:

- legal or supplied name;
- email;
- phone;
- address when supplied;
- organisation when supplied;
- source enquiry reference;
- existing customer match or newly created customer;
- existing lead/opportunity match or newly created sales opportunity.

Product information:

- exact product/model when confidently identified;
- current published base price as the starting price snapshot;
- standard inclusions for the selected product version;
- known dimensions and weight fields;
- default payment schedule;
- approved delivery, production, and exclusion wording;
- relevant saved configuration when one exists.

Internal enquiry context:

- original message;
- vehicle make, model, and year;
- tray type and dimensions;
- number of travellers;
- travel style or intended use;
- budget and timeframe;
- callback preference;
- referral source;
- AI classification and product suggestions;
- promised photos, visit, or next action.

### 11.4 Contractual boundary

The original free-text message is evidence and sales context. It must not be silently copied into contractual inclusions.

Potential customer requests appear in a separate review area labelled:

**Customer requested — needs confirmation**

For each item, the GM can:

- Add to agreement
- Add or confirm price
- Mark included in base price
- Exclude
- Mark as not proceeding
- Require factory confirmation
- Require CAD/3D drawing update
- Record weight impact
- Record delivery impact
- Leave unresolved

Unresolved material items block agreement sending but do not block saving the draft.

### 11.5 Customer matching

Deterministic matching order:

1. Exact normalised email
2. Exact normalised phone
3. Existing explicit enquiry-customer link
4. Exact name plus corroborating product or address data
5. AI-assisted suggestion for human confirmation

The system must not merge customer records solely because names are similar.

### 11.6 Phone-only and walk-in customers

The persistent **Create Agreement** action supports customers without a website enquiry.

Minimum start fields:

- customer name;
- phone or email;
- product/model or “not decided.”

The system creates the necessary customer and opportunity records as part of saving the agreement draft.

---

## 12. Fast Agreement Workspace

### 12.1 Terminology

Use **Agreement** in the GM interface. Existing technical modules may retain `contract` internally during migration.

Replace:

- “Owner review” with “Review” or “Business approval”
- `approvedBy: owner` with the actual authenticated actor
- “Prepare Final Contract” with a clearer stage action such as “Create Final Agreement”
- a generic “Go” button with **Review & Send Agreement**

### 12.2 Editor sections

The normal editor shows six ordered sections:

1. Customer
2. Product
3. Negotiated pricing
4. Extras and alterations
5. Specifications
6. Total, deposit, and next step

Advanced details such as exclusions, build identifiers, weights, validity, delivery impacts, factory confirmations, and drawing references appear contextually.

### 12.3 Product and price snapshot

When the agreement is created:

- the selected product's current approved base price is copied into the draft;
- the catalogue version and capture timestamp are stored;
- the original price source is recorded;
- later website price changes do not silently alter the agreement;
- deliberate price refresh creates a visible difference and requires confirmation.

All money is stored as integer cents and recalculated server-side.

### 12.4 Alterations

Every custom alteration must support:

- customer-facing description;
- internal production description;
- quantity;
- price or explicit “included” decision;
- discount/override reason where applicable;
- factory-confirmation state;
- CAD/3D update requirement;
- drawing reference and approval state;
- indicative weight impact and confidence;
- delivery impact;
- customer approval state;
- source evidence, such as enquiry, voice capture, email, or visit note.

If an alteration affects the physical build, agreement readiness must display whether the corresponding configuration/drawing update is complete or deliberately deferred.

### 12.5 Discounts and deviations

- Discounts require a reason.
- Manual base-price changes require a reason and actor.
- The previous value remains in the audit trail.
- Margin or internal cost data remains private.

### 12.6 Payment schedule

Default schedule remains deterministic:

- 30% on signing the agreement;
- 20% when the camper arrives in Australia;
- 50% on taking delivery.

The final payment is calculated as the remaining balance to avoid rounding discrepancies.

### 12.7 Autosave and recovery

- Draft changes autosave after a short debounce.
- The page shows Saved, Saving, or Offline/Retrying.
- A browser refresh must not lose confirmed edits.
- Concurrent edits must be detected using record revision or ETag-style checks.
- Approved, prepared, sent, or accepted snapshots remain immutable.

### 12.8 Agreement readiness summary

Before sending, show a concise readiness panel:

- customer identity complete;
- product selected;
- price confirmed;
- alterations priced or resolved;
- required factory confirmations complete;
- required drawing/CAD updates complete or explicitly acknowledged;
- totals valid;
- payment schedule valid;
- recipient confirmed;
- current agreement version approved for business use.

### 12.9 Review and send

The primary action is **Review & Send Agreement**.

It must:

1. run server-side validation;
2. show the exact customer-facing representation;
3. highlight material values and unresolved warnings;
4. require explicit GM confirmation;
5. create an immutable version and digest;
6. create or update the customer review link;
7. prepare the approved email/PDF delivery method;
8. record the send event only after delivery is confirmed;
9. move the deal to `awaiting_customer`;
10. generate the appropriate follow-up automatically.

The first implementation may retain the current Gmail compose step, provided attachments, recipient, subject, document reference, and follow-up are prepared automatically and the complete flow is measurably faster than Word. A later controlled sending integration may remove the manual attachment step after delivery, failure, privacy, and audit behaviour are proven.

### 12.10 Performance target

- Website enquiry to complete standard agreement draft: no more than 60 seconds for a correctly classified standard product.
- Standard agreement draft to ready-to-send review: no more than 90 seconds when no custom alteration requires external confirmation.
- No retyping of information already held in the enquiry, customer, product, or configuration record.

---

## 13. Customer Agreement Experience

### 13.1 Secure link

The customer receives an expiring, revocable, random secure link. The stored token must be hashed.

The customer can:

- review the agreement in a mobile-readable format;
- download the immutable PDF/final copy;
- request a change;
- accept using an approved method;
- view the exact deposit amount;
- view a unique payment reference;
- select **I have paid**;
- see what happens next.

### 13.2 No customer account

The customer must not be forced to create a username or password for agreement review.

### 13.3 Requested changes

A customer change request:

- does not alter the sent agreement;
- creates a reviewable change intake record;
- alerts the GM in Today;
- produces a new pre-acceptance revision or post-acceptance addendum after human review;
- retains the original sent version and evidence.

### 13.4 Payment reporting versus verification

These states are separate:

- `deposit_expected`
- `deposit_reported`
- `deposit_verified`
- `deposit_mismatch`
- `deposit_cancelled_or_refunded`

Selecting **I have paid** creates `deposit_reported`. It must never start production.

### 13.5 Deposit verification

An authorised user verifies actual bank receipt by confirming:

- customer/agreement;
- received amount;
- received date;
- bank reference;
- any mismatch or third-party payer explanation;
- actor and timestamp.

Only `deposit_verified` may satisfy the production payment gate.

---

## 14. Agreement-to-Build Handoff

### 14.1 Handoff trigger

The build handoff requires:

- an accepted or otherwise valid business-approved agreement state;
- a verified deposit;
- a complete immutable agreement snapshot;
- an approved configuration/build specification where required;
- approved drawings for alterations that require them;
- no unresolved hard production blockers.

### 14.2 Handoff action

The authorised action is **Release to Build**. It is separate from deposit verification so exceptional cases remain visible and deliberate.

### 14.3 Records created or updated

Release to Build must atomically or recoverably:

- mark the sales opportunity won;
- update the customer lifecycle;
- create or link the customer order;
- create the build record;
- copy the accepted commercial specification into an immutable build-input snapshot;
- link the approved configuration and drawing versions;
- create the China production stages;
- create the shipment and Australian-arrival stages;
- create the local-factory finishing stages;
- create the 20% arrival payment milestone;
- create the final delivery payment milestone;
- append audit and timeline events;
- resolve the sales follow-up and create the next operational checkpoint.

### 14.4 Source-of-truth hierarchy

- The working configuration is the sales-design source before agreement creation.
- The accepted agreement plus accepted addenda is the commercial source.
- Approved engineering CAD and factory documentation remain the technical authority.
- The build specification reconciles these sources and records any approved variance.
- Later catalogue or website changes cannot mutate an existing agreement or build.

### 14.5 Build stages

Minimum customer build stages:

1. Agreement accepted
2. Deposit verified
3. Build released
4. China production preparation
5. China manufacture
6. Factory inspection/ready to ship
7. In transit to Australia
8. Arrived in Australia
9. Local factory finishing
10. Customer handover preparation
11. Delivered/completed

Internal substages may be added without changing customer-facing wording.

---

## 15. Workshop Voice Capture

### 15.1 Product concept

The GM installs a Beyond RV web-app shortcut on his phone Home Screen named **Log Customer Call**. It opens `/admin/quick-note` directly and shows a large microphone control.

No separate App Store application is required for the initial release.

### 15.2 Primary interaction

1. GM taps the Home Screen shortcut.
2. The approved device/session authenticates him with minimal friction.
3. GM taps or presses and holds the microphone button.
4. GM dictates naturally.
5. The system uploads and transcribes the recording.
6. AI converts the transcript into a schema-constrained proposed action set.
7. The GM sees **Here is what I understood**.
8. Material and uncertain fields are highlighted.
9. The GM selects:
   - **Correct — Save Everything**
   - **Correct by Voice**
   - **Edit Details**
   - **Discard**
10. Confirmed actions update all relevant records and show a short result summary.

### 15.3 Example dictation

> Spoke to John Smith about the 3.5 metre pop-top. Quoted one hundred and forty-eight thousand five hundred including diesel heating and an external shower. He wants photos today and will visit Tuesday at ten. Prepare the agreement, but the cabinetry colour still needs confirmation.

Expected extraction:

- customer: John Smith;
- product: 3.5m Electric Pop-Top;
- quoted total: AUD 148,500;
- included alteration: diesel heating;
- included alteration: external shower;
- unresolved choice: cabinetry colour;
- promised action: send photos today;
- appointment: Tuesday at 10:00;
- agreement action: create or update draft.

### 15.4 Structured fields

The extraction schema must support:

- customer identity and match candidates;
- contact channel and call direction;
- call date/time;
- product interest;
- vehicle/tray information;
- discussed base price;
- negotiated total;
- deposit discussed or reported;
- inclusions;
- exclusions;
- custom alterations;
- unresolved questions;
- photos/information promised;
- visit or appointment;
- next follow-up date/time;
- customer sentiment/decision stage;
- agreement create/update request;
- build or factory question;
- source transcript spans;
- per-field confidence;
- proposed system commands.

### 15.5 Matching behaviour

The voice capture may begin with or without a customer context.

If opened from a customer, enquiry, or agreement page:

- that record is the default context;
- the GM still sees the matched customer before saving.

If opened from the Home Screen:

- exact phone/email/name matches are attempted;
- likely matches are presented as large one-tap choices;
- ambiguous matches block cross-record updates;
- **Create new customer** remains available.

### 15.6 Confirmation rules

Always highlight and require confirmation for:

- customer identity;
- every monetary amount;
- discounts;
- dates and appointment times;
- contractual inclusions/exclusions;
- agreement creation or revision;
- deposit state;
- drawing/CAD requirements;
- production implications.

Low-risk notes may be saved with the overall confirmation.

### 15.7 AI correction by voice

The GM may tap **Correct by Voice** and say, for example:

> The price was one hundred and forty-six thousand five hundred, not one hundred and forty-eight.

The system applies the correction to the proposed action set and presents the revised amount before saving.

### 15.8 Workshop and connectivity behaviour

- Optimise microphone capture for short post-call summaries, not live calls.
- Show a clear recording indicator and duration.
- Support cancel and re-record.
- Keep a recoverable local pending upload if connectivity drops.
- Retry upload only after the user has chosen to save or retry.
- Never duplicate an activity because an upload is retried.
- Warn when the recording is too quiet, clipped, or cannot be reliably transcribed.
- Permit headset or phone-microphone input.
- Provide a typed fallback.
- Use large controls suitable for workshop use.

### 15.9 Audio retention

Recommended default:

- retain audio only until transcription, structured extraction, and GM confirmation complete;
- delete routine audio after successful processing;
- store the confirmed structured record and transcript when operationally justified;
- allow explicitly authorised retention only where a documented business need exists;
- never capture the customer's voice through this post-call feature.

The final retention period must be configured and disclosed in the privacy documentation before production.

### 15.10 Technical approach

Initial recommended architecture:

1. Browser microphone capture over HTTPS.
2. Short audio file upload to an authenticated Netlify Function or signed private upload endpoint.
3. OpenAI speech-to-text transcription.
4. Schema-constrained extraction into a proposed command object.
5. Server-side validation against current customer, product, agreement, and configuration records.
6. Human confirmation.
7. Transaction-like execution through existing domain services.
8. Audio deletion according to policy.

A continuous Realtime voice agent is not required for the first release. Short file-based transcription is simpler, cheaper to validate, and appropriate for post-call workshop summaries. Realtime correction can be considered later.

### 15.11 Performance targets

- Shortcut to recording-ready: under 3 seconds on a normal connection.
- Typical 30–60 second recording to proposed summary: under 10 seconds after upload under normal conditions.
- Proposed summary confirmation: one tap when fully correct.
- Total post-call capture: normally under 30 seconds excluding dictation time.

---

## 16. Automatic Activity and Follow-Up Model

### 16.1 Activity events

Every meaningful business action creates an append-only activity event, including:

- enquiry received;
- customer call summarised;
- photographs promised or sent;
- visit invited or booked;
- agreement draft created;
- agreement revised;
- agreement prepared;
- agreement sent;
- customer change requested;
- agreement accepted;
- deposit reported;
- deposit verified;
- build released;
- drawing requested/approved;
- build stage changed;
- customer contacted.

### 16.2 No duplicate entry

The same action updates the relevant state and writes the activity event. The GM does not separately log the action.

### 16.3 Follow-up derivation

A follow-up is a projection of unresolved promises and lifecycle expectations. It includes:

- source event;
- customer/agreement/build context;
- due date/time;
- owner/assignee;
- reason;
- expected resolution event;
- priority inputs;
- current status.

When the resolution event occurs, the follow-up closes automatically.

### 16.4 Owner visibility

The owner may view the same operational timeline and business summaries, subject to role access. The product must not create a hidden “GM monitoring” screen or an undisclosed inactivity indicator.

---

## 17. Status Models

### 17.1 Sales opportunity

```text
new
→ contact_in_progress
→ requirements_understood
→ agreement_draft
→ agreement_sent
→ awaiting_customer
→ deposit_reported
→ deposit_verified
→ won
```

Alternative terminal states:

- `not_proceeding`
- `lost_price`
- `lost_timing`
- `lost_product_fit`
- `lost_other`
- `spam`
- `archived`

### 17.2 Agreement

```text
draft
→ ready_for_review
→ approved
→ prepared
→ sent
→ accepted
```

Additional states:

- `changes_requested`
- `superseded`
- `declined`
- `cancelled`
- `error`

Prepared, sent, and accepted versions are immutable. Changes before acceptance create a revision. Changes after acceptance create an addendum.

### 17.3 Payment milestone

- `expected`
- `reported`
- `verified`
- `partially_verified`
- `mismatch`
- `overdue`
- `cancelled`
- `refunded`

### 17.4 Voice capture

- `recording`
- `pending_upload`
- `transcribing`
- `extracting`
- `needs_match`
- `needs_confirmation`
- `confirmed`
- `partially_applied`
- `applied`
- `discarded`
- `error`

### 17.5 Build

- `not_released`
- `release_blocked`
- `released`
- `china_preparation`
- `china_manufacture`
- `factory_inspection`
- `ready_to_ship`
- `in_transit`
- `arrived_australia`
- `local_finishing`
- `handover_ready`
- `delivered`
- `on_hold`
- `cancelled`

---

## 18. Data Architecture

### 18.1 Safe migration approach

Existing enquiry, customer, lead, agreement, configuration, order, and build stores remain intact during migration.

The initial implementation introduces:

- explicit cross-record links;
- shared domain commands;
- read projections for the GM workspace;
- append-only activity events;
- idempotency records;
- user identity and role attribution.

No source store is deleted or renamed until the integrated workflow has been validated in production and backed up.

### 18.2 Canonical relationship

```text
Enquiry ─┐
Phone ───┼─→ Customer → Sales Opportunity → Agreement → Payment Milestones
Walk-in ─┘                         │             │               │
                                  └→ Configuration              │
                                                │               │
                                                └──────→ Order/Build
```

### 18.3 Activity record

```ts
interface ActivityEvent {
  id: string;
  occurredAt: string;
  recordedAt: string;
  actorUserId: string;
  customerId?: string;
  opportunityId?: string;
  enquiryId?: string;
  agreementId?: string;
  configurationId?: string;
  buildId?: string;
  activityType: string;
  outcome?: string;
  source: 'website' | 'gm_ui' | 'voice_capture' | 'customer_link' | 'gmail' | 'system';
  sourceReference?: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

### 18.4 Sales opportunity record

```ts
interface SalesOpportunity {
  id: string;
  customerId: string;
  primaryEnquiryId?: string;
  productSlug?: string;
  configurationId?: string;
  agreementId?: string;
  stage: string;
  estimatedValueCents?: number;
  agreedValueCents?: number;
  currency: 'AUD';
  nextAction?: {
    type: string;
    dueAt: string;
    reason: string;
  };
  assignedUserId: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 18.5 Voice capture record

```ts
interface VoiceCaptureRecord {
  id: string;
  actorUserId: string;
  context: {
    customerId?: string;
    enquiryId?: string;
    opportunityId?: string;
    agreementId?: string;
  };
  status: string;
  audioStorageReference?: string;
  transcript?: string;
  transcriptModel?: string;
  extractionModel?: string;
  proposedActions: ProposedSalesAction[];
  confirmedActions: ProposedSalesAction[];
  idempotencyKey: string;
  error?: string;
  createdAt: string;
  confirmedAt?: string;
  appliedAt?: string;
  audioDeletedAt?: string;
}
```

### 18.6 Proposed sales action

```ts
interface ProposedSalesAction {
  id: string;
  actionType:
    | 'append_note'
    | 'update_customer'
    | 'update_opportunity'
    | 'create_agreement_draft'
    | 'update_agreement_draft'
    | 'add_agreement_item'
    | 'create_follow_up'
    | 'book_appointment'
    | 'record_photos_promised'
    | 'record_deposit_reported'
    | 'flag_factory_confirmation'
    | 'flag_drawing_update';
  payload: Record<string, unknown>;
  confidence: number;
  sourceExcerpt: string;
  risk: 'low' | 'medium' | 'high';
  requiresExplicitConfirmation: boolean;
  validationErrors: string[];
}
```

### 18.7 Agreement linkage additions

Existing agreement records should add or standardise:

- `sourceEnquiryId`
- `opportunityId`
- `customerId` as required rather than optional after save
- `configurationReference`
- `priceSource`
- `priceCapturedAt`
- `catalogueVersion`
- `businessApprovalVersion`
- `createdByUserId`
- `approvedByUserId`
- `sentByUserId`
- `customerReviewTokenId`
- `expectedDepositMilestoneId`
- `buildId`

### 18.8 Custom alteration record

```ts
interface CustomAlteration {
  id: string;
  customerDescription: string;
  productionDescription: string;
  priceCents: number;
  pricingDecision: 'charged' | 'included' | 'discounted';
  pricingReason?: string;
  factoryConfirmation: 'not_required' | 'required' | 'confirmed' | 'rejected';
  drawingRequirement: 'not_required' | 'required' | 'uploaded' | 'approved';
  drawingReference?: string;
  weightImpactKg?: number;
  weightConfidence?: 'known' | 'estimated' | 'unknown';
  deliveryImpact?: string;
  customerApproval: 'pending' | 'approved' | 'rejected';
  sourceType: 'enquiry' | 'phone' | 'email' | 'visit' | 'manual';
  sourceReference?: string;
}
```

### 18.9 Payment milestone record

```ts
interface PaymentMilestone {
  id: string;
  agreementId: string;
  buildId?: string;
  sequence: number;
  percentage: number;
  amountCents: number;
  trigger: string;
  status: string;
  customerReportedAt?: string;
  verifiedAt?: string;
  verifiedByUserId?: string;
  receivedAmountCents?: number;
  bankReference?: string;
  discrepancyNotes?: string;
}
```

---

## 19. Functional Requirements

### 19.1 GM shell

- **FR-GM-001:** `/admin` must route a GM to Today.
- **FR-GM-002:** GM navigation must contain no more than four primary destinations.
- **FR-GM-003:** A Create Agreement action must remain accessible from every primary GM screen.
- **FR-GM-004:** Technical website navigation must be separated and capability-protected.
- **FR-GM-005:** The normal GM UI must not use the label Tasks.

### 19.2 Enquiry conversion

- **FR-ENQ-001:** Every valid website enquiry displays its agreement-state button.
- **FR-ENQ-002:** Conversion must be idempotent.
- **FR-ENQ-003:** Conversion creates or links customer and opportunity records.
- **FR-ENQ-004:** Reliable source fields prefill the agreement.
- **FR-ENQ-005:** Free-text requests remain non-contractual until confirmed.
- **FR-ENQ-006:** Existing linked agreement state survives refresh and different devices.
- **FR-ENQ-007:** Duplicate customer suggestions require human resolution.

### 19.3 Agreement workflow

- **FR-AGR-001:** A standard product loads its approved base price and inclusions.
- **FR-AGR-002:** The GM can edit negotiated details before review.
- **FR-AGR-003:** Alterations support price, drawing, factory, weight, and delivery data.
- **FR-AGR-004:** Discounts and price overrides require reasons.
- **FR-AGR-005:** Totals and 30/20/50 payments are recalculated server-side.
- **FR-AGR-006:** Material unresolved items block sending.
- **FR-AGR-007:** Sending creates an immutable snapshot and digest.
- **FR-AGR-008:** Prepared/sent agreements cannot be overwritten.
- **FR-AGR-009:** Pre-acceptance changes create revisions.
- **FR-AGR-010:** Post-acceptance changes create addenda.
- **FR-AGR-011:** Agreement creation and state changes write activity/timeline events.

### 19.4 Voice capture

- **FR-VOICE-001:** The GM can open a recording-first page from a Home Screen shortcut.
- **FR-VOICE-002:** Microphone access begins only after deliberate user interaction.
- **FR-VOICE-003:** Audio is transcribed server-side without exposing the API key to the browser.
- **FR-VOICE-004:** Extraction conforms to a strict schema.
- **FR-VOICE-005:** The user sees the proposed interpretation before actions execute.
- **FR-VOICE-006:** Customer, money, dates, contract fields, and production effects require explicit confirmation.
- **FR-VOICE-007:** Ambiguous customer matching blocks application.
- **FR-VOICE-008:** Voice correction updates the proposal rather than creating an unlinked second note.
- **FR-VOICE-009:** Retried uploads and action execution do not duplicate records.
- **FR-VOICE-010:** Audio deletion follows the configured retention policy.
- **FR-VOICE-011:** Partial execution is visible and recoverable.

### 19.5 Customer review and payment

- **FR-CUST-001:** Customer review does not require an account.
- **FR-CUST-002:** Links are random, signed or securely mapped, expiring, revocable, and stored as hashes where possible.
- **FR-CUST-003:** Customer actions never mutate an immutable sent agreement.
- **FR-CUST-004:** Customer-reported payment and verified payment are separate states.
- **FR-CUST-005:** Payment verification records actor, date, amount, and reference.
- **FR-CUST-006:** Reported payment cannot release production.

### 19.6 Build handoff

- **FR-BUILD-001:** Release to Build is a deliberate authorised action.
- **FR-BUILD-002:** Release is blocked by missing agreement, deposit, configuration, drawing, or hard production gates.
- **FR-BUILD-003:** Release copies an immutable build-input snapshot.
- **FR-BUILD-004:** China manufacture, shipment, local finishing, and handover stages are created.
- **FR-BUILD-005:** Arrival and delivery payment milestones are linked.
- **FR-BUILD-006:** Existing agreements/builds are not changed by later catalogue edits.

### 19.7 Follow-ups and activity

- **FR-ACT-001:** Meaningful commands produce append-only activity events.
- **FR-ACT-002:** Follow-ups are derived from unresolved promises and lifecycle rules.
- **FR-ACT-003:** Completing the business action resolves the follow-up automatically.
- **FR-ACT-004:** The system must not require duplicate task completion.
- **FR-ACT-005:** Owner and GM views use disclosed shared operational data, not hidden employee monitoring.

---

## 20. AI Responsibilities and Boundaries

### 20.1 AI may

- transcribe GM voice notes;
- classify the conversation type;
- suggest a customer or enquiry match;
- extract names, product references, dates, prices, alterations, promises, and next steps;
- copy reliable enquiry data into a proposed agreement draft;
- propose structured agreement changes;
- identify missing or contradictory information;
- produce a short confirmation summary;
- propose follow-ups and appointments;
- flag likely CAD/drawing or factory-confirmation needs;
- help the GM correct the proposal by voice.

### 20.2 AI must not

- invent a price or specification;
- treat a suggested product as confirmed;
- merge customers autonomously when identity is ambiguous;
- silently convert free text into a contractual inclusion;
- decide that an alteration is free;
- approve a discount;
- confirm vehicle suitability;
- assert an unknown weight or compliance fact;
- approve factory feasibility;
- approve CAD/drawings;
- send an agreement;
- record acceptance without evidence;
- verify a deposit;
- release a build;
- obey instructions embedded in untrusted customer messages that conflict with system rules.

### 20.3 Evidence and confidence

Every extracted material field must retain:

- source type;
- source excerpt or timestamp where available;
- confidence score or confidence category;
- human confirmation state;
- final value and actor.

### 20.4 Structured output

The extraction model must use a stable strict schema. Server validation must reject:

- unknown action types;
- unexpected fields;
- malformed money or dates;
- unsupported status transitions;
- cross-customer updates without a confirmed match;
- high-risk actions lacking explicit confirmation.

### 20.5 Model routing

Use separate roles rather than one expensive model for every step:

- speech transcription model for audio-to-text;
- fast structured extraction model for routine call summaries;
- stronger reasoning model only for genuinely ambiguous multi-part change interpretation;
- deterministic application code for prices, totals, statuses, and permissions.

Model identifiers remain centrally configurable and must not be scattered through UI components.

---

## 21. Proposed Server Commands and Endpoints

Names are indicative and should follow repository conventions.

### 21.1 GM projections

- `GET /.netlify/functions/admin-gm-today`
- `GET /.netlify/functions/admin-gm-customer?id=...`
- `GET /.netlify/functions/admin-gm-agreements`
- `GET /.netlify/functions/admin-gm-builds`

### 21.2 Enquiry conversion

- `POST /.netlify/functions/admin-enquiry-agreement`
  - create-or-return agreement from enquiry;
  - requires idempotency key;
  - returns customer, opportunity, and agreement links.

### 21.3 Voice capture

- `POST /.netlify/functions/admin-voice-capture-start`
- `POST /.netlify/functions/admin-voice-capture-upload`
- `POST /.netlify/functions/admin-voice-capture-extract`
- `POST /.netlify/functions/admin-voice-capture-correct`
- `POST /.netlify/functions/admin-voice-capture-confirm`
- `DELETE /.netlify/functions/admin-voice-capture-audio`

The server may combine stages where safe, but storage and lifecycle states must remain recoverable.

### 21.4 Agreement and customer review

- extend `admin-contracts` for required linkage and actor identity;
- extend `admin-contract-preview` for agreement readiness;
- add or extend customer agreement review endpoint;
- add customer change-request endpoint;
- add payment-reported endpoint;
- add authenticated payment-verification command.

### 21.5 Build release

- `POST /.netlify/functions/admin-build-release`
- server loads and validates all source snapshots;
- command is idempotent;
- partial failure is recoverable and does not duplicate orders/builds/milestones.

### 21.6 Shared domain services

Create shared server-only services for:

- customer matching;
- opportunity lifecycle;
- agreement conversion;
- activity events;
- follow-up derivation;
- payment milestones;
- build release;
- AI proposal validation;
- idempotency;
- actor/capability checks.

UI components must not directly reproduce these rules.

---

## 22. Security, Privacy, and Commercial Integrity

- All admin endpoints require authenticated individual identity.
- All mutations require server-side capability checks.
- OpenAI and other service credentials remain server-only.
- Audio uploads are private, access-controlled, size-limited, and content-type validated.
- Customer messages, transcripts, and uploads are untrusted content.
- AI prompts send only the data needed for the action.
- Bank account details and unnecessary payment data must not be sent to AI.
- Customer secure-link responses expose allowlisted fields only.
- Tokens are revocable and rate-limited.
- Prepared, sent, accepted, and build-release snapshots are immutable.
- Price calculations, permissions, and lifecycle transitions are deterministic server functions.
- Audit logs must not contain full audio, credentials, access tokens, card information, or unnecessary personal information.
- Public JavaScript must not contain internal costs, margins, factory data, original CAD, or private configuration rules.
- Destructive merge/archive actions require explicit confirmation and recoverability.
- Retention and breach-response procedures must be documented before production.

---

## 23. Reliability and Error Recovery

### 23.1 Required guarantees

- Every create command supports an idempotency key.
- Every mutable record has a revision/version field.
- Immutable snapshots are content-digested.
- Retries return the original successful result where appropriate.
- Partial multi-record operations store progress and support safe resume.
- Activity events include causal command IDs.
- The UI never reports success before the server confirms it.

### 23.2 Voice-specific recovery

- Pending recordings survive a temporary network interruption on the same device.
- If transcription succeeds but extraction fails, the transcript can be retried.
- If extraction succeeds but confirmation is interrupted, the proposal remains available.
- If some confirmed actions apply and another fails, the UI lists exactly what succeeded and provides a retry for the remainder.
- Audio is not deleted before the required processing and confirmation state is durable.

### 23.3 Agreement-specific recovery

- A failed preview does not corrupt the draft.
- A failed send does not mark the agreement sent.
- A failed build release does not create a second build on retry.
- Concurrent edits to the same agreement display a conflict rather than silently overwriting changes.

---

## 24. Mobile, Accessibility, and PWA Requirements

- Minimum touch target: 48 by 48 CSS pixels.
- Primary actions remain reachable with one hand.
- Text inputs use at least 16px font sizing on mobile to avoid unwanted zoom.
- Recording state is conveyed visually and with accessible text.
- Do not rely on colour alone for status or errors.
- Screen-reader labels are required for microphone, stop, retry, confirmation, and destructive actions.
- Focus moves predictably after dialogs and validation errors.
- Keyboard operation remains supported on desktop.
- Test at 320px-wide viewport and on a physical iPhone SE-class device.
- Web app manifest supports standalone display and a dedicated GM shortcut/start URL.
- The application is served only over HTTPS.
- Microphone permission is requested only when the GM deliberately starts recording.
- Offline state, upload progress, and retry state are clearly visible.

---

## 25. Analytics and Success Measures

### 25.1 Adoption metrics

- Percentage of website enquiries converted through the one-click agreement action.
- Percentage of agreements created in admin versus outside documents.
- Weekly active GM days in the sales workspace.
- Voice captures confirmed per week.
- Voice proposals accepted unchanged, corrected, edited, or discarded.
- Median time from enquiry open to agreement draft.
- Median time from agreement draft to sent.

### 25.2 Data-quality metrics

- Percentage of active agreements linked to a customer and opportunity.
- Duplicate agreement creation rate.
- Duplicate customer suggestion rate and merge error rate.
- Percentage of custom alterations with price decision and drawing/factory state.
- Percentage of sent agreements with immutable snapshot and send evidence.
- Percentage of builds linked to accepted agreement, verified deposit, and approved specification.

### 25.3 Sales execution metrics

- Customers waiting for a promised response.
- Agreements awaiting customer decision.
- Agreed/quoted value in progress.
- Deposits reported but unverified.
- Median response time to new enquiry.
- Median time from agreement sent to deposit verified.
- Lost-reason completion rate.

### 25.4 Guardrail metrics

- AI monetary-field correction rate.
- Ambiguous match rate.
- Failed or partially applied voice action rate.
- Agreement validation failure rate.
- Payment mismatch rate.
- Build-release blocker rate.
- Unresolved alteration rate at send attempt.

Metrics are for product and business improvement. They must not be implemented as undisclosed individual surveillance.

---

## 26. Testing Strategy

### 26.1 Unit tests

- customer email and phone normalisation;
- deterministic matching thresholds;
- enquiry-to-agreement field mapping;
- idempotency-key handling;
- agreement-state button derivation;
- money parsing from structured AI output;
- integer-cent totals;
- 30/20/50 payment schedule and rounding;
- alteration readiness rules;
- agreement transition rules;
- payment transition rules;
- build-release gates;
- follow-up derivation and resolution;
- strict AI schema validation;
- capability checks;
- audio-retention state transitions.

### 26.2 Integration tests

- convert enquiry and create/link customer, opportunity, and agreement;
- retry conversion without duplicates;
- convert an enquiry with an existing customer;
- reject an ambiguous customer merge;
- prefill product and base-price snapshot;
- keep a free-text request outside contractual inclusions;
- add a confirmed priced alteration;
- block sending with unresolved material alteration;
- prepare immutable agreement and digest;
- customer requests a change without mutating the sent version;
- customer reports deposit without releasing build;
- authorised user verifies deposit;
- release to build and create one order/build/milestone set;
- retry build release safely;
- upload, transcribe, extract, confirm, and apply voice capture;
- voice correction changes the proposal before execution;
- partial voice execution recovers safely;
- audio deletion occurs after policy conditions are met.

### 26.3 AI evaluation fixtures

Create realistic Australian-English workshop recordings and transcripts covering:

- product names and dimensions;
- customer names;
- amounts such as `$72,000`, `$98,000`, `$140,000`, and `$225,000`;
- “included” versus “extra” distinctions;
- corrections made mid-sentence;
- uncertain customer requests;
- relative dates such as “next Tuesday at ten”;
- noisy background audio;
- more than one customer mentioned;
- no customer name;
- factory/CAD implications;
- deposit reported versus deposit confirmed;
- instructions that attempt to bypass confirmation.

Evaluate field accuracy, not only transcript readability. Monetary and identity errors are critical failures unless caught by confirmation safeguards.

### 26.4 End-to-end browser tests

Use Playwright for:

- GM login and Today redirect;
- four-item desktop and mobile navigation;
- Create/Continue/View Agreement button states;
- enquiry conversion;
- agreement editing and autosave;
- unresolved alteration block;
- review and send preparation;
- customer secure-link review;
- payment reporting;
- deposit verification;
- build release;
- microphone-permission denial fallback;
- pre-recorded audio upload test path;
- interrupted upload retry;
- mobile layouts at iPhone SE viewport;
- role access denial to `/admin/site` and customer-cross-record attempts.

Browser automation cannot fully validate physical microphone quality, operating-system Home Screen installation, or real workshop acoustics. Those require a short physical-device pilot.

### 26.5 Regression tests

- Existing Stripe shop orders remain functional.
- Existing enquiry submission and email delivery remain functional.
- Existing agreement revision/addendum behaviour remains immutable.
- Existing configuration and drawing approvals remain functional.
- Existing production tracking remains functional.
- Existing website content-management functions remain available to authorised users in `/admin/site`.
- Public website pricing and product data remain unchanged unless separately authorised.

### 26.6 Security tests

- expired/revoked admin session;
- role/capability bypass attempts;
- cross-customer ID substitution;
- malformed and oversized audio uploads;
- unsupported MIME types;
- prompt injection in enquiry text and transcript;
- forged customer review token;
- replayed conversion, payment, and build-release commands;
- client-supplied price manipulation;
- immutable snapshot overwrite attempts;
- API key and private-data exposure scans.

---

## 27. Delivery Plan

### Phase 0 — Safety and foundation

Objectives:

- preserve the current agreement wording while assigning an accurate business-approved version;
- introduce individual user identity and role/capability enforcement;
- define stable customer/opportunity/agreement links;
- add idempotency and shared activity events;
- establish baseline timing and completion metrics;
- preserve current source stores and test fixtures.

Exit criteria:

- actor identity appears in mutations and audit events;
- GM and site-admin permissions are enforced server-side;
- agreement version no longer inaccurately says legal-review draft;
- current agreement tests pass unchanged for wording and calculations;
- source-store backups and rollback plan are documented.

### Phase 1 — Simplified GM shell and Today

Objectives:

- create the four-area GM navigation;
- redirect `/admin` to Today for GM users;
- move technical functions behind `/admin/site`;
- project existing enquiries, agreements, deposits, and builds into Today;
- replace task terminology with follow-ups and business actions.

Exit criteria:

- GM can find a customer, agreement, or build from the simplified shell;
- current technical functions remain accessible to authorised users;
- no operational source data is lost;
- mobile navigation passes Playwright and physical-device checks.

### Phase 2 — One-click enquiry-to-agreement

Implementation note (9 August 2026): the initial conversion slice is complete locally. Today and Customers expose the agreement-state action; the server returns one deterministic active agreement per source enquiry; trustworthy identity/product/base-price data prefills; free-text requests remain in a non-contractual context panel; and the draft opens immediately. Persisting a dedicated canonical customer record and adding product-specific approved inclusions/structured alteration readiness remain for the following slices.

Objectives:

- add Create/Continue/View Agreement to every website enquiry;
- create/link customer and opportunity automatically;
- prefill reliable customer, product, price, and context data;
- separate unconfirmed requests from contractual inclusions;
- implement resumable idempotent conversion.

Exit criteria:

- a repeated click cannot create a duplicate agreement;
- standard enquiry creates a usable agreement draft without retyping;
- ambiguous customer matches are safely blocked;
- conversion works on desktop and iPhone SE viewport.

### Phase 3 — Fast agreement and customer review

Objectives:

- streamline the agreement editor;
- load product-specific approved starting data;
- add structured alteration readiness;
- implement one readiness review and immutable preparation flow;
- provide secure customer review/change/acceptance experience;
- automate agreement follow-ups;
- retain controlled Gmail delivery initially if required.

Exit criteria:

- standard agreement can be prepared in 60–90 seconds;
- generated agreement matches the current approved structure and wording;
- no unresolved commercial item can be silently sent;
- sent agreement and evidence are immutable and retrievable;
- customer can review on mobile without an account.

### Phase 4 — Workshop voice capture

Objectives:

- add installable Home Screen experience;
- capture short post-call recordings;
- transcribe and extract strict proposed actions;
- support matching, voice correction, confirmation, and multi-record application;
- implement offline retry and audio deletion.

Exit criteria:

- GM can dictate and confirm a normal call summary without typing;
- money, identity, date, and agreement changes are explicitly confirmed;
- failed/retried uploads do not duplicate activity;
- a physical workshop-floor pilot demonstrates acceptable accuracy and speed;
- typical confirmed capture takes under 30 seconds excluding dictation.

### Phase 5 — Deposit and build handoff

Objectives:

- implement expected/reported/verified deposit states;
- add authorised verification;
- create Release to Build gates;
- generate linked order, immutable build input, China/shipping/local stages, and remaining payment milestones.

Exit criteria:

- reported payment cannot start production;
- verified deposit alone cannot bypass missing agreement/drawing gates;
- release creates exactly one build and milestone set;
- agreement/configuration/build references reconcile;
- existing production tracker receives the correct data.

### Phase 6 — Optimisation and optional integrations

Only after adoption data is available:

- improve queue ranking;
- consider controlled email sending that removes manual attachments;
- consider calendar integration;
- consider bank-feed reconciliation;
- consider Realtime voice correction;
- consider VOIP/call-event integration as a last resort;
- consider customer build-status visibility.
- replace password entry with approved-phone-number plus one-time SMS code login after provider, delivery reliability, recovery, rate limiting, code expiry, replay protection, SIM-swap/account-recovery, cost, and privacy requirements are approved.

---

## 28. Rollout Strategy

1. Build behind feature flags.
2. Keep the existing admin available as a temporary fallback during the pilot.
3. Use staging with copied or synthetic customer data where possible.
4. Run automated unit, integration, Playwright, and security checks.
5. Pilot the GM shell and enquiry conversion before changing the default production route.
6. Time a real agreement in Word and the new admin using the same scenario.
7. Do not replace Word until the admin is demonstrably faster and the generated agreement is verified.
8. Pilot voice capture with controlled recordings before real customer data.
9. Run a short physical workshop-floor pilot.
10. Enable deposit/build release only after reconciliation and rollback procedures are proven.
11. Remove the legacy GM interface only after a defined observation period with no unresolved data-loss or workflow blockers.

Rollback must disable the new projections/actions without deleting records created through them.

---

## 29. Acceptance Criteria

The full product direction is accepted when all of the following are true.

### 29.1 GM workspace

1. The GM opens admin and sees Today rather than the broad website dashboard.
2. The GM sees no more than four primary navigation destinations.
3. The Create Agreement action is always easy to reach.
4. Technical website-management functions no longer compete with daily sales work.
5. Mobile touch targets and navigation work on an iPhone SE-sized viewport.

### 29.2 Enquiry and agreement

6. Every website enquiry displays Create, Continue, or View Agreement.
7. One click prefills all reliable relevant information.
8. Customer and opportunity records are created or linked automatically.
9. Repeated clicks do not create duplicates.
10. Free-text customer requests do not become contractual inclusions without confirmation.
11. The GM can adjust the agreement to reflect the negotiated phone discussion.
12. Custom alterations carry price, factory, drawing, weight, and delivery states where applicable.
13. A standard agreement can be prepared faster than the Word process and normally within 60–90 seconds.
14. The output retains the current business-approved agreement wording and deterministic payment calculations.
15. Sent/accepted versions remain immutable and retrievable.

### 29.3 Voice capture

16. The GM can open Log Customer Call from his phone Home Screen.
17. He can dictate a normal post-call summary without navigating the full admin.
18. The AI produces a structured, readable confirmation.
19. Customer identity, amounts, dates, agreement changes, and production implications require confirmation.
20. The GM can correct the interpretation by voice.
21. Confirming once updates the customer, activity, opportunity, follow-up, appointment, and agreement draft as applicable.
22. Network retries and repeated confirmations do not duplicate records.
23. Routine audio is deleted according to the approved retention policy.

### 29.4 Customer, payment, and build

24. The customer can review and download the agreement without an account.
25. A customer change request creates a controlled revision/addendum workflow.
26. “I have paid” records deposit reported but does not start the build.
27. Deposit verification records evidence and actor identity.
28. Release to Build checks agreement, deposit, configuration, and drawing gates.
29. Release creates one linked order/build with China, shipping, local finishing, and handover stages.
30. Arrival and delivery payment milestones are calculated and linked.

### 29.5 Integrity and safety

31. Individual identity and server-enforced roles replace reliance on a shared undifferentiated admin actor.
32. AI cannot send agreements, approve prices, verify deposits, approve drawings, or release builds.
33. All material commands are auditable and idempotent.
34. Existing enquiries, orders, agreements, configurations, and site-management functions continue to work during migration.
35. No existing source store is deleted before the integrated workflow is proven.

---

## 30. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The redesigned interface is still slower than Word | GM bypasses it | Time the real Word flow; enforce the 60–90 second target; remove retyping and redundant approval steps |
| Speech transcription mishears a price or name | Commercial or privacy error | Highlight identity and money; retain source excerpt; require explicit confirmation; test noisy Australian-English audio |
| AI turns an uncertain request into a promise | Unpriced or incorrect build obligation | Separate requested items from agreement inclusions; use strict action schemas; block send on unresolved material items |
| Duplicate customers or agreements | Fragmented records and confusion | Deterministic matching, human confirmation, idempotency keys, explicit links, duplicate reporting |
| Shared admin password prevents reliable attribution | Weak audit and permissions | Implement individual identity and server-side roles in Phase 0 |
| Phone session login is too cumbersome | GM avoids voice feature | Approved-device session, secure low-friction reauthentication, direct Home Screen start URL |
| Workshop connectivity is unreliable | Lost recording or duplicate retry | Local pending upload, visible retry, resumable states, idempotent execution |
| Agreement and build drift apart | Wrong unit is manufactured | Immutable snapshots, cross-links, source-of-truth hierarchy, release gates, addenda/reconciliation |
| Customer reports payment that has not arrived | Premature build start | Separate reported and verified states; require bank evidence and authorised verification |
| Custom alteration lacks CAD/factory confirmation | Production delay or impossibility | Structured readiness fields; block agreement/build release where required |
| Site-management functions are accidentally removed | Operational disruption | Move rather than delete; role-protected `/admin/site`; regression tests and fallback |
| Existing Blob stores are consolidated too early | Data loss | Projection-first migration; preserve source stores and backups |
| Audio retention creates privacy risk | Unnecessary sensitive data | Default deletion after processing; minimal retention; access controls; documented policy |
| Owner assumes the system replaces operational judgment | Incorrect release or status | Explicit human gates and clear authority boundaries |

---

## 31. Recommended Defaults and Remaining Implementation Decisions

These decisions do not change the product direction but must be confirmed during implementation.

| Decision | Recommended default |
|---|---|
| GM device authentication | Individual account with secure approved-device session and revocation |
| Future login method | Approved phone number plus short-lived, single-use SMS code; deferred until explicitly scheduled |
| Agreement UI term | Agreement |
| Primary send action | Review & Send Agreement |
| Customer access | Expiring revocable secure link; no account |
| Initial delivery method | Streamlined current Gmail compose/download flow, then evaluate controlled sending |
| Voice approach | Short post-call file recording, not continuous Realtime agent |
| Routine audio retention | Delete after successful confirmation/application |
| Transcript retention | Retain only confirmed operational transcript/summary according to privacy policy |
| AI extraction | Strict schema plus server validation and source evidence |
| Calendar | Internal appointment record first; external calendar integration later |
| Deposit verification | Manual authorised bank verification first |
| VOIP integration | Out of scope until adoption proves it necessary |
| Source-store migration | Preserve stores; add projection and links first |

---

## 32. Existing Implementation Reference Map

Likely existing modules to extend:

- `src/pages/admin.astro`
- `src/components/AdminPanel.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/ContractManager.tsx`
- `src/components/ConfiguratorWorkspace.tsx`
- `netlify/functions/admin-auth.ts`
- `netlify/functions/admin-enquiries.ts`
- `netlify/functions/admin-manual-enquiry.ts`
- `netlify/functions/admin-owner-copilot-records.ts`
- `netlify/functions/admin-owner-copilot-timeline.ts`
- `netlify/functions/admin-contracts.ts`
- `netlify/functions/admin-contract-preview.ts`
- `netlify/functions/admin-contract-acceptance.ts`
- `netlify/functions/admin-contract-revisions.ts`
- `netlify/functions/admin-contract-addenda.ts`
- `netlify/functions/admin-configuration-contract.ts`
- `netlify/functions/admin-configuration-production.ts`
- `netlify/functions/contract-core.ts`
- `netlify/functions/contract-ai-core.ts`
- `netlify/functions/configuration-core.ts`
- `netlify/functions/configuration-review-core.ts`
- `netlify/functions/admin-orders.ts`
- `netlify/functions/admin-dashboard.ts`
- `netlify/functions/lead-reminder-core.ts`

Recommended new modules:

- `src/pages/admin/today.astro`
- `src/pages/admin/quick-note.astro`
- `src/components/gm/GmShell.tsx`
- `src/components/gm/TodayWorkspace.tsx`
- `src/components/gm/EnquiryAgreementAction.tsx`
- `src/components/gm/QuickVoiceCapture.tsx`
- `src/components/gm/VoiceConfirmation.tsx`
- `netlify/functions/admin-gm-today.ts`
- `netlify/functions/admin-enquiry-agreement.ts`
- `netlify/functions/admin-voice-capture-*.ts`
- `netlify/functions/admin-build-release.ts`
- `netlify/functions/sales-domain-core.ts`
- `netlify/functions/activity-core.ts`
- `netlify/functions/customer-match-core.ts`
- `netlify/functions/payment-milestone-core.ts`
- `netlify/functions/voice-capture-core.ts`

Final module names may change to match repository conventions. Domain logic must remain outside large React components.

---

## 33. External Product and Technical References

The design selectively follows proven patterns without copying enterprise complexity:

- HubSpot guided sales execution: <https://knowledge.hubspot.com/prospecting/use-guided-execution-in-the-sales-workspace>
- Salesforce prioritised sales work queue: <https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/sales_productivity.pdf>
- Pipedrive visual deal workflow: <https://support.pipedrive.com/en/article/pipeline-view>
- Pipedrive Smart Docs CRM-prefilled documents: <https://support.pipedrive.com/en/article/smart-docs>
- Pipedrive deal-to-project separation: <https://support.pipedrive.com/en/article/projects-vs-deals>
- PandaDoc structured pricing tables: <https://support.pandadoc.com/en/articles/9714703-pricing-table-add-and-set-your-pricing-table>
- ServiceM8 quote acceptance and deposit workflow: <https://support.servicem8.com/help-center/desktop/invoicing/how-to-use-a-quote-acceptance>
- Jobber customer quote approvals: <https://help.getjobber.com/hc/en-us/articles/115012715008-Quote-Approvals>
- WebKit Home Screen web apps: <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>
- Browser microphone capture: <https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia>
- OpenAI speech transcription methods: <https://developers.openai.com/cookbook/examples/speech_transcription_methods>
- OpenAI strict structured function outputs: <https://developers.openai.com/api/docs/guides/function-calling#strict-mode>

Patterns adopted:

- prioritised work surface;
- record preview without losing context;
- CRM-prefilled agreement data;
- immutable sales-to-delivery handoff;
- customer self-service review without account friction;
- quote/agreement acceptance linked to deposit state;
- strict schema-constrained AI extraction.

Patterns deliberately avoided:

- large enterprise navigation;
- generic task administration;
- shame-based red overdue indicators;
- unrestricted document-template design;
- automated commercial decisions;
- covert employee monitoring;
- production release from unverified customer actions.

---

## 34. Definition of Done

This PRD is fully delivered only when:

- the GM's default interface reflects the real phone-to-agreement workflow;
- the admin agreement process has replaced Word for normal live use because it is demonstrably faster;
- every website enquiry can safely become one linked agreement without retyping or duplication;
- a workshop-floor voice summary can update the connected business records after one human confirmation;
- automatic follow-ups arise from real work rather than manual task creation;
- customers can review, request changes, accept, and report payment through a secure mobile experience;
- payment reporting and verification remain separate;
- accepted commercial data and approved technical data create a controlled build handoff;
- China manufacture, shipment, local finishing, and payment milestones are linked and visible;
- AI actions remain constrained, attributable, reversible where appropriate, and human-approved at every commercial gate;
- existing website, shop, enquiry, agreement, configuration, and production functionality remains operational;
- automated tests and a physical GM workshop pilot meet the acceptance criteria;
- rollback, privacy, retention, and operational runbooks are documented.
