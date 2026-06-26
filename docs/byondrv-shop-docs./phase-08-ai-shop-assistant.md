# Phase 08 - AI Shop Assistant and Stock Intelligence

Read `codex-rules.md` before starting.

## Status

Not started.

## Goal

Add an AI assistant for ByondRV shop management that helps Melissa and the owners understand product demand, stock patterns, and monthly China container ordering decisions.

This phase should not give the AI authority to place orders, change public product data, charge customers, or alter stock automatically. The AI provides recommendations for owner review.

## Business Context

ByondRV receives a container from China roughly once per month. Australian stock is limited and often used for existing builds.

The owners need help deciding:

- what to keep in Australia
- what to add to the next China container
- what is getting enquiries but not converting
- what is no longer worth carrying
- what items are often needed for existing builds
- what products should remain enquiry-only

Melissa likely manages purchasing and financial approval. The AI should support her by preparing clear, reviewable recommendations.

## AI Boundaries

The AI may:

- summarise demand
- identify trends
- recommend reorder quantities
- recommend products for the next China container
- flag products with repeated unavailable requests
- flag products with high interest but low sales
- explain reasoning in plain English
- draft a container planning list for review
- suggest availability changes for review

The AI must not:

- place supplier orders automatically
- change public availability automatically
- change prices automatically
- expose private supplier notes to customers
- promise stock availability to customers
- send purchase orders without approval
- override Melissa or owner decisions

## Inputs

The AI can use approved internal data:

- orders
- enquiries
- demand signals
- cart interest where recorded
- unavailable item requests
- pricing fields
- compare-at / discount fields
- public availability and lead-time text
- product source type
- container eligibility
- estimated lead times
- internal stock estimates
- target local stock
- previous container reorder quantities
- private product notes
- sales/enquiry date ranges

## Outputs

The AI should provide clear, practical recommendations.

Example:

```text
Recommended China Container Additions

High confidence:
- 200W solar panel — add 4
  Reason: steady enquiries and repeated cart interest; low storage risk; commonly used in builds.

- Roof hatch — add 3
  Reason: frequent requests and long lead time; consider keeping at least 1 in Australia.

Watch list:
- Starlink mount — 5 enquiries but no confirmed orders.
  Recommendation: keep as enquiry-only until demand converts.

Do not restock:
- Item X — no purchases or enquiries in 90 days.
```

## Main Features

### 1. Monthly Container Recommendation

An admin screen that recommends what to add to the next China container.

Must include:

- product
- recommended quantity
- confidence level
- reason
- demand summary
- owner action values: accept, edit quantity, ignore, or mark as watch list

### 2. Australian Stock Recommendation

Suggest what should normally be kept in Australia.

Must include:

- suggested local target
- reason
- recent demand
- storage/fitment caution if relevant
- whether item is best kept enquiry-only

### 3. Demand Summary

Plain-English summary of recent product demand.

Examples:

- "Customers asked about solar upgrades 8 times this month."
- "Three customers tried to buy unavailable items."
- "The Starlink mount gets interest but has not converted to confirmed orders."

### 4. Product Suggestions for Melissa

The assistant should produce a short monthly purchasing note Melissa can review.

It should be practical, not technical.

### 5. Owner Approval Workflow

AI recommendations remain pending until an owner/admin approves, edits, or dismisses them.

The system should store the final decision for future learning.

## Deliverables

- AI stock intelligence admin page.
- Monthly container recommendation view.
- Australian stock target recommendation view.
- Demand summary by product and category.
- AI explanation for every recommendation.
- Owner approval/edit/dismiss workflow.
- Decision history stored for future reference.
- No automatic purchase ordering.
- No automatic public product changes.
- No customer-facing availability promises.

## Testing Requirements

Add or update tests for:

- AI recommendation generated from seeded demand data
- recommendation includes quantity, confidence, and reasoning
- recommendation can be accepted
- recommendation quantity can be edited before acceptance
- recommendation can be dismissed
- decision history is saved
- private notes are not exposed to customer-facing pages
- unauthorised users cannot access AI stock intelligence

## Acceptance Criteria

- Melissa/owners can see AI recommendations for the monthly China container.
- Recommendations are based on recorded demand and product planning fields.
- AI explains recommendations in plain English.
- Owner approval is required before any decision is treated as accepted.
- AI cannot place orders or change public product data automatically.
- Private supplier/order notes remain private.
- Existing shop, cart, checkout, shipping, order, inventory, and label tests still pass.
