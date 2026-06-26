# Unified Order Lifecycle Design

Date: 2026-06-26

This note is a design and reconciliation note.

Stage 1 is now implemented in code:

- shared lifecycle normalization helper
- unified admin list/view model
- dashboard/list UI showing orders and enquiries together
- consistent status labels
- clear source type labels
- safe sorting by created/updated date
- tests for the normalization logic

Later stages in this note remain planned and are not yet implemented.

## Current State

The codebase already has the pieces, but they are split across separate stores and views:

- Stripe paid sessions create order records in `customer-orders` from `netlify/functions/stripe-webhook.ts`.
- Manual admin edits also save into `customer-orders` from `netlify/functions/admin-orders.ts`.
- Website enquiries and availability/fitment requests save into `customer-enquiries` from `netlify/functions/contact-submit.ts`.
- Enquiry backup records are listed in `netlify/functions/admin-enquiries.ts`.
- The admin dashboard currently shows orders and enquiries separately from `netlify/functions/admin-dashboard.ts` and `src/components/AdminDashboard.tsx`.
- The admin panel lets staff edit orders directly, including shipping fields, from `src/components/AdminPanel.tsx`.
- Shipping-label code assumes an approved order record exists and uses shipping fields already attached to the order record.

What this means:

- Paid shop orders are already persistent.
- Enquiries are already persistent.
- Shipping-label creation already expects an order-like record.
- The missing piece is a single admin-facing lifecycle view and record model that can represent both paid orders and enquiries without deleting the separate source stores.

## Proposed Unified Lifecycle Model

Use one admin-facing lifecycle record that can represent:

- paid shop order
- unpaid enquiry
- availability request
- quote request
- container-follow-up item
- completed/cancelled/archived record

Proposed record shape:

```ts
type LifecycleSourceType =
  | 'stripe_checkout'
  | 'website_enquiry'
  | 'manual_admin'
  | 'phone_call'
  | 'walk_in'
  | 'facebook'
  | 'instagram'
  | 'referral'
  | 'other';

type LifecycleRecordType =
  | 'paid_shop_order'
  | 'unpaid_enquiry'
  | 'availability_request'
  | 'quote_request'
  | 'container_follow_up'
  | 'customer_order'
  | 'archived';

type LifecyclePaymentStatus =
  | 'unpaid'
  | 'deposit_paid'
  | 'paid_in_full'
  | 'refunded'
  | 'part_refunded';

type LifecycleFulfilmentStatus =
  | 'new'
  | 'needs_review'
  | 'approved'
  | 'awaiting_availability'
  | 'awaiting_container'
  | 'awaiting_shipping'
  | 'label_created'
  | 'in_transit'
  | 'ready_for_handover'
  | 'completed'
  | 'cancelled'
  | 'archived';

type LifecycleEnquiryStatus =
  | 'new'
  | 'awaiting_response'
  | 'follow_up_due'
  | 'quoted'
  | 'won'
  | 'lost'
  | 'spam'
  | 'archived';
```

Suggested fields:

- `id`
- `sourceType`
- `recordType`
- `customerName`
- `customerEmail`
- `customerPhone`
- `productSlug`
- `productTitle`
- `productCategory`
- `orderType`
- `shippingMethod`
- `paymentStatus`
- `fulfilmentStatus`
- `enquiryStatus`
- `status`
- `notes`
- `followUpDate`
- `sourceEnquiryId`
- `stripeSessionId`
- `stripePaymentIntentId`
- `stripeEventId`
- `amountPaidCents`
- `currency`
- `shippingName`
- `shippingAddressLine1`
- `shippingAddressLine2`
- `shippingCity`
- `shippingState`
- `shippingPostcode`
- `shippingCountry`
- `shippingCarrier`
- `shippingService`
- `trackingNumber`
- `shippingLabelId`
- `shippingLabelUrl`
- `shippingLabelCreatedAt`
- `shippingLabelPrintedAt`
- `shippingStatus`
- `shippingBlockReason`
- `internalNotes`
- `demandSignalType`
- `demandSignalValue`
- `createdAt`
- `updatedAt`
- `archivedAt`

## Model Rules

- Stripe paid orders should keep their Stripe metadata.
- Enquiries should keep their enquiry metadata.
- A lifecycle record can point back to the original source record.
- The unified admin view should be a read/write projection, not the first step in storage consolidation.
- The existing separate stores remain the source of truth until migration is proven safe.

## Safe Migration Approach

### Stage 1: Keep source stores

- Leave `customer-orders` and `customer-enquiries` intact.
- Do not rename or delete the stores.
- Continue writing Stripe events to `customer-orders`.
- Continue writing enquiry submissions to `customer-enquiries`.
- Implemented in code as a read-only projection only; the source stores remain the system of record.

### Stage 2: Build a unified admin view

- Add a lifecycle projection in admin that merges orders and enquiries into one list.
- Group records by `sourceEnquiryId`, Stripe session ID, customer email, product slug, and date proximity where appropriate.
- Surface the original source type so staff can tell what generated the record.
- Partially planned for later write-back/edit flows; the read-only unified list exists now.

### Stage 3: Add shared status and notes

- Allow a single admin UI to edit the lifecycle status, notes, follow-up date, and shipping fields.
- Persist edits back to the appropriate source record first.
- Keep source-specific fields intact.

### Stage 4: Unify reporting

- Update dashboard summaries to count lifecycle records rather than only source records.
- Track paid orders, unresolved enquiries, quote requests, and container follow-ups in one set of admin metrics.

### Stage 5: Consider storage consolidation later

- Only after the projection is stable should we consider a single canonical store.
- If consolidation happens, keep the source records or event trail available for auditability.

## Files Likely To Change

- `netlify/functions/admin-dashboard.ts`
- `netlify/functions/admin-orders.ts`
- `netlify/functions/admin-enquiries.ts`
- `netlify/functions/contact-submit.ts`
- `netlify/functions/stripe-webhook.ts`
- `src/components/AdminPanel.tsx`
- `src/components/AdminDashboard.tsx`
- [`PROJECT_ROADMAP.md`](./PROJECT_ROADMAP.md)
- [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md)

## Risks

- Duplicate records if matching rules are too aggressive.
- Hidden data loss if source records are overwritten too early.
- Confusion if staff see both source records and unified records without a clear label.
- Shipping-label and fulfilment logic may assume a paid order when the lifecycle record is still just an enquiry.
- Inventory planning may accidentally treat all enquiries as demand without checking quality or intent.

## Acceptance Criteria

- One admin-facing lifecycle list can display paid orders and enquiries together.
- Staff can identify the source of every record.
- Existing Stripe and enquiry storage still works during the transition.
- Status, notes, and follow-up date can be edited from the unified view.
- No source store is deleted until the unified view has been validated.
- Shipping-label creation still only works for eligible fulfilment records.
- Reporting can distinguish paid orders from enquiry-driven demand.
