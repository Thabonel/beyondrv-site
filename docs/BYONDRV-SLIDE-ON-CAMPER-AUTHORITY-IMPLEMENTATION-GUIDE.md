# Beyond RV Slide-On Camper Authority Implementation Guide

**Created:** 29 July 2026
**Purpose:** Make Beyond RV the most useful, trusted, and frequently cited Australian website for slide-on camper questions in conventional and AI-assisted search.
**Operating constraint:** The delivery team completes the work. The owners are only asked for facts, evidence, access, or approvals that cannot safely be inferred.
**Initial delivery window:** 12 weeks
**Authority-building window:** 6–18 months

---

## 1. What success looks like

The goal is not to publish the most articles or repeat the phrase `slide-on camper` most often. The goal is to make Beyond RV the source that buyers, journalists, publishers, search engines, and AI systems can rely on when they need to answer questions such as:

- Will this camper fit this vehicle and tray?
- What will the real loaded weight be?
- Will the vehicle stay within GVM and axle limits?
- Where should the camper's centre of gravity sit?
- What are the practical differences between a hardtop and a pop-top?
- How is a slide-on secured, loaded, unloaded, tested, and maintained?
- What does Beyond RV manufacture, import, finish, certify, and support in Queensland?
- What has happened to real customer builds after years of Australian use?

Success has four components:

1. **Technical trust:** Search systems can crawl, index, understand, and correctly identify the business and its content.
2. **Topical depth:** The site answers the complete set of important slide-on camper questions.
3. **Original evidence:** Beyond RV publishes measurements, photographs, methods, real build records, and honest limitations that other sites cannot copy without citing.
4. **External validation:** Customers, suppliers, engineers, industry bodies, journalists, and relevant publishers independently confirm the business and its expertise.

No search position or AI citation can be guaranteed. The controllable objective is to produce the strongest evidence, coverage, and entity clarity in the Australian slide-on camper market, then measure whether citations and enquiries grow.

---

## 2. Current starting point

The July 2026 audit found a strong technical base but an incomplete authority system.

### Existing strengths

- Static, crawlable Astro pages.
- Canonical URLs, XML sitemap, `robots.txt`, `llms.txt`, and `llms-full.txt`.
- Product, offer, breadcrumb, business, FAQ, and video structured-data support.
- Four slide-on camper product pages with substantial specifications and photography.
- A slide-on comparison table, suitability checker, and weight calculator.
- Two useful technical guides.
- Real workshop, product, customer, and handover material.
- More than ten years of claimed manufacturing experience.
- Search visibility for the brand, category, products, and at least one detailed slide-on query.
- Public reviews and testimonials that can be turned into better case-study evidence with permission.

### Gaps that this guide addresses

- Only two guide pages exist in `src/pages/guides/`.
- `/guides/` and the old `/blog/` currently return 404 responses.
- The product source contains no completed product FAQ arrays.
- No guide or product source currently declares a named author, technical reviewer, publication date, or meaningful update date.
- Important fitment fields remain unknown on multiple products, including dry weight, loaded weight, tray requirements, and centre of gravity.
- Public wording alternates between `Beyond RV`, `ByondRV`, `Byond RV`, and `Beyond Caravans`.
- Search-visible third-party listings contain old addresses.
- Manufacturing and compliance wording is broader than the publicly shown evidence.
- Organisation structured data is duplicated under different entity identifiers.
- Some product/category structured data can emit inaccurate availability, shipping, or fulfilment information.
- Sitemap `lastmod` currently reflects deployment time rather than the last significant change to each page.
- Most discoverable off-site mentions are directories, reviews, or replicated social material rather than independent technical coverage.

Re-run the baseline checks in Section 6 before implementation. Treat the code and live site as the source of truth when older documents disagree.

---

## 3. The central strategy

### Become the owner of the best Australian fitment and weight evidence

Beyond RV will not win authority merely by publishing generic camping advice. Established competitors already have long histories and large article libraries.

The defensible position is:

> Beyond RV publishes the clearest, best-sourced Australian evidence about matching slide-on campers to real vehicles, trays, payloads, axle limits, and travel requirements.

Every major page should contribute to at least one of these evidence categories:

| Evidence category | Examples |
| --- | --- |
| Measured product facts | Verified dry weight, travel-ready weight, dimensions, water capacity, battery capacity, centre of gravity |
| Vehicle fitment | Exact vehicle variant, tray dimensions, GVM, axle limits, accessories, weighbridge result |
| Test method | Where, when, and how the vehicle or camper was weighed or measured |
| Build experience | Workshop decisions, problems solved, materials used, installation notes |
| Owner experience | Distance travelled, terrain, setup process, durability, repairs, lessons learned |
| Independent evidence | Government rules, OEM documentation, engineer review, supplier specifications, third-party road tests |
| Honest limits | Unknown values, assumptions, unsuitable vehicle configurations, conditions requiring professional confirmation |

### Non-negotiable publishing rules

1. Never invent a measurement, customer result, qualification, accreditation, or compliance conclusion.
2. `Unknown` or `requires confirmation` is acceptable internally, but a page should not claim definitive suitability while critical facts remain unknown.
3. Use primary sources for safety, mass, legal, electrical, gas, and compliance topics.
4. Distinguish measured facts from estimates and general guidance.
5. State who wrote and technically reviewed advice.
6. Show when the page was materially reviewed or updated.
7. State commercial relationships and potential bias.
8. Do not change dates merely to make old content appear fresh.
9. Do not buy links, reviews, awards, or favourable editorial conclusions.
10. Structured data must match what a visitor can see on the page.

---

## 4. Division of responsibility

One person may hold several roles, but every responsibility must have a named owner in the project tracker.

| Role | Responsibilities | Owner involvement |
| --- | --- | --- |
| Programme lead | Schedule, tracker, owner questionnaires, risk decisions, weekly QA | Receives only batched exceptions |
| Technical lead | Astro implementation, redirects, schema, crawlability, analytics, testing | None unless access is required |
| Research lead | Source collection, claim verification, competitor gap analysis, evidence register | Requests missing private evidence |
| Technical writer | Guides, product upgrades, case studies, captions, transcripts | Uses prefilled approval forms |
| Data lead | Product facts, fitment records, source status, measurement methods | Requests only unknown critical fields |
| Outreach lead | Directories, publishers, partners, reviews, road tests, link tracking | Requests introductions only when necessary |
| Reviewer | Legal/safety/compliance review and accuracy sign-off | Owner nominates internal or external reviewer once |

### Rules for dealing with busy owners

- Do not ask owners to research information that the delivery team can find.
- Do not ask open-ended questions when a prefilled statement can be approved or corrected.
- Batch questions no more than once per week.
- Keep each form to ten minutes or less.
- Provide an `Unknown` option so the owner can finish quickly.
- Use one-click answers: `Approve`, `Correct`, `Unknown`, or `Do not publish`.
- Accept a two-minute voice note instead of written prose.
- Never ask for passwords. Ask the owner to grant delegated access or complete a short sign-in step.
- Do not request approval for spelling, formatting, internal links, metadata, or other routine editorial work.
- Escalate only claims, private facts, customer permission, legal risk, significant brand decisions, or publication of sensitive information.

---

## 5. Owner contact plan

The entire initial programme should require four short owner interactions plus account-access steps.

| Timing | Owner task | Target time | Delivery-team preparation |
| --- | --- | ---: | --- |
| Week 1 | Identity and claims questionnaire | 7 minutes | Prefill all known answers |
| Week 2 | Slide-on product facts table | 10 minutes | Include only unknown or contradictory fields |
| Week 3 | Public expert profiles and review authority | 5 minutes | Draft biographies for approval |
| Weeks 5–8 | Case-study permission forms | 3 minutes each | Draft story and choose images first |
| Once only | Grant Search Console, Bing, Business Profile, analytics, and social access | 5–15 minutes | Send exact click path and account email |

The exact questionnaires are in Section 20.

---

## 6. Phase 0 — Create the baseline and control system

**Timing:** Days 1–2
**Owner time:** None
**Outcome:** One evidence-backed record of the starting position.

### Step 1: Create the programme tracker

Use a spreadsheet or project board with these columns:

- Task ID
- Workstream
- Page or target URL
- Task
- Responsible person
- Status
- Priority
- Evidence needed
- Owner input needed
- Owner request sent date
- Due date
- Published date
- Verification result
- Search Console inspection date
- Bing/IndexNow submission date
- Notes

Statuses should be limited to:

`Backlog` → `Researching` → `Drafting` → `Technical review` → `Ready to publish` → `Published` → `Verified`

### Step 2: Create the claim and evidence register

Record every important public claim, not only search keywords.

Required columns:

- Claim ID
- Exact claim
- Pages using it
- Claim type: product, manufacturing, experience, safety, compliance, customer, local business
- Source URL or private evidence reference
- Source owner
- Verified date
- Reviewer
- Expiry/review date
- Status: verified, qualified, disputed, unknown, retired
- Approved public wording

Start with these high-risk or high-value claims:

- Public brand and legal trading name.
- Years of manufacturing experience.
- Queensland manufacturing/finishing wording.
- Imported versus locally manufactured components.
- ADR and other compliance statements.
- Warranty duration and scope.
- Product weights and dimensions.
- Vehicle compatibility.
- Customer travel and durability statements.
- Price, availability, lead time, and stock status.

### Step 3: Capture the search baseline

Export and preserve:

- Google Search Console performance for the last 3, 6, and 16 months where available.
- Google indexed-page and excluded-page reports.
- Google query and page exports.
- Bing Webmaster search performance.
- Bing AI Performance citations, cited URLs, and grounding queries.
- Current sitemap URL list and response status.
- Current referring domains from an available backlink index.
- Current Google Business Profile review count, rating, categories, address, phone, hours, and website.
- Bing Places equivalent data.
- Current organic and AI prompt-test results from Section 18.

Save exports under a private operational location, not in the public repository if they contain sensitive analytics or customer information.

### Step 4: Crawl the live site

For every public URL, record:

- HTTP status
- Indexability
- Canonical URL
- Title
- Meta description
- H1
- Word count
- Internal inbound links
- Structured-data types
- Images missing meaningful alt text
- Broken internal/external links
- Publication/update date presence
- Author/reviewer presence
- Sitemap inclusion

Explicitly test:

- `/blog/`
- `/guides/`
- All old WordPress URLs found in Search Console, analytics, sitemaps, backlink tools, or search results.
- All current product, category, calculator, and guide URLs.
- `robots.txt`, `llms.txt`, `llms-full.txt`, sitemap index, and sitemap files.

### Phase 0 definition of done

- [ ] Programme tracker exists.
- [ ] Claim/evidence register exists.
- [ ] Search and AI baseline exports are saved.
- [ ] Every public URL has been crawled.
- [ ] Old URLs and their best replacement targets are listed.
- [ ] The first owner questionnaire contains only unresolved facts.

---

## 7. Phase 1 — Repair identity, crawl paths, and structured data

**Timing:** Week 1–2
**Owner time:** Seven-minute identity questionnaire plus account access
**Outcome:** Search engines encounter one unambiguous business entity and no avoidable authority leaks.

### Step 1: Establish a canonical entity record

Create one internal site-identity object used by metadata, schema, footer, contact pages, calculators, guides, and generated files.

It should contain:

- Canonical public name.
- Legal entity and trading name.
- ABN.
- Current address.
- Primary telephone.
- Domain-based public email when available.
- Appointment hours.
- Logo URL.
- Social profile URLs.
- Business Profile URLs/identifiers where appropriate.
- Founding year or experience wording only if verified.
- Approved manufacturing wording.
- Approved compliance wording.

Recommended public name based on the existing domain and dominant site usage: **Beyond RV**. Keep historical names only as declared alternate names when they refer to the same entity and are still useful for disambiguation.

### Step 2: Standardise public naming

Search the public source for:

- `ByondRV`
- `BeyondRV`
- `Byond RV`
- `Beyond Caravans`
- Old phone numbers
- Old email addresses
- Old street addresses

Replace them with the approved canonical data except where a historical name is intentionally explained.

Correct misleading labels such as `Source: Byond RV`. Product source/fulfilment labels should describe real source or stock status, not introduce another spelling of the brand.

### Step 3: Create the `/guides/` hub

Add `src/pages/guides/index.astro`.

The page must include:

- A direct description of the guide library.
- Cards for every published guide.
- Topic groups: choosing a camper, vehicle fitment, weights and compliance, design/construction, ownership and travel.
- Named editorial/review policy.
- Link to the weight calculator and vehicle suitability checker.
- Links to relevant slide-on products without turning the page into an advertisement.
- CollectionPage, BreadcrumbList, and ItemList structured data where accurate.

Add `Guides` to a stable site-wide navigation location. If the main header is too crowded, add it to the footer and relevant category pages at minimum.

### Step 4: Recover old blog authority

1. Export all known old `/blog/` URLs from Search Console, analytics, the old sitemap, archive records, and backlink tools.
2. For each URL, choose one action:
   - Restore and improve the article when it has useful history, traffic, links, or unique expertise.
   - Redirect it with HTTP 301 to the closest equivalent guide.
   - Return 410 only when the content has no replacement and should permanently disappear.
3. Do not redirect every old article to the homepage.
4. Redirect `/blog/` itself to `/guides/` after the guide hub exists.
5. Test each redirect for one hop only.

### Step 5: Consolidate organisation structured data

Use one organisation identifier everywhere, for example:

`https://beyondrv.com.au/#organization`

Connect the website, local business, products, videos, authorship, and publisher references to that same entity. Avoid emitting competing `#business` and `#organization` records with different details.

Include only accurate properties. Add ABN/legal identifiers when appropriate and confirmed. Do not add review markup for self-controlled reviews to the LocalBusiness entity in an attempt to create star snippets.

### Step 6: Correct product and offer data

Review `src/lib/structuredData.js`, category schemas, and product schemas.

Correct the following:

- Convert internal availability codes to valid Schema.org URLs everywhere.
- Do not claim free shipping or zero-day delivery when freight, fitment, or collection must be arranged.
- Describe workshop pickup or quote-required fulfilment accurately.
- Ensure price, currency, availability, seller, product URL, and images match visible content.
- Use stable SKU/MPN values and never invent GTINs.
- Add return-policy information only after confirming the legal and operational wording.
- Remove expired `priceValidUntil` values or generate valid ones from real pricing review dates.

Run Google Rich Results Test or Schema Markup Validator on:

- Homepage.
- Slide-on category page.
- One purchasable slide-on product.
- One made-to-order product.
- One guide.
- One video page.

### Step 7: Make `lastmod` truthful

Replace the build-time fallback in `astro.config.mjs` with meaningful content dates.

Preferred approach:

- Add `publishedAt` and `updatedAt` to product, guide, and case-study content.
- Update `updatedAt` only after a significant change to primary content, structured data, or important links.
- Derive sitemap `lastmod` from the content record.
- Omit `lastmod` when a reliable date is unavailable.
- Do not change all page dates on each deployment.

### Step 8: Repair breadcrumbs and internal links

- Ensure every breadcrumb target returns 200.
- Add links from the homepage and slide-on category to the guides hub and the best guides.
- Link products to relevant fitment/weight guides and the calculator.
- Link guides to the category, products, related guides, authoritative sources, and case studies.
- Use descriptive anchor text rather than `learn more` or `click here`.

### Step 9: Configure webmaster platforms

- Verify the domain property in Google Search Console.
- Submit the sitemap index.
- Inspect and request indexing for the homepage, guide hub, slide-on category, four slide-on products, and new/updated guides.
- Verify Bing Webmaster Tools.
- Submit the sitemap.
- Enable and record Bing AI Performance.
- Implement IndexNow for meaningful additions, changes, and removals.
- Confirm `OAI-SearchBot`, Googlebot, Bingbot, Claude search crawlers, and Perplexity crawler access at both `robots.txt` and hosting/firewall levels.

### Phase 1 definition of done

- [ ] One canonical business identity is used publicly.
- [ ] `/guides/` returns 200 and is internally linked.
- [ ] `/blog/` and valuable old posts redirect or are restored appropriately.
- [ ] No breadcrumb points to a 404 page.
- [ ] Structured data passes validation without critical errors or knowingly false fields.
- [ ] Sitemap dates reflect meaningful updates.
- [ ] Search Console, Bing Webmaster Tools, and Bing AI Performance are accessible.
- [ ] Priority URLs are submitted and monitored.

---

## 8. Phase 2 — Build the evidence and authorship model

**Timing:** Week 2
**Owner time:** Five-minute expert approval
**Outcome:** Every important claim has a source and every technical page has accountable human expertise.

### Step 1: Add product evidence fields

Extend the vehicle product content model so facts can be stored with status and provenance. The public page does not need to reveal private documents, but the source must be traceable internally.

Recommended fields:

- `dryWeightKg`
- `dryWeightDefinition`
- `typicalLoadedWeightKg`
- `requiredTrayLengthMm`
- `requiredTrayWidthMm`
- `centreOfGravityMm`
- `centreOfGravityReferencePoint`
- `overallLengthMm`
- `overallWidthMm`
- `overallHeightMm`
- `sleeps`
- `freshWaterLitres`
- `greyWaterLitres`
- `batteryCapacityAh`
- `solarCapacityW`
- `verifiedAt`
- `verifiedBy`
- `dataStatus`: measured, manufacturer-confirmed, documented, estimated, unknown
- `evidenceRef`
- `assumptions`

Do not show an estimated number without the word `estimated`, the assumptions, and a review date.

### Step 2: Create public expert profiles

Create an author/reviewer data structure and public profile pages containing:

- Full name.
- Current role.
- Relevant years of experience.
- Specific areas of hands-on experience.
- Relevant qualifications, licences, or accreditations.
- What they are qualified to review and what they are not.
- Workshop photograph with permission.
- Links to the guides or case studies they wrote/reviewed.
- Disclosure of employment or commercial relationship with Beyond RV.

Do not describe someone as an engineer, electrician, gas fitter, compliance expert, or similarly regulated professional without verified evidence.

### Step 3: Add editorial metadata

Every guide and case study should visibly show:

- Written by.
- Technically reviewed by, where required.
- First published date.
- Last materially reviewed date.
- Short methodology or source note.
- Commercial disclosure.
- Correction contact or process.

Add appropriate Article or TechArticle structured data linked to the real Person and Organization entities.

### Step 4: Publish an editorial and corrections policy

The policy should explain:

- Source hierarchy.
- How measurements are obtained.
- How estimates are labelled.
- How technical and safety advice is reviewed.
- How commercial bias is disclosed.
- How readers can report an error.
- How corrections are recorded.
- Why product suitability still requires exact vehicle and load verification.

### Phase 2 definition of done

- [ ] Product data supports provenance and verification status.
- [ ] At least one writer and one appropriate technical reviewer have approved profiles.
- [ ] Guide templates display authorship, review, dates, sources, and disclosures.
- [ ] Editorial/corrections policy is published.
- [ ] No regulated qualification is claimed without evidence.

---

## 9. Phase 3 — Upgrade the four slide-on product pages

**Timing:** Weeks 2–5
**Owner time:** One ten-minute batch questionnaire
**Outcome:** Each product page becomes a complete and citeable fitment resource.

Upgrade in this order:

1. Advent 2150 Hardtop Ute Slide-On Camper.
2. Advent 2300 Hardtop Ute Slide-On Camper.
3. Advent 2450 Hardtop Ute Slide-On Camper.
4. 7ft Electric Pop-Top Slide-On Camper.

### Product-page production procedure

Complete these steps for one product before starting the next:

1. Collect the current product record, brochures, workshop sheets, invoices, certificates, manuals, photographs, videos, and known customer builds.
2. Compare every fact across those sources and list contradictions.
3. Complete all facts that can be verified without the owner.
4. Send the owner only the unresolved critical facts using Questionnaire 2.
5. Mark every field with its evidence status.
6. Write a direct opening summary: what it is, who it suits, where it is finished/built, and the most important limitation.
7. Add a `Best for` section.
8. Add a `May not suit` section.
9. Add verified weights, dimensions, centre-of-gravity, and tray requirements above the long specification accordions.
10. Add a plain-language fitment method and link to the calculator.
11. Add at least six product-specific FAQs based on real enquiry and chatbot questions.
12. Add visible video transcript or a detailed walkthrough summary.
13. Add captions that explain what each important image demonstrates.
14. Add links to the relevant guide, calculator, category page, related product, warranty page, and enquiry flow.
15. Add update/reviewer information.
16. Validate visible content against Product/Offer/Video/FAQ structured data.
17. Build, test, publish, submit through IndexNow, and request Search Console inspection.
18. Check the page again after deployment on mobile and desktop.

### Required visible product-page structure

1. Product name and direct summary.
2. Price, availability, and lead-time status.
3. `Best for` and `May not suit`.
4. Verified fitment facts.
5. Weight and payload explanation.
6. Tray and mounting requirements.
7. Construction and systems summary.
8. Complete specifications.
9. Real build photographs with captions.
10. Walkthrough video and transcript/summary.
11. Owner/build example where permission exists.
12. Product-specific FAQ.
13. Sources, reviewer, and updated date.
14. Related guides and calculator.
15. Enquiry CTA that requests the exact vehicle information needed for a fitment review.

### Minimum product FAQ set

Adapt the answers to the actual product:

- What vehicles and cab styles may suit this model?
- What tray length and width does it require?
- What is its verified dry weight and what is included in that figure?
- What is a realistic loaded touring weight?
- Where is the centre of gravity?
- Can it be used off the vehicle on its legs?
- How is it secured to the tray?
- What electrical, water, gas, and appliance systems are standard?
- What is completed in Queensland?
- What must be checked before ordering?

### Product-page definition of done

- [ ] No critical fitment value is silently omitted.
- [ ] Unknowns and estimates are clearly labelled.
- [ ] Every important measurement has a source/status.
- [ ] Page has specific `Best for` and `May not suit` guidance.
- [ ] At least six non-duplicated FAQs are visible.
- [ ] Video information is also available as text.
- [ ] At least one relevant guide and calculator are linked.
- [ ] Author/reviewer and dates are visible.
- [ ] Structured data matches the page.
- [ ] Page has passed build, link, mobile, schema, and post-deployment checks.

---

## 10. Phase 4 — Build the definitive guide library

**Timing:** Weeks 3–10
**Owner time:** None unless a guide uses a private claim
**Outcome:** Beyond RV covers the complete subject with better evidence than competing manufacturer sites.

### Recommended site architecture

- `/our-slide-on-campers/` — commercial range and comparison hub.
- `/guides/` — educational knowledge hub.
- `/case-studies/` — real completed builds and owner outcomes.
- `/slide-on-camper-weight-calculator/` — interactive calculator.
- `/vehicle-suitability-checker/` — suitability workflow.

Do not create several nearly identical pages for `slide-on campers`, `ute slide-ons`, `slide-on campers Australia`, and `slide-on campers Queensland`. Give each page a distinct purpose and consolidate overlapping search intent.

### Publishing order and content briefs

| Priority | Page | Primary question | Unique Beyond RV evidence required |
| ---: | --- | --- | --- |
| 1 | Complete Guide to Slide-On Campers in Australia | What is a slide-on and how do I choose one? | Workshop process, product taxonomy, decision flow, real examples |
| 2 | Slide-On Camper Weight and Payload Guide | How do I know whether my ute can carry one? | Measured camper examples, accessory scenarios, calculator |
| 3 | Centre of Gravity and Rear-Axle Loading | Why does camper position matter? | Diagrams, measured reference points, reviewed worked examples |
| 4 | Australian Legal and Compliance Guide | What rules and checks apply? | Primary government sources and qualified review |
| 5 | Ute Tray Size and Camper Fitment | What tray dimensions and construction are required? | Measured products/trays, mounting photographs |
| 6 | Hardtop vs Pop-Top Slide-On Campers | Which roof type suits my travel? | Real models, measured dimensions, setup and insulation observations |
| 7 | Single Cab vs Space Cab vs Dual Cab | Which cab configuration works best? | Fitment records and axle/payload examples, not generic opinions |
| 8 | Slide-On Camper vs Caravan vs Campervan | Which format suits my use? | Decision table, towing/access observations, honest trade-offs |
| 9 | Loading and Unloading a Slide-On Camper | How is it safely moved on and off a tray? | Step photographs/video, jack limits, level-ground and wind precautions |
| 10 | Slide-On Mounting and Tie-Down Systems | How is the camper secured? | Beyond RV mounting details that can safely be public, inspection checklist |
| 11 | Electrical and Water Systems for Remote Touring | How much battery, solar, and water do I need? | Real system configurations and usage assumptions |
| 12 | Insurance, GVM Upgrades, and Modifications | What must be confirmed before travel? | Insurer/engineer questions, primary sources, strong disclaimers |

### Standard guide-production procedure

1. Define one primary reader task and five to ten supporting questions.
2. Review Search Console queries, chatbot topics, enquiries, competitor pages, forums, and People Also Ask-style questions for vocabulary and gaps.
3. Build the source list before drafting.
4. Collect original Beyond RV examples and media.
5. Draft an answer-first summary of 40–80 words.
6. Explain the topic in plain language.
7. Add a comparison table, checklist, calculation, or decision flow where it genuinely helps.
8. Add a `What can go wrong` or `Common mistakes` section.
9. Add evidence-backed worked examples.
10. Link each significant safety/legal claim to a primary source.
11. Add relevant product and calculator links without forcing a sales pitch into every paragraph.
12. Add a short FAQ using questions not already fully answered by headings.
13. Add author, reviewer, methodology, disclosure, dates, and correction link.
14. Perform technical review before copy-editing; do not polish an unverified claim.
15. Validate all calculations independently.
16. Publish and add links from the guides hub, related guides, category, and relevant products.
17. Submit through IndexNow and inspect through Search Console.
18. Review performance after 30, 60, and 90 days.

### Guide quality test

Do not publish until all answers are `Yes`:

- Does this page contain information that is difficult to obtain elsewhere?
- Could a buyer make a safer or clearer decision after reading it?
- Are important facts sourced or identified as first-hand observations?
- Does the writer's and reviewer's experience match the subject?
- Are estimates and examples clearly separated from verified product data?
- Does the page acknowledge limitations and unsuitable scenarios?
- Would an independent 4x4 publisher be comfortable citing it?
- Can an AI system extract a correct short answer without losing a critical qualification?

---

## 11. Phase 5 — Publish original research assets

**Timing:** Weeks 6–12, then ongoing
**Owner time:** Only evidence confirmation
**Outcome:** Beyond RV creates data that naturally earns citations and links.

### Asset 1: Australian Slide-On Camper Weight and Fitment Index

Publish an HTML table and downloadable CSV containing only verified records.

Recommended columns:

- Camper model.
- Camper configuration/version.
- Verified dry weight.
- Definition of dry weight.
- Typical loaded-weight example.
- Base/tray dimensions.
- Centre-of-gravity location and reference point.
- Vehicle make/model/variant/year.
- Cab type.
- Vehicle GVM.
- Front and rear axle limits.
- Measured vehicle weight before camper.
- Measured axle weights before camper.
- Measured complete weight after camper.
- Measured axle weights after camper.
- Accessories included.
- Water/fuel/passenger state.
- Data date.
- Measurement method.
- Reviewer.
- Suitability conclusion and limitations.

Never populate a record by combining incompatible brochure values from different vehicle variants.

### Asset 2: Annual Australian Slide-On Camper Weight Report

Publish once enough verified records exist. It should include:

- Dataset version and methodology.
- Number and type of combinations measured.
- Common sources of lost payload.
- How frequently rear-axle limits become the controlling limit.
- Differences between advertised and real remaining payload.
- Range of water, battery, accessories, and touring loads observed.
- Anonymised case examples.
- Corrections and limitations.
- Downloadable tables.

Send the report to relevant publishers, clubs, engineers, suppliers, and industry organisations. The value is the data, not a claim that Beyond RV is the best.

### Asset 3: Fitment worksheet

Create a downloadable one-page worksheet that collects:

- Vehicle make/model/year/variant.
- Cab style.
- Compliance plate GVM and axle limits.
- Current weighbridge total and axle weights.
- Tray dimensions and material.
- Accessories.
- Passenger and fuel assumptions.
- Camper model.
- Water, battery, gas, luggage, and other touring loads.

Make the worksheet useful even when the buyer does not purchase a Beyond RV product. This increases the likelihood that clubs, forums, publishers, and AI systems treat it as a genuine reference.

### Measurement protocol

For any published measurement:

1. Identify the exact camper and vehicle configuration.
2. Photograph identifying plates where permission and privacy allow.
3. Record whether tanks, gas, fuel, batteries, accessories, passengers, and luggage are included.
4. Use a calibrated public weighbridge or suitable verified equipment.
5. Record total, front-axle, and rear-axle values when the method supports them.
6. Record date, location, operator, and evidence reference.
7. Repeat or cross-check unexpected values.
8. Have calculations reviewed by a second person.
9. Publish assumptions and measurement limitations.
10. Preserve the source record after publication.

Do not publish a centre-of-gravity calculation as authoritative unless the method has been reviewed by a suitably competent person.

---

## 12. Phase 6 — Turn completed builds into case studies

**Timing:** Start Week 5; publish at least two per month
**Owner time:** Three-minute approval per case
**Outcome:** First-hand experience becomes durable, searchable proof.

### Priority case studies

1. A space-cab ute with an Advent slide-on.
2. A single-cab ute with the Advent 2450.
3. A 7ft pop-top installation.
4. A ten-year-old Beyond slide-on still in use.
5. A remote-tour build that reached a destination unsuitable for trailers.
6. An Isuzu NPS or similar light-truck camper.
7. A Unimog expedition build.
8. A build where payload or tray design changed the initial recommendation.

### Case-study workflow

1. Select a completed build with useful evidence.
2. Collect existing order/build records and public social material.
3. Remove customer contact and private commercial data.
4. Draft the case without asking the owner to write it.
5. Prepare a one-page fact sheet and image selection.
6. Send Questionnaire 4 to the owner.
7. Obtain customer permission where the customer, registration, location, or identifiable story will be used.
8. Ask the customer five short questions by form or voice note.
9. Verify technical facts against build records.
10. Publish with links to the product, guide, calculator, and related case studies.
11. Invite the customer to correct any factual error.
12. Offer the case study to relevant vehicle, supplier, club, or travel communities where appropriate.

### Required case-study structure

- Build summary.
- Vehicle and tray.
- Owner's travel goal.
- Initial constraints.
- Payload and fitment checks.
- Design/build decisions.
- Verified specifications.
- Photographic build evidence.
- Handover result.
- Owner experience after a stated period or distance.
- What the team would do differently.
- Sources, reviewer, publication/update dates, and permission status.

Do not write every case study as a flawless success. Honest problems and how they were resolved are powerful trust evidence.

---

## 13. Phase 7 — Build external authority and clean local citations

**Timing:** Weeks 4–12 and ongoing
**Owner time:** Introductions only when needed
**Outcome:** Independent sources consistently confirm the entity and cite its expertise.

### Step 1: Create the master citation sheet

Include:

- Canonical public business name.
- Legal/trading name.
- Address.
- Phone.
- Email.
- Website.
- Appointment hours.
- Primary business description.
- Primary and secondary categories.
- Logo and approved photographs.
- Social URLs.
- Old names, addresses, and phone numbers to remove.
- Listing URL, login owner, current status, correction date, and verification date.

### Step 2: Correct high-priority profiles

Correct in this order:

1. Google Business Profile.
2. Bing Places.
3. Facebook.
4. Instagram.
5. YouTube.
6. Apple Business Connect/Maps where applicable.
7. Relevant caravan, camping, 4x4, local business, and industry listings.
8. Search-visible aggregators showing old addresses.

Do not spend time creating dozens of low-quality directory listings. Correct prominent inaccurate records and pursue relevant industry recognition.

### Step 3: Build an ethical review process

After a real handover or service milestone:

1. Send a short neutral review request.
2. Link directly to the correct Business Profile.
3. Do not offer an incentive for a positive review.
4. Do not ask customers to insert exact keywords.
5. Invite honest details about the model, use case, and experience if they wish.
6. Respond factually and professionally to every review.
7. Request separate permission before republishing a review on the website.

Suggested message:

> Thanks again for choosing Beyond RV. If you have two minutes, an honest Google review would help other travellers assess us. Mentioning the camper or build you own is useful, but please write the review in your own words: [review link]

### Step 4: Obtain independent road tests

Prepare a media kit containing:

- One-page company facts.
- Exact product specifications and measurement status.
- High-resolution photographs.
- Test-unit availability.
- Suggested technical questions, not required conclusions.
- Disclosure of any transport, loan, accommodation, or other support.
- Contact person.

Offer test access to credible Australian 4x4, touring, caravan, camping, overlanding, regional, and vehicle-specific publishers. Do not require positive coverage or approval before publication.

### Step 5: Earn partner and supplier citations

Ask legitimate partners to reference real work, for example:

- Appliance suppliers featuring a documented installation.
- Electrical suppliers featuring a system case study.
- Vehicle/tray partners featuring a fitment project.
- Engineers or compliance partners co-authoring a reviewed guide.
- Clubs referencing the fitment worksheet.
- Shows/events listing the correct business and products.

The link must make sense to a human reader. Avoid reciprocal-link pages created solely for SEO.

### Step 6: Outreach with a useful asset

Do not send `Please link to our website`. Lead with something that helps the publisher's audience.

Suggested research outreach:

> **Subject:** Australian slide-on camper weight data for your readers
>
> Hi [Name],
>
> We have published a documented set of real vehicle, axle, tray, and slide-on camper measurements from Australian builds. The methodology and downloadable data are here: [URL].
>
> It may be useful for future payload or slide-on coverage. You are welcome to cite the data or question the methodology. We can also provide original photographs and arrange access to a measured build. Any commercial relationship or support will be disclosed.
>
> Regards,
> [Name]
> Beyond RV

Suggested road-test outreach:

> **Subject:** Independent test access — [exact camper and vehicle]
>
> Hi [Name],
>
> Beyond RV can make a [model] on a [vehicle variant] available for an independent test. We will provide verified weights, configuration details, and access to the workshop, but we will not request editorial approval or a positive conclusion.
>
> If the combination suits your coverage, I can send the technical pack and proposed access dates.
>
> Regards,
> [Name]
> Beyond RV

### Phase 7 definition of done

- [ ] Major public profiles use the same name, address, phone, and URL.
- [ ] Old address listings are corrected, merged, or reported.
- [ ] Review requests are part of the handover workflow.
- [ ] Media kit exists.
- [ ] At least 20 relevant publishers/partners are prioritised.
- [ ] Outreach is based on a real asset, test, or story.
- [ ] Earned coverage and links are tracked by URL and quality.

---

## 14. How to make pages easy for AI systems to cite accurately

Write for people first, then ensure the page is unambiguous enough for a machine to extract safely.

### Use answer-first blocks

Start each major section with a direct answer, then explain evidence and exceptions.

Example:

> A ute's brochure payload is not the amount automatically available for a slide-on camper. The tray, bull bar, passengers, fuel, accessories, water, luggage, and camper all consume payload, and the rear-axle limit may be reached before GVM.

### Keep entities explicit

Prefer:

> The Beyond RV Advent 2150 has a 2150 mm base length.

Avoid:

> It has a 2150 base.

### Put qualifications next to claims

Do not separate an important warning from the number it qualifies.

Prefer:

> The measured dry weight was X kg in configuration Y, without water, gas, luggage, or optional equipment, measured on DATE.

Avoid:

> Dry weight: X kg.

### Use stable tables

Tables should have:

- Units in headers or values.
- A clear definition for every weight state.
- `Unknown` rather than a blank cell.
- Source/update note.
- Mobile-readable presentation.
- Matching text for key conclusions.

### Add transcripts and captions

AI and search systems should not need to infer important facts from an image or video alone.

- Summarise each walkthrough in visible text.
- Caption photographs with the vehicle, camper, component, and point being demonstrated.
- Provide full transcripts for detailed technical videos when practical.
- Link the video and article to each other.

### Make evidence easy to follow

- Link government and OEM sources directly.
- Use a Sources section for longer guides.
- State which claims are Beyond RV measurements or observations.
- Show a short methodology box for calculators and research.
- Use permanent URLs and redirect them if titles change.

### Do not overproduce FAQ/schema markup

FAQ sections should answer genuine buyer questions. Structured data supports understanding but is not a substitute for visible expertise, evidence, links, and external recognition.

---

## 15. Internal-linking system

Use this relationship model:

```text
Homepage
  -> Slide-on camper commercial hub
      -> Four slide-on product pages
      -> Guides hub
      -> Weight calculator
      -> Vehicle suitability checker

Guides hub
  -> Pillar guide
      -> Weight/payload guide
      -> Centre-of-gravity guide
      -> Legal/compliance guide
      -> Tray/fitment guide
      -> Roof/cab/comparison guides
  -> Case studies

Product page
  -> Relevant weight/fitment guide
  -> Calculator/checker
  -> Matching case study
  -> Related product comparison

Case study
  -> Exact product
  -> Exact vehicle/cab guide
  -> Relevant technical guide
```

### Linking rules

- Every priority page must have at least two contextual inbound links from other relevant pages.
- Every guide must link to the guides hub and at least two related resources.
- Every product must link to the calculator/checker and at least one technical guide.
- Every case study must link to the product and the decision issue it demonstrates.
- Do not place dozens of repetitive keyword links in footers.
- Update old pages with links to new guides when a guide is published.
- Crawl the site after every content batch to detect orphans and broken links.

---

## 16. Twelve-week delivery schedule

This schedule assumes one small delivery team. Parallelise technical, research, and writing tasks when capacity permits.

### Week 1 — Baseline and identity

- Create tracker and evidence register.
- Export Search Console, Bing, AI, analytics, reviews, and link baselines.
- Crawl the entire site and collect old URLs.
- Send Owner Questionnaire 1.
- Establish canonical entity data.
- Draft redirect map.

**Deliverable:** Baseline report, entity sheet, redirect map.

### Week 2 — Technical trust repairs

- Build `/guides/` hub.
- Add `/blog/` and individual legacy redirects/restorations.
- Consolidate organisation schema.
- Correct product availability/shipping structured data.
- Implement meaningful `publishedAt`/`updatedAt` handling.
- Configure Search Console, Bing, AI Performance, and IndexNow.
- Draft author/reviewer profiles.

**Deliverable:** Clean crawl and entity foundation.

### Week 3 — Advent 2150 and 2300

- Complete evidence audit for both products.
- Send one combined owner product-facts form.
- Upgrade both pages.
- Add FAQs, source status, transcripts, captions, author/reviewer, and internal links.

**Deliverable:** Two complete product authority pages.

### Week 4 — Advent 2450 and 7ft pop-top

- Repeat the product workflow.
- Update the comparison table using verified facts.
- Publish the editorial/corrections policy.
- Start citation corrections.

**Deliverable:** Four complete slide-on product pages.

### Week 5 — Pillar guide and first case study

- Publish Complete Guide to Slide-On Campers in Australia.
- Publish the strongest existing customer/build case study.
- Link both across the site.
- Begin media-kit preparation.

**Deliverable:** Main educational entry point and first proof page.

### Week 6 — Weight and payload

- Publish the weight/payload guide.
- Audit and improve calculator methodology, explanations, and result language.
- Create fitment worksheet.
- Start the verified weight/fitment dataset.

**Deliverable:** Citeable weight resource and downloadable tool.

### Week 7 — Centre of gravity and legal/compliance

- Obtain appropriate technical review.
- Publish centre-of-gravity guide.
- Publish legal/compliance guide using primary sources.
- Review all site-wide compliance wording against the evidence register.

**Deliverable:** Two safety-critical reviewed guides.

### Week 8 — Tray, cab, and roof decisions

- Publish tray-size/fitment guide.
- Publish single/space/dual-cab guide.
- Publish hardtop-vs-pop-top guide.
- Publish second and third case studies.

**Deliverable:** Complete vehicle-selection cluster.

### Week 9 — Ownership comparisons

- Publish slide-on vs caravan vs campervan guide.
- Publish loading/unloading guide.
- Publish mounting-system guide.
- Film missing process material if needed.

**Deliverable:** Practical ownership cluster.

### Week 10 — Systems and original data

- Publish electrical/water guide.
- Publish insurance/GVM/modification guide after review.
- Publish version 1 of the fitment index with methodology.
- Complete the media kit.

**Deliverable:** Twelve-guide library and initial original dataset.

### Week 11 — External authority campaign

- Finish priority listing corrections.
- Send the research asset to relevant publishers and clubs.
- Offer independent test access.
- Request legitimate partner/supplier case-study citations.
- Publish two more case studies.

**Deliverable:** First coordinated earned-authority campaign.

### Week 12 — Verification and next-quarter plan

- Re-crawl the site.
- Re-run schema, broken-link, page-speed, mobile, and indexability checks.
- Review Search Console and Bing coverage.
- Run the AI prompt panel.
- Compare baseline metrics.
- Identify cited and non-cited pages.
- Prepare the next 90-day backlog from observed gaps.

**Deliverable:** Verified implementation report and next-quarter priorities.

---

## 17. Quality assurance before every release

### Factual QA

- [ ] Every number has a source or is clearly labelled as an estimate/example.
- [ ] Exact vehicle variant is stated where vehicle limits are discussed.
- [ ] Dry, tare, loaded, GVM, GCM, ATM, GTM, axle, and payload terms are not confused.
- [ ] Product facts match current workshop/product records.
- [ ] Price, availability, and lead time are current.
- [ ] Qualifications and compliance claims have evidence.
- [ ] Customer permission is recorded.
- [ ] No private customer or commercial data is exposed.

### Editorial QA

- [ ] Page answers the main question in the opening section.
- [ ] Headings describe real subtopics.
- [ ] Important warnings are close to the claims they qualify.
- [ ] Commercial bias is disclosed.
- [ ] Author, reviewer, publication date, and updated date are visible.
- [ ] Sources are linked.
- [ ] Images have accurate alt text and useful captions.
- [ ] Video facts are also available in text.
- [ ] Page adds original value beyond competing results.

### Technical QA

- [ ] Page returns 200.
- [ ] Canonical URL is correct.
- [ ] Title, description, H1, and social preview are correct.
- [ ] Page is included in the sitemap if indexable.
- [ ] `lastmod` is accurate.
- [ ] Structured data matches visible content.
- [ ] Internal and external links work.
- [ ] No important content depends entirely on client-side interaction.
- [ ] Mobile layout and tables work.
- [ ] Core images are compressed and correctly sized.
- [ ] Build, automated tests, and relevant end-to-end tests pass.
- [ ] Post-deployment live status and content are verified.

### Search/AI release steps

- [ ] Add links from existing relevant pages.
- [ ] Submit the changed URL through IndexNow.
- [ ] Inspect priority URLs in Search Console.
- [ ] Record publication in the tracker.
- [ ] Check indexing and citations at 30, 60, and 90 days.

---

## 18. Measurement system

Measure authority through evidence of discovery and citation, not a single third-party `domain authority` score.

### Weekly controllable metrics

- Public URLs returning 200.
- Broken links and orphan pages.
- Pages with accurate canonical and structured data.
- Pages with verified author/reviewer/date information.
- Product fields verified versus unknown.
- Guides and case studies published.
- Old citations corrected.
- Outreach sent and replies received.

### Monthly outcome metrics

- Google organic impressions and clicks.
- Non-brand impressions and clicks.
- Number of priority queries in top 3, top 10, and top 20.
- Indexed priority pages.
- Bing AI citations.
- Unique Bing cited pages.
- Bing grounding queries.
- AI prompt-panel appearances and citations.
- Relevant referring domains and independent mentions.
- Google Business Profile views, calls, website clicks, directions, reviews, and rating.
- Organic enquiries and assisted conversions.
- Calculator completions and fitment enquiries.

### Quality targets for the first 90 days

These are delivery targets, not ranking guarantees:

- 100% of priority public pages return the intended status.
- 100% of breadcrumbs and canonical URLs are valid.
- 100% of priority pages use the canonical business identity.
- 100% of four slide-on products show the status of every critical fitment field.
- 100% of new technical guides have appropriate authorship, review, sources, and dates.
- 12 high-quality guide topics are published or substantially upgraded.
- At least 4 evidence-rich case studies are published.
- Version 1 of the fitment index and methodology is public.
- Major search-visible old business listings are corrected or actively disputed.
- Monthly Google/Bing/AI visibility tests are operating.

### AI prompt panel

Run the same prompts each month in Google AI search where available, ChatGPT Search, Bing/Copilot, Perplexity, and Claude search where available.

Core prompts:

1. What is a slide-on camper in Australia?
2. Best slide-on camper builders in Queensland.
3. Best slide-on campers in Australia.
4. Can a dual-cab ute carry a slide-on camper?
5. Best ute for a slide-on camper in Australia.
6. How do I calculate payload for a slide-on camper?
7. Does a slide-on camper count toward GVM?
8. How do rear-axle limits affect a slide-on camper?
9. Where should the centre of gravity be on a slide-on camper?
10. Hardtop vs pop-top slide-on camper.
11. Slide-on camper vs caravan for remote travel.
12. What tray size do I need for a slide-on camper?
13. How are slide-on campers attached to a ute?
14. Can a slide-on camper stand on its legs off the vehicle?
15. What does a fully loaded slide-on camper weigh?
16. Slide-on campers suitable for a space-cab ute.
17. Slide-on campers suitable for a single-cab ute.
18. Who builds Unimog camper bodies in Australia?
19. Who builds Isuzu NPS campers in Australia?
20. Queensland slide-on camper weight calculator.

For each engine and prompt, record:

- Date.
- Location/account state where relevant.
- Beyond RV mentioned: yes/no.
- Beyond RV cited: yes/no.
- Cited URL.
- Position/prominence if observable.
- Competing sources cited.
- Type of winning page.
- Factual accuracy.
- Likely content/evidence gap.
- Follow-up action.

Do not treat one answer as a stable ranking. Track trends across time and repeated tests.

---

## 19. Ongoing operating cadence after Week 12

### Every week

- Review new enquiries and chatbot questions for content gaps.
- Verify changed prices, availability, and lead times.
- Fix crawl, schema, or broken-link errors.
- Progress one guide, case study, dataset update, or external placement.

### Every month

- Publish two high-evidence case studies or guides.
- Update the fitment dataset with new verified records.
- Run the AI prompt panel.
- Review Search Console and Bing AI Performance.
- Request eligible customer reviews.
- Correct new inaccurate listings.
- Conduct one focused publisher/partner outreach batch.
- Send owners a one-page result summary with no meeting required.

### Every quarter

- Re-crawl and re-audit the site.
- Review every safety/compliance guide with the responsible reviewer.
- Refresh content only where facts or evidence have materially changed.
- Review competitors and newly cited sources.
- Retire, consolidate, or redirect weak overlapping pages.
- Select the next original research asset.

### Every year

- Publish the annual weight/fitment report.
- Reconfirm business identity, profiles, accreditations, authors, and policies.
- Audit every product's current configuration and measurements.
- Review customer permission and case-study update opportunities.
- Reassess the complete authority programme using the original baseline.

---

## 20. Owner questionnaires

These forms should be prefilled. Send only the questions that remain unresolved after the delivery team has checked the repository, public records, internal documents, and available accounts.

### Questionnaire 1 — Identity and public claims

**Target time:** 7 minutes
**Response format:** Approve, correct, unknown, or do not publish.

1. **Public brand:** Approve `Beyond RV` as the only main public spelling?
   `Approve / Correct to: ____`

2. **Legal identity:** Approve `Passion Industries Pty Ltd trading as Beyond RV Campers, ABN 45 145 189 297`?
   `Approve / Correct to: ____`

3. **Current public contact:** Approve `77 Coleyville Rd, Mutdapilly QLD 4307; 0430 863 819`?
   `Approve / Correct to: ____`

4. **Public email:** Continue using `beyondcaravans@gmail.com`, or approve creation/use of a domain address such as `sales@beyondrv.com.au`?
   `Keep Gmail / Use domain email / Correct to: ____`

5. **Manufacturing wording:** Approve this wording?
   `Beyond RV sources selected base units and components locally and internationally, then completes the specified fitout, finishing, testing, handover, warranty support, and documented local work at its Mutdapilly workshop. Each product page states the exact scope for that model.`
   `Approve / Correct / Do not publish`

6. **Experience wording:** Approve `More than ten years of relevant manufacturing and RV build experience`?
   `Approve / Correct start year or wording: ____ / Unknown`

7. **Compliance:** Upload or name the current licences, certificates, approvals, accreditations, or professionals that support public compliance claims.
   `Upload / List: ____ / None / Unknown`

8. **Public experts:** Which team members may be named as guide authors or workshop reviewers?
   `Names and roles: ____ / We will nominate later`

### Questionnaire 2 — Four slide-on product facts

**Target time:** 10 minutes
**Delivery-team rule:** Prefill all known facts and show only empty or contradictory cells. `Unknown` is a valid answer.

For each of the Advent 2150, Advent 2300, Advent 2450, and 7ft pop-top, request only:

1. Verified dry weight and what is included/excluded.
2. Typical travel-ready weight, or permission to publish a clearly labelled estimate.
3. Minimum/required tray length and width.
4. Centre-of-gravity measurement and reference point.
5. Confirmed cab/vehicle configurations known to have been fitted.
6. Sleeping capacity.
7. Fresh-water, grey-water, battery, and solar capacity where records conflict.
8. Whether the camper may be occupied while supported on its legs off the vehicle, and under what conditions.
9. Source document or person who can confirm the answers.
10. Any statement that must not be made publicly.

Recommended form layout:

| Field | Our prefilled answer | Owner response |
| --- | --- | --- |
| Dry weight | [prefilled] | Approve / correction / unknown |
| Weight definition | [prefilled] | Approve / correction / unknown |
| Typical loaded weight | [prefilled] | Approve / correction / unknown |
| Tray length × width | [prefilled] | Approve / correction / unknown |
| Centre of gravity | [prefilled] | Approve / correction / unknown |
| Known fitted vehicles | [prefilled] | Approve / correction / unknown |
| Sleeps | [prefilled] | Approve / correction / unknown |
| Water/battery/solar | [prefilled] | Approve / correction / unknown |

### Questionnaire 3 — Expert profile approval

**Target time:** 5 minutes
**Delivery-team rule:** Draft the biography first.

1. Approve this name, role, and biography?
   `Approve / Correction: ____`
2. Approve these years and areas of experience?
   `Approve / Correction: ____`
3. Approve publication of these qualifications/licences?
   `Approve / Remove / Correction: ____`
4. Which topics may this person review publicly?
   `Approve suggested list / Correction: ____`
5. Approve the selected photograph?
   `Approve / Choose another / No photograph`

### Questionnaire 4 — Case-study approval

**Target time:** 3 minutes
**Delivery-team rule:** Send the finished draft summary and selected images, not a blank form.

1. Are the build facts in the attached one-page summary accurate?
   `Approve / Corrections: ____ / Unknown`
2. Publication level:
   `Named customer / First name only / Anonymous / Do not publish`
3. Do we have customer permission to use the story and selected images?
   `Yes—evidence attached / Ask customer / No`
4. May we publish registration plates and identifiable locations?
   `Both / Plates only / Locations only / Neither`
5. Who should technically review this case?
   `Suggested reviewer approved / Change to: ____`

### Account-access request

Send one combined request. Never request passwords.

> To complete search and listing work, please add `[delivery account email]` with the minimum suitable access to Google Search Console, Google Business Profile, Bing Webmaster Tools/Bing Places, analytics, YouTube, Facebook, and Instagram. If an account is not owned or cannot be found, select `Unknown`. We will handle configuration and report back only if ownership verification needs your action.

---

## 21. Risk controls

### Safety and legal topics

- Treat vehicle suitability, payload, axle loading, mounting, modifications, gas, electrical, and road compliance as high-risk content.
- Use government, OEM, legislation, and qualified professional sources.
- Do not tell a buyer that a setup is legally suitable from a generic calculator result.
- Separate general education from a final vehicle-specific assessment.
- Preserve disclaimers, but do not use disclaimers as a substitute for accurate content.

### Commercial claims

- Define `built`, `manufactured`, `assembled`, `finished`, `fitted`, `tested`, and `certified` precisely.
- Do not imply all components are Australian-made when they are not.
- Do not claim an independent award, test, review, or accreditation without a public source.
- Keep price, availability, and stock schema synchronised with visible pages.

### Customer evidence

- Obtain permission before publishing identifiable customer information or private correspondence.
- Remove addresses, phone numbers, signatures, VINs, payment data, and contract details.
- Do not turn a private complaint into a public case study without explicit permission.
- Preserve the owner's meaning when editing testimonials.

### AI-assisted production

- AI may organise sources, draft structures, compare records, transcribe videos, and propose copy.
- A human must verify every product fact, calculation, regulated claim, source, and customer statement.
- Do not publish fabricated citations or plausible-sounding technical details.
- Record material AI assistance in the editorial workflow when disclosure would help readers understand how the content was produced.

---

## 22. Immediate first ten actions

Complete these in order:

1. Create the programme tracker and evidence register.
2. Export current Search Console, Bing, Business Profile, and analytics baselines.
3. Crawl every live URL and collect all legacy blog/product URLs.
4. Prepare and send the prefilled identity questionnaire.
5. Establish one canonical business identity record in the codebase.
6. Build the `/guides/` hub and repair its breadcrumbs/internal links.
7. Map `/blog/` and all valuable old URLs to restored pages or one-hop redirects.
8. Correct organisation, product availability, shipping, and sitemap structured signals.
9. Audit the four slide-on product records and prepare one prefilled facts table for the owners.
10. Fully upgrade the Advent 2150 page as the template for every later product and guide.

Do not start mass article production until actions 1–9 are complete. Authority grows faster when every new page inherits a clean entity, evidence, authorship, linking, and measurement system.

---

## 23. Primary reference sources

Use current versions of these sources during implementation:

- Google AI features and websites: https://developers.google.com/search/docs/appearance/ai-features
- Google helpful, reliable, people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google organisation structured data: https://developers.google.com/search/docs/appearance/structured-data/organization
- Google product structured data: https://developers.google.com/search/docs/appearance/structured-data/product
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google local ranking guidance: https://support.google.com/business/answer/7091
- OpenAI ChatGPT Search inclusion guidance: https://help.openai.com/en/articles/9237897-chatgpt-search
- OpenAI crawler documentation: https://developers.openai.com/api/docs/bots
- Bing AI Performance: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- IndexNow: https://www.indexnow.org/
- Australian Government road vehicle standards: https://www.infrastructure.gov.au/infrastructure-transport-vehicles/vehicles/road-vehicle-standards-laws
- National Heavy Vehicle Regulator: https://www.nhvr.gov.au/
- Queensland vehicle safety and transporting loads: https://www.qld.gov.au/transport/vehicle-safety
- Caravan Industry Association of Australia/RVMAP: https://www.caravanindustry.com.au/accreditation/rvmap/

Check publication dates, current legislation, and page revisions when using these sources. A link in this guide is a starting point, not permanent proof that a later claim remains current.

---

## 24. Final programme definition of done

The initial authority implementation is complete when:

- The business is represented as one consistent entity across the site and major external profiles.
- Valuable old URLs preserve their relevance through restoration or specific redirects.
- The guides hub and case-study system are live.
- All four slide-on product pages contain verified or explicitly unknown fitment data, evidence status, FAQs, authorship, review, dates, transcripts, and strong internal links.
- At least twelve distinct high-quality guide topics cover the primary Australian slide-on camper decision journey.
- At least four real build case studies demonstrate first-hand experience.
- A public fitment/weight dataset and methodology exist.
- Technical/safety content is reviewed by appropriately competent people.
- Structured data and sitemap signals are accurate.
- Search Console, Bing AI Performance, IndexNow, local listings, review workflow, and monthly AI prompt testing are operational.
- External outreach is based on original data, independent testing, and useful case studies rather than link requests.
- The delivery team can continue the programme without recurring long owner meetings.

At that point, the remaining work is sustained evidence production and independent recognition—not another technical SEO rebuild.
