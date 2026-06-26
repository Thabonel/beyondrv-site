# Google and AI Search Growth Plan

Date: 2026-06-04
Owner: Beyond RV
Status: Active plan

## Objective

Get the new Beyond RV website as visible as possible in Google Search, Google AI Overviews/AI Mode, ChatGPT Search, Bing/Copilot, Perplexity, and other AI answer engines.

This plan does not assume rankings can be guaranteed. The working strategy is to build the strongest possible foundation for organic search and AI citation: crawlable pages, clean technical SEO, fresh product data, high-quality buyer guidance, local authority, external mentions, and ongoing measurement.

## Current state

### Strengths

- The site is built with Astro and outputs static, crawlable HTML.
- `robots.txt` allows Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, and GPTBot.
- The live site publishes `sitemap-index.xml`, `sitemap-0.xml`, `robots.txt`, `llms.txt`, and `llms-full.txt`.
- Product pages include Product, Offer, Breadcrumb, FAQ, and VideoObject schema where data is available.
- Category pages include CollectionPage and FAQ schema.
- The site has useful buyer-intent pages already:
  - Slide-on campers
  - Off-road caravans
  - Expedition vehicles
  - Custom builds
  - Vehicle suitability checker
  - Slide-on camper weight calculator
  - Caravan towing calculator
  - GVM/GCM/ATM/GTM guide
  - Best utes for slide-on campers guide
- Google has indexed the domain and multiple product/category pages.

### Gaps and risks

- Google snippets still show older copy in some results, suggesting recrawl and snippet refresh work is needed.
- The sitemap contains URLs but no `lastmod` values.
- AI crawler policy does not yet explicitly mention Claude or Perplexity search crawlers.
- Brand wording is inconsistent across existing content: `Beyond RV`, `BeyondRV`, and `ByondRV`.
- Some pages need more plain-text explanation for AI answer extraction.
- Product pages need stronger "best for", "vehicle suitability", comparison, proof, and transcript sections.
- Local SEO authority depends heavily on Google Business Profile, reviews, citations, and local mentions; these are not fully tracked in the repo.
- Off-site authority is likely the largest ranking constraint after technical fixes.

## Research summary

### Google Search and Google AI features

Google says AI Overviews and AI Mode use the same core SEO foundations as regular Search. Pages must be crawlable, indexed, eligible for snippets, internally linked, useful to people, supported by high-quality images/videos, and backed by structured data that matches visible page content. Google also says no special AI schema or AI-specific machine-readable file is required for Google AI features.

Sources:

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content

### Bing and Copilot

Bing has introduced AI Performance reporting in Bing Webmaster Tools. It shows AI citation counts, cited URLs, grounding query phrases, page-level citation activity, and visibility trends. This is directly useful for measuring whether Beyond RV pages are being used in Microsoft AI answers.

Sources:

- https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- https://blogs.bing.com/search/April-2025/Introducing-Copilot-Search-in-Bing

### ChatGPT Search and OpenAI

OpenAI documentation says ChatGPT Search may rewrite user prompts into one or more targeted web queries. To be included, the site should allow `OAI-SearchBot` to crawl and should not block OpenAI crawler IP access at the host or CDN layer.

Source:

- https://help.openai.com/en/articles/9237897-chatgpt-search

### Generative Engine Optimization research

The GEO research literature shows AI answer visibility can improve when content is structured, factual, complete, easy to cite, and supported with evidence. Results vary by engine and domain, so this plan treats AI visibility as something to test and monitor, not something to assume.

Source:

- https://arxiv.org/abs/2311.09735

### Local ranking

Google describes local results as mainly based on relevance, distance, and prominence. For Beyond RV, the controllable levers are business profile completeness, consistent name/address/phone details, reviews, photos, product/service descriptions, and local/off-road industry mentions.

Source:

- https://support.google.com/business/answer/7091

## Strategy

The strategy has five connected tracks:

1. Technical search foundation
2. Product and category page quality
3. Buyer-guide content clusters
4. Local and off-site authority
5. Measurement and daily improvement loop

## Phase 1: First 7 days

### Measurement setup

- Confirm Google Search Console is verified.
- Submit `https://beyondrv.com.au/sitemap-index.xml` in Search Console.
- Confirm Bing Webmaster Tools is verified.
- Submit sitemap in Bing Webmaster Tools.
- Enable and review Bing AI Performance when available.
- Confirm Google Business Profile ownership.
- Confirm Bing Places ownership.
- Set up or verify analytics events for:
  - Enquiry form submit
  - Product enquiry click
  - Buy-now/enquire intent click
  - Phone tap
  - Email click
  - Chat lead
  - Calculator completed
  - Calculator result sent/submitted

### Crawl and freshness fixes

- Add `lastmod` values to generated sitemap entries.
- Request recrawl for:
  - Home
  - `/our-slide-on-campers/`
  - `/our-caravans/`
  - `/expedition/`
  - `/custom/`
  - `/on-sale/`
  - `/vehicle-suitability-checker/`
  - `/slide-on-camper-weight-calculator/`
  - `/caravan-towing-calculator/`
  - Top product URLs
- Verify old URLs redirect correctly and are not still being treated as primary pages:
  - `/15-ft/`
  - `/12-ft/`
  - `/4-7m-truck-camper/`
  - `/expedition/isuzu-nps-cabover-camper/`
  - `/expedition/isuzu-nps-poptop-camper/`

### AI crawler policy

- Keep `OAI-SearchBot`, `ChatGPT-User`, and `GPTBot` allowed.
- Add explicit allow rules for reputable AI search crawlers if the business wants maximum AI answer visibility:
  - `Claude-SearchBot`
  - `Claude-User`
  - `PerplexityBot`
- Verify Netlify, firewall, or CDN rules do not block these crawlers.
- Keep `llms.txt` concise and update `llms-full.txt` when major pages/products change.

### Brand consistency

- Decide the public brand spelling:
  - Recommended: `Beyond RV`
- Replace inconsistent public references to `ByondRV` or `BeyondRV` where they are not intentional.
- Keep `Beyond Caravans` as an alternate name where historically useful.

### Local SEO

- Update Google Business Profile with:
  - Correct name, address, phone, website, and hours
  - Workshop viewings by appointment
  - Product/service categories
  - Recent product photos
  - Workshop photos
  - Current product posts
- Update Bing Places with the same information.
- Start a customer review request process after each handover.
- Ask customers to naturally mention the product/use case where appropriate, for example slide-on camper, truck camper, off-road caravan, Unimog camper, or Queensland-built camper.

## Phase 2: Weeks 2-4

### Core commercial pages

Create or upgrade pages targeting high-intent searches:

- Slide-On Campers Australia
- Slide-On Campers Queensland
- Ute Slide-On Campers
- Truck Campers Australia
- Isuzu NPS Camper Builds
- Unimog Camper Bodies
- Off-Road Caravans Queensland
- Custom Camper Bodies
- Composite Camper Construction
- GVM, GCM, ATM, GTM and Payload Guides

Each page should include:

- Direct answer in the first 100 words.
- Clear H1/H2 hierarchy.
- Comparison tables.
- Product links with descriptive anchor text.
- FAQs based on real buyer questions.
- Real images with descriptive alt text and captions.
- Relevant videos or video summaries.
- Last updated date.
- Workshop/team review note where appropriate.
- Links to authoritative sources for weight, compliance, towing, or vehicle safety topics.

### Internal linking

- Link every relevant product page to its matching guide/calculator.
- Link every guide back to the most relevant product/category pages.
- Use specific anchor text such as `Advent 2150 hardtop ute slide-on camper`, not generic `click here`.
- Add contextual links from homepage/category pages to the strongest guides.

## Phase 3: Product page upgrades

For every product page, add or verify:

- Short summary: what it is, who it suits, where it is built.
- `Best for` section.
- `Not ideal for` section.
- Vehicle suitability notes.
- Weight, payload, tray, tow, or platform assumptions.
- Specification summary table above long accordions.
- Image captions and descriptive alt text.
- Walkthrough video summary or transcript summary in visible text.
- Current price/availability and matching Product/Offer schema.
- FAQs that answer real pre-sale questions.
- Links to related calculators and guides.
- Clear enquiry CTA.

High-priority products:

- Advent 2150 Hardtop Ute Slide-On Camper
- Advent 2300 Hardtop Ute Slide-On Camper
- Advent 2450 Hardtop Ute Slide-On Camper
- 7ft Electric Pop-Top Slide-On Camper
- 4.7m Hardtop Truck Camper
- 3.5m Electric Pop-Top Cabover Family Camper
- Unimog Overlander Camper
- Mercedes Sprinter AWD LWB Cab Chassis Motorhome
- Sunpatch 12C Couples Off-Road Van
- Sunpatch 15-XC Couples Off-Road Van

## Phase 4: Authority and links

### Build case studies

Publish two case studies per month. Each should include:

- Vehicle platform
- Customer use case
- Problem solved
- Build specs
- Photos
- Video where available
- Workshop notes
- Product/category links

Priority case study themes:

- Unimog overlander build
- Isuzu NPS family camper
- Ute slide-on camper for space cab
- Compact off-road couples caravan
- Custom camper body for remote touring

### External authority

- Pitch Australian 4x4, caravan, touring, camping, and overlanding publishers.
- Seek legitimate supplier/partner links.
- Ensure directory listings are accurate and consistent.
- Keep Facebook, Instagram, and YouTube profiles consistent with the website.
- Publish YouTube walkthroughs for every major product and link back to product pages.
- Encourage customer photos/testimonials where approved.

## Phase 5: AI search monitoring

Run the same prompt set monthly across Google AI search, ChatGPT Search, Bing/Copilot, Perplexity, and Claude Search where available.

Track:

- Whether Beyond RV appears.
- Whether Beyond RV is cited.
- Which URL is cited.
- Which competitors are cited.
- Which source type wins: product page, guide, YouTube, review, directory, forum, or publisher article.
- What content gap likely caused the competitor to win.

Suggested prompts:

- Best slide-on camper builders in Queensland
- Best slide-on campers Australia
- Who builds Unimog camper bodies in Australia?
- Who builds Isuzu NPS camper bodies in Australia?
- Best ute slide-on campers for Australian touring
- Can a dual cab ute carry a slide-on camper?
- Slide-on camper vs off-road caravan
- Best truck campers for remote travel Australia
- Queensland off-road caravan manufacturers
- Custom camper body builders Australia

## Success metrics

### Search visibility

- Google Search Console impressions.
- Google Search Console clicks.
- Average position for priority queries.
- Indexed page count.
- Pages with valid rich results.

### AI visibility

- Bing AI Performance citation count.
- Bing cited URLs.
- Bing grounding queries.
- Manual AI prompt test appearances.
- Manual AI prompt test citations.

### Local visibility

- Google Business Profile views.
- Calls from Business Profile.
- Direction requests.
- Website clicks.
- Review count.
- Review rating.
- Photo views.

### Business outcomes

- Organic enquiry count.
- Organic phone enquiries.
- Product-specific enquiries.
- Calculator completions.
- Chat leads.
- Lead-to-sale conversion where trackable.

## Operating rhythm

### Daily

- Update the daily progress report.
- Check Search Console/Bing if there were recent deployments.
- Record completed SEO/content/authority actions.
- Record blockers and next actions.

### Weekly

- Review Search Console query movement.
- Review Bing AI Performance if available.
- Review Google Business Profile performance.
- Publish or improve at least one page.
- Add or request at least one authority/review/citation action.

### Monthly

- Run AI prompt visibility tests.
- Review highest-impression, low-click pages.
- Review pages with declining rankings.
- Refresh priority product availability/pricing.
- Publish at least two build case studies.
- Update `llms.txt` and `llms-full.txt` if product/category facts changed.

## Immediate recommended next action

Start with the technical/freshness fixes, then build or upgrade a strong `Slide-On Campers Queensland` pillar page. That page is the best first commercial target because it matches the business location, main product line, and buyer intent.
