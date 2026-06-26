# ByondRV Shop Implementation Roadmap

Read `codex-rules.md` before starting any phase.

## Goal

Add a lightweight eCommerce platform to the existing Astro website without turning ByondRV into a complex warehouse system.

ByondRV receives a container from China roughly once per month. Australian stock is limited and is often reserved for existing builds. The shop should therefore avoid promising exact public unit counts unless the owners intentionally choose to expose them later.
Some items are shipped through Australia Post, some can be delivered in the Brisbane area by ute for a charged local delivery fee, and oversized items remain pickup-only or enquiry-only.

## Core Principles

- Keep the public shop honest and simple.
- Use availability status publicly, not exact stock counts.
- Do not imply that an item is reserved until a later server-side order/inventory phase supports it.
- Give Melissa and the owners simple admin controls to manage products, photos, prices, availability, orders, and buying decisions.
- Track customer demand over time so the AI can recommend what to keep in Australia and what to add to future China containers.
- Stop after each phase and verify acceptance criteria before continuing.

## Public Availability Model

Use simple availability statuses for the public shop:

- `available_in_australia`
- `coming_next_container`
- `made_to_order`
- `ask_availability`
- `unavailable`

Do not show public unit counts in the shop unless a later phase explicitly approves that change.

## Management Model

The owners need a simple admin workflow, likely operated day-to-day by Melissa, who tracks money, approves purchases, and handles ordering.

The admin system should eventually allow non-technical product and stock management:

- Add products.
- Hide or remove products.
- Add or replace photos.
- Set prices.
- Set public availability status.
- Mark whether an item is supply-and-fit, shippable, container-sourced, local-supplier sourced, workshop stock, or enquiry-only.
- Record supplier/order notes privately.
- Review AI demand and container recommendations before ordering.

## Implementation Order

1. Product Catalogue — complete
2. Cart — complete
3. Stripe Checkout — complete
4. Australia Post Shipping + Brisbane ute delivery — complete
5. Order Management — mostly complete
6. Inventory Control + Admin Product Management — partially complete
7. Shipping Labels — complete
8. AI Shop Assistant + Stock Intelligence — partially complete

## Important Scope Rule

Phases 1 and 2 are already complete. Do not revisit them unless a later phase requires a small integration change.

For each remaining phase, implement that phase only. Do not build future phases early.
