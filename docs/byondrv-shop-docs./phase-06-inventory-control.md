# Phase 06 - Inventory Control and Admin Product Management

Read `codex-rules.md` before starting.

## Status

Not started.

## Goal

Give ByondRV a simple owner-operated shop and vehicle inventory management system for pricing, discounts, public availability, lead times, container planning, and product publication without developer involvement for routine updates.

## Business Context

ByondRV receives a container from China roughly once per month. Australian stock is limited and often allocated to current builds.

The public website should avoid showing exact unit counts unless explicitly approved. The admin area may track richer internal information for planning.

## Scope

Build practical product management, not a complex warehouse system.

This phase includes:

- shared public pricing fields for shop, camper, caravan, and expedition products
- sale pricing and discount presentation
- public availability status management
- public lead-time and container-arrival wording
- online purchase eligibility controls
- internal stock and supplier planning fields
- manual demand review

This phase does not include:

- AI-generated recommendations
- automatic purchasing
- supplier API integration
- real-time reservations
- multi-warehouse inventory
- barcode scanning
- accounting software integration

## Official Product/Admin Model

The owner should manage one shared commercial model across the shop and vehicle catalogue.

Public fields:

- current price
- optional compare-at/original price
- optional sale label
- public availability status
- public lead-time text
- public container arrival text
- product is purchasable online yes/no
- deposit/full-payment toggles where relevant
- featured yes/no

Private admin fields:

- source type
- private supplier/order notes
- internal stock estimate
- target local stock
- container reorder quantity
- minimum comfort stock
- last stock checked at/by
- container eligible yes/no
- usual container lead time days

Rules:

- Current price is the source of truth for the public sale price.
- Compare-at price is display-only and represents the prior or recommended higher price.
- Discount amount is derived from current price and compare-at price; do not store multiple competing discount numbers.
- Availability controls the customer-facing wording and whether Stripe checkout is allowed.
- Public lead-time text can say things like "arriving in the next China container" or "ETA March 2027" without exposing internal notes.
- Private stock fields stay out of public pages.

## Public Availability Model

Admin users can set one public availability status for both the shop and the vehicle catalogue:

- `available_in_australia`
- `coming_next_container`
- `made_to_order`
- `ask_availability`
- `unavailable`

Public wording should stay customer-friendly:

- `available_in_australia` => In stock
- `coming_next_container` => Coming next container
- `made_to_order` => Made to order
- `ask_availability` => Ask about availability
- `unavailable` => Unavailable

## Admin Product Fields

The admin product editor should allow Melissa to manage:

- product name
- slug
- category
- product type
- current price
- compare-at/original price
- sale label
- public availability status
- online purchase enabled yes/no
- deposit enabled yes/no
- full payment enabled yes/no
- public lead-time text
- container arrival text
- source type
- published/hidden status
- photos
- featured flag
- enquiry-only yes/no
- shipping or pickup flags where relevant
- private supplier/order notes
- internal Australian stock estimate, optional and private
- target local stock, optional and private
- container reorder quantity, optional and private
- container eligible yes/no
- track demand yes/no

Use wording like:

- "Can customers buy this online?"
- "What should the website say about availability?"
- "Is this item coming in the next container?"
- "What is the public ETA wording?"
- "Where does this item usually come from?"
- "Private notes for Melissa and the owners"

Avoid developer terms such as schema, slug where possible, API, payload, manifest, or database.

## Internal Stock Fields

Internal stock fields are for planning only unless later approved.

They must not automatically appear on the public website.

Recommended fields:

- `internalStockEstimate`
- `targetAustraliaStock`
- `containerReorderQuantity`
- `minimumComfortStock`
- `lastStockCheckedAt`
- `lastStockCheckedBy`
- `containerEligible`
- `usualContainerLeadTimeDays`
- `supplierNotes`

## Demand Review

Show a basic demand history panel per product using demand signals collected in Phase 05.

Example metrics:

- purchases in the last 30/60/90 days
- enquiries in the last 30/60/90 days
- unavailable requests
- cart interest if already tracked
- container-interest flags

This is a manual review panel only. Do not generate AI recommendations in this phase.

## Deliverables

- Admin product list.
- Admin add product flow.
- Admin edit product flow.
- Admin hide/unhide product flow.
- Admin photo upload/change flow.
- Admin availability management.
- Admin pricing and discount controls.
- Admin source/container fields.
- Private internal stock/planning fields.
- Demand history panel using existing demand signals.
- Public shop and vehicle catalogue read updated product data.
- No AI recommendations in this phase.
- No automatic purchase orders in this phase.

## Testing Requirements

Add or update tests for:

- admin can add a product
- admin can edit a product
- admin can hide a product
- admin can upload/change product photo
- admin can set public availability status
- admin can set source type and container eligibility
- admin can set compare-at price and sale label
- public site reflects published product changes
- private stock fields do not leak to public product pages
- unauthorised users cannot access product management
- demand history appears for products with demand signals

## Acceptance Criteria

- Melissa/owners can manage shop products, campers, caravans, and expedition products without code changes.
- Public shop uses the shared availability model.
- Public product pages can show discount and ETA wording without exposing private notes.
- Private internal stock fields do not leak publicly.
- Products can be added, hidden, edited, and given photos.
- Demand data is visible for manual planning.
- No AI stock recommendation engine is implemented yet.
- Existing order, shipping, checkout, cart, and shop tests still pass.
