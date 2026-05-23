# PRD: Admin Business Intelligence Dashboard

Date: 2026-05-23
Owner: Beyond RV
Status: Draft for implementation

## Executive summary

The current admin area is strong for site operations: product edits, media uploads, chatbot knowledge, enquiry backup, and deploy control. It is not yet strong enough for business decisions. The owner needs a first-screen dashboard that turns inventory, enquiries, website behaviour, and launch readiness into clear actions.

This PRD defines the next admin phase: a business intelligence dashboard for Beyond RV that helps the owner answer:

- Which products are generating interest?
- Which stock is available, on sale, or stale?
- Which leads need follow-up today?
- Are website enquiries and email delivery working?
- Which traffic sources and pages lead to real enquiries?
- What needs attention before launch or handover?

## Research summary

### PostHog

PostHog supports SQL/HogQL access to event data through the project query API, which is already the pattern used by `netlify/functions/analytics-data.ts`. PostHog documents SQL access for querying events and properties, and its query API accepts a `HogQLQuery` payload against `/api/projects/:project_id/query`.

PostHog Trends are suitable for time-series metrics such as sessions, pageviews, enquiries, and conversion rate over 7/30/90 day ranges. PostHog Funnels are suitable for tracking where users drop off between viewing a product page and submitting an enquiry.

Sources:

- https://posthog.com/docs/sql
- https://posthog.com/docs/product-analytics/trends/overview
- https://posthog.com/docs/product-analytics/funnels

### Netlify Blobs

Netlify Blobs is suitable for storing unstructured or lightweight structured data from functions. It supports `setJSON`, `get`, `list`, metadata, and strongly consistent reads where needed. Netlify’s documentation states it can be used as a simple key/value store or basic database, while recommending dedicated database vendors for complex relational use cases.

This fits Beyond RV’s needs for enquiry records and simple lead statuses without adding a database.

Sources:

- https://docs.netlify.com/build/data-and-storage/netlify-blobs/

## Current state

The admin currently includes:

- Product Manager tab.
- Media Manager tab.
- Enquiries tab.
- Chatbot Knowledge tab.
- Pending Changes tab.
- Separate `/admin/analytics` page with sessions, enquiries, conversion rate, trends, top pages, sources, and YouTube attribution.

The current system can manage content and receive enquiries, but it does not yet combine product, enquiry, and analytics data into an owner-friendly decision dashboard.

## Goals

- Give the owner a single first-screen snapshot of business health.
- Surface urgent follow-up actions.
- Show stock and listed inventory value.
- Connect enquiries to product interest.
- Connect product page analytics to product enquiry performance.
- Highlight products that need attention.
- Highlight launch and operations readiness issues.
- Keep the system database-free by using existing markdown, PostHog, and Netlify Blobs.

## Non-goals

- Building a full CRM.
- Adding a relational database.
- Adding payment/order management.
- Replacing accounting or inventory software.
- Automating sales decisions without owner review.
- Exposing private customer data outside protected admin.

## Users

- Business owner: wants quick decisions and follow-up priorities.
- Site admin/operator: wants to verify launch readiness and content health.
- Sales responder: wants to know who to call, what they asked about, and which products they want.

## Data sources

### Product catalogue

Source:

- `netlify/functions/product-catalogue.json`
- generated from `src/content/products/*.md`

Used for:

- product count
- category count
- status count
- on-sale count
- featured count
- price/listed value estimate
- gallery completeness
- related-products completeness
- products with missing or placeholder media

### Enquiries

Source:

- Netlify Blobs store: `customer-enquiries`
- admin endpoint: `/.netlify/functions/admin-enquiries`

Used for:

- new enquiry count
- recent enquiries
- product interest count
- callback queue
- lead status
- response/follow-up tracking

### Lead status metadata

Source:

- Netlify Blobs store: proposed `lead-status`

Used for:

- lead state: `new`, `contacted`, `quoted`, `won`, `lost`, `spam`
- notes
- next follow-up date
- assigned owner
- last updated timestamp

### Website analytics

Source:

- PostHog events through `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID`
- existing `analytics-data.ts` pattern

Used for:

- sessions
- pageviews
- enquiry conversions
- product page views
- product page view-to-enquiry ratio
- traffic source quality
- campaign performance
- funnel drop-off

## Product requirements

### 1. Dashboard home

Add a new default admin landing view called `Dashboard`.

It should show:

- total products
- available products
- on-sale products
- coming-soon products
- estimated listed stock value
- enquiries in last 7 days
- enquiries in last 30 days
- open leads
- callbacks due today
- email delivery status
- analytics status
- pending changes count

Acceptance criteria:

- Owner can understand business health within 30 seconds.
- Dashboard loads without PostHog configured, showing product/enquiry data and an analytics warning.
- Dashboard does not expose raw API errors to the client.

### 2. Inventory intelligence

Add an inventory panel showing:

- stock count by category
- stock count by status
- total listed value by category
- products with no gallery
- products with fewer than three gallery images
- products using placeholder images
- products marked on-sale
- products with no recent enquiries

Price parsing:

- Use numeric value parsed from `price`.
- Ignore `POA`, `Contact us`, empty prices, and coming-soon products for listed value.
- Show value as an estimate, not accounting-grade inventory valuation.

Acceptance criteria:

- Owner can see approximate listed value.
- Owner can identify weak listings and stale stock.
- No product markdown changes are made by the dashboard itself.

### 3. Lead follow-up queue

Extend stored enquiries with editable lead status.

Required lead fields:

- enquiry ID
- status
- notes
- next follow-up date
- last updated

Lead statuses:

- `new`
- `contacted`
- `quoted`
- `won`
- `lost`
- `spam`

Dashboard should show:

- new leads
- callbacks due today
- overdue follow-ups
- leads by status
- quick call and email links

Acceptance criteria:

- Owner can mark an enquiry as contacted.
- Owner can add a note.
- Owner can set next follow-up date.
- Dashboard persists lead status in Netlify Blobs.
- No external CRM is required.

### 4. Product enquiry intelligence

Connect enquiry product interest to product catalogue.

Dashboard should show:

- enquiries by product
- products with enquiries in last 30 days
- products with no enquiries in last 30 days
- on-sale products with no enquiries
- top products by lead count

Matching rules:

- Prefer exact `product_interest` slug.
- If no slug, fallback to title text matching.
- If no match, count as `General enquiry`.

Acceptance criteria:

- Owner can see which stock is generating leads.
- Unknown/general enquiries remain visible instead of being discarded.

### 5. Product page performance

Use PostHog to show product page demand.

Metrics:

- product page views
- product enquiries
- product conversion rate
- product pages with high views and low enquiries
- product pages with low views but available stock

Acceptance criteria:

- Uses existing PostHog API pattern.
- Works for 7, 30, and 90 day ranges.
- Shows analytics unavailable state if env vars are missing.

### 6. Funnel summary

Add a simple funnel from:

1. product page view
2. enquiry form view
3. enquiry submitted

Metrics:

- product page viewers
- enquiry form viewers
- submitted enquiries
- drop-off percentage between steps

Acceptance criteria:

- Owner can see whether the problem is traffic, form starts, or form completion.
- Funnel is shown as a simple stepped summary, not an overly complex chart.

### 7. Traffic source quality

Improve source reporting by tying sources to enquiries, not just visits.

Metrics:

- sessions by source
- enquiries by source
- conversion rate by source
- YouTube campaign visits and enquiries
- referral partner enquiries

Acceptance criteria:

- Owner can see which marketing sources produce leads.
- YouTube attribution remains supported.
- Referral fields already stored in enquiries are used where available.

### 8. Launch readiness panel

Add a checklist panel for operational readiness.

Checks:

- admin auth configured
- contact email configured
- Resend API key configured
- product catalogue available
- chatbot knowledge file available
- PostHog public key configured
- PostHog server API configured
- products have hero images
- active products have gallery images
- no pending high-risk changes

Acceptance criteria:

- Owner can see what is ready and what needs setup.
- Missing analytics does not block launch, but is clearly marked.
- Missing contact email delivery is marked as launch-blocking.

## Technical requirements

### New functions

Create:

- `netlify/functions/admin-dashboard.ts`
- `netlify/functions/admin-lead-status.ts`

Enhance:

- `netlify/functions/admin-enquiries.ts`
- `netlify/functions/analytics-data.ts`

### New components

Create:

- `src/components/AdminDashboard.tsx`

Optionally refactor shared UI pieces from:

- `src/components/AdminPanel.tsx`
- `src/components/AnalyticsDashboard.tsx`

### Data model

Lead status blob key:

```text
lead-status/<enquiry-id>.json
```

Shape:

```json
{
  "enquiryId": "2026-05-23T...",
  "status": "new",
  "notes": "Called once, left voicemail.",
  "nextFollowUpDate": "2026-05-25",
  "updatedAt": "2026-05-23T10:00:00.000Z"
}
```

### Dashboard response shape

`admin-dashboard.ts` should return:

```json
{
  "inventory": {
    "totalProducts": 15,
    "available": 8,
    "onSale": 5,
    "comingSoon": 2,
    "estimatedListedValue": 730000,
    "byCategory": []
  },
  "leads": {
    "last7Days": 3,
    "last30Days": 12,
    "open": 7,
    "dueToday": 2,
    "overdue": 1,
    "byStatus": []
  },
  "productPerformance": [],
  "traffic": [],
  "funnel": [],
  "readiness": []
}
```

## UX requirements

- Dashboard becomes the first tab or first admin page.
- Use dense operational layout, not marketing-style cards.
- Use status colours consistently:
  - green: healthy
  - orange: warning
  - red: action required
  - grey: unavailable
- Every chart/table must answer an owner question.
- Empty states must explain what data is missing and how to fix it.

## Privacy and security

- Admin-only endpoints must use existing admin auth.
- Customer names, emails, phones, and notes must never appear on public pages.
- Lead notes must stay in Netlify Blobs.
- Analytics should be aggregate-only where possible.
- Do not send customer details to OpenAI unless the owner explicitly asks the admin AI to process a specific lead.

## Implementation phases

### Phase A: Dashboard foundation

- Create `admin-dashboard.ts`.
- Aggregate product catalogue.
- Aggregate enquiry counts from Netlify Blobs.
- Add dashboard tab/page.
- Add readiness checks.

### Phase B: Lead workflow

- Add lead status blob store.
- Add status/notes/follow-up UI.
- Add lead follow-up queue.
- Add callback due/overdue counts.

### Phase C: Product intelligence

- Map enquiries to products.
- Add enquiries by product.
- Add stale stock and on-sale-no-lead warnings.
- Add product listing quality checks.

### Phase D: Analytics intelligence

- Extend PostHog queries.
- Add product page views.
- Add product conversion rates.
- Add funnel summary.
- Add traffic source quality.

### Phase E: Polish and handover

- Add help text for dashboard metrics.
- Add launch-readiness checklist.
- Add QA test data notes.
- Add owner handover instructions.

## Acceptance criteria

- Owner can identify today’s follow-ups from the dashboard.
- Owner can see whether email delivery is configured.
- Owner can estimate active listed inventory value.
- Owner can identify products with weak listings.
- Owner can see product interest by enquiry volume.
- Owner can see traffic source quality, not just traffic volume.
- Dashboard works with only product/enquiry data if PostHog is unavailable.
- No database is added.
- Build and Netlify function bundling pass.

## Open questions

- Should lead status live only in admin, or should email notifications include a link to the admin lead?
- Should `won` leads automatically suggest marking a product sold?
- Should stale stock be based on no enquiries in 30 days, 60 days, or configurable per category?
- Should stock value include on-sale price only, or original price if `priceBadge` contains old price context?
- Does the owner want weekly email summaries later?

## Recommendation

Build Phase A and Phase B first. Those create the highest immediate business value: a dashboard, email/readiness confidence, and a practical follow-up queue. Product and analytics intelligence should follow once real enquiry data is flowing through the new contact form.

