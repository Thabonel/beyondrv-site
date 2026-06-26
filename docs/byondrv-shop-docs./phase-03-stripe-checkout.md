# Phase 03 - Stripe Checkout

Read `codex-rules.md` before starting.

## Status

Not started.

## Goal

Implement Stripe Checkout for products that can be purchased online now, without adding server-side inventory reservation, order management, shipping labels, or AI stock planning in this phase.

Phase 03 should keep the stock model simple and honest:

- Public stock is an availability status, not a precise unit count.
- Checkout is allowed only for products marked as purchasable.
- Availability is checked before sending the customer to Stripe.
- Checkout does not reserve inventory.
- Final availability may still need to be confirmed before fulfilment.

The shared public model should also support display-only pricing and timing fields:

- current price
- optional compare-at/original price
- optional discount label
- public lead-time or container-arrival wording

Those fields may change the customer-facing display, but Stripe should still calculate the payment amount from the trusted current price only.

## Business Context

ByondRV receives a container from China roughly once per month. Australian stock is limited and often allocated to existing builds.

For this reason, Phase 03 must not create a false impression that the website has real-time warehouse inventory. Exact unit-count stock control belongs in a later phase only if the business decides it is worth the operational overhead.

## Public Availability Statuses

The checkout gate should use the public availability model:

- `available_in_australia` — may be eligible for checkout if also marked purchasable.
- `coming_next_container` — generally enquiry or pre-order only unless explicitly enabled.
- `made_to_order` — enquiry or quote flow unless explicitly enabled.
- `ask_availability` — no direct checkout.
- `unavailable` — no direct checkout.

The same model should be used for both the shop and the camper/caravan catalogue, even though the buy-now flows differ.

## Product Purchase Rules

A product may go to Stripe Checkout only when all are true:

1. The product is published.
2. The product has a valid price.
3. The product is not a service-only product.
4. The product is marked as purchasable online.
5. The product availability status permits checkout.
6. The cart contains at least one eligible item.
7. Quantity is valid for the cart rules from Phase 02.

If any item fails the checkout gate, the customer should receive a clear message and should not be sent to Stripe.

## Deliverables

- A Netlify Function or existing backend endpoint that creates a Stripe Checkout session.
- Server-side validation of cart items against trusted product data.
- Stripe Checkout redirect from the cart page.
- Success and cancel pages or existing routes wired to Stripe Checkout.
- Clear customer messaging when checkout is blocked because an item is not available for online purchase.
- Environment variable documentation for Stripe keys.
- No database order management in this phase.
- No inventory reservation in this phase.
- No Australia Post integration in this phase.
- No admin product editor in this phase.
- No AI demand planning in this phase.

## Trusted Data Rules

The client cart must not be trusted for price, product title, availability, or purchasability.

The server must rebuild the checkout line items from trusted published product data.

The client may send:

- product slug
- quantity

The server decides:

- whether the product can be purchased
- price
- title
- image
- Stripe line item data
- whether checkout is allowed

## Customer Messaging

Use plain language.

Examples:

- "This item is not available for online checkout yet. Please ask us about availability."
- "Some items in your cart need availability confirmed before purchase."
- "This product is made to order. Please contact ByondRV before purchasing."

## Testing Requirements

Add or update tests for:

- successful checkout session creation for an eligible product
- blocked checkout for service-only products
- blocked checkout for `ask_availability`
- blocked checkout for `unavailable`
- blocked checkout when client price is tampered with
- blocked checkout for unknown slugs
- cart still works without checkout when no items are eligible

## Acceptance Criteria

- Stripe Checkout works for eligible products only.
- Server-side validation uses trusted product data.
- Prices are never read from localStorage or client input.
- Availability status gates checkout.
- No public exact stock count is introduced.
- No inventory reservation is created.
- No order management dashboard is created.
- No shipping calculation is created.
- No placeholder future functionality is scaffolded.
- Existing Phase 02 cart tests still pass.
