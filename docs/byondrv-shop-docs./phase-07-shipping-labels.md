# Phase 07 - Shipping Labels

Read `codex-rules.md` before starting.

## Status

Complete.

## Goal

Allow ByondRV staff to create and manage shipping labels for eligible orders, after order management and shippable product rules already exist.

Do not build AI stock recommendations, automatic purchasing, or advanced warehouse operations in this phase.

## Business Context

Some products may be shippable through Australia Post. Other products may be supply-and-fit only, reserved for builds, too large to ship, or require manual handling.
Certain smaller items can also be delivered within the Brisbane area by ute for a charged local delivery fee.

Shipping labels should only be created for orders that are confirmed and eligible for shipping.

## Label Eligibility Rules

An order can create a shipping label only when:

1. The order is paid or otherwise approved for fulfilment.
2. The item is shippable.
3. Shipping address is valid.
4. Dimensions and weight are present.
5. The order does not require supply-and-fit.
6. The order does not require availability confirmation.
7. Staff explicitly chooses to create the label.

## Deliverables

- Admin action to create a shipping label for eligible orders.
- Australia Post label creation integration if supported by the chosen API/account.
- Store label metadata against the order.
- Download/print label from admin.
- Tracking number saved to the order where available.
- Update order shipping status.
- Customer email with tracking details if appropriate.
- Brisbane ute delivery support for eligible local orders.
- Clear messaging when a label cannot be created.
- No AI stock/container planning in this phase.
- No automatic reorder or purchasing in this phase.

## Admin UX Requirements

Use plain language.

Examples:

- "Create shipping label"
- "Print label"
- "Tracking number"
- "This order cannot be shipped because it is marked supply-and-fit only."
- "This order needs availability confirmed before shipping."

## Testing Requirements

Add or update tests for:

- eligible order can create a label
- supply-and-fit order cannot create a label
- order with missing dimensions cannot create a label
- order needing availability confirmation cannot create a label
- label metadata is saved
- tracking number appears in admin
- unauthorised users cannot create labels

## Acceptance Criteria

- Labels can be created only for eligible orders.
- Tracking details are stored against the order.
- Staff can download/print labels.
- Ineligible orders are blocked with clear explanations.
- No AI stock/container planning is built in this phase.
- Existing order and shipping tests still pass.
