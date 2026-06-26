# Project Audit

This audit treats the codebase as the source of truth. Planning-doc wording only counts when the implementation matches it.

Note: the shop planning folder in this repo is [`docs/byondrv-shop-docs.`](./byondrv-shop-docs.), including the trailing dot.

## Duplicate / Superseded Planning

- `2026-04-17-buy-now-design.md` overlaps with `2026-04-17-buy-now-prd.md` and is now superseded by the Astro/Netlify implementation.
- `2026-05-23-seo-ai-discovery-prd.md` overlaps with `2026-06-04-google-ai-search-growth-plan.md`; the June plan is the active continuation.
- `2026-05-24-admin-editable-homepage-sections-prd.md` overlaps with `2026-05-28-owner-website-review-change-prd.md`; the review-driven doc now governs the homepage/content shape.
- `2026-05-27-buyer-confidence-improvements-prd.md`, `2026-05-28-product-youtube-video-embeds-prd.md`, and `2026-05-28-owner-website-review-change-prd.md` overlap on fitment, comparison, stock labels, and media.
- `2026-04-29-ai-admin.md`, `2026-04-29-ai-admin-design.md`, `2026-05-22-ai-admin-self-service-prd.md`, and `2026-06-06-byondrv-owner-copilot-implementation-plan.md` all cover the same admin/owner workflow from different angles.
- `docs/byondrv-shop-docs./phase-04-australia-post-shipping.md` and `docs/byondrv-shop-docs./phase-07-shipping-labels.md` overlap on shipping fulfilment; the label workflow is now implemented in code and no longer a separate planning gap.

## 2026-04-17-3d-configurator-prd.md

Overall status: Not Started

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| 3D slide-on configurator page and model | Not implemented | No matching `configurator` route or 3D function found in `src/pages` or `netlify/functions` | There is no customer-facing 3D configurator yet. |
| Upgrade catalogue / live price and weight updates | Not implemented | No matching configurator data model in `src/data` or `src/content` | No `camper-config` asset exists. |
| Deposit checkout branch for the configurator | Not implemented | No configurator checkout branch found | Current Stripe checkout is product/cart based, not configurator based. |

## 2026-04-17-buy-now-design.md

Overall status: Superseded

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Deposit / full-price purchase flow design | Superseded by implementation | `src/layouts/ProductLayout.astro`, `src/pages/cart.astro`, `netlify/functions/checkout.ts`, `netlify/functions/stripe-webhook.ts`, `src/pages/checkout/success.astro` | The design doc describes the old WordPress wrapper; the Astro/Netlify flow is now the actual system. |
| Finance calculator design | Partially implemented elsewhere | `src/pages/caravan-towing-calculator/index.astro`, `src/pages/vehicle-suitability-checker/index.astro` | The exact finance-panel design in this doc is not the current implementation path. |

## 2026-04-17-buy-now-prd.md

Overall status: Partially Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Stripe Checkout for deposit/full payment | Complete | `src/layouts/ProductLayout.astro`, `src/pages/cart.astro`, `netlify/functions/checkout.ts`, `netlify/functions/stripe-webhook.ts`, `src/pages/checkout/success.astro` | Product and cart checkout are live in code. |
| Server-side validation and checkout gating | Complete | `netlify/functions/checkout.ts`, `src/lib/checkout.ts`, `src/lib/cart.ts` | Price is rebuilt server-side and purchase eligibility is checked from trusted data. |
| Webhook-driven owner notification and receipts | Complete | `netlify/functions/stripe-webhook.ts`, `netlify/functions/session-status.ts` | Stripe receipts and owner notifications are wired. |
| Finance panel / loan calculator | Not implemented | No `Finance This Camper` UI or Yes Caravan Loans flow found in `src/pages` or `src/components` | This is the main remaining gap from the PRD. |

## 2026-04-18-executive-summary.md

Overall status: Superseded

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Phase A/B/C roadmap narrative | Superseded | `docs/PROJECT_ROADMAP.md`, current site codebase | The summary document is historical; the live roadmap now reflects actual implementation state. |
| "Just type what you want changed" admin story | Partially implemented | `src/components/AdminPanel.tsx`, `netlify/functions/admin-chat.ts`, `netlify/functions/admin-product-edit.ts` | The core admin editing promise exists, but the roadmap and dashboard now define the current operating model. |

## 2026-04-22-phase-a-prd.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Public marketing site, routes, and templates | Complete | `src/pages/index.astro`, `src/pages/our-caravans/index.astro`, `src/pages/our-slide-on-campers/index.astro`, `src/pages/expedition/index.astro`, `src/pages/about-us/index.astro` | The public Astro site exists and is built from repo content. |
| Enquiry form and delivery path | Complete | `src/pages/inquiry-form/index.astro`, `netlify/functions/contact-submit.ts`, `netlify/functions/admin-enquiries.ts` | JS form submission, backup storage, and admin backup inbox exist. |
| AI admin and chatbot surfaces | Complete | `src/components/AdminPanel.tsx`, `netlify/functions/admin-chat.ts`, `src/components/SiteChatWidget.tsx`, `netlify/functions/site-chat.ts` | The owner chat and customer chat are both present. |
| SEO scaffolding / structured data | Mostly Complete | `src/components/BaseHead.astro`, `src/layouts/ProductLayout.astro`, `public/robots.txt`, `public/llms.txt` | Core SEO is in place; launch verification remains outside the codebase. |

## 2026-04-25-phase-a-foundation.md

Overall status: Superseded

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Initial Astro + Netlify scaffolding | Complete | `astro.config.mjs`, `netlify.toml`, `src/pages/*`, `src/components/*` | The repo has moved far beyond the bootstrap plan. |
| Early redirect / robots scaffolding | Superseded | `netlify.toml`, `public/robots.txt` | The current codebase has a richer redirect, SEO, and AI-discovery setup than the foundation doc described. |

## 2026-04-29-ai-admin-design.md

Overall status: Superseded

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Chat-based admin layout and pending queue | Implemented, but doc is superseded | `src/components/AdminPanel.tsx`, `netlify/functions/admin-chat.ts`, `netlify/functions/admin-deploy.ts` | The broad design is real in code, but the later self-service and owner-copilot docs are more current. |
| No-auth / direct-to-main assumptions | Superseded | `src/components/AdminPanel.tsx`, admin auth functions | The live system now has protected admin access and a more mature workflow. |

## 2026-04-29-ai-admin.md

Overall status: Superseded

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Admin chat + deploy architecture | Implemented, but superseded | `netlify/functions/admin-chat.ts`, `netlify/functions/admin-deploy.ts`, `src/components/AdminPanel.tsx` | The implementation exists, but this plan has been overtaken by the self-service/admin-dashboard/owner-copilot work. |
| Product price, availability, and media editing | Implemented, but superseded | `src/components/AdminPanel.tsx`, `netlify/functions/admin-product-edit.ts`, `src/content/config.ts` | These capabilities now live in the current admin model. |

## 2026-05-02-chatbot-prd.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Floating site chatbot on every page | Complete | `src/components/SiteChatWidget.tsx`, `src/layouts/BaseLayout.astro` | The widget mounts globally. |
| Product-aware prompts and product catalogue grounding | Complete | `netlify/functions/site-chat.ts`, `netlify/functions/product-catalogue.json`, `src/content/products/*.md` | The chatbot is grounded in build-time product data. |
| Conversation handoff to enquiry form | Complete | `src/components/SiteChatWidget.tsx`, `src/pages/inquiry-form/index.astro` | Chat can hand off to the enquiry form with context. |

## 2026-05-22-ai-admin-self-service-prd.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Safe assisted editing and chatbot knowledge updates | Complete | `src/components/AdminPanel.tsx`, `netlify/functions/admin-chat.ts`, `netlify/functions/knowledge-rewrite.ts` | Help content, queued changes, and chatbot knowledge edits exist. |
| Guided product management and structured product fields | Mostly Complete | `src/components/AdminPanel.tsx`, `netlify/functions/admin-product-edit.ts`, `src/content/config.ts` | The structured product editor covers the shared commerce model; some hardening is still possible around edge workflows. |
| Media management / preview / publishing confidence | Partially Complete | `src/components/AdminPanel.tsx`, `netlify/functions/admin-media.ts`, `netlify/functions/admin-deploy.ts` | Media upload and previews exist, but the doc’s full confidence/rollback vision is not finished. |

## 2026-05-22-contact-form-delivery.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Netlify function delivery path | Complete | `netlify/functions/contact-submit.ts` | The enquiry form posts to the function and stores backups. |
| Resend email notification path | Complete | `netlify/functions/contact-submit.ts`, `src/components/AdminPanel.tsx` | Contact delivery is wired to email plus backup storage. |
| Admin enquiries backup inbox | Complete | `netlify/functions/admin-enquiries.ts`, `src/components/AdminPanel.tsx` | The owner can review recent enquiries in admin. |

## 2026-05-23-admin-business-intelligence-prd.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Admin dashboard home / readiness checks | Complete | `src/components/AdminDashboard.tsx`, `netlify/functions/admin-dashboard.ts` | The dashboard is the first admin view and includes operational readiness. |
| Lead follow-up queue and lead statuses | Mostly Complete | `netlify/functions/admin-lead-status.ts`, `src/components/AdminPanel.tsx`, `netlify/functions/admin-dashboard.ts` | Lead status, notes, and follow-up dates are implemented. |
| Product performance / traffic / funnel analysis | Mostly Complete | `src/components/AdminDashboard.tsx`, `netlify/functions/admin-dashboard.ts`, `src/components/AnalyticsDashboard.tsx` | Product, traffic, and funnel intelligence exists; it still depends on live analytics data. |

## 2026-05-23-seo-ai-discovery-prd.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Sitemap, robots, noindex, and canonical SEO fixes | Complete | `public/robots.txt`, `src/components/BaseHead.astro`, `netlify.toml`, `docs/SEO-LAUNCH-CHECKLIST.md` | Private and non-index pages are handled in code. |
| Product / breadcrumb / local business schema | Mostly Complete | `src/layouts/ProductLayout.astro`, `src/components/BaseHead.astro`, `src/pages/index.astro` | Rich schema exists, but it still benefits from ongoing validation and crawl refresh. |
| AI discovery files and crawler policy | Complete | `public/llms.txt`, `public/llms-full.txt`, `public/robots.txt` | Public AI discovery files are in place. |
| Public content cleanup | Complete | `src/pages/about-us/index.astro`, `src/pages/privacy-policy/index.astro`, `src/pages/warranty/index.astro` | No public TODOs were found in the current page files. |

## 2026-05-24-admin-editable-homepage-sections-prd.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Recent builds data file and homepage rendering | Complete | `src/data/homepage/recent-builds.json`, `src/pages/index.astro` | The homepage pulls recent builds from JSON. |
| Testimonials data file and homepage rendering | Complete | `src/data/homepage/testimonials.json`, `src/pages/index.astro` | Testimonials are data-driven instead of hardcoded. |
| Admin homepage editor | Complete | `src/components/AdminPanel.tsx`, `docs/PROJECT_ROADMAP.md` | The admin has a Homepage tab with queued JSON updates. |

## 2026-05-27-buyer-confidence-improvements-prd.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Vehicle fit check / suitability guidance | Complete | `src/pages/inquiry-form/index.astro`, `netlify/functions/contact-submit.ts`, `src/components/AdminPanel.tsx`, `src/layouts/ProductLayout.astro` | Fitment details are captured and shown in admin and public flows. |
| Comparison table for slide-ons / caravans / expedition products | Complete | `src/components/ProductComparisonTable.astro`, `src/pages/our-slide-on-campers/index.astro`, `src/pages/our-caravans/index.astro`, `src/pages/expedition/index.astro` | The comparison table is in the site. |
| Stock / source / payload labels | Complete | `src/lib/shop.ts`, `src/components/ProductCard.astro`, `src/components/ShopProductCard.astro`, `src/layouts/ProductLayout.astro`, `src/pages/shop/[slug].astro` | Consistent stock and source labels are implemented. |
| Floorplans and walkthrough videos | Mostly Complete | `src/content/config.ts`, `src/layouts/ProductLayout.astro`, `src/components/AdminPanel.tsx` | Video embeds are implemented; floorplan coverage is content-dependent. |

## 2026-05-28-owner-website-review-change-prd.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Homepage range-card/image updates | Complete | `src/pages/index.astro`, `src/components/AdminPanel.tsx` | The homepage uses the reviewed range layout and images. |
| Revised product ordering and prices | Complete | `src/pages/our-caravans/index.astro`, `src/pages/our-slide-on-campers/index.astro`, `src/pages/expedition/index.astro`, `src/content/products/*.md` | Product ordering and pricing reflect the owner-reviewed structure. |
| Optional extras / gallery ordering / spec layout changes | Complete | `src/content/products/*.md`, `src/layouts/ProductLayout.astro`, `src/components/AdminPanel.tsx` | The reviewed product-structure changes are now in code. |

## 2026-05-28-product-youtube-video-embeds-prd.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| YouTube video frontmatter / schema support | Complete | `src/content/config.ts`, `src/layouts/ProductLayout.astro`, `src/content/products/*.md` | `youtubeVideo` is part of the content model. |
| Embedded video section on product pages | Complete | `src/layouts/ProductLayout.astro`, `src/styles/global.css` | Product pages render privacy-enhanced embeds when present. |
| Admin product video editing | Complete | `src/components/AdminPanel.tsx`, `netlify/functions/admin-product-edit.ts` | Admin can paste a URL and queue the metadata. |

## 2026-06-04-google-ai-search-growth-plan.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Search console / Bing / crawler measurement setup | Partially Complete | `docs/SEO-LAUNCH-CHECKLIST.md`, `src/components/AnalyticsDashboard.tsx`, `netlify/functions/seo-data.ts` | The checklists and dashboards exist, but the external properties still need confirmation. |
| Sitemap freshness / `lastmod` / recrawl work | Mostly Complete | `astro.config.mjs`, `netlify/functions/seo-data.ts`, `src/components/AnalyticsDashboard.tsx`, `dist/sitemap-0.xml` | The build emits `lastmod`; the remaining work is live-domain recrawl and launch checklist follow-through. |
| Expanded guide / authority content | Partially Complete | `src/pages/guides/*`, `src/pages/vehicle-suitability-checker/index.astro`, `src/pages/caravan-towing-calculator/index.astro` | Some guide content exists; the broader growth plan still has active content/local-authority work. |
| Local SEO / brand consistency / off-site authority | Partially Complete | `src/pages/index.astro`, `src/pages/about-us/index.astro`, `docs/plans/2026-06-04-google-ai-search-growth-plan.md` | This work is mostly outside code but still active. |

## 2026-06-06-byondrv-owner-copilot-implementation-plan.md

Overall status: Partially Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Customer / lead / task / timeline core | Mostly Complete | `netlify/functions/owner-copilot-core.ts`, `netlify/functions/owner-copilot-record-sync.ts`, `netlify/functions/admin-owner-copilot-records.ts`, `netlify/functions/admin-owner-copilot-tasks.ts`, `netlify/functions/admin-owner-copilot-timeline.ts` | The underlying stores and admin surfaces exist. |
| Lead intelligence and dashboard summaries | Mostly Complete | `netlify/functions/admin-dashboard.ts`, `src/components/AdminDashboard.tsx`, `netlify/functions/admin-lead-status.ts` | Lead status and task visibility are in place. |
| Gmail / Drive matching and OAuth scaffolding | Partially Complete | `netlify/functions/google-oauth-core.ts`, `netlify/functions/google-gmail-sync.ts`, `netlify/functions/google-drive-sync.ts`, `netlify/functions/admin-gmail-matches.ts`, `netlify/functions/admin-drive-matches.ts` | The scaffolding exists, but the plan’s later automation phases are not finished. |
| Full owner copilot workflow | Partially Complete | `src/components/AdminPanel.tsx`, `netlify/functions/admin-owner-copilot-ai-actions.ts`, `netlify/functions/admin-weekly-report.ts` | The owner-facing workflow is strong, but not all planned automation is complete. |

## 2026-06-25-sms-contracts-prd.md

Overall status: Not Started

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Inbound SMS / MMS webhook | Not implemented | No `sms-webhook.ts` found in `netlify/functions` | There is no SMS ingress path yet. |
| Contract package generation and addenda | Not implemented | No `contract-*` functions or `deal-guardian` route found | Contract generation is still a future phase. |
| SMS-driven contract intelligence / approval trail | Not implemented | No matching SMS/contract UI or workflow found | Existing owner-copilot foundations are adjacent but not the same thing. |

## docs/byondrv-shop-docs./README.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Phase ordering and commercial model | Mostly Complete | `docs/PROJECT_ROADMAP.md`, `src/content/config.ts`, `src/lib/checkout.ts` | The shop stack now matches most of the README’s intended order. |
| Product catalogue / cart / Stripe checkout | Complete | `src/pages/shop/index.astro`, `src/pages/cart.astro`, `netlify/functions/checkout.ts` | The first three shop phases are implemented. |
| Shipping / order / inventory / shipping labels / AI assistant | Partially Complete | `netlify/functions/shipping-quote.ts`, `netlify/functions/admin-orders.ts`, `netlify/functions/admin-shipping-label.ts`, `netlify/functions/shipping-label-core.ts`, `src/components/AdminDashboard.tsx` | Shipping labels and tracking are implemented; order, inventory, and AI phases still have remaining work. |

## docs/byondrv-shop-docs./phase-01-product-catalogue.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Product catalogue pages and content collection | Complete | `src/content/products/*.md`, `src/pages/shop/index.astro`, `src/pages/shop/[slug].astro` | The product catalogue exists and builds. |

## docs/byondrv-shop-docs./phase-02-cart.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Cart storage and cart page | Complete | `src/lib/cart.ts`, `src/pages/cart.astro` | Cart support is live. |

## docs/byondrv-shop-docs./phase-03-stripe-checkout.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Product/cart checkout requests | Complete | `src/layouts/ProductLayout.astro`, `src/pages/cart.astro`, `src/lib/checkout.ts`, `netlify/functions/checkout.ts` | Checkout is implemented for product and cart flows. |
| Stripe webhook handling and confirmation page | Complete | `netlify/functions/stripe-webhook.ts`, `netlify/functions/session-status.ts`, `src/pages/checkout/success.astro` | Webhook verification, receipt handling, and success-page confirmation exist. |

## docs/byondrv-shop-docs./phase-04-australia-post-shipping.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Shipping quote calculation | Complete | `netlify/functions/shipping-quote.ts`, `src/lib/shipping.ts`, `src/pages/cart.astro` | Shipping estimates are present. |
| Label creation and shipping workflow | Superseded by later implementation | `netlify/functions/admin-shipping-label.ts`, `netlify/functions/shipping-label-core.ts`, `src/components/AdminPanel.tsx` | The quote phase stayed focused on rate calculation; shipping-label management was implemented later as a separate workflow. |

## docs/byondrv-shop-docs./phase-05-order-management.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Stripe order storage and admin order list/detail | Mostly Complete | `netlify/functions/admin-orders.ts`, `netlify/functions/stripe-webhook.ts`, `src/components/AdminPanel.tsx` | Paid Stripe sessions now auto-create persistent orders and the admin can still edit them manually. |
| Order statuses, notes, and follow-up fields | Mostly Complete | `netlify/functions/admin-orders.ts`, `src/components/AdminPanel.tsx`, `netlify/functions/admin-dashboard.ts`, `src/components/AdminDashboard.tsx` | Status, notes, follow-up data, Stripe payment metadata, and recent order visibility now exist. |
| Demand signals / combined order intelligence | Partially Complete | `netlify/functions/admin-dashboard.ts`, `src/components/AdminDashboard.tsx`, `src/components/AdminPanel.tsx` | Orders and enquiries are both visible in admin, but they still sit in separate stores rather than a single unified timeline. |

## docs/byondrv-shop-docs./phase-06-inventory-control.md

Overall status: Mostly Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Public pricing / availability / source / lead-time fields | Complete | `src/content/config.ts`, `netlify/functions/admin-product-edit.ts`, `src/components/AdminPanel.tsx` | The shared commerce model is in the content schema and admin UI. |
| Private stock-planning fields | Complete | `src/content/config.ts`, `netlify/functions/admin-product-edit.ts`, `src/components/AdminPanel.tsx` | Internal planning fields are present in code. |
| Demand history / reorder planning / container views | Mostly Complete | `netlify/functions/admin-dashboard.ts`, `src/components/AdminDashboard.tsx`, `netlify/functions/admin-product-edit.ts` | The dashboard now shows planning signals, but it is still a planning view rather than a closed-loop inventory system. |

## docs/byondrv-shop-docs./phase-07-shipping-labels.md

Overall status: Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Shipping label generation | Complete | `netlify/functions/admin-shipping-label.ts`, `netlify/functions/shipping-label-core.ts`, `src/components/AdminPanel.tsx` | Staff can create labels for eligible orders, including Australia Post and Brisbane ute delivery paths. |
| Download / print / tracking workflow | Complete | `netlify/functions/admin-shipping-label.ts`, `src/components/AdminPanel.tsx` | Printable label output and tracking/reference fields are stored on the order. |

## docs/byondrv-shop-docs./phase-08-ai-shop-assistant.md

Overall status: Partially Complete

| Feature | Status | Evidence (files) | Notes |
| --- | --- | --- | --- |
| Dashboard-driven product/traffic intelligence | Mostly Complete | `src/components/AdminDashboard.tsx`, `netlify/functions/admin-dashboard.ts` | The admin can already surface a lot of useful signals. |
| AI stock / container recommendations | Partially Complete | `netlify/functions/admin-weekly-report.ts`, `netlify/functions/admin-dashboard.ts` | Recommendation scaffolding exists, but the full AI shop assistant is not done. |
| Approval workflow for recommendations | Not complete | `src/components/AdminPanel.tsx`, `netlify/functions/admin-owner-copilot-ai-actions.ts` | There are owner-copilot approval patterns, but not a dedicated shop-assistant workflow. |
