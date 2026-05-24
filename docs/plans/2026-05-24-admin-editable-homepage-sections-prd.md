# PRD: Admin Editable Homepage Sections

Date: 2026-05-24
Owner: Beyond RV
Status: Draft for implementation

## Executive Summary

The homepage currently contains important trust-building content that will need regular updates:

- Recent Builds & Fitouts
- What Customers Say / Built to Last / Backed by Real Owners

These sections should not be hardcoded into `src/pages/index.astro`. They need to be editable from the admin area so the client can keep the homepage current without developer intervention.

This PRD defines a structured, database-free system for managing those homepage sections through the existing admin workflow.

## Problem

The Recent Builds section is currently hardcoded in the homepage file. Images, titles, and tags are embedded directly in Astro markup.

This creates several problems:

- The client cannot easily update recent builds.
- The admin AI would need to edit homepage code, which is riskier than editing structured content.
- Recent build images may become stale quickly.
- Incorrect labels can appear, such as naming the wrong vehicle platform.
- There is no simple way to reorder, hide, or replace cards.
- Testimonials are not yet managed as structured client-editable content.

The homepage needs to stay fresh because it is a high-trust page. Recent real builds and owner feedback are sales assets, not static design elements.

## Goals

- Make Recent Builds editable from the admin area.
- Make Testimonials / What Customers Say editable from the admin area.
- Keep the system database-free.
- Store section data in structured files that are easy for AI and code to update safely.
- Allow the client to upload/select images from the admin media system.
- Allow the client to edit titles, descriptions, tags, display order, and visibility.
- Keep homepage rendering fast and SEO-friendly.
- Avoid hardcoded recent-build/testimonial content in `src/pages/index.astro`.
- Preserve build-time static output for performance.

## Non-Goals

- Building a full CMS.
- Adding a relational database.
- Adding public user-submitted reviews.
- Integrating Google Reviews, Facebook Reviews, or third-party testimonial feeds in this phase.
- Letting unapproved testimonials publish automatically.
- Creating dynamic server-rendered homepage sections.

## Users

- Business owner: wants to update homepage proof points as builds are completed.
- Admin/operator: wants a safe interface for changing content, images, and order.
- Prospective customer: wants to see real recent work and owner feedback.
- AI admin assistant: needs structured content it can modify safely without editing layout code.

## Current State

### Recent Builds

Current location:

- `src/pages/index.astro`

Current behaviour:

- Cards are hardcoded.
- Images are selected from a local `rangeImages` object.
- Titles and tags are hardcoded in homepage markup.
- Editing requires code changes.

### Testimonials

The requested section is:

- `What Customers Say`
- `Built to Last.`
- `Backed by Real Owners.`

This should become a managed homepage section with structured testimonial data.

## Proposed Solution

Create structured content files:

```txt
src/data/homepage/recent-builds.json
src/data/homepage/testimonials.json
```

The homepage imports these files and renders the sections from data.

The admin area gets a new tab or panel:

```txt
Homepage
```

Inside the Homepage admin area:

- Recent Builds editor
- Testimonials editor

The admin AI can also update these files directly through the existing pending-change flow, but the user interface should support common edits without requiring free-form AI instructions.

## Data Model

### Recent Build

```json
{
  "id": "advent-2300-mutdapilly-2026-05",
  "title": "Advent 2300 Build",
  "image": "/images/optimized/products/advent-2300-hardtop-slide-on/01-beyond-rv-2300-advent-series-19-1024x678.webp",
  "alt": "Advent 2300 slide-on camper build at Beyond RV",
  "tags": [
    "Finished in Mutdapilly, Queensland",
    "Solar, lithium & 240V fitout",
    "Queensland warranty & ongoing support"
  ],
  "link": "/advent-2300-hardtop-slide-on/",
  "isVisible": true,
  "sortOrder": 1
}
```

Required fields:

- `id`
- `title`
- `image`
- `alt`
- `tags`
- `isVisible`
- `sortOrder`

Optional fields:

- `link`
- `caption`
- `completedDate`
- `vehiclePlatform`
- `productSlug`

### Testimonial

```json
{
  "id": "owner-feedback-001",
  "quote": "The camper has been solid, practical, and exactly what we needed for remote touring.",
  "customerName": "Verified Owner",
  "customerLocation": "Queensland",
  "productName": "Advent 2150",
  "image": "/images/optimized/products/advent-2150-hardtop-slide-on/01-advent-2150-05-1024x576.webp",
  "rating": 5,
  "isVisible": true,
  "sortOrder": 1
}
```

Required fields:

- `id`
- `quote`
- `customerName`
- `isVisible`
- `sortOrder`

Optional fields:

- `customerLocation`
- `productName`
- `image`
- `rating`
- `source`
- `approvedDate`

## Admin Requirements

### Homepage Tab

Add a new admin tab:

```txt
Homepage
```

The tab should show:

- Recent Builds list
- Testimonials list
- Add/edit forms
- Reorder controls
- Visibility toggle
- Save/queue changes workflow

### Recent Builds Admin Features

The client must be able to:

- Add a new recent build card.
- Edit title.
- Edit image.
- Select image from uploaded media or paste existing image path.
- Edit image alt text.
- Add/remove tags.
- Add optional product link.
- Reorder cards.
- Hide/show a card.
- Delete a card from the homepage data file.

Validation:

- Title required.
- Image required.
- Alt text required.
- At least one tag required.
- Image path must be local or approved Netlify media path.
- No external image URLs unless explicitly allowed later.

### Testimonials Admin Features

The client must be able to:

- Add testimonial.
- Edit testimonial quote.
- Edit customer display name.
- Edit customer location.
- Edit linked product name.
- Optionally add owner/customer photo or product photo.
- Set rating if available.
- Reorder testimonials.
- Hide/show testimonial.
- Delete testimonial from homepage data file.

Validation:

- Quote required.
- Customer display name required.
- Quote length should be reasonable for homepage display.
- Ratings, if provided, must be 1-5.
- Testimonials should be manually approved before visible.

## AI Admin Requirements

The AI admin assistant should understand these structured files:

```txt
src/data/homepage/recent-builds.json
src/data/homepage/testimonials.json
```

It should be instructed to:

- Modify these files instead of editing homepage markup.
- Preserve valid JSON.
- Preserve existing IDs unless creating a new item.
- Generate stable IDs from title/date when adding items.
- Never invent customer quotes.
- Never invent customer names.
- Ask for missing testimonial details.
- Ask for image details if no suitable image is supplied.
- Queue changes for review before deploy.

## Frontend Requirements

### Recent Builds Section

Homepage should:

- Import `recent-builds.json`.
- Filter to `isVisible: true`.
- Sort by `sortOrder`.
- Render up to a configured limit, initially 3.
- Use responsive optimized images.
- Use `loading="lazy"` and `decoding="async"` for section images.
- Use proper alt text from data.
- Avoid hardcoded build titles/tags in homepage markup.

### Testimonials Section

Homepage should:

- Import `testimonials.json`.
- Filter to `isVisible: true`.
- Sort by `sortOrder`.
- Render a polished trust section under:
  - `What Customers Say`
  - `Built to Last.`
  - `Backed by Real Owners.`
- Show quote, customer display name, optional location/product, and optional rating.
- Avoid publishing empty or placeholder testimonials.
- Use schema where appropriate.

### SEO / Structured Data

If testimonials are shown, consider adding `Review` or `AggregateRating` schema only when data is legitimate and verifiable.

Do not add fake review schema.

## Storage Strategy

Use structured repo files, not a database:

```txt
src/data/homepage/recent-builds.json
src/data/homepage/testimonials.json
```

Why:

- Static build remains fast.
- Content is version-controlled.
- Admin AI can safely modify JSON.
- No new database required.
- Changes deploy through existing GitHub/Netlify flow.

Netlify Blobs are not recommended for this phase because these sections should be part of the static homepage build and should be versioned.

## Acceptance Criteria

- Homepage Recent Builds section renders from `src/data/homepage/recent-builds.json`.
- Homepage Testimonials section renders from `src/data/homepage/testimonials.json`.
- No recent-build cards are hardcoded in `src/pages/index.astro`.
- No testimonial content is hardcoded in `src/pages/index.astro`.
- Admin has a Homepage tab or equivalent editor.
- Client can add/edit/reorder/hide recent builds.
- Client can add/edit/reorder/hide testimonials.
- Admin edits queue structured file changes through the existing review/deploy flow.
- Invalid empty items cannot be saved.
- Existing media manager can be used to supply images.
- `npm run check` passes.
- `npm run build` passes.
- Homepage renders without broken images.
- Data files are valid JSON.

## Implementation Plan

### Phase 1: Structured Content

- Add `src/data/homepage/recent-builds.json`.
- Add `src/data/homepage/testimonials.json`.
- Move existing homepage Recent Builds content into JSON.
- Add starter testimonial content only if real approved testimonial copy exists.
- If real testimonials are not available, keep the section hidden or omit testimonial cards.

### Phase 2: Homepage Rendering

- Update `src/pages/index.astro` to import recent builds and testimonials.
- Replace hardcoded Recent Builds cards with mapped data.
- Add or update the Testimonials section.
- Use existing image helpers for `srcset`, `sizes`, and lazy loading.
- Keep section layout consistent with the current design.

### Phase 3: Admin UI

- Add Homepage tab to `AdminPanel`.
- Add Recent Builds editor.
- Add Testimonials editor.
- Add add/edit/reorder/hide/delete controls.
- Use existing pending-change flow for JSON file updates.
- Connect image fields to uploaded media paths where possible.

### Phase 4: AI Admin Guardrails

- Update admin AI system prompt to know the homepage data files.
- Add rules for recent builds and testimonials.
- Ensure testimonial creation requires real customer-provided copy.
- Ensure images are not invented.

### Phase 5: Verification

- Run `npm run check`.
- Run `npm run build`.
- Preview homepage.
- Verify admin can queue and deploy section changes.
- Verify no old hardcoded homepage card data remains.

## Risks

- Client may accidentally publish unverified testimonials.
- Admin UI could become cluttered if too many homepage controls are added.
- Image paths can still break if pasted manually.
- AI could create generic testimonial copy if not guarded.

## Mitigations

- Require visible testimonials to be manually entered/approved.
- Keep fields small and specific.
- Validate image paths.
- Use existing media manager where possible.
- Instruct AI never to invent customer quotes.
- Keep all changes in review/pending state before deploy.

## Launch Priority

Priority: Medium-high before owner handover.

This is not strictly required for the public launch, but it is important for client independence. Without it, the owner will still depend on developer/code changes for one of the homepage’s most frequently changing trust sections.
