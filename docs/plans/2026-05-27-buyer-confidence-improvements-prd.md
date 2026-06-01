# PRD: Buyer Confidence Improvements

Date: 2026-05-27
Owner: Beyond RV
Status: Draft for client review

## Executive Summary

The new Beyond RV site is close to launch-ready. The next opportunity is not basic website functionality; it is buyer confidence.

Slide-on camper, truck camper, and expedition vehicle customers usually hesitate because they are unsure about fitment, payload, GVM/GCM, vehicle suitability, layout, availability, and total buying process. The site already presents products, real testimonials, recent builds, enquiry capture, AI chat, and admin editing. The next phase should add tools and content that help a serious buyer decide whether to enquire.

This PRD defines a post-launch improvement phase focused on:

- Vehicle fit confidence.
- Model comparison.
- Weight and payload clarity.
- Better enquiry data.
- Stronger product-page conversion.
- Clear stock/location messaging.
- Better slide-on positioning.
- Floorplans and walkthrough media where accurate assets exist.

## Problem

The current site presents the range well, but some high-intent buyers still need more practical information before contacting Beyond RV.

Common buyer questions likely include:

- Will this camper fit my ute, truck, or tray?
- Is my payload enough once passengers, water, gear, and accessories are included?
- Which Advent model is right for me?
- What is the difference between hardtop, pop-top, ute slide-on, truck camper, and expedition build?
- Is this product actually available now?
- Where can I inspect it?
- What does the internal layout look like?
- What information should I send to get useful advice quickly?

If these questions are not answered clearly, the site may generate fewer enquiries or lower-quality enquiries.

## Goals

- Increase buyer confidence before enquiry.
- Improve quality of leads sent to Beyond RV.
- Reduce repetitive fitment and suitability questions.
- Make slide-on model differences easier to understand.
- Make product pages more conversion-focused above the fold.
- Give the chatbot and enquiry form better structured information.
- Avoid making legal or engineering claims that should be confirmed by the team.
- Keep improvements maintainable through the existing admin and content workflow where practical.

## Non-Goals

- Replacing professional GVM, payload, engineering, or compliance advice.
- Building a full vehicle engineering calculator.
- Guaranteeing fitment automatically.
- Adding finance, deposits, checkout, or online ordering.
- Replacing the owner/sales team’s judgement.
- Publishing floorplans or weights that have not been confirmed by the owner.
- Using invented testimonials, fake reviews, or placeholder proof.

## Users

- Prospective slide-on buyer: wants to know if a camper suits their vehicle.
- Prospective caravan buyer: wants quick confidence around layout, inclusions, price, and availability.
- Truck/expedition buyer: wants to understand whether Beyond RV can build around their platform.
- Business owner: wants better-qualified enquiries with vehicle details included.
- Admin/operator: wants content that can be updated safely as stock and models change.
- Chatbot: needs structured site information to answer common questions without inventing details.

## Current State

The site currently includes:

- Product category pages.
- Product detail pages.
- Product pricing and status from structured content.
- Product galleries and hero images.
- Real testimonials on the homepage.
- Recent builds section.
- Contact/enquiry form.
- AI chatbot with product catalogue and business knowledge.
- Admin product manager.
- Admin media manager.
- Admin-editable homepage recent builds and testimonials.
- Admin chatbot knowledge section.
- Analytics dashboard and campaign link builder.

Known gaps:

- No structured vehicle fitment tool.
- No slide-on comparison table.
- Limited weight/payload guidance on many product pages.
- Enquiry form could collect more vehicle and use-case information.
- Product page first screen can be made more conversion-focused.
- Stock/location badges can be clearer.
- Floorplans and videos are not consistently available.

## Proposed Solution

Create a buyer-confidence improvement phase with five high-priority deliverables and three optional asset-dependent deliverables.

Priority deliverables:

1. Vehicle Fit Check Tool.
2. Slide-On Comparison Table.
3. Weights and Payload Guidance.
4. Improved Enquiry Form.
5. Product Page First-Screen Improvements.

Optional deliverables:

6. Stronger Stock and Location Labels.
7. No-Tow Positioning Section.
8. Floorplans and Walkthrough Videos.

## Product Requirements

### 1. Vehicle Fit Check Tool

Add a guided tool called something like:

```txt
Will it fit my ute or truck?
```

Suggested locations:

- Slide-on category page.
- Product detail pages for slide-ons and truck campers.
- Chatbot suggested action where relevant.

Required inputs:

- Vehicle make.
- Vehicle model.
- Vehicle year.
- Tray/tub type.
- Tray length.
- Current payload if known.
- GVM upgrade status: yes, no, unsure.
- Number of passengers.
- Intended camper/model.
- Expected water/gear/accessory load.
- Travel style: touring, beach, remote, full-time, work, towing boat/trailer.

Output categories:

- `Likely suitable to discuss`
- `Needs payload/GVM check`
- `Talk to Beyond RV before choosing`

The tool must be conservative. It should never say a vehicle is legally approved or guaranteed suitable.

Required disclaimers:

- The result is indicative only.
- Final suitability depends on vehicle plate data, tray setup, accessories, passengers, fluids, gear, axle loading, GVM, GCM, and compliance.
- Beyond RV should confirm fitment before purchase.

Admin/content requirements:

- Tool copy should be editable in content or simple config if practical.
- Recommended payload thresholds should not be hardcoded as legal truth unless confirmed by the owner.

Acceptance criteria:

- User can complete the tool in under two minutes.
- Tool gives a clear next step.
- Tool result can be included in enquiry submission.
- Tool does not make unsafe legal fitment claims.
- Mobile layout is easy to use.

### 2. Slide-On Comparison Table

Add a comparison table for slide-on and truck camper products.

Suggested location:

- `Our Slide-On Campers` page.
- Optional compact version on relevant product pages.

Compare products such as:

- Advent 2150.
- Advent 2300.
- Advent 2450.
- 7ft Electric Pop-Top Slide-On.
- 3.5m Pop-Top Truck Camper.
- 4.7m Truck Camper.
- Relevant expedition/truck-camper builds where appropriate.

Comparison fields:

- Product name.
- Price.
- Stock status.
- Category.
- Base length.
- Recommended vehicle type.
- Sleeps.
- Bathroom/ensuite.
- Power system.
- Water capacity if confirmed.
- Construction.
- Best for.
- CTA.

Data source:

- Prefer structured product markdown/frontmatter where available.
- Add missing fields only after owner confirmation.

Acceptance criteria:

- User can compare key models without opening every product page.
- Table works on mobile.
- Prices/statuses come from current product data.
- Unknown fields show `Ask us` or `To be confirmed`, not invented values.

### 3. Weights and Payload Guidance

Add a buyer-friendly section to relevant product pages.

Suggested heading:

```txt
Weights, Payload & Vehicle Suitability
```

Fields to support where confirmed:

- Tare/dry weight.
- Estimated wet weight.
- Recommended payload.
- Recommended vehicle class.
- Tray requirements.
- Centre of gravity guidance.
- GVM/GCM reminder.
- Payload disclaimer.

Content behaviour:

- If exact weight is unknown, show `Confirm with Beyond RV`.
- Do not invent weights.
- Use conservative language.
- Encourage customers to provide vehicle details.

Acceptance criteria:

- Product pages make it clear that fitment depends on the customer’s vehicle.
- No unsupported legal or engineering guarantees are made.
- Chatbot can use this content to answer fitment questions cautiously.

### 4. Improved Enquiry Form

Extend the enquiry form so Beyond RV receives better-qualified leads.

New suggested fields:

- Vehicle make/model/year.
- Tray length.
- Tray/tub type.
- Current GVM upgrade status: yes/no/unsure.
- Number of travellers.
- Interested model.
- Planned travel style.
- Towing requirement: boat/trailer/none/unsure.
- Budget range if owner wants it.
- Timeframe: ready now, 1-3 months, 3-6 months, researching.
- Optional vehicle/tray photo upload if Netlify storage flow supports it reliably.

Required fields:

- Keep current contact basics required.
- `How did you hear about us?` remains required.
- Vehicle details should be required only for slide-on/truck-camper enquiries, or optional with strong prompts.

Email output:

- Email to Beyond RV should group these details clearly.
- Include product interest and fit-check result if available.
- Preserve existing Resend delivery behaviour.

Admin output:

- Stored enquiry backup should include new fields.
- Dashboard should surface product interest and follow-up status as it does now.

Acceptance criteria:

- Form remains simple enough for mobile.
- New fields improve lead quality without blocking general enquiries.
- Email notification includes all new fields.
- Admin enquiry view displays the new fields clearly.

### 5. Product Page First-Screen Improvements

Improve product detail pages so high-value information appears above the fold.

First viewport should include:

- Product title.
- Price.
- Status/stock badge.
- Short tagline.
- Key specs.
- Primary CTA: enquire/call/talk to human.
- Secondary CTA: fit check or compare.
- Hero image/gallery visible but not dominating at the expense of buying info.

Mobile requirements:

- Price and CTA must be visible early.
- Gallery must not push all product information too far down.
- CTAs must be thumb-friendly.

Acceptance criteria:

- User can identify product, price/status, and next action in the first screen.
- Page remains visually premium.
- No product media regression.
- Lighthouse/mobile usability does not regress materially.

### 6. Stronger Stock and Location Labels

Improve stock badges and calls to action.

Examples:

- `Available now`
- `On sale`
- `In Melbourne`
- `One-off special`
- `Coming soon`
- `Book inspection`
- `Register interest`

Where product location is known, show it near the price/status area.

Acceptance criteria:

- Stock/location status is visible on cards and detail pages.
- Status text is driven by structured product data where possible.
- No stale stock claims are made without owner confirmation.

### 7. No-Tow Positioning Section

Add a section explaining the slide-on value proposition.

Suggested message:

```txt
Caravan comfort. Ute freedom.
```

Benefits to communicate:

- No trailer.
- Easier manoeuvring.
- Can tow a boat or trailer depending on setup and legal limits.
- Faster camp setup and pack-down.
- Better access to tracks where trailers may be restricted.
- Keeps the vehicle/camper combination compact.

Acceptance criteria:

- Section appears on the slide-on page.
- Copy is practical, not overhyped.
- Any towing statement includes a legal-suitability caveat.

### 8. Floorplans and Walkthrough Videos

Add floorplans and videos only where real, accurate assets are available.

Floorplans:

- Simple layout diagram.
- Mark bed, kitchen, fridge, shower/toilet, entry, storage, lounge, and major dimensions.
- Must be reviewed by owner before publishing.

Videos:

- Exterior walkthrough.
- Interior walkthrough.
- Bathroom/kitchen demo.
- Setup/pack-down.
- Electrical system overview.
- Vehicle/platform explanation.

Acceptance criteria:

- Product pages support optional floorplan/video fields.
- Missing assets do not create empty sections.
- Videos are lazy-loaded or embedded in a performance-conscious way.
- Floorplans have accessible alt text.

## Chatbot Requirements

The chatbot should use the new content to answer:

- Which slide-on might suit my vehicle?
- What details do you need to check fitment?
- What is the difference between Advent models?
- What is the price/status of a product?
- Is this in stock?
- What should I send before calling?

Rules:

- Use current product catalogue for price and status.
- Use fitment guidance conservatively.
- Do not guarantee vehicle suitability.
- Ask for vehicle details when needed.
- Direct ready buyers to `Talk to a human` or call 0430 863 819.

## Data Requirements

Product content may need additional structured fields:

```yaml
baseLength:
recommendedVehicle:
sleeps:
bathroom:
power:
water:
tareWeight:
estimatedWetWeight:
recommendedPayload:
trayRequirements:
centreOfGravity:
location:
bestFor:
floorplanImage:
walkthroughVideoUrl:
```

Not every field must be populated immediately. Unknown values should render as `Ask us`, `Confirm with Beyond RV`, or be hidden depending on context.

## Admin Requirements

The admin should eventually support:

- Editing comparison fields.
- Editing fitment guidance fields.
- Editing stock/location labels.
- Adding floorplan images.
- Adding video URLs.
- Viewing the extra enquiry fields.
- Seeing fit-check result attached to an enquiry.

For phase one, it is acceptable to manage the new product fields through structured product edits if UI work would delay launch.

## Analytics Requirements

Track these events where possible:

- Fit check started.
- Fit check completed.
- Fit check result category.
- Comparison table viewed.
- Comparison CTA clicked.
- Product enquiry CTA clicked.
- Product enquiry submitted.
- Video played.
- Floorplan opened.

Dashboard should eventually show:

- Fit-check completion rate.
- Most common vehicle makes/models.
- Most common suitability result.
- Products most compared.
- Products generating fitment uncertainty.

## SEO and AI Discovery Requirements

The new content should improve search and AI discovery by answering specific buyer questions directly.

SEO targets:

- Slide-on camper vehicle fitment.
- Slide-on camper payload.
- Advent slide-on comparison.
- Truck camper fitment.
- Queensland slide-on camper manufacturer.
- Custom expedition camper builds.

Implementation:

- Use real headings.
- Use plain-language FAQs.
- Add structured FAQ content where appropriate.
- Do not hide important copy inside images.
- Keep product specs crawlable in HTML.

## Implementation Phases

### Phase 1: Highest Commercial Value

Deliver:

- Product page first-screen improvements.
- Slide-on comparison table.
- Improved enquiry form fields.
- Stronger stock/location labels.
- Basic no-tow positioning section.

Rationale:

These changes improve conversion and lead quality without requiring complex calculations or new assets.

### Phase 2: Fitment Confidence

Deliver:

- Vehicle Fit Check Tool.
- Fit-check result attached to enquiry.
- Chatbot guidance updated to reference fit-check flow.
- Analytics tracking for fit-check usage.

Rationale:

This is likely the strongest differentiator, but it needs careful rules and disclaimers.

### Phase 3: Rich Product Proof

Deliver:

- Floorplan support.
- Walkthrough video support.
- Admin fields for floorplans/video links.
- Optional product-page FAQ sections.

Rationale:

These assets are highly valuable, but should only be added once accurate diagrams/videos exist.

## Risks and Mitigations

### Risk: Unsafe fitment advice

Mitigation:

- Use conservative result categories.
- Include clear disclaimers.
- Avoid legal certainty.
- Encourage direct contact for final confirmation.

### Risk: Stale product data

Mitigation:

- Use structured product data as source of truth.
- Make owner/admin workflow clear.
- Hide unknown values rather than inventing data.

### Risk: Form becomes too long

Mitigation:

- Use conditional fields.
- Group vehicle details clearly.
- Keep basic contact enquiry simple.

### Risk: Inaccurate floorplans

Mitigation:

- Do not publish floorplans until owner-reviewed.
- Store source and approval status where possible.

### Risk: Performance regression

Mitigation:

- Lazy-load videos.
- Use optimized images.
- Keep comparison table lightweight.
- Avoid heavy third-party embeds unless necessary.

## Acceptance Criteria Summary

- Buyers can compare slide-on models quickly.
- Buyers can understand what vehicle details Beyond RV needs.
- Enquiries include more useful vehicle and travel information.
- Product pages show price/status/CTA clearly in the first viewport.
- Stock and location labels are clearer.
- Chatbot can answer pricing/status/comparison/fitment questions more helpfully without making unsupported claims.
- No fake testimonials, invented weights, invented floorplans, or unsafe legal fitment guarantees are introduced.

## Open Questions for Client

- Which product weights and wet-weight assumptions are confirmed and safe to publish?
- Which vehicles should each slide-on model be positioned around?
- Should budget range be added to the enquiry form?
- Should vehicle/tray photo upload be included in phase one or later?
- Which products have accurate floorplans available?
- Which products have video walkthroughs available?
- Does Beyond RV want to publish stock location on every product or only special cases?
- What wording does the owner prefer for fitment disclaimers?

## Recommended Next Step

Ask the client to approve the direction first, then implement Phase 1. Phase 2 should follow once the owner confirms the fitment rules and payload guidance they are comfortable publishing.
