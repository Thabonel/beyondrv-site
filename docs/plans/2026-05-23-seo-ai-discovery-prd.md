# PRD: SEO and AI Discovery Launch Optimisation

Date: 2026-05-23
Owner: Beyond RV
Status: Draft for implementation

## Executive summary

Beyond RV's new Astro/Netlify site has a solid SEO foundation: crawlable static pages, product routes, meta titles/descriptions, canonical tags, Open Graph tags, sitemap generation, robots.txt, LocalBusiness schema, Product schema, and FAQ schema.

The site is not yet launch-grade for best possible SEO or AI discovery. The highest-risk issues are technical and should be fixed before launch:

- Private admin routes are appearing in the generated sitemap.
- A valid product page URL conflicts with a redirect.
- The public header logo uses a 2.4 MB image.
- Legal/draft TODOs remain in public content files.
- AI discovery has no curated machine-readable business/product map.
- Product structured data is present but incomplete for rich result quality.

This PRD defines the implementation work required to make the site stronger for Google Search, Bing, ChatGPT Search, AI answer engines, and product/entity discovery.

## Research summary

### Google SEO and product discovery

Google's SEO guidance emphasises crawlable pages, useful content, canonical URLs, sitemaps, and structured data. Product pages can become eligible for richer product search experiences when Product and Offer structured data is present in the initial HTML.

Important implications for Beyond RV:

- The sitemap should contain only public, index-worthy canonical URLs.
- Admin and success pages should not be included in the sitemap.
- Product structured data should be accurate and complete.
- Product pages should focus on one specific product/model.
- Public content should answer real buyer questions clearly.

Sources:

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing

### AI discovery

OpenAI documents separate crawler controls for ChatGPT search/discovery and model training, including `OAI-SearchBot` and `GPTBot`. To maximise visibility in ChatGPT search features, sites should not block `OAI-SearchBot`.

`llms.txt` is an emerging convention for publishing a concise, machine-readable map of a website. It is not a guaranteed ranking or discovery mechanism, but it is useful as a controlled summary for AI agents and is now recognised by tooling such as Lighthouse agentic browsing guidance.

Important implications for Beyond RV:

- Robots policy should explicitly allow reputable search/discovery crawlers.
- The site should publish a clear `/llms.txt`.
- AI-readable content should include canonical product/category URLs, business identity, location, contact details, and a concise description of what the company builds.
- Public pages should use plain, factual, crawlable language rather than relying only on visual design.

Sources:

- https://platform.openai.com/docs/gptbot
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt

## Current state

### Strengths

- Astro generates static, crawlable HTML.
- `astro.config.mjs` has the canonical site URL set to `https://beyondrv.com.au`.
- `@astrojs/sitemap` generates a sitemap.
- `public/robots.txt` allows crawling and links to the sitemap.
- `BaseHead.astro` includes:
  - title
  - meta description
  - canonical
  - favicon links
  - Open Graph tags
  - Twitter card tags
  - LocalBusiness schema
- `ProductLayout.astro` includes Product schema and FAQ schema.
- Category pages use CollectionPage schema.
- Product pages generally have SEO title and description fields.

### Known issues

1. Sitemap includes non-indexable/private URLs:
   - `/admin/`
   - `/admin/analytics/`
   - `/inquiry-form/success/`

2. Redirect conflict:
   - `netlify.toml` redirects `/sunpatch-12c-couples-caravan/` to `/our-caravans/`.
   - The site also has an active `sunpatch-12c-couples-caravan` product page.

3. Public header logo performance:
   - `Header.astro` uses `/images/site/logo.png`.
   - That source file is roughly 2.4 MB.

4. Public content needs final review:
   - About page contains placeholder/TODO copy.
   - Privacy policy contains legal-review TODOs.
   - Warranty page contains legal-review TODOs.

5. Product schema is incomplete:
   - Product images are not consistently absolute URLs.
   - No product `url`.
   - No stable SKU/product ID.
   - No item condition.
   - No price validity metadata.
   - No BreadcrumbList schema.

6. AI discovery is underdeveloped:
   - No `/llms.txt`.
   - No AI-specific crawl policy notes.
   - No concise AI-readable business/product map.
   - Category/product pages could answer more natural-language buyer questions.

7. Search console setup is not yet part of the deployment checklist:
   - Google Search Console.
   - Bing Webmaster Tools.
   - Sitemap submission.
   - Rich Results Test.
   - PageSpeed Insights.

## Goals

- Remove launch-blocking SEO mistakes before domain cutover.
- Make all indexable URLs clean, canonical, and public.
- Improve product rich result eligibility.
- Improve AI answer-engine discoverability.
- Improve performance signals that affect search and conversion.
- Create a repeatable post-launch search verification checklist.

## Non-goals

- Guaranteeing rankings.
- Creating a full blog/content marketing program in this phase.
- Adding paid ads, Google Merchant Center feeds, or inventory ads.
- Rewriting every product page from scratch.
- Replacing the existing design system.

## Users

- Prospective buyer searching Google/Bing for campers, caravans, or expedition builds.
- Prospective buyer asking ChatGPT/Perplexity/Gemini for suitable camper builders.
- Beyond RV owner who needs leads from organic discovery.
- Search/AI crawler consuming structured and plain text site content.

## Implementation phases

## Phase 1: Launch-blocking technical SEO fixes

### Requirements

1. Exclude private and non-index pages from sitemap:
   - `/admin/`
   - `/admin/analytics/`
   - `/inquiry-form/success/`
   - `/404.html` if generated into sitemap in future.

2. Ensure private pages are noindex:
   - Admin page.
   - Admin analytics page.
   - Enquiry success page.
   - 404 page.

3. Fix redirect conflict:
   - Remove the `/sunpatch-12c-couples-caravan/` redirect if the product remains active.
   - Only redirect removed/sold product URLs.

4. Optimise public header logo:
   - Replace `/images/site/logo.png` usage in the public header with a small optimised image.
   - Preserve visual quality.
   - Add explicit width/height to reduce layout shift.

5. Add Netlify cache headers for static assets:
   - Long cache for fingerprinted Astro assets.
   - Long cache for images and favicons where safe.
   - Avoid long cache on HTML.

### Acceptance criteria

- Generated sitemap contains only public, index-worthy pages.
- Admin and success pages are not in sitemap.
- Active product URLs are not redirected away.
- Public header logo payload is reduced substantially.
- `npm run build` passes.
- Netlify redirect syntax remains valid.

## Phase 2: Structured data upgrade

### Requirements

1. Upgrade Product schema:
   - `@id`
   - absolute `url`
   - absolute image URL or image array
   - `brand`
   - `manufacturer` or `seller`
   - `sku` based on product slug
   - `itemCondition`
   - `offers`
   - `priceCurrency`
   - `price`
   - `availability`
   - `seller`
   - `areaServed`

2. Handle `POA` and coming-soon products correctly:
   - Do not emit invalid numeric prices.
   - For POA, include product schema without price or use a valid schema pattern that does not misrepresent price.
   - Coming-soon products should use appropriate availability such as `PreOrder` only if they genuinely accept enquiries/interest.

3. Add BreadcrumbList schema:
   - Home.
   - Category.
   - Product.

4. Improve Organization/LocalBusiness schema:
   - Add logo.
   - Add sameAs social profiles.
   - Add areaServed.
   - Add opening/viewing-by-appointment language where appropriate.

5. Add WebSite schema only once on the homepage.

### Acceptance criteria

- Product structured data is valid in Google's Rich Results Test.
- Breadcrumb schema appears on product pages.
- No invalid Product Offer price is emitted for POA products.
- LocalBusiness schema includes social and logo signals.

## Phase 3: AI discovery files and crawler policy

### Requirements

1. Add `/llms.txt`:
   - Short business summary.
   - Canonical homepage, category pages, product pages.
   - Contact details.
   - Location.
   - Product categories.
   - Important policies.
   - Public chatbot caveat: product availability and prices can change.

2. Optionally add `/llms-full.txt`:
   - More detailed page/product summaries.
   - No private/admin URLs.
   - No customer data.
   - No API keys, internal implementation notes, or private operational details.

3. Update `robots.txt`:
   - Keep general crawling allowed.
   - Explicitly allow reputable search/discovery bots where useful:
     - Googlebot
     - Bingbot
     - OAI-SearchBot
     - ChatGPT-User
     - GPTBot, if owner accepts training crawl exposure.
   - Do not block admin via robots alone; admin remains protected and noindexed.
   - Include sitemap.

4. Add an AI-discovery note to the launch checklist:
   - Verify `/robots.txt`.
   - Verify `/llms.txt`.
   - Verify no private URLs appear.

### Acceptance criteria

- `/llms.txt` is generated/public.
- `/llms.txt` contains only public, stable business facts.
- Robots file does not block ChatGPT search discovery.
- Sitemap URL remains present in robots.

## Phase 4: Content/entity improvements

### Requirements

1. Replace placeholder About page copy:
   - Workshop story.
   - Mutdapilly/Queensland location.
   - What Beyond RV actually builds.
   - Build/fitout process.
   - Trust signals.

2. Finalise legal-sensitive content:
   - Privacy policy reviewed.
   - Warranty wording reviewed.
   - Remove public TODO comments from launch content.

3. Add natural-language buyer FAQ sections:
   - Category pages.
   - Product pages.
   - Custom build page.

4. Add search-intent landing content:
   - Slide-on campers for utes.
   - Truck campers for Iveco/Isuzu/Unimog/Sprinter.
   - Off-road caravans for couples/families.
   - Expedition campers Queensland.

5. Add internal links:
   - Product pages to related category pages.
   - Category pages to relevant custom build and enquiry pages.
   - About page to product categories.
   - FAQ answers to enquiry form where appropriate.

### Acceptance criteria

- No launch content contains TODO comments.
- Category pages answer common buyer questions.
- Product pages include crawlable FAQ or practical buying guidance.
- Internal links help users and crawlers move between related pages.

## Phase 5: Performance and media optimisation

### Requirements

1. Replace oversized header logo usage.
2. Add explicit image dimensions where practical.
3. Use optimised image paths for product cards and hero images.
4. Avoid shipping unused heavy images to first viewport.
5. Confirm remote WordPress CDN images are acceptable short-term or migrate critical images locally/Blob/CDN with optimised variants.

### Acceptance criteria

- Header logo is below 50 KB.
- Key public pages pass practical PageSpeed checks after deployment.
- No obvious layout shift from header images.
- Product cards use resized/optimised image URLs.

## Phase 6: Post-launch verification

### Requirements

1. Create a launch SEO checklist covering:
   - Google Search Console property.
   - Bing Webmaster Tools property.
   - Sitemap submission.
   - Rich Results Test for representative product page.
   - PageSpeed Insights for homepage/category/product.
   - Manual robots.txt check.
   - Manual sitemap check.
   - Manual admin noindex/protection check.

2. Add owner handover notes:
   - How to check organic search visibility.
   - How to read Search Console basics.
   - What not to change in product titles/slugs without redirects.

### Acceptance criteria

- Launch checklist exists in docs.
- Owner/developer can follow the checklist without reading code.
- Search Console and Bing setup are explicitly tracked as deployment tasks.

## Technical notes

### Sitemap exclusions

Preferred approach:

- Configure `@astrojs/sitemap` with a filter to exclude admin and non-index pages.
- Keep `noIndex` meta tags as an additional signal.

### Redirects

Redirects should only be used for:

- removed products
- renamed products
- old WordPress URLs
- canonical cleanup

Redirects should not point active product URLs to category pages.

### Product schema

For products with a valid numeric price:

- Emit `Offer.price`.

For POA products:

- Emit Product schema but avoid invalid or misleading `Offer.price`.

For coming-soon products:

- Use availability carefully.
- Do not imply immediate purchase availability if only interest registration is available.

### AI discovery file

`/llms.txt` should be short, factual, and safe. It should not include:

- admin URLs
- API details
- private customer data
- unpublished product information
- internal implementation notes

## Risks

- Over-optimising product schema can create invalid rich result data if price/availability does not match the visible page.
- AI crawler policy can expose more public content to training crawlers if GPTBot is explicitly allowed. Owner should decide whether training access is acceptable; ChatGPT search discovery specifically needs `OAI-SearchBot`.
- Product image migration may create broken URLs if local and WordPress-hosted image paths are mixed incorrectly.
- Legal content should not be treated as final without owner/legal review.

## Recommended implementation order

1. Phase 1: sitemap, redirect, public logo, noindex, cache headers.
2. Phase 3: `/llms.txt` and robots policy.
3. Phase 2: Product, LocalBusiness, and Breadcrumb schema upgrades.
4. Phase 4: About/legal/FAQ content cleanup.
5. Phase 5: broader media and performance optimisation.
6. Phase 6: post-launch verification checklist.

## Definition of done

- Build passes.
- Sitemap excludes private and non-index routes.
- Active product URLs resolve directly.
- Product schema validates on representative products.
- Robots and `/llms.txt` are public and safe.
- Public header logo is optimised.
- Launch checklist exists.
- No unrelated product/content changes are included without owner approval.
