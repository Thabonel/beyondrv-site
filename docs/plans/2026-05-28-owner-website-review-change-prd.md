# PRD: Owner Website Review Changes

Date: 2026-05-28
Owner: Beyond RV
Status: Implemented

## Executive Summary

The owner has reviewed the new Beyond RV website and supplied a Word review document plus new image/spec assets on the external drive:

```txt
/Volumes/PortableSSD/WEBSITE RESOURCES (READ ME!!!!!)
```

This PRD converts that review into an implementation plan for homepage, category pages, product pages, images, pricing, stock status, product positioning, specifications, optional extras, and admin behaviour.

The key business direction is:

- Keep the homepage Recent Builds section.
- Keep only 3 Recent Builds in admin and on the homepage; adding a new recent build replaces the oldest one.
- Make Slide-Ons a ute slide-on category only.
- Move truck campers and expedition-style products out of Slide-Ons and into Expedition and/or On Sale.
- Update product pricing and status based on the owner’s clarifications.
- Use embedded images and external-drive folders as the asset source.
- Replace product specification tables with the owner’s preferred existing-site format.

## Source Materials

- Review document: `/Volumes/PortableSSD/WEBSITE RESOURCES (READ ME!!!!!)/WEBSITE REVIEW DOC (READ ME!!!!!!).docx`
- Asset folder: `/Volumes/PortableSSD/WEBSITE RESOURCES (READ ME!!!!!)`
- Product photo folders:
  - `ADVENT 2150 PHOTOS`
  - `3.5M ELECTRIC POPTOP FAMILY CAMPER W DROP DOWN BED PHOTOS`
  - `3.5m ELECTRIC POPTOP BOX CAMPER`
  - `3.5M DIY HARDTOP CAMPER BOX PHOTOS`
  - `4.7M HARDTOP TRUCK CAMPER PICTURES`
  - `SUNPATCH 12C PHOTOS`
  - `SUNPATCH 15XC PHOTOS`
  - `SUNPATCH 21XF PHOTOS`
  - `SPEC SHEETS`

## Owner Clarifications

The owner clarified the conflicts in the review document:

- Sunpatch 21-XF price is `$73,000`.
- Advent 2150 price is `$72,000`.
- Advent 2450 remains visible on Slide-Ons as an available build-to-order model, but must not appear on On Sale.
- Recent Builds should stay live.
- Isuzu NPS Pop-Top Camper should be renamed/replaced as the dedicated 4.7m Truck Camper page in Expedition.
- Sunpatch 19-XC is currently available for sale, but further details and images are coming soon.
- Unimog Overlander should stay live as a concept/custom build page.
- Slide-Ons is for ute slide-ons only. Truck campers should be removed from Slide-Ons but remain live under Expedition and/or On Sale.

## Goals

- Align public product ranges with the owner’s intended category structure.
- Update pricing, stock status, and page copy.
- Use the supplied images and folders as the source of truth.
- Improve product specification presentation.
- Preserve SEO value with redirects where product pages are renamed or replaced.
- Keep the admin simple for the owner to maintain.
- Avoid duplicate/conflicting product pages.

## Non-Goals

- Inventing missing specifications.
- Publishing unconfirmed weights or compliance claims.
- Removing concept/custom build pages unless explicitly requested.
- Replacing the admin pending-change workflow.
- Changing brand identity or the overall visual design unless needed to support content.
- Publishing private operational notes from the review document.

## Users

- Buyer comparing ute slide-ons.
- Buyer comparing truck campers and expedition builds.
- Buyer looking for immediately available/on-sale stock.
- Owner/admin updating homepage proof, products, photos, and specs.
- Search engines and AI assistants reading structured product/category information.

## Global Requirements

### Recent Builds Admin Rule

The homepage Recent Builds section must remain live.

Admin requirements:

- Keep exactly 3 recent build slots.
- Adding a new Recent Build in admin places the new build first.
- The previous oldest build is automatically removed.
- The homepage should only render visible Recent Builds from the capped list.
- Admin help text must explain the replacement behaviour.

Acceptance criteria:

- Admin cannot accidentally grow the Recent Builds list beyond 3.
- Queued homepage JSON contains no more than 3 recent builds.
- Adding a new item clearly replaces the oldest item.

### Product Specifications Format

All product pages should replace the current specifications section with the format used on the old/existing website, based on the reference image embedded in the review document.

Reference image:

- Embedded doc image: `word/media/image14.png`
- Visual description: dark accordion-style specification groups with rows such as Dimensions, Water System, Electrical, Gas, Internal Construction Features, External Features, Internal Features.

Acceptance criteria:

- Product specs are grouped into clear expandable or grouped sections.
- Spec groups use confirmed values from supplied spec sheets.
- Unknown values show `To be confirmed` or are omitted; do not invent.

### Optional Extras Pricing

Update optional extras globally:

- Extra 200Ah battery: `$1,500`
- Additional 200W solar panel: `$500`
- 2kW AuFocus diesel heater supply and install: `$2,000`
- 40L greywater tank with 12V sump pump: `$1,000`
- Custom gel-coat colour matching: `$3,000`

Acceptance criteria:

- Optional extras reflect the above prices.
- Product pages using optional extras display the updated values.
- New custom gel-coat option appears with the correct price.

### Gallery Ordering

Product galleries should be ordered by area:

1. Exterior
2. Kitchen
3. Seating area
4. Bed area
5. Toilet area

Acceptance criteria:

- Product galleries are reordered where the supplied folders contain enough images.
- If a category is not represented in the available photos, use the best available order and do not fabricate missing images.

## Embedded Image Mapping

I can clearly see the embedded images in the review document. The owner/user has confirmed the previously ambiguous homepage images and gallery-order approach.

| Embedded Image | Intended Use | Confidence |
| --- | --- | --- |
| `image1.jpeg` | Homepage Expedition Vehicles image, dark blue truck | Confirmed |
| `image2.jpeg` | Homepage Slide-On Campers image and Advent 2300 hero | Confirmed |
| `image3.png` | Homepage Custom Builds image | High |
| `image4.jpeg` | Sunpatch 12C category/product hero | High |
| `image5.jpeg` | Sunpatch 15-XC category/product hero | High |
| `image6.jpeg` | Sunpatch 21-XF category/product hero | High |
| `image7.jpeg` | Advent 2150 hero | High |
| `image8.jpeg` | Advent 2450 hero | High |
| `image9.jpeg` | 7ft Electric Pop-Top Slide-On hero | High |
| `image10.jpeg` | Expedition page hero | High |
| `image11.jpeg` | 3.5m Electric Pop-Top Cabover Family Camper image | High |
| `image12.jpeg` | 4.7m Hardtop Truck Camper image | High |
| `image13.jpeg` | About Us hero | High |
| `image14.png` | Specification table/accordion reference | High |
| `image15.jpeg` | Custom 3.5m Electric Pop-Top Truck Camper main image | High |
| `image16.jpeg` | 3.5m DIY Camper Box main image | High |

## Photo Clarifications

Confirmed handling:

- Homepage `Expedition Vehicles`: use the dark blue truck image, embedded `image1.jpeg`.
- Homepage `Slide-On Campers`: use the white camper-on-tray image, embedded `image2.jpeg`.
- Homepage `Ready To Roll`: use each product’s normal hero image.
- Advent 2300 hero: use the same white camper-on-tray image, embedded `image2.jpeg`.
- Sunpatch 19-XC: build the product/card with a coming-soon banner that can be removed when the owner supplies images.
- Gallery ordering: choose the best order by visual inspection from each folder; the owner can later rearrange through the admin page.

## Homepage Requirements

Changes:

- Keep overall business message if it feels right.
- Change `10+ years manufacturing` to `10+ years manufacturing experience`.
- Use supplied images for homepage range cards:
  - Expedition Vehicles: embedded `image1.jpeg`, dark blue truck.
  - Slide-On Campers: embedded `image2.jpeg`, white camper-on-tray.
  - Custom Builds: embedded `image3.png`.
- Ready To Roll should feature:
  - Advent 2150.
  - Mercedes Sprinter Motorhome.
  - Sunpatch 15-XC.
  - Sunpatch 12C Couples Van.
- Ready To Roll cards should use each product’s normal hero image.
- Advent 2450 must not be featured as in-stock/on-sale.
- Keep Recent Builds.
- Customer testimonials are confirmed good.
- Phone, email, and address are confirmed good.

Acceptance criteria:

- Homepage copy uses the corrected manufacturing phrase.
- Range card images match supplied assets.
- Ready To Roll shows the four confirmed products.
- Recent Builds remains visible and contains 3 items.
- Contact details remain unchanged.

## Our Caravans Page

Display products in this order:

1. Sunpatch 12C Couples Off-Road Van: `$39,999`
2. Sunpatch 15-XC Couples Off-Road Van: `$63,000`
3. Sunpatch 19-XC Couples Off-Road Van: `$68,000`
4. Sunpatch 21-XF Family Off-Road Van: `$73,000`

Hero/category images:

- Sunpatch 12C: embedded `image4.jpeg`.
- Sunpatch 15-XC: embedded `image5.jpeg`.
- Sunpatch 19-XC: details/images coming soon; use a removable coming-soon banner.
- Sunpatch 21-XF: embedded `image6.jpeg`.

Acceptance criteria:

- Product order matches the owner’s requested order.
- Prices match the owner’s requested values.
- Sunpatch 19-XC is available for sale but clearly marked as details/images coming soon where appropriate.

## Slide-Ons Page

Slide-Ons is for ute slide-ons only.

Display only:

1. Advent 2150: `$72,000`
2. Advent 2300: `$75,000`
3. Advent 2450: `$77,800`
4. 7ft Electric Pop-Top Slide-On Camper: `$68,800`

Remove from Slide-Ons:

- 3.5m truck campers.
- 4.7m truck camper.
- Any expedition/truck-camper products.

Product image mapping:

- Advent 2150: embedded `image7.jpeg`.
- Advent 2300: embedded `image2.jpeg`, white camper-on-tray.
- Advent 2450: embedded `image8.jpeg`.
- 7ft Electric Pop-Top: embedded `image9.jpeg`.

Acceptance criteria:

- Slide-Ons page contains ute slide-ons only.
- Advent 2450 remains visible as build-to-order, not in-stock.
- Product order and pricing match this PRD.

## Expedition Page

Changes:

- Move truck camper positioning into Expedition.
- Use embedded `image10.jpeg` as the expedition hero image.
- Keep Unimog build section.
- Rename `Isuzu NPS builds` section to `4x4 Truck Builds`.
- Feature:
  - 3.5m Electric Pop-Top Cabover Family Camper w/ Electric Drop Down Bed.
  - 4.7m Hardtop Couples Truck Camper.
- Position 4.7m Truck Camper as the premier option for couples looking for a truck camper.
- Mention it can be made to suit a Unimog.

Product image mapping:

- 3.5m Electric Pop-Top Cabover Family Camper: embedded `image11.jpeg`.
- 4.7m Hardtop Truck Camper: embedded `image12.jpeg`.

Acceptance criteria:

- Expedition page has no duplicate/conflicting 4.7m product listing.
- 4x4 Truck Builds section replaces Isuzu NPS Builds wording.
- Truck camper products are discoverable here.

## On Sale Page

Display immediate delivery/on-sale products:

- Sunpatch 15-XC Hardtop Couples Van: `$63,000`
- Sunpatch 19-XC Hardtop Couples Van: `$68,000`
- Sunpatch 21-XF Hardtop Family Van: `$73,000`
- Sunpatch 12C Hardtop Couples Van: `$39,999`
- Advent 2150 Hardtop Ute Slide-On Camper: `$72,000`
- Custom 3.5m Electric Pop-Top Truck Camper: `$49,999`
- 3.5m DIY Camper Box w/ Cabover section: `$38,999`
- Mercedes Sprinter AWD LWB Cab Chassis Motorhome: `$225,000`

Exclusions:

- Advent 2450 must not appear on On Sale.

Acceptance criteria:

- On Sale page includes only the above products.
- Prices match this PRD.
- Images come from product hero images or named folders.
- Advent 2450 is excluded.

## About Us Page

Changes:

- Content is confirmed good.
- Use embedded `image13.jpeg` as hero image.

Acceptance criteria:

- About page hero uses the supplied image.
- Copy remains otherwise unchanged unless implementation requires a minor image alt update.

## Product Page Requirements

### Advent 2150

Changes:

- Price: `$72,000`.
- Use photos from `ADVENT 2150 PHOTOS`.
- Base dimensions: `2150mm x 2000mm (L x W)`.
- Replace intro line with: `The Advent 2150 is the go-anywhere companion for 4x4 space cab utes and select dual cab ute owners.`
- Suits: `Space cab and certain dual cab utes`.
- Specification table from `BeyondRV 2150 Advent Hardtop Slideon`.

### Advent 2300

Changes:

- Price: `$75,000`.
- Current images are good, but reorder gallery by product area.
- Base Dimensions: `2300mm x 2000mm (L x W)`.
- Specification table from `BeyondRV 2300 Advent Hardtop Slideon`.

### Advent 2450

Changes:

- Price: `$77,800`.
- Build-to-order / available model, not on sale.
- Update copy to say the camper is designed specifically for single cab utes rather than dual cabs.
- Update suitable vehicles accordingly.
- Base Dimensions: `2450mm x 2000mm (L x W)`.
- Reorder images.
- Specification table from `BeyondRV 2450 Advent Hardtop Slideon`.

### 7ft Electric Pop-Top Slide-On Camper

Changes:

- Price: `$68,800`.
- Suitable vehicles: `Single cab utes`.
- Base dimensions: `2150mm x 2000mm (L x W)`.
- Specification table from `BeyondRV 7ft Poptop Slide-on`.

### Empty DIY Unimog Camper Box

Current page:

- Rename `Unimog Pop-Top Camper` to `Empty DIY Unimog Camper Box`.

Changes:

- Photos are good.
- Available in hardtop or electric pop-top configuration.
- Available as a flatpack kit or fully assembled box with wiring roughed in.
- Base dimensions: custom made to order.
- Remove DRIVE section.
- Roof: `Pop-top OR hardtop`.
- Specification table from `BeyondRV Custom Empty Poptop Unimog Camper Box`.

### Unimog Overlander Camper

Changes:

- Keep live as concept/custom build page.
- Images wait until Thabo’s camper is complete.
- Pricing and spec sheet unavailable until completion.

### 3.5m Electric Pop-Top Cabover Family Camper w/ Electric Drop Down Bed

Current page:

- Rename `Isuzu NPS Cabover Camper` to this title.

Changes:

- Made for families on a compact 3.5m base.
- Made to suit dual cab Isuzu NPS.
- Can be built as slide-on or permanently mounted camper.
- Pricing starts at `$140,000`.
- Specification table from `3.5m ISUZU NPS Camper w CABOVER AND DROP DOWN BED`.
- Use images from `3.5M ELECTRIC POPTOP FAMILY CAMPER W DROP DOWN BED PHOTOS`.

### 4.7m Hardtop Truck Camper

Current page:

- Rename/replace `Isuzu NPS Pop-Top Camper` page as the dedicated `4.7m Hardtop Truck Camper`.

Changes:

- Price starts at `$98,000`.
- Available in 2.2m wide truck camper configuration or 2.4m wide Unimog configuration.
- Roof: `Hard-top`.
- Platform: `Single cab truck or Unimog`.
- Specification table from `BeyondRV 4.7m Truck Camper`.
- Use images from `4.7M HARDTOP TRUCK CAMPER PICTURES`.

### Sunpatch 12C Caravan

Changes:

- Price: `$39,999`.
- Implement gallery viewing function if missing.
- Use images from `SUNPATCH 12C PHOTOS`.
- Specifications from `12C sales agreement`.
- Include full weights: TARE, ATM, BALL WEIGHT.

### Sunpatch 15-XC Caravan

Changes:

- Price: `$63,000`.
- Tare: `1900kg`.
- Max ATM: `2500kg`.
- Standard battery: `200Ah`.
- Freshwater: `240L`.
- Specification table from `15XC Sales Agreement`.

### Sunpatch 19-XC Caravan

Changes:

- Price: `$68,000`.
- Available for sale.
- Details/images coming soon.
- Build the page/card with a removable coming-soon banner until owner-supplied images are available.
- Specifications from `19XC Sales Agreement`.

### Sunpatch 21-XF Caravan

Changes:

- Price: `$73,000`.
- Currently available, 1 in stock.
- Sleeps 5 people.
- Use images from `SUNPATCH 21XF PHOTOS`.
- Specifications from `21XF Sales Agreement`.

### Custom 3.5m Electric Pop-Top Truck Camper

Changes:

- Price starts at `$49,999`.
- Specifications from `BeyondRV 3.5m Poptop Truck Camper`.
- Use embedded `image15.jpeg` as main product and On Sale image.
- Gallery from `3.5m ELECTRIC POPTOP BOX CAMPER`.

### 3.5m DIY Camper Box with Cabover and Underfloor Storage

Changes:

- Price starts at `$38,999`.
- Market as foundation for people who want to complete their own truck camper fitout.
- Waterproofed composite shell construction with electric legs and some furniture included.
- Hardtop configuration.
- Use embedded `image16.jpeg` as main product and On Sale image.
- Gallery from `3.5M DIY HARDTOP CAMPER BOX PHOTOS`.
- No spec sheet available.
- Sold as-is: what you see is what you get.

### Mercedes Sprinter AWD LWB Cab Chassis Motorhome

Changes:

- Price remains `$225,000`, negotiable.
- Specifications from `BeyondRV Mercedes Sprinter + 4.7m Truck Camper`.
- In stock and available for immediate delivery.

## Redirect Requirements

Product renames/replacements must preserve old URLs where practical.

Likely redirects:

- Old Isuzu NPS Pop-Top Camper URL to new 4.7m Hardtop Truck Camper URL.
- Old Isuzu NPS Cabover Camper URL to new 3.5m Electric Pop-Top Cabover Family Camper URL.
- Old Unimog Pop-Top Camper URL may remain if slug is preserved, or redirect if slug changes.
- Existing standalone 4.7m Truck Camper URL needs a decision: preserve, redirect, or merge with the new Expedition page.

Acceptance criteria:

- No important old URL returns 404.
- Category links point to canonical new product pages.
- Duplicate 4.7m truck camper pages are avoided.

## Admin Requirements

Admin must continue supporting:

- Product photo uploads.
- Gallery ordering.
- Product video URL entry.
- Recent Builds capped at 3.
- Homepage proof section updates.
- Product edits via pending changes.

New admin copy:

- Recent Builds help must explain that only 3 are kept and a new one replaces the oldest.

## Implementation Phases

### Phase 1: Data and Navigation Structure

- Update category filters/order.
- Resolve product renames and redirects.
- Update product prices/statuses.
- Remove Advent 2450 from On Sale.
- Keep Advent 2450 as build-to-order on Slide-Ons.
- Keep Unimog Overlander concept page live.

### Phase 2: Images

- Extract/use embedded hero images where mapped.
- Process external-drive folders into optimized product images.
- Reorder galleries.
- Update category and product hero images.

### Phase 3: Specifications

- Parse/spec-check documents from `SPEC SHEETS`.
- Replace spec tables with grouped old-site format.
- Ensure weights are included where explicitly requested.

### Phase 4: Homepage and Admin

- Update homepage copy and feature products.
- Keep Recent Builds.
- Enforce 3-item Recent Builds admin cap.
- Update admin help copy.

### Phase 5: QA

- Run build and type checks.
- Check all product/category pages locally.
- Check redirects.
- Check mobile layouts.
- Check image rendering and gallery order.
- Check structured data still validates conceptually.

## Acceptance Criteria

- Owner-confirmed pricing is reflected across product, category, and On Sale pages.
- Slide-Ons only contains ute slide-ons.
- Truck campers appear under Expedition and/or On Sale as requested.
- Recent Builds remains live and capped at 3 in admin.
- All supplied hero images are used where mapping is confirmed.
- Product pages use the new grouped specification format.
- No duplicate/conflicting 4.7m truck camper pages.
- No unconfirmed specs are invented.
- `npm run build` passes.
- `npm run check` passes.

## Open Questions

- Should the standalone current `/4-7m-truck-camper/` page be redirected to the new Expedition 4.7m page, preserved, or removed?
- Should renamed products keep old slugs for SEO, or should URLs change to match new titles with redirects?
- Should unavailable spec fields be omitted or shown as `To be confirmed`?
