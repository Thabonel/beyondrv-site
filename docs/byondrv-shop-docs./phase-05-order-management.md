# Phase 05 - Order Management

Read `codex-rules.md` before starting.

## Status

Not started.

## Goal

Create a simple order management system for ByondRV staff after payment or enquiry, without building advanced inventory control, shipping labels, or AI stock recommendations in this phase.

## Business Context

ByondRV needs an owner-friendly way to see what customers have bought or requested.

The system should help Melissa and the owners track:

- paid orders
- enquiry orders
- items needing availability confirmation
- items that may need to be added to the next China container
- items reserved for customer builds
- items requiring supply-and-fit follow-up

This phase should collect useful demand data for later AI stock intelligence, but it must not build the AI recommendation engine yet.

## Order Types

Support simple order categories:

- `paid_online`
- `availability_enquiry`
- `supply_and_fit_request`
- `made_to_order_request`
- `container_interest`

## Order Statuses

Use simple operational statuses:

- `new`
- `needs_review`
- `confirmed`
- `awaiting_customer`
- `awaiting_container`
- `ready_to_fulfil`
- `fulfilled`
- `cancelled`
- `refunded`

## Demand Signals

When an order or enquiry is created, record a demand signal for future planning.

Examples:

- product purchased
- product enquired about
- unavailable item requested
- made-to-order item requested
- container item requested
- quantity requested
- customer postcode/state
- date
- source page or cart event where available

This data is only collected and listed in Phase 05. Do not generate AI recommendations yet.

## Admin Users

The admin interface should be simple enough for Melissa to use without a developer.

Admin screens should use plain language and avoid technical terms.

## Deliverables

- Store orders from successful Stripe Checkout.
- Store enquiry/availability requests where applicable.
- Basic admin list of orders.
- Basic admin order detail view.
- Ability to update order status.
- Ability to add internal notes.
- Ability to mark items as needing container follow-up.
- Basic demand-signal records created from orders/enquiries.
- Email notification to ByondRV for new paid orders or enquiries if Resend is already part of the project plan.
- No AI recommendations in this phase.
- No stock reservation engine in this phase.
- No shipping label creation in this phase.

## Admin Order Detail Should Show

- customer name
- customer email
- customer phone if collected
- order type
- payment status
- shipping status if relevant
- products
- quantities
- availability status at time of order
- notes
- status
- whether the item may need container ordering

## Testing Requirements

Add or update tests for:

- paid Stripe order creates an order record
- enquiry creates an order/enquiry record
- order can be viewed in admin
- order status can be updated
- internal notes can be saved
- demand signal is recorded for order/enquiry items
- unauthorised users cannot access admin order screens

## Acceptance Criteria

- Paid orders and enquiries are visible in admin.
- Admin users can update order status and add notes.
- Demand signals are recorded for later stock intelligence.
- No AI recommendation is generated yet.
- No inventory reservation is implemented yet.
- No shipping labels are created yet.
- Existing checkout/shipping/cart tests still pass.
