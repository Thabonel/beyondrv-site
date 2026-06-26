# Phase 04 - Australia Post Shipping

Read `codex-rules.md` before starting.

## Status

Complete.

## Goal

Add shipping calculation for products that can be shipped through Australia Post, without building shipping labels, warehouse inventory, order management dashboards, or AI stock/container recommendations in this phase.

## Business Context

Not every ByondRV item should be treated as a normal parcel product.

Some items may be:

- supply-and-fit only
- too large for standard parcel shipping
- reserved for existing builds
- ordered with a monthly China container
- made to order
- enquiry-only

Shipping should therefore be available only for products explicitly marked as shippable.

## Product Shipping Fields

Use simple product-level shipping fields:

- `isShippable`
- `shippingClass`
- `weightKg`
- `lengthCm`
- `widthCm`
- `heightCm`
- `shipsFromPostcode`
- `requiresAvailabilityConfirmation`
- `supplyAndFitOnly`

Do not add an advanced warehouse model in this phase.

## Public Behaviour

The cart/checkout flow should:

- calculate shipping only for shippable products
- block direct shipping checkout for supply-and-fit-only products
- show clear messaging when shipping is not available
- allow enquiry flow for products that need confirmation
- avoid implying real-time stock reservation

## Deliverables

- Australia Post shipping-rate integration using the preferred architecture.
- Server-side shipping calculation using trusted product shipping data.
- Cart/checkout integration for eligible shippable products.
- Clear error handling when shipping cannot be calculated.
- Documentation for required Australia Post API credentials.
- No shipping label purchase/printing in this phase.
- No order management dashboard in this phase.
- No admin product editor in this phase.
- No AI stock planning in this phase.

## Trusted Data Rules

The client must not be trusted for product dimensions, weight, shipping class, or origin postcode.

The client may send:

- product slug
- quantity
- destination postcode/suburb/state where required

The server decides:

- whether the product is shippable
- dimensions
- weight
- available shipping options
- shipping price

## Testing Requirements

Add or update tests for:

- shipping rate returned for a valid shippable product
- shipping blocked for supply-and-fit-only product
- shipping blocked for missing dimensions/weight
- shipping blocked for unavailable product where confirmation is required
- invalid postcode handling
- Stripe Checkout receives the selected shipping amount only after server validation

## Acceptance Criteria

- Australia Post rates are calculated for eligible shippable products.
- Non-shippable and supply-and-fit products do not enter parcel checkout.
- Shipping uses trusted server-side product data.
- No shipping labels are created.
- No inventory reservation is created.
- No AI container planning is created.
- Existing checkout and cart tests still pass.
