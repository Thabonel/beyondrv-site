# PRD: Product YouTube Video Embeds

Date: 2026-05-28
Owner: Beyond RV
Status: Draft for client review

## Executive Summary

Beyond RV should add an embedded YouTube walkthrough video to each product page where a suitable video exists. The video should play inside the website so buyers can watch the walkthrough without leaving the product page.

This is a buyer-confidence and SEO improvement. Walkthrough videos help customers understand layout, finish, proportions, storage, access, and fitment details that static photos cannot show. They also create stronger signals for Google video search and AI-assisted discovery when paired with clear product content and `VideoObject` structured data.

The site already has a strong product-page template, image galleries, product schema, FAQ schema, and YouTube social links. The next step is to make video a first-class product content field.

## Problem

Product pages currently rely on photos, short copy, specs, features, and optional FAQs. This works for basic browsing, but serious buyers often need to see the product in motion before enquiring.

Common buyer questions that video can answer better than static content include:

- What does the camper look like at real scale?
- How does the roof, door, kitchen, storage, bathroom, or bed area work?
- How much room is inside?
- What does the finish look like close up?
- What vehicle or tray setup is shown?
- Is this a real build or just a listing?
- Can I trust the product enough to enquire?

Without embedded video, buyers may leave the site to check YouTube, social media, or competitor content. Some may not return to complete an enquiry.

## Goals

- Add one optional YouTube video to each product page.
- Let customers watch the video inside the Beyond RV site.
- Keep page performance acceptable by lazy-loading the embed.
- Use privacy-enhanced YouTube embeds where practical.
- Add video structured data for eligible product videos.
- Make video fields maintainable through product markdown/frontmatter.
- Avoid breaking existing product pages that do not yet have a video.
- Support future admin editing of product video fields.
- Improve buyer confidence and time on product page.

## Non-Goals

- Hosting video files directly on the Beyond RV server.
- Building a custom video player.
- Removing all YouTube branding or controls.
- Preventing every possible off-site YouTube click.
- Autoplaying product videos.
- Replacing product images or written specifications.
- Creating the actual video content.
- Guaranteeing Google video-rich results.
- Building a full YouTube API integration in the first phase.

## Users

- Prospective buyer: wants to see the camper or caravan before enquiring.
- Mobile buyer: wants a quick walkthrough without opening another app.
- Business owner: wants more qualified enquiries and stronger product trust.
- Site admin/operator: needs a simple way to attach or change a product video.
- Google and AI crawlers: need clear video metadata connected to the product page.

## Current State

The current site includes:

- Product markdown files in `src/content/products`.
- Product schema and Offer data in `src/layouts/ProductLayout.astro`.
- Product page hero gallery and thumbnails.
- Product specs, features, FAQ, and enquiry CTA sections.
- Social YouTube links in schema and footer.
- Analytics dashboard that already recognises YouTube campaign traffic.
- Cookie consent for PostHog analytics.

Known gaps:

- No product-level video field.
- No embedded video section on product pages.
- No `VideoObject` schema for product videos.
- No admin UI field for YouTube video ID/title/description.
- No video transcript or summary field for AI/search context.

## Proposed Solution

Add an optional `youtubeVideo` object to product content. When present, the product page renders an embedded YouTube player in a dedicated product video section and emits matching `VideoObject` structured data.

Use YouTube's privacy-enhanced embed domain:

```txt
https://www.youtube-nocookie.com/embed/{VIDEO_ID}?rel=0&playsinline=1
```

This keeps playback on the product page while limiting personalised YouTube behaviour. The `rel=0` parameter cannot fully remove related videos, but current YouTube behaviour limits related videos to the same channel where possible.

## Product Requirements

### 1. Product Content Model

Extend the product collection schema in `src/content/config.ts`.

Suggested field:

```ts
youtubeVideo: z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  uploadDate: z.string().optional(),
  duration: z.string().optional(),
  transcriptSummary: z.string().optional(),
}).optional(),
```

Field notes:

- `id` is the YouTube video ID only, not the full URL.
- `title` should be human-readable and product-specific.
- `description` should describe what the buyer will see.
- `thumbnail` should use a stable YouTube thumbnail URL or uploaded site image.
- `uploadDate` should use ISO date format, for example `2026-05-28`.
- `duration` should use ISO 8601 duration format if provided, for example `PT6M32S`.
- `transcriptSummary` is optional text for search, chatbot, and AI-answer context.

Example product frontmatter:

```yaml
youtubeVideo:
  id: "abc123XYZ"
  title: "Advent 2150 Hardtop Slide-On Walkthrough"
  description: "A walkthrough of the Beyond RV Advent 2150 hardtop slide-on camper, including exterior, interior, kitchen, storage, and off-grid setup."
  thumbnail: "https://i.ytimg.com/vi/abc123XYZ/maxresdefault.jpg"
  uploadDate: "2026-05-28"
  duration: "PT5M42S"
  transcriptSummary: "Shows the Advent 2150 hardtop slide-on, full composite body, compact 2,150mm base length, interior layout, storage, kitchen, sleeping area, and 200Ah lithium setup."
```

Acceptance criteria:

- Product files without `youtubeVideo` still build.
- Invalid product frontmatter fails clearly during build.
- Existing product fields keep working unchanged.

### 2. Product Page Video Section

Render a product video section on product detail pages when `data.youtubeVideo` exists.

Suggested placement:

- After the main product description.
- Before specifications and optional extras.

Suggested heading:

```txt
Watch the walkthrough
```

Suggested layout:

- Full-width section within the existing product content container.
- 16:9 responsive iframe.
- Product-specific title above or below the player.
- Optional short description or transcript summary.
- CTA below the video: `Enquire about this build`.

Suggested iframe:

```html
<iframe
  src="https://www.youtube-nocookie.com/embed/VIDEO_ID?rel=0&playsinline=1"
  title="Product walkthrough video"
  loading="lazy"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>
```

Acceptance criteria:

- Video plays inline inside the product page.
- Iframe is lazy-loaded.
- Iframe has an accessible title.
- Mobile layout is responsive and does not overflow.
- The section is omitted entirely when no video exists.
- The video section does not push the enquiry CTA too far down on mobile without another CTA nearby.

### 3. Video Structured Data

When a product has `youtubeVideo`, add `VideoObject` schema to the structured data array in `ProductLayout.astro`.

Suggested schema:

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "@id": "https://beyondrv.com.au/product-slug/#video",
  "name": "Advent 2150 Hardtop Slide-On Walkthrough",
  "description": "A walkthrough of the Beyond RV Advent 2150 hardtop slide-on camper.",
  "thumbnailUrl": "https://i.ytimg.com/vi/abc123XYZ/maxresdefault.jpg",
  "uploadDate": "2026-05-28",
  "duration": "PT5M42S",
  "embedUrl": "https://www.youtube-nocookie.com/embed/abc123XYZ",
  "contentUrl": "https://www.youtube.com/watch?v=abc123XYZ",
  "publisher": {
    "@type": "Organization",
    "name": "Beyond RV",
    "logo": {
      "@type": "ImageObject",
      "url": "https://beyondrv.com.au/images/site/admin-logo.png"
    }
  }
}
```

Acceptance criteria:

- `VideoObject` is emitted only when video data exists.
- Required Google fields are populated where possible.
- Schema content matches visible page content.
- Build output contains Product, Breadcrumb, optional FAQ, optional VideoObject, and LocalBusiness schema.

### 4. Video SEO and YouTube Publishing Rules

Each YouTube video should be published in a way that supports both YouTube discovery and product-page SEO.

Recommended YouTube title format:

```txt
Beyond RV Advent 2150 Hardtop Slide-On Walkthrough | Queensland Slide-On Camper
```

Recommended YouTube description:

- First sentence should name the exact product and Beyond RV.
- Include a link to the matching product page.
- Include a link to the enquiry form.
- Add key specs and vehicle suitability caveats.
- Add chapters/timestamps where useful.
- Mention location: Mutdapilly, Queensland, Australia.

Recommended chapters:

```txt
00:00 Overview
00:30 Exterior and construction
01:30 Interior layout
02:30 Kitchen and storage
03:30 Power and off-grid setup
04:30 Who this model suits
05:15 How to enquire
```

Acceptance criteria:

- Each embedded video has a public or unlisted YouTube URL with embedding allowed.
- Video title and product page title are aligned.
- YouTube description links back to the matching Beyond RV product page.
- Video is not set to private.
- Embedding is enabled in YouTube Studio.

### 5. Admin Product Video Management

Phase 1 can be content-file only. Phase 2 should expose product video fields in the admin page for both existing products and new product drafts.

The admin must be able to paste a YouTube URL when editing a current product page and when adding a new product. The system should extract the video ID and store clean structured metadata in the product markdown frontmatter.

Existing product edit fields:

- YouTube video URL.
- YouTube video ID, auto-filled or derived from the URL.
- Video title.
- Video description.
- Thumbnail URL.
- Upload date.
- Duration.
- Transcript summary.

New product draft fields:

- YouTube video URL.
- YouTube video title.
- Video description.
- Thumbnail URL.
- Upload date.
- Duration.
- Transcript summary.

Admin behaviour:

- Add the video fields to the existing product edit form in the admin Products tab.
- Add the video fields to the Add Product Draft form in the admin Products tab.
- Accept normal YouTube watch URLs, shortened `youtu.be` URLs, Shorts URLs, and embed URLs where practical.
- Extract the video ID automatically when a full URL is pasted.
- Store only the clean video ID in product frontmatter.
- Store the remaining fields under `youtubeVideo`.
- Preview the thumbnail or embedded video before queueing changes.
- Validate obvious invalid IDs before saving.
- Allow a product to have no video.
- Allow an existing product video to be replaced.
- Allow an existing product video to be removed.
- Include product video metadata in pending changes so the owner can review it before deployment.

Supported URL examples:

```txt
https://www.youtube.com/watch?v=abc123XYZ
https://youtu.be/abc123XYZ
https://www.youtube.com/shorts/abc123XYZ
https://www.youtube.com/embed/abc123XYZ
```

Generated frontmatter from admin:

```yaml
youtubeVideo:
  id: "abc123XYZ"
  title: "Advent 2150 Hardtop Slide-On Walkthrough"
  description: "A walkthrough of the Beyond RV Advent 2150 hardtop slide-on camper."
  thumbnail: "https://i.ytimg.com/vi/abc123XYZ/maxresdefault.jpg"
  uploadDate: "2026-05-28"
  duration: "PT5M42S"
  transcriptSummary: "Shows the exterior, interior, storage, kitchen, sleeping area, and off-grid setup."
```

Acceptance criteria:

- Admin can add or edit product video metadata without touching code.
- Admin can paste a YouTube URL while editing an existing product.
- Admin can paste a YouTube URL while creating a new product draft.
- The admin UI extracts and displays the clean YouTube video ID.
- The pending product change includes the `youtubeVideo` frontmatter block when video data is supplied.
- Products can be saved without video data.
- Existing product videos can be removed from the admin UI.
- Pending changes show the video fields clearly.
- Product build still passes after admin-generated changes.

### 6. Performance and Privacy

Use a lightweight embed strategy.

Phase 1 requirement:

- Use `loading="lazy"` on the iframe.
- Use `youtube-nocookie.com`.
- Do not autoplay.
- Do not load the YouTube IFrame API unless video event tracking is required.

Phase 2 optional enhancement:

- Replace the iframe with a click-to-load thumbnail component.
- Load the iframe only after the buyer clicks play.
- This can further reduce third-party requests and improve page speed.

Acceptance criteria:

- No autoplay.
- Product pages without videos do not load any YouTube resources.
- Product pages with videos do not load YouTube until the iframe enters the browser's loading window, or until click-to-load is implemented.
- Privacy policy is reviewed and updated if needed.

### 7. Analytics

Phase 1:

- Track product-page visits and enquiries as currently implemented.
- Use YouTube campaign links in YouTube descriptions to attribute traffic back to product pages.

Phase 2 optional:

- Use YouTube IFrame Player API with consent-aware analytics.
- Track events such as video started, 25%, 50%, 75%, completed.
- Only send browser analytics after cookie consent if required by the existing analytics policy.

Acceptance criteria:

- Phase 1 does not introduce analytics cookies beyond YouTube's own embed behaviour.
- Phase 2 video analytics respects the site's consent model.

## Content Requirements

Minimum video checklist per product:

- One clear walkthrough video.
- Product-specific title.
- Product-specific description.
- Stable thumbnail.
- Product page link in YouTube description.
- Enquiry link in YouTube description.
- Embedding enabled.
- Optional transcript summary added to product frontmatter.

Priority product rollout:

1. Advent 2150 Hardtop Slide-On.
2. Advent 2300 Hardtop Slide-On.
3. Advent 2450 Hardtop Slide-On.
4. 4.7m Truck Camper.
5. Isuzu NPS Pop-Top Camper.
6. Unimog Pop-Top Camper.
7. Sunpatch 15-XC Couples Off-Road Van.

## Technical Implementation Notes

Likely files to modify:

- `src/content/config.ts`
- `src/layouts/ProductLayout.astro`
- `src/styles/global.css`
- `src/content/products/*.md`
- `src/content/products/expedition/*.md`

Optional later files:

- `src/components/AdminPanel.tsx`
- `netlify/functions/admin-products.ts`
- `netlify/functions/product-catalogue.json`
- `src/data/chatbot-knowledge.md`
- `public/llms.txt`
- `public/llms-full.txt`

Suggested implementation order:

1. Extend product schema.
2. Add video embed rendering to `ProductLayout.astro`.
3. Add `VideoObject` schema generation.
4. Add responsive CSS for `.product-video-section` and `.product-video-frame`.
5. Add one test video to a single product.
6. Run `npm run build`.
7. Check generated HTML for iframe and schema.
8. Add remaining product video data when videos are available.
9. Add admin editing in a later phase.

## UX Requirements

The video section should feel like part of the product page, not a separate media block.

Design requirements:

- Keep visual style consistent with existing dark product pages.
- Use an aspect-ratio container for 16:9 video.
- Avoid nested cards.
- Do not add marketing explainer text about why video exists.
- Keep the title concise.
- Keep CTA close to the video.
- Ensure video does not overlap galleries, specs, or CTAs on mobile.

Suggested visible copy:

```txt
Watch the walkthrough
```

```txt
See the layout, finish, storage, and fit-out details before you enquire.
```

## Risks and Mitigations

Risk: YouTube related videos could distract users.

Mitigation: Use `rel=0`, keep the iframe in context, and add a CTA directly below the video. Note that YouTube no longer allows related videos to be fully disabled.

Risk: Video embeds can affect performance.

Mitigation: Lazy-load in phase 1. Consider click-to-load thumbnails in phase 2.

Risk: Video metadata becomes stale.

Mitigation: Store video details in product frontmatter and eventually expose fields in admin.

Risk: Video claims may conflict with current product specs.

Mitigation: Use conservative descriptions and link users to enquire for current price, stock, fitment, and lead time.

Risk: Google may not show video-rich results.

Mitigation: Treat schema as eligibility and clarity, not a guarantee.

## Acceptance Criteria

Phase 1 is complete when:

- Product schema accepts optional `youtubeVideo` data.
- Product pages render an embedded YouTube player when a video exists.
- Product pages without videos are unchanged.
- `VideoObject` schema is emitted for products with video.
- The embed uses `youtube-nocookie.com`.
- Videos do not autoplay.
- Iframes are lazy-loaded.
- Mobile and desktop layouts are usable.
- `npm run build` passes.
- At least one product page is verified with a real or placeholder owner-approved YouTube video ID.

Phase 2 is complete when:

- Admin can add and edit product video fields.
- Full YouTube URLs can be pasted and converted to video IDs.
- Video metadata is included in pending product changes.
- Optional video analytics respects cookie consent.

## Measurement

Track before and after:

- Product page engagement.
- Product page scroll depth if available.
- Enquiry rate from product pages with video.
- Clicks on `Enquire Now` after video section.
- YouTube referral visits back to product pages.
- YouTube watch time and retention.
- Search Console video impressions if available.
- AI/search visibility for product and category queries.

## Open Questions

- Which products already have suitable YouTube videos?
- Should videos be public or unlisted?
- Does the owner want the videos hosted on the main Beyond RV YouTube channel only?
- Should each video include owner narration, captions, or both?
- Should the first phase use simple iframes or click-to-load thumbnails?
- Should transcript summaries be written manually from each video?

## References

- YouTube embedded player parameters: https://developers.google.com/youtube/player_parameters
- YouTube privacy-enhanced embeds: https://support.google.com/youtube/answer/171780
- Google video SEO best practices: https://developers.google.com/search/docs/appearance/video
