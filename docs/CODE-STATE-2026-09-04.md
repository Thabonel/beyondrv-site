# The Beyond RV site: state of the code

Date: 4 September 2026
Repo: `Thabonel/beyondrv-site`
Live: https://beyondrv.com.au
Status: **work paused. The site build is considered finished.**

This is the whole-codebase picture for someone picking the project up cold. For
the vehicle picker and the calculator specifically, read
[STATE-OF-THE-BUILD-2026-09-04.md](STATE-OF-THE-BUILD-2026-09-04.md), then
[HANDOVER-2026-09-04.md](HANDOVER-2026-09-04.md).

## What it is

An Astro site for Beyond RV, a Queensland builder of slide-on campers,
caravans and expedition vehicles. It sells product, takes enquiries, and runs a
set of tools that tell a customer whether a camper suits their vehicle.

It is not a brochure site. The shop takes real orders, the admin is used daily by
the owner and the GM, and the vehicle data behind the calculators is sourced from
manufacturer documents with the provenance recorded per figure.

## Stack

| | |
|---|---|
| Framework | Astro, with React islands for the admin |
| Hosting | Netlify, deployed from `main` |
| Serverless | 116 Netlify Functions |
| Storage | Netlify Blobs |
| Data | SQLite for vehicle research, Markdown content collections for products |
| Payments | Stripe |
| Analytics | PostHog |
| AI | OpenAI, for admin assistance and enquiry handling |
| 3D | Three.js, for the configurator |

Build command, from `netlify.toml`:

```
npm run catalogue:build && node SCRIPTS/build-product-catalogue.mjs && npm run build
```

The vehicle catalogue and the product catalogue are generated **during the
build**, so a publication decision reaches customers without a separate step.

## What is in it

- **29 customer-facing page files**, including the shop, cart, checkout, search,
  guides, careers and the product pages
- **17 product content files**, the source of truth for what is sold
- **116 Netlify Functions**: 59 admin, plus commerce (`checkout`,
  `shipping-quote`, `shipping-label-core`, `stripe-shared`), enquiries, contracts,
  sales workspace, vehicle review, tray sizes and the owner copilot
- **18 React components**, almost all of them the admin dashboard
- **42 unit test files and 23 end-to-end specs**

## The customer-facing tools

**Slide-on camper weight calculator.** Pick a vehicle and it fills in GVM and
kerb from the catalogue, then works out available payload, loaded weight and GVM
margin. It names the camper model the tray suits, and hands everything entered to
the enquiry form.

**Caravan towing calculator.** The same idea for towing: GVM, GCM, tow capacity,
ATM, GTM and tow ball margins.

**Vehicle suitability checker** and a set of guides.

**Configurator**, using Three.js.

All of it estimates. The standing disclaimer says Beyond RV weighs the vehicle at
the factory before build, and those figures decide.

## The admin

A React dashboard behind `admin-auth`, with capability-based access. The owner
and the GM see different things. It covers enquiries, leads and reminders,
contracts and agreements, orders and shipping labels, product editing, marketing
ideas, a sales workspace with voice capture, vehicle review and reported tray
sizes.

## The data discipline

This is the part most likely to be undone by accident, so it is worth stating.

Every published vehicle figure comes from a manufacturer document, and the
database records the source, the locator within it, the date it was read and the
basis of the measurement. Where a figure is optimistic or has been corrected, the
calculator tells the customer on the page.

Three guards enforce it, and each has caught something real:

- `tests/vehicle-catalogue-publication.test.ts` recomputes what should be live
  from the database and the overrides, and compares it with the committed
  catalogue.
- `tests/vehicle-database-seed.test.ts` rebuilds the database from `seed.sql` and
  compares every row, after a rebuild silently deleted two Hino rows.
- `ALLOWED_SOURCE_HOSTS` in `src/lib/vehicleCatalogue/validate.ts` fails the whole
  build rather than publish one row from an unapproved source.

## Running it

```bash
npm install
npm run dev                  # local dev server
npm run check                # astro check; tsc alone misses .astro script blocks
npm test                     # unit tests
npm run test:e2e             # end to end, five browser projects
npm run audit:repository     # repository hygiene
npm run catalogue:build      # regenerate the vehicle catalogue
bash data/vehicle-selector/build-database.sh   # rebuild the research database
```

CI runs `quality` (check, test, audit) and `browsers` (end to end). **Both are
required on `main`.** `strict` is off, so a branch need not be rebased before
merging; `enforce_admins` is off, so an admin can override in an emergency.

At the point of pausing: **419 unit tests, 910 end-to-end tests across five
browsers, zero type errors, repository audit clean.**

## Where the bodies are buried

- **Generated files are committed.** `catalogue.json`,
  `vehicle-review-candidates.json` and `vehicle-variant-index.json` are generated
  and tracked, so any two branches touching vehicle data conflict in them.
  Resolve by regenerating, never by hand-merging.
- **`tsc --noEmit` does not check `.astro` script blocks.** Use `npm run check`.
- **A tray is not a tub.** A slide-on mounts on a flat tray; 96 of the 165 live
  variants have no factory tray and need one fitted.
- **Maximum body length is not a tray length.** It is what a chassis is rated
  for, and prefilling it as a tray would suggest a camper the vehicle cannot
  carry.
- **Manufacturer sites block automated retrieval.** Expect to be handed PDFs.

## What is unfinished

Listed with the reasoning in
[STATE-OF-THE-BUILD-2026-09-04.md](STATE-OF-THE-BUILD-2026-09-04.md):

1. Six truck families unresearched, all needing documents supplied by hand
2. Nine rows the build cannot publish: three missing a chassis mass, six whose
   model year is deliberately absent
3. Ford's heavier-options kerb figures, with the exact brochure page named
4. `tray_specifications` is built, tested and empty, which now matters most
5. The admin review screen works and has never been used

None of these stops the site working. Each is a decision or a document away.
