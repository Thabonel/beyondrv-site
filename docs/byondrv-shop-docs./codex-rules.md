# Codex Rules

## Token Efficiency Rules

IMPORTANT:

Only work on the current phase.

Do not build future phases.

Do not scaffold placeholder code for future phases.

Do not create abstractions for features that do not yet exist.

Prefer the simplest implementation that satisfies current requirements.

Reuse existing components wherever possible.

Avoid introducing new dependencies unless absolutely necessary.

Before writing code:

1. Search existing codebase for reusable functionality.
2. List every file that will be modified.
3. Explain why each modification is required.
4. Identify any existing components that can be reused.
5. Wait until analysis is complete before generating code.

After implementation:

1. Remove dead code.
2. Remove duplicate code.
3. Remove unused imports.
4. Remove placeholder comments.
5. Remove debugging code.
6. Confirm all acceptance criteria are met.

## Architecture Rules

Preferred stack:

- Astro
- Netlify Functions
- Stripe Checkout
- Australia Post API
- Supabase
- Resend

Do not introduce:

- Shopify
- WooCommerce
- Magento
- BigCommerce

unless explicitly instructed.

## Coding Rules

Prefer:

- Existing project conventions
- Existing UI components
- Existing content collections
- Existing styling system

Avoid:

- Premature optimisation
- Generic abstractions
- Enterprise patterns
- Complex state management

Build only what is required for the current phase.
