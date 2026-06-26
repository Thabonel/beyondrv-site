# Product/Admin Model Handover

Last updated: 2026-06-26

This document is the implementation brief for the owner's GPT. It records the official product/admin model so the next coding pass can update the schema, admin editor, and public display rules without re-deciding the business model.

## What Is Official Now

The site should use one shared commercial model across:

- the shop
- campers
- caravans
- expedition products

The owner must be able to manage:

- current price
- optional compare-at/original price
- optional sale label
- public availability
- public lead-time wording
- public container-arrival wording
- online purchase eligibility
- deposit/full-payment eligibility where relevant
- source type
- private stock planning fields

Public and private data must stay separated. Private stock planning fields should not leak to the public site or to checkout calculations.

## Exact Schema Changes Needed In `src/content/config.ts`

### 1. Vehicle products

Extend `vehicleProduct` with the shared commerce fields:

- `compareAtPrice: z.string().optional()`
- `saleLabel: z.string().optional()`
- `availability: z.enum(['available_in_australia', 'coming_next_container', 'made_to_order', 'ask_availability', 'unavailable']).default('available_in_australia')`
- `purchasableOnline: z.boolean().default(false)`
- `depositEnabled: z.boolean().default(false)`
- `fullPaymentEnabled: z.boolean().default(false)`
- `sourceType: z.enum(['china_container', 'local_supplier', 'workshop_stock', 'custom_made_to_order', 'other']).default('other')`
- `leadTimeText: z.string().optional()`
- `containerEtaText: z.string().optional()`
- `containerEtaDate: z.string().optional()`

Keep `status` and `onSale` for migration/backward compatibility, but do not treat them as the only source of truth for checkout or public availability.

### 2. Shop products

Extend `stockProduct` with the same sale and timing fields:

- `compareAtPrice: z.number().nonnegative().optional()`
- `saleLabel: z.string().optional()`
- `leadTimeText: z.string().optional()`
- `containerEtaText: z.string().optional()`
- `containerEtaDate: z.string().optional()`
- `sourceType: z.enum(['china_container', 'local_supplier', 'workshop_stock', 'custom_made_to_order', 'other']).default('other')`

Keep `availability` and `purchasableOnline` as the shop’s public gating fields.

### 3. Transform output

Update the `transform` step so the generated product data exposes the new public fields consistently to pages and listing components:

- current price
- compare-at price
- sale label
- availability
- lead-time text
- container ETA text
- source type

If `status` is still needed by older pages, derive it from the shared model instead of making it the primary source of truth.

### 4. Fields that should not go into `src/content/config.ts`

Keep these private fields out of the public content schema:

- `internalStockEstimate`
- `targetAustraliaStock`
- `containerReorderQuantity`
- `minimumComfortStock`
- `lastStockCheckedAt`
- `lastStockCheckedBy`
- `containerEligible`
- `usualContainerLeadTimeDays`
- private supplier notes

Those belong in the admin-side planning model, not in public content.

## Admin / Editor Changes To Implement Later

The owner-facing product editor should be updated so it can manage the shared model directly.

### Product list

Show at least:

- title
- current price
- compare-at price
- sale label
- availability
- lead-time / ETA summary
- online purchase state

### Edit form

Add fields for:

- current price
- compare-at/original price
- sale label
- public availability
- public lead-time text
- container ETA text
- source type
- online purchase enabled
- deposit enabled
- full payment enabled
- featured flag

Keep the private planning fields in a separate owner/admin section.

### Validation rules

- Require a current price before publishing.
- Prevent checkout-eligible states when availability is `ask_availability` or `unavailable`.
- Do not let the client supply a price that overrides the server-side source of truth.
- Treat discount fields as display values, not as payment inputs.

## Stripe / Checkout Impact

Stripe should continue to use the trusted published current price only.

Discount and compare-at pricing are display-only.
Lead-time and ETA wording are display-only.
Availability and purchase-eligibility fields control whether the Buy Now or deposit CTA appears.

## Files That Need The Next Coding Pass

- `src/content/config.ts`
- `src/components/AdminPanel.tsx`
- `netlify/functions/admin-product-edit.ts`
- `src/lib/checkout.ts`
- `src/lib/shop.ts`
- any product card or product page component that renders pricing or availability labels

## Handoff Note

This is the point to switch to the owner's GPT for coding. The docs now define the official model; the next implementation pass should follow this brief rather than re-litigating the product schema.
