# Phase A Foundation — Astro + Netlify Build

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Astro + Netlify marketing site foundation for ByondRV — routes, layout, design system, product content collection, all page templates, enquiry form, redirects, and SEO scaffolding. No AI admin, chatbot, Stripe, analytics dashboard, or 3D configurator.

**Architecture:** Astro 4 static site at project root; content collections for product Markdown; shared BaseLayout with header/footer; dynamic `[...slug].astro` for product pages; `public/images/products/{slug}/` for product images.

**Tech Stack:** Astro 4, `@astrojs/sitemap`, `@astrojs/netlify`, `@astrojs/check`, TypeScript, vanilla CSS (dark design system from mockup.html), Netlify Forms, `netlify.toml` for redirects.

---

## Task 1: Initialise Astro project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `.gitignore` (update)

**Step 1: Create package.json**
```json
{
  "name": "beyondrv-site",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  }
}
```

**Step 2: Install Astro and integrations**
```bash
npm install astro@^4.16 @astrojs/sitemap @astrojs/netlify @astrojs/check typescript
```

**Step 3: Create astro.config.mjs**
```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://beyondrv.com.au',
  output: 'static',
  adapter: netlify(),
  integrations: [sitemap()],
  image: {
    remotePatterns: [],
  },
});
```

**Step 4: Create tsconfig.json**
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strictNullChecks": true,
    "baseUrl": "."
  }
}
```

**Step 5: Update .gitignore** — add `node_modules/`, `dist/`, `.astro/`

**Step 6: Run dev server to verify**
```bash
npx astro dev --host
```
Expected: server starts on port 4321

**Step 7: Commit**
```bash
git add package.json astro.config.mjs tsconfig.json .gitignore
git commit -m "feat: initialise Astro project with sitemap + Netlify adapter"
```

---

## Task 2: netlify.toml

**Files:**
- Create: `netlify.toml`

**Step 1: Create netlify.toml**
```toml
[build]
  command   = "npm run build"
  publish   = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from   = "/12-ft/"
  to     = "/our-caravans/"
  status = 301

[[redirects]]
  from   = "/15-ft/"
  to     = "/our-caravans/"
  status = 301

[[redirects]]
  from   = "/sunpatch-12c-couples-caravan/"
  to     = "/our-caravans/"
  status = 301

[[headers]]
  for    = "/*"
  [headers.values]
    X-Frame-Options        = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy        = "strict-origin-when-cross-origin"
```

**Step 2: Commit**
```bash
git add netlify.toml
git commit -m "feat: add netlify.toml with redirects and security headers"
```

---

## Task 3: Directory skeleton

Create these empty directories (place a `.gitkeep` where needed):
```
src/
  assets/
  components/
  content/
    products/
  layouts/
  pages/
    expedition/
  styles/
public/
  images/
    products/
      advent-2150/
      advent-2300/
      advent-2450/
      sunpatch-15xc/
      7ft-poptop/
      4-7m-truck-camper/
      3-5m-poptop/
      3-5m-cabover/
      mercedes-sprinter/
      sunpatch-19xc/
      sunpatch-21xf/
      unimog-overlander/
      unimog-poptop/
      isuzu-nps-cabover/
      isuzu-nps-poptop/
    site/
  fonts/
```

**Step 1: Create skeleton**
```bash
mkdir -p src/{assets,components,content/products,layouts,pages/expedition,styles}
mkdir -p public/images/products/{advent-2150,advent-2300,advent-2450,sunpatch-15xc,7ft-poptop,4-7m-truck-camper,3-5m-poptop,3-5m-cabover,mercedes-sprinter,sunpatch-19xc,sunpatch-21xf,unimog-overlander,unimog-poptop,isuzu-nps-cabover,isuzu-nps-poptop}
mkdir -p public/images/site
```

**Step 2: Copy existing product images**
```bash
# Advent 2150
cp 2150/*.jpg public/images/products/advent-2150/ 2>/dev/null; cp 2150/*.JPG public/images/products/advent-2150/ 2>/dev/null; true

# Advent 2300
cp 2300/*.jpg public/images/products/advent-2300/ 2>/dev/null; cp 2300/*.JPG public/images/products/advent-2300/ 2>/dev/null; true

# Advent 2450
cp 2450/*.jpg public/images/products/advent-2450/ 2>/dev/null; cp 2450/*.JPG public/images/products/advent-2450/ 2>/dev/null; true

# Sunpatch 15-XC (two source folders)
cp "Beyond RV Sunpatch 15-XC"/*.JPG public/images/products/sunpatch-15xc/ 2>/dev/null; \
cp "15-XC"/*.jpg public/images/products/sunpatch-15xc/ 2>/dev/null; true

# 4.7m Truck Camper → 4-7m-truck-camper
cp "4.7m Truck Camper"/*.JPG public/images/products/4-7m-truck-camper/ 2>/dev/null; true

# 3.5m Poptop → 3-5m-poptop
cp "3.5m truck camper box"/*.jpg public/images/products/3-5m-poptop/ 2>/dev/null; true

# 3.5m Cabover → 3-5m-cabover
cp "3.5m Truck Camper w- Cabover"/*.JPG public/images/products/3-5m-cabover/ 2>/dev/null; \
cp "3.5m camper with cabover section"/*.jpg public/images/products/3-5m-cabover/ 2>/dev/null; true

# 4.6m Poptop → 7ft-poptop
cp "4.6M POPTOP TRUCK CAMPER"/*.jpg public/images/products/7ft-poptop/ 2>/dev/null; \
cp "4.6m truck camper ONE OFF"/*.jpg public/images/products/7ft-poptop/ 2>/dev/null; true

# Sunpatch 12C (used for coming-soon caravans category hero)
mkdir -p public/images/products/sunpatch-12c
cp "Sunpatch 12C couples caravans"/*.jpg public/images/products/sunpatch-12c/ 2>/dev/null; true

# Site-wide assets
cp unimog-hero.jpg public/images/site/
cp mog2.jpg public/images/site/
cp "2nd hero.jpg" public/images/site/hero-02.jpg 2>/dev/null; true
cp beyondlogo-1024x1024.jpg public/images/site/logo.jpg
cp "back of unimog.png" public/images/site/unimog-rear.png 2>/dev/null; true
```

**Step 3: Commit**
```bash
git add src/ public/images/
git commit -m "feat: add Astro directory skeleton and product images"
```

---

## Task 4: Global CSS design system

**Files:**
- Create: `src/styles/global.css`
- Create: `src/styles/tokens.css`

Extract from `mockup.html`. The complete design system:

**Step 1: Create `src/styles/tokens.css`**
```css
:root {
  --black:   #0a0a0a;
  --dark:    #111111;
  --panel:   #161616;
  --border:  #2a2a2a;
  --orange:  #E8540A;
  --orange2: #FF6B1A;
  --tan:     #C4A87A;
  --cream:   #F0EBE3;
  --muted:   #888888;
  --white:   #ffffff;

  --font-heading: 'Bebas Neue', sans-serif;
  --font-body:    'Outfit', sans-serif;
  --font-accent:  'Playfair Display', serif;

  --nav-height: 72px;
  --max-width: 1400px;
  --gutter: clamp(1.5rem, 4vw, 4rem);
}
```

**Step 2: Create `src/styles/global.css`**  
Includes: reset, body, cursor, nav, hero, ticker, sections, buttons, cards, product grid, gallery, trust, FAQ accordion, CTA section, footer, scroll reveals, animations, responsive breakpoints.

Port ALL CSS from `mockup.html` between `<style>` tags. Key additions beyond the mockup:
- `.badge` — orange pill for "In Stock", "Coming Soon", "On Sale"  
- `.coming-soon-badge` — muted outline variant
- `.page-hero` — shorter hero for interior pages (50vh)
- `.specs-table` — dark-themed table for product specs
- `.product-grid` — grid for product listings
- `.product-card` — individual product card (image + overlay + details)
- `.form-field`, `.form-label`, `.form-input`, `.form-textarea` — enquiry form inputs
- `.enquiry-form` — form container

Full CSS content is in `mockup.html` lines 10–656. Copy verbatim, then append the additions above.

**Step 3: Commit**
```bash
git add src/styles/
git commit -m "feat: port design system CSS from mockup"
```

---

## Task 5: Content collection schema

**Files:**
- Create: `src/content/config.ts`

**Step 1: Create `src/content/config.ts`**
```ts
import { defineCollection, z } from 'astro:content';

const specRow = z.object({ label: z.string(), value: z.string() });

const products = defineCollection({
  type: 'content',
  schema: z.object({
    title:        z.string(),
    slug:         z.string(),
    category:     z.enum(['caravan', 'slide-on', 'expedition']),
    tagline:      z.string(),
    price:        z.string(),           // "$72,000" | "POA" | "Coming Soon"
    priceBadge:   z.string().optional(),// "SPECIAL" | "IN STOCK"
    status:       z.enum(['available', 'on-sale', 'coming-soon']).default('available'),
    onSale:       z.boolean().default(false),
    featured:     z.boolean().default(false),
    heroImage:    z.string(),           // path relative to /public/images/products/{slug}/
    gallery:      z.array(z.string()), // additional image filenames
    keySpecs: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })),
    specs:        z.array(specRow).optional(),
    features:     z.array(z.string()).optional(),
    faq:          z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    relatedSlugs: z.array(z.string()).optional(),
    seoTitle:     z.string().optional(),
    seoDesc:      z.string().optional(),
    canonicalUrl: z.string().optional(),
  }),
});

export const collections = { products };
```

**Step 2: Commit**
```bash
git add src/content/config.ts
git commit -m "feat: define product content collection schema"
```

---

## Task 6: Product Markdown files (all 15)

**Files:**  
- Create 15 files in `src/content/products/`

Each product gets `{url-slug}.md`. Filenames match the PRD URL slugs exactly.

### 6a. Caravan products

**`src/content/products/sunpatch-15xc-couples-offroad-van.md`**
```yaml
---
title: "Sunpatch 15-XC Couples Off-Road Van"
slug: "sunpatch-15xc-couples-offroad-van"
category: caravan
tagline: "The ultimate couples' off-road caravan. Built tough, finished beautifully."
price: "$78,888"
priceBadge: "IN STOCK"
status: available
onSale: false
featured: true
heroImage: "/images/products/sunpatch-15xc/sunpatch-15xc-01.jpg"
gallery:
  - "/images/products/sunpatch-15xc/sunpatch-15xc-02.jpg"
  - "/images/products/sunpatch-15xc/sunpatch-15xc-03.jpg"
  - "/images/products/sunpatch-15xc/sunpatch-15xc-04.jpg"
  - "/images/products/sunpatch-15xc/sunpatch-15xc-05.jpg"
keySpecs:
  - { label: "Length", value: "15 ft (4.57m)" }
  - { label: "TARE", value: "~1,800 kg" }
  - { label: "Sleeps", value: "2 adults" }
  - { label: "Construction", value: "Full composite" }
  - { label: "Power", value: "300Ah lithium" }
  - { label: "Water", value: "200L fresh" }
specs:
  - { label: "Body length", value: "4,570mm" }
  - { label: "Overall length", value: "7,200mm (inc. drawbar)" }
  - { label: "Body width", value: "2,480mm" }
  - { label: "TARE weight", value: "~1,800kg" }
  - { label: "ATM", value: "3,500kg" }
  - { label: "Payload", value: "~1,700kg" }
  - { label: "Bed", value: "Queen fixed island bed" }
  - { label: "Battery", value: "300Ah lithium" }
  - { label: "Solar", value: "400W rooftop solar" }
  - { label: "Fresh water", value: "200L" }
  - { label: "Grey water", value: "80L" }
  - { label: "Hot water", value: "Gas/electric HWS" }
  - { label: "Kitchen", value: "3-burner cooktop, oven, microwave" }
  - { label: "Air conditioning", value: "Roof-mount reverse-cycle" }
  - { label: "Suspension", value: "Independent coil" }
  - { label: "Tyres", value: "LT285/70R17 AT" }
features:
  - "Full composite construction — lighter and stronger than fibreglass"
  - "Fixed queen island bed with ample under-bed storage"
  - "Full ensuite with separate shower and toilet"
  - "Fully equipped kitchen with 3-burner cooktop, oven, and microwave"
  - "300Ah lithium battery system with 400W solar"
  - "Independent coil suspension for serious off-road capability"
  - "Roof-mount reverse-cycle air conditioning"
  - "LED lighting throughout"
  - "Large offside slide-out pantry"
faq:
  - q: "What tow vehicle is needed for the 15-XC?"
    a: "A 4WD with a minimum 3,500kg tow rating. Popular pairings include Toyota LandCruiser 300 Series, Nissan Patrol, and Ford Ranger Raptor."
  - q: "Is the 15-XC suitable for solo travellers?"
    a: "Primarily designed for couples, but absolutely usable solo. The queen bed and ensuite make it comfortable for one person."
relatedSlugs: ["sunpatch-19xc-hardtop-couples-offroad-van", "sunpatch-21xf-hardtop-family-offroad-van"]
seoTitle: "Sunpatch 15-XC Off-Road Couples Caravan | ByondRV Queensland"
seoDesc: "The Sunpatch 15-XC is ByondRV's flagship couples off-road caravan. Full composite build, queen island bed, 300Ah lithium, independent suspension. Built in Queensland."
---

The **Sunpatch 15-XC** is ByondRV's most popular couples caravan — and it's easy to see why. Engineered at our Queensland workshop, every 15-XC is built from full composite panels for a lighter, stronger shell that laughs off corrugated outback tracks.

Inside, you'll find a fixed queen island bed, full ensuite, and a galley kitchen that makes camp cooking genuinely enjoyable. The 300Ah lithium battery system with 400W solar keeps you off-grid for weeks at a time.

The independent coil suspension setup means the 15-XC can go wherever your 4WD can — without beating you up on the way there.
```

**`src/content/products/sunpatch-19xc-hardtop-couples-offroad-van.md`**
```yaml
---
title: "Sunpatch 19-XC Hardtop Couples Off-Road Van"
slug: "sunpatch-19xc-hardtop-couples-offroad-van"
category: caravan
tagline: "Bigger, tougher, and coming soon. Register your interest now."
price: "POA"
status: coming-soon
onSale: false
featured: false
heroImage: "/images/products/sunpatch-15xc/sunpatch-15xc-01.jpg"
gallery: []
keySpecs:
  - { label: "Length", value: "~19 ft" }
  - { label: "Status", value: "Coming Soon" }
  - { label: "Construction", value: "Full composite hardtop" }
features:
  - "Hardtop composite construction"
  - "Full ensuite"
  - "Expanded kitchen and living space over the 15-XC"
  - "Details to be confirmed — register your interest below"
seoTitle: "Sunpatch 19-XC Hardtop Couples Off-Road Van | Coming Soon | ByondRV"
seoDesc: "The Sunpatch 19-XC is ByondRV's upcoming hardtop couples off-road van. Register your interest now and be first to know when it launches."
---

The **Sunpatch 19-XC Hardtop** is coming. A bigger, better-equipped evolution of our popular 15-XC — hardtop composite construction, expanded living, and the same go-anywhere off-road capability ByondRV is known for.

Register your interest below and we'll reach out the moment it's ready.
```

**`src/content/products/sunpatch-21xf-hardtop-family-offroad-van.md`**
```yaml
---
title: "Sunpatch 21-XF Hardtop Family Off-Road Van"
slug: "sunpatch-21xf-hardtop-family-offroad-van"
category: caravan
tagline: "Family adventure without compromise. Coming soon."
price: "POA"
status: coming-soon
onSale: false
featured: false
heroImage: "/images/products/sunpatch-15xc/sunpatch-15xc-01.jpg"
gallery: []
keySpecs:
  - { label: "Length", value: "~21 ft" }
  - { label: "Sleeps", value: "Family (TBC)" }
  - { label: "Status", value: "Coming Soon" }
features:
  - "Hardtop composite construction"
  - "Family sleeping configuration"
  - "Full ensuite"
  - "Details to be confirmed — register your interest below"
seoTitle: "Sunpatch 21-XF Hardtop Family Off-Road Van | Coming Soon | ByondRV"
seoDesc: "The Sunpatch 21-XF is ByondRV's upcoming hardtop family off-road van. Register your interest today."
---

The **Sunpatch 21-XF Hardtop** brings ByondRV's off-road DNA to families who refuse to leave the kids behind. Coming soon — register your interest and be first in the queue.
```

### 6b. Slide-on products

**`src/content/products/advent-2150-hardtop-slide-on.md`**
```yaml
---
title: "Advent 2150 Hardtop Slide-On"
slug: "advent-2150-hardtop-slide-on"
category: slide-on
tagline: "Compact, capable, and ready to go right now."
price: "$72,000"
priceBadge: "IN STOCK"
status: on-sale
onSale: true
featured: true
heroImage: "/images/products/advent-2150/advent-2150-01.jpg"
gallery:
  - "/images/products/advent-2150/advent-2150-02.jpg"
  - "/images/products/advent-2150/advent-2150-03.jpg"
  - "/images/products/advent-2150/advent-2150-04.jpg"
  - "/images/products/advent-2150/advent-2150-05.jpg"
  - "/images/products/advent-2150/advent-2150-06.jpg"
  - "/images/products/advent-2150/advent-2150-07.jpg"
  - "/images/products/advent-2150/advent-2150-08.jpg"
keySpecs:
  - { label: "Base length", value: "2,150mm" }
  - { label: "TARE", value: "~700kg" }
  - { label: "Construction", value: "Full composite" }
  - { label: "Power", value: "200Ah lithium" }
  - { label: "Status", value: "In Stock" }
  - { label: "Fits", value: "Mid-size trucks" }
specs:
  - { label: "Base length", value: "2,150mm" }
  - { label: "TARE weight", value: "~700kg" }
  - { label: "Construction", value: "Full composite hardtop" }
  - { label: "Battery", value: "200Ah lithium" }
  - { label: "Solar", value: "Solar ready" }
  - { label: "Suitable trucks", value: "Mid-size utes and trucks" }
features:
  - "Full composite construction — lightweight and durable"
  - "Hardtop design for year-round use"
  - "200Ah lithium battery system"
  - "Solar-ready setup"
  - "Modern kitchen with efficient storage"
  - "Comfortable sleeping area"
  - "In stock — ready for immediate delivery"
relatedSlugs: ["advent-2300-hardtop-slide-on", "advent-2450-hardtop-slide-on"]
seoTitle: "Advent 2150 Hardtop Slide-On Camper | In Stock | ByondRV Queensland"
seoDesc: "The Advent 2150 is ByondRV's compact hardtop slide-on. Full composite, 200Ah lithium, in stock now at $72,000. Ideal for mid-size trucks."
---

The **Advent 2150** is the go-anywhere companion for serious ute and mid-size truck owners. At just 2,150mm base length, it's compact enough for tight tracks but packed with everything you need for weeks away.

Full composite construction keeps the weight down (approx. 700kg TARE) without sacrificing durability. The 200Ah lithium setup keeps you self-sufficient off-grid.

**In stock now and ready for immediate delivery.**
```

**`src/content/products/advent-2300-hardtop-slide-on.md`**
```yaml
---
title: "Advent 2300 Hardtop Slide-On"
slug: "advent-2300-hardtop-slide-on"
category: slide-on
tagline: "The middle ground — serious capability, serious comfort."
price: "$72,000"
status: available
onSale: false
featured: false
heroImage: "/images/products/advent-2300/advent-2300-01.jpg"
gallery:
  - "/images/products/advent-2300/advent-2300-02.jpg"
  - "/images/products/advent-2300/advent-2300-03.jpg"
  - "/images/products/advent-2300/advent-2300-04.jpg"
keySpecs:
  - { label: "Base length", value: "2,300mm" }
  - { label: "TARE", value: "~750kg" }
  - { label: "Construction", value: "Full composite hardtop" }
  - { label: "Power", value: "200Ah lithium" }
specs:
  - { label: "Base length", value: "2,300mm" }
  - { label: "TARE weight", value: "~750kg" }
  - { label: "Construction", value: "Full composite hardtop" }
  - { label: "Battery", value: "200Ah lithium" }
  - { label: "Solar", value: "Solar ready" }
features:
  - "Full composite construction"
  - "Hardtop design"
  - "200Ah lithium battery"
  - "Extended living space over the 2150"
  - "Solar ready"
relatedSlugs: ["advent-2150-hardtop-slide-on", "advent-2450-hardtop-slide-on"]
seoTitle: "Advent 2300 Hardtop Slide-On Camper | ByondRV Queensland"
seoDesc: "The Advent 2300 hardtop slide-on from ByondRV. Full composite, 200Ah lithium, built in Queensland for serious off-road use."
---

The **Advent 2300** sits in the sweet spot of the Advent range — more space than the 2150 without the bulk of the 2450. Ideal for ute owners who want genuine live-aboard capability on longer trips.
```

**`src/content/products/advent-2450-hardtop-slide-on.md`**
```yaml
---
title: "Advent 2450 Hardtop Slide-On"
slug: "advent-2450-hardtop-slide-on"
category: slide-on
tagline: "Maximum space. Maximum off-road credibility."
price: "$72,000"
status: available
onSale: false
featured: true
heroImage: "/images/products/advent-2450/advent-2450-01.jpg"
gallery:
  - "/images/products/advent-2450/advent-2450-02.jpg"
  - "/images/products/advent-2450/advent-2450-03.jpg"
  - "/images/products/advent-2450/advent-2450-04.jpg"
  - "/images/products/advent-2450/advent-2450-05.jpg"
keySpecs:
  - { label: "Base length", value: "2,450mm" }
  - { label: "TARE", value: "~800kg" }
  - { label: "Construction", value: "Full composite hardtop" }
  - { label: "Power", value: "200Ah lithium" }
specs:
  - { label: "Base length", value: "2,450mm" }
  - { label: "TARE weight", value: "~800kg" }
  - { label: "Construction", value: "Full composite hardtop" }
  - { label: "Battery", value: "200Ah lithium" }
  - { label: "Solar", value: "Solar ready" }
features:
  - "Full composite construction"
  - "Largest in the Advent range"
  - "200Ah lithium battery"
  - "Maximum interior living space"
  - "Solar ready"
  - "Designed for dual-cab trucks"
relatedSlugs: ["advent-2150-hardtop-slide-on", "advent-2300-hardtop-slide-on"]
seoTitle: "Advent 2450 Hardtop Slide-On Camper | ByondRV Queensland"
seoDesc: "The Advent 2450 hardtop slide-on from ByondRV. Maximum space, full composite, 200Ah lithium. The flagship of the Advent range."
---

The **Advent 2450** is the flagship of the Advent slide-on range. At 2,450mm base, it provides the most interior space available in a composite slide-on that still mounts cleanly on a dual-cab ute.
```

**`src/content/products/7ft-electric-poptop-slide-on.md`**
```yaml
---
title: "7ft Electric Pop-Top Slide-On"
slug: "7ft-electric-poptop-slide-on"
category: slide-on
tagline: "Stand-up comfort. Compact footprint."
price: "$54,800"
status: available
onSale: false
featured: false
heroImage: "/images/products/7ft-poptop/4.6m-poptop-truck-camper-01.jpg"
gallery:
  - "/images/products/7ft-poptop/4.6m-poptop-truck-camper-02.jpg"
  - "/images/products/7ft-poptop/4.6m-poptop-truck-camper-03.jpg"
keySpecs:
  - { label: "Base length", value: "4,600mm" }
  - { label: "Roof", value: "Electric pop-top" }
  - { label: "TARE", value: "~700kg" }
  - { label: "Ceiling height", value: "Standing room (raised)" }
specs:
  - { label: "Base length", value: "4,600mm" }
  - { label: "Roof type", value: "Electric pop-top" }
  - { label: "TARE weight", value: "~700kg" }
  - { label: "Construction", value: "Full composite" }
features:
  - "Electric pop-top roof — standing room when set up"
  - "Compact profile for highway travel"
  - "Full composite construction"
  - "Designed for utes and light trucks"
relatedSlugs: ["advent-2150-hardtop-slide-on", "3-5m-poptop-truck-camper"]
seoTitle: "7ft Electric Pop-Top Slide-On Camper | ByondRV Queensland"
seoDesc: "ByondRV's 7ft electric pop-top slide-on camper. Stand-up comfort when you need it, low profile on the road. Built in Queensland."
---

The **7ft Electric Pop-Top** solves the age-old camper dilemma: low enough on the road, tall enough once you're parked. The electric pop-top rises in seconds and gives you full standing room — no more crouching in your own camp.
```

**`src/content/products/4-7m-truck-camper.md`**
```yaml
---
title: "4.7m Truck Camper"
slug: "4-7m-truck-camper"
category: slide-on
tagline: "Serious truck. Serious camper."
price: "POA"
status: available
onSale: false
featured: false
heroImage: "/images/products/4-7m-truck-camper/4.7m Truck Camper 01.JPG"
gallery:
  - "/images/products/4-7m-truck-camper/4.7m Truck Camper 02.JPG"
  - "/images/products/4-7m-truck-camper/4.7m Truck Camper 03.JPG"
  - "/images/products/4-7m-truck-camper/4.7m Truck Camper 04.JPG"
keySpecs:
  - { label: "Base length", value: "4,700mm" }
  - { label: "Construction", value: "Full composite" }
  - { label: "Target trucks", value: "Iveco, Unimog, Isuzu" }
specs:
  - { label: "Base length", value: "4,700mm" }
  - { label: "Construction", value: "Full composite" }
features:
  - "Full composite construction"
  - "Designed for heavy-duty truck mounting"
  - "Spacious interior layout"
  - "Self-contained living"
relatedSlugs: ["3-5m-poptop-truck-camper", "3-5m-truck-camper-cabover"]
seoTitle: "4.7m Truck Camper | ByondRV Queensland"
seoDesc: "ByondRV's 4.7m truck camper — full composite construction, built for Iveco, Unimog, and Isuzu platform trucks. Made in Queensland."
---

The **4.7m Truck Camper** is built for the big rigs — Iveco Eurocargo, Unimog, Isuzu NPS. Full composite construction in a proper live-aboard layout for the travellers who go furthest.
```

**`src/content/products/3-5m-poptop-truck-camper.md`**
```yaml
---
title: "3.5m Pop-Top Truck Camper"
slug: "3-5m-poptop-truck-camper"
category: slide-on
tagline: "Low profile. Big living."
price: "$62,000"
status: available
onSale: false
featured: false
heroImage: "/images/products/3-5m-poptop/truck-3.5m-box-01.jpg"
gallery:
  - "/images/products/3-5m-poptop/truck-3.5m-box-02.jpg"
  - "/images/products/3-5m-poptop/truck-3.5m-box-03.jpg"
  - "/images/products/3-5m-poptop/truck-3.5m-box-04.jpg"
keySpecs:
  - { label: "Base length", value: "3,500mm" }
  - { label: "Roof", value: "Pop-top" }
  - { label: "TARE", value: "~600kg" }
  - { label: "Construction", value: "Full composite" }
specs:
  - { label: "Base length", value: "3,500mm" }
  - { label: "Roof type", value: "Pop-top" }
  - { label: "TARE weight", value: "~600kg" }
  - { label: "Construction", value: "Full composite" }
features:
  - "Pop-top roof — standing room when set up"
  - "Compact 3.5m footprint"
  - "Full composite construction"
  - "Designed for mid-size trucks"
relatedSlugs: ["3-5m-truck-camper-cabover", "7ft-electric-poptop-slide-on"]
seoTitle: "3.5m Pop-Top Truck Camper | ByondRV Queensland"
seoDesc: "ByondRV's 3.5m pop-top truck camper. Composite build, pop-top roof, compact footprint. Built in Queensland for serious off-road trucks."
---

The **3.5m Pop-Top Truck Camper** delivers maximum living in a compact package. Pop the roof and you're standing — keep it down and you're aerodynamic. Simple, reliable, purpose-built in Queensland.
```

**`src/content/products/3-5m-truck-camper-cabover.md`**
```yaml
---
title: "3.5m Truck Camper with Cabover"
slug: "3-5m-truck-camper-cabover"
category: slide-on
tagline: "Extra sleeping. Same tough footprint."
price: "$60,000"
status: available
onSale: false
featured: false
heroImage: "/images/products/3-5m-cabover/3.5m Truck Camper w- Cabover 01.JPG"
gallery:
  - "/images/products/3-5m-cabover/3.5m Truck Camper w- Cabover 02.JPG"
  - "/images/products/3-5m-cabover/3.5m Truck Camper w- Cabover 03.JPG"
keySpecs:
  - { label: "Base length", value: "3,500mm" }
  - { label: "Cabover", value: "Extra sleeping berth" }
  - { label: "TARE", value: "~650kg" }
  - { label: "Construction", value: "Full composite" }
specs:
  - { label: "Base length", value: "3,500mm" }
  - { label: "Cabover", value: "Yes — additional sleeping berth" }
  - { label: "TARE weight", value: "~650kg" }
  - { label: "Construction", value: "Full composite" }
features:
  - "Cabover extension for additional sleeping"
  - "Full composite construction"
  - "Compact 3.5m base footprint"
  - "Designed for mid-size trucks"
relatedSlugs: ["3-5m-poptop-truck-camper", "4-7m-truck-camper"]
seoTitle: "3.5m Truck Camper with Cabover | ByondRV Queensland"
seoDesc: "ByondRV's 3.5m truck camper with cabover sleeping section. Extra berth, full composite, built in Queensland."
---

The **3.5m Cabover Truck Camper** adds an extra sleeping berth over the cab — ideal for small families or couples who want the guest room. Same tough composite construction, same compact base.
```

**`src/content/products/mercedes-sprinter-motorhome.md`**
```yaml
---
title: "Mercedes Sprinter Motorhome"
slug: "mercedes-sprinter-motorhome"
category: slide-on
tagline: "The ultimate self-contained adventure vehicle. Custom built on Mercedes Sprinter."
price: "$225,000"
status: available
onSale: false
featured: true
heroImage: "/images/products/mercedes-sprinter/placeholder-sprinter.jpg"
gallery: []
keySpecs:
  - { label: "Base vehicle", value: "Mercedes Sprinter" }
  - { label: "Build", value: "Full custom motorhome" }
  - { label: "Price", value: "$225,000" }
  - { label: "Construction", value: "Full composite body" }
specs:
  - { label: "Base vehicle", value: "Mercedes-Benz Sprinter" }
  - { label: "Construction", value: "Full composite body" }
  - { label: "Price", value: "$225,000" }
features:
  - "Built on Mercedes-Benz Sprinter platform"
  - "Full composite motorhome body"
  - "Complete self-contained living"
  - "Custom Queensland build"
  - "Contact us for full specification details"
seoTitle: "Mercedes Sprinter Motorhome | Custom Build | ByondRV Queensland"
seoDesc: "ByondRV's custom Mercedes Sprinter motorhome. Full composite body, complete self-contained build. Queensland-made, $225,000."
---

The **Mercedes Sprinter Motorhome** is ByondRV's flagship build — a complete custom motorhome body on the trusted Mercedes-Benz Sprinter platform. Every component chosen for reliability and comfort on serious Australian roads.

Contact us for the full specification sheet and to discuss your build.
```

### 6c. Expedition products

**`src/content/products/unimog-overlander-camper.md`**
```yaml
---
title: "Unimog Overlander Camper"
slug: "expedition/unimog-overlander-camper"
category: expedition
tagline: "Where roads end, the Unimog begins."
price: "POA"
status: available
onSale: false
featured: true
heroImage: "/images/site/unimog-hero.jpg"
gallery:
  - "/images/site/mog2.jpg"
  - "/images/site/unimog-rear.png"
keySpecs:
  - { label: "Platform", value: "Mercedes-Benz Unimog" }
  - { label: "Build", value: "Full expedition camper" }
  - { label: "Clearance", value: "Portal axles — extreme" }
  - { label: "Price", value: "POA" }
specs:
  - { label: "Platform", value: "Mercedes-Benz Unimog U300/U400/U4000" }
  - { label: "Construction", value: "Full composite expedition body" }
  - { label: "Drive", value: "4WD with portal axles" }
  - { label: "Price", value: "POA — contact for build specification" }
features:
  - "Built on the legendary Mercedes-Benz Unimog platform"
  - "Portal axle drive for extreme terrain clearance"
  - "Full composite expedition body"
  - "Complete self-contained living quarters"
  - "Designed for extended remote expeditions"
  - "Custom-built to order — contact us to discuss"
seoTitle: "Unimog Overlander Camper | ByondRV Expedition Vehicles Queensland"
seoDesc: "ByondRV's Unimog Overlander Camper. Full composite expedition body on the Mercedes-Benz Unimog platform. Built for where roads end."
---

The **Unimog Overlander** is ByondRV's most extreme build. Mounted on the legendary Mercedes-Benz Unimog with portal axles, this is the expedition vehicle for people who genuinely leave all roads behind.

Full composite body, complete live-aboard spec, custom-built to order. Contact us to discuss your build.
```

**`src/content/products/unimog-poptop-camper.md`**
```yaml
---
title: "Unimog Pop-Top Camper"
slug: "expedition/unimog-poptop-camper"
category: expedition
tagline: "Extreme terrain. Standing room when you arrive."
price: "POA"
status: available
onSale: false
featured: false
heroImage: "/images/site/unimog-hero.jpg"
gallery: []
keySpecs:
  - { label: "Platform", value: "Mercedes-Benz Unimog" }
  - { label: "Roof", value: "Pop-top" }
  - { label: "Price", value: "POA" }
features:
  - "Unimog platform with portal axles"
  - "Pop-top roof for standing room"
  - "Full composite body"
  - "Custom-built to order"
relatedSlugs: ["expedition/unimog-overlander-camper"]
seoTitle: "Unimog Pop-Top Camper | ByondRV Expedition Vehicles"
seoDesc: "ByondRV Unimog pop-top camper. Extreme off-road capability with pop-top standing room. Custom expedition build, Queensland."
---

The **Unimog Pop-Top** combines the Unimog's unmatched off-road capability with the practicality of a pop-top roof — low profile on the move, full standing room once you've found your spot.
```

**`src/content/products/isuzu-nps-cabover-camper.md`**
```yaml
---
title: "Isuzu NPS Cabover Camper"
slug: "expedition/isuzu-nps-cabover-camper"
category: expedition
tagline: "Truck-based expedition capability. More accessible than Unimog, less compromise."
price: "POA"
status: available
onSale: false
featured: false
heroImage: "/images/site/hero-02.jpg"
gallery: []
keySpecs:
  - { label: "Platform", value: "Isuzu NPS" }
  - { label: "Build", value: "Cabover expedition camper" }
  - { label: "Drive", value: "4WD" }
  - { label: "Price", value: "POA" }
specs:
  - { label: "Platform", value: "Isuzu NPS 4WD" }
  - { label: "Construction", value: "Full composite body" }
  - { label: "Price", value: "POA — contact for specification" }
features:
  - "Built on Isuzu NPS 4WD platform"
  - "Full composite expedition body"
  - "Cabover design maximises living space"
  - "More accessible than Unimog — all Isuzu dealers"
  - "Custom-built to order"
relatedSlugs: ["expedition/isuzu-nps-poptop-camper", "expedition/unimog-overlander-camper"]
seoTitle: "Isuzu NPS Cabover Expedition Camper | ByondRV Queensland"
seoDesc: "ByondRV Isuzu NPS cabover expedition camper. Serious 4WD truck platform with custom composite body. Nationwide Isuzu dealer network."
---

The **Isuzu NPS Cabover** gives you serious expedition capability on a platform you can service anywhere in Australia. Full composite body, cabover design for maximum living space, and the Isuzu NPS's proven 4WD drivetrain.
```

**`src/content/products/isuzu-nps-poptop-camper.md`**
```yaml
---
title: "Isuzu NPS Pop-Top Camper"
slug: "expedition/isuzu-nps-poptop-camper"
category: expedition
tagline: "Pop-top freedom on a trusted truck platform."
price: "POA"
status: available
onSale: false
featured: false
heroImage: "/images/site/hero-02.jpg"
gallery: []
keySpecs:
  - { label: "Platform", value: "Isuzu NPS" }
  - { label: "Roof", value: "Pop-top" }
  - { label: "Drive", value: "4WD" }
  - { label: "Price", value: "POA" }
features:
  - "Isuzu NPS 4WD platform"
  - "Pop-top roof"
  - "Full composite construction"
  - "Custom-built to order"
relatedSlugs: ["expedition/isuzu-nps-cabover-camper", "expedition/unimog-overlander-camper"]
seoTitle: "Isuzu NPS Pop-Top Expedition Camper | ByondRV Queensland"
seoDesc: "ByondRV Isuzu NPS pop-top expedition camper. Proven truck platform, pop-top roof, full composite body. Built in Queensland."
---

The **Isuzu NPS Pop-Top** delivers expedition-grade capability with the practicality of a pop-top — standing room when you need it, low highway profile when you don't. Built on the proven Isuzu NPS 4WD.
```

**Step 1: Create placeholder image for Mercedes Sprinter** (product has no local images yet)
```bash
# Create a simple placeholder — will be replaced when client provides photos
cp public/images/site/unimog-hero.jpg public/images/products/mercedes-sprinter/placeholder-sprinter.jpg
```

**Step 2: Commit all product markdown**
```bash
git add src/content/
git commit -m "feat: add all 15 product content files (11 with data, 4 expedition placeholders)"
```

---

## Task 7: BaseHead SEO component

**Files:**
- Create: `src/components/BaseHead.astro`

```astro
---
interface Props {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'product';
  noIndex?: boolean;
  canonicalUrl?: string;
  structuredData?: object | object[];
}
const {
  title,
  description,
  image = '/images/site/unimog-hero.jpg',
  type = 'website',
  noIndex = false,
  canonicalUrl,
  structuredData,
} = Astro.props;
const canonical = canonicalUrl ?? Astro.url.href;
const ogImage = new URL(image, Astro.site).toString();
---
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<meta name="description" content={description} />
{noIndex && <meta name="robots" content="noindex" />}
<link rel="canonical" href={canonical} />

<!-- Open Graph -->
<meta property="og:type" content={type} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={ogImage} />
<meta property="og:url" content={canonical} />
<meta property="og:site_name" content="ByondRV" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={ogImage} />

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&family=Playfair+Display:ital,wght@1,400;1,600&display=swap" rel="stylesheet" />

<!-- Global CSS -->
<link rel="stylesheet" href="/styles/global.css" />

<!-- Structured Data -->
{structuredData && (
  <script type="application/ld+json" set:html={JSON.stringify(
    Array.isArray(structuredData) ? structuredData : [structuredData]
  )} />
)}

<!-- Site-wide LocalBusiness schema -->
<script type="application/ld+json">{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "ByondRV",
  "url": "https://beyondrv.com.au",
  "telephone": "+61430863819",
  "email": "beyondcaravans@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "77 Coleyville Rd",
    "addressLocality": "Mutdapilly",
    "addressRegion": "QLD",
    "postalCode": "4307",
    "addressCountry": "AU"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": -27.66,
    "longitude": 152.55
  }
})}</script>
```

**Step 1: Create the component, commit**
```bash
git add src/components/BaseHead.astro
git commit -m "feat: BaseHead SEO component with OG, Twitter, structured data, LocalBusiness schema"
```

---

## Task 8: Header component

**Files:**
- Create: `src/components/Header.astro`

Port the nav from `mockup.html` lines 664–678, converting to Astro.

```astro
---
const navLinks = [
  { href: '/our-caravans/', label: 'Our Caravans' },
  { href: '/our-slide-on-campers/', label: 'Slide-Ons' },
  { href: '/expedition/', label: 'Expedition' },
  { href: '/on-sale/', label: 'On Sale' },
  { href: '/custom/', label: 'Custom' },
  { href: '/about-us/', label: 'About' },
];
const { activePath = '' } = Astro.props;
---
<nav id="navbar">
  <a href="/" class="nav-logo">
    <img src="/images/site/logo.jpg" alt="ByondRV logo" width="36" height="36" />
    <span class="nav-logo-text">Beyond<span>RV</span></span>
  </a>
  <button class="nav-hamburger" id="navHamburger" aria-label="Open menu" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
  <ul class="nav-links" id="navLinks">
    {navLinks.map(({ href, label }) => (
      <li><a href={href} class={activePath.startsWith(href) ? 'active' : ''}>{label}</a></li>
    ))}
  </ul>
  <a href="/inquiry-form/" class="nav-cta">Enquire Now</a>
</nav>

<script>
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');

  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  hamburger?.addEventListener('click', () => {
    const open = navLinks?.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
  });
</script>
```

**Step 1: Commit**
```bash
git add src/components/Header.astro
git commit -m "feat: Header nav component with scroll state and mobile hamburger"
```

---

## Task 9: Footer component

**Files:**
- Create: `src/components/Footer.astro`

Port from `mockup.html` lines 572–618.

```astro
---
const year = new Date().getFullYear();
---
<footer>
  <div class="footer-grid">
    <div>
      <div class="footer-brand-name">Beyond<span>RV</span></div>
      <p class="footer-desc">Queensland-built slide-on campers, truck campers, and expedition vehicles. Engineered for where Australian roads end.</p>
      <div class="footer-socials">
        <a href="https://www.facebook.com/beyondrvau" class="footer-social" aria-label="Facebook" target="_blank" rel="noopener">f</a>
        <a href="https://www.instagram.com/beyond_rv/" class="footer-social" aria-label="Instagram" target="_blank" rel="noopener">ig</a>
        <a href="https://www.youtube.com/@BeyondRV" class="footer-social" aria-label="YouTube" target="_blank" rel="noopener">yt</a>
      </div>
    </div>
    <div>
      <div class="footer-col-title">Products</div>
      <ul class="footer-links">
        <li><a href="/our-caravans/">Our Caravans</a></li>
        <li><a href="/our-slide-on-campers/">Slide-On Campers</a></li>
        <li><a href="/expedition/">Expedition Vehicles</a></li>
        <li><a href="/on-sale/">On Sale</a></li>
        <li><a href="/custom/">Custom Build</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Company</div>
      <ul class="footer-links">
        <li><a href="/about-us/">About Us</a></li>
        <li><a href="/warranty/">Warranty</a></li>
        <li><a href="/privacy-policy/">Privacy Policy</a></li>
        <li><a href="/inquiry-form/">Contact Us</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Contact</div>
      <ul class="footer-links">
        <li><a href="tel:+61430863819">0430 863 819</a></li>
        <li><a href="mailto:beyondcaravans@gmail.com">beyondcaravans@gmail.com</a></li>
        <li>77 Coleyville Rd<br />Mutdapilly QLD 4307</li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© {year} ByondRV. All rights reserved.</span>
    <div class="footer-badge">
      <span class="footer-badge-dot"></span>
      Queensland Built
    </div>
  </div>
</footer>
```

**Step 1: Commit**
```bash
git add src/components/Footer.astro
git commit -m "feat: Footer component with nav, contact, and social links"
```

---

## Task 10: BaseLayout

**Files:**
- Create: `src/layouts/BaseLayout.astro`

```astro
---
import BaseHead from '../components/BaseHead.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'product';
  noIndex?: boolean;
  canonicalUrl?: string;
  structuredData?: object | object[];
  activePath?: string;
}
const { activePath = '', ...headProps } = Astro.props;
---
<!doctype html>
<html lang="en">
<head>
  <BaseHead {...headProps} />
</head>
<body>
  <div id="cursor" aria-hidden="true"></div>
  <div id="cursor-ring" aria-hidden="true"></div>
  <Header activePath={activePath} />
  <main>
    <slot />
  </main>
  <Footer />
  <script>
    // Custom cursor
    const cursor = document.getElementById('cursor');
    const ring = document.getElementById('cursor-ring');
    if (cursor && ring && !window.matchMedia('(pointer: coarse)').matches) {
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        ring.style.left = e.clientX + 'px';
        ring.style.top = e.clientY + 'px';
      }, { passive: true });
    }
    // Scroll reveals
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  </script>
</body>
</html>
```

**Step 1: Commit**
```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: BaseLayout with head, header, footer, cursor, scroll reveal"
```

---

## Task 11: ProductCard component

**Files:**
- Create: `src/components/ProductCard.astro`

```astro
---
interface Props {
  title: string;
  slug: string;
  category: string;
  tagline: string;
  price: string;
  status: string;
  heroImage: string;
  priceBadge?: string;
}
const { title, slug, category, tagline, price, status, heroImage, priceBadge } = Astro.props;
const href = slug.startsWith('expedition/') ? `/${slug}/` : `/${slug}/`;
const isComingSoon = status === 'coming-soon';
---
<article class="product-card reveal">
  <a href={href} class="product-card-inner">
    <div class="product-card-image">
      <img src={heroImage} alt={title} loading="lazy" />
      <div class="product-card-overlay"></div>
      {priceBadge && <span class="badge">{priceBadge}</span>}
      {isComingSoon && <span class="coming-soon-badge">Coming Soon</span>}
    </div>
    <div class="product-card-body">
      <span class="product-card-category">{category}</span>
      <h3 class="product-card-title">{title}</h3>
      <p class="product-card-tagline">{tagline}</p>
      <div class="product-card-footer">
        <span class="product-card-price">{price}</span>
        <span class="product-card-cta">{isComingSoon ? 'Register Interest →' : 'View Details →'}</span>
      </div>
    </div>
  </a>
</article>
```

**Step 1: Commit**
```bash
git add src/components/ProductCard.astro
git commit -m "feat: ProductCard component for category grids"
```

---

## Task 12: Product page layout (ProductLayout.astro)

**Files:**
- Create: `src/layouts/ProductLayout.astro`

This is the shared template for all 15 product pages.

```astro
---
import BaseLayout from './BaseLayout.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  product: CollectionEntry<'products'>;
}
const { product } = Astro.props;
const { data } = product;
const isComingSoon = data.status === 'coming-soon';

const enquiryUrl = `/inquiry-form/?product=${encodeURIComponent(data.slug)}&name=${encodeURIComponent(data.title)}`;

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": data.title,
  "description": data.seoDesc,
  "brand": { "@type": "Brand", "name": "ByondRV" },
  "image": new URL(data.heroImage, 'https://beyondrv.com.au').toString(),
  "offers": {
    "@type": "Offer",
    "priceCurrency": "AUD",
    "price": data.price.replace(/[^0-9]/g, '') || undefined,
    "availability": isComingSoon ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "ByondRV" }
  }
};
---
<BaseLayout
  title={data.seoTitle ?? `${data.title} | ByondRV`}
  description={data.seoDesc ?? data.tagline}
  image={data.heroImage}
  type="product"
  canonicalUrl={data.canonicalUrl}
  structuredData={productSchema}
  activePath={`/${data.slug}/`}
>
  <!-- Hero / Gallery -->
  <section class="product-hero-section">
    <div class="product-gallery">
      <div class="product-gallery-main">
        <img id="productHeroImg" src={data.heroImage} alt={data.title} />
      </div>
      {data.gallery.length > 0 && (
        <div class="product-gallery-thumbs">
          {[data.heroImage, ...data.gallery].map((img, i) => (
            <button class={`thumb-btn${i === 0 ? ' active' : ''}`} data-src={img} aria-label={`View image ${i + 1}`}>
              <img src={img} alt={`${data.title} view ${i + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
    <div class="product-hero-info">
      <div class="section-eyebrow">
        <div class="section-eyebrow-line"></div>
        <span class="section-eyebrow-text">{data.category}</span>
      </div>
      <h1 class="product-title">{data.title}</h1>
      <p class="product-tagline">{data.tagline}</p>
      <div class="product-price-block">
        {data.priceBadge && <span class="badge">{data.priceBadge}</span>}
        {isComingSoon && <span class="coming-soon-badge">Coming Soon</span>}
        <span class="product-price">{data.price}</span>
      </div>
      {data.keySpecs.length > 0 && (
        <div class="key-specs">
          {data.keySpecs.map(s => (
            <div class="key-spec">
              <span class="key-spec-label">{s.label}</span>
              <span class="key-spec-value">{s.value}</span>
            </div>
          ))}
        </div>
      )}
      <div class="product-ctas">
        {isComingSoon ? (
          <a href={enquiryUrl} class="btn-primary">Register Interest</a>
        ) : (
          <>
            <a href={enquiryUrl} class="btn-primary">Enquire Now</a>
            <a href={enquiryUrl + '&intent=buy'} class="btn-ghost">Buy Now</a>
          </>
        )}
      </div>
    </div>
  </section>

  <!-- Description -->
  <section class="product-description container">
    <div class="product-description-body prose">
      <slot />
    </div>
  </section>

  <!-- Full Specs Table -->
  {data.specs && data.specs.length > 0 && (
    <section class="product-specs-section container">
      <h2 class="section-title">Full Specifications</h2>
      <table class="specs-table">
        <tbody>
          {data.specs.map(row => (
            <tr>
              <th>{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )}

  <!-- Features -->
  {data.features && data.features.length > 0 && (
    <section class="product-features-section container">
      <h2 class="section-title">Features</h2>
      <ul class="features-list">
        {data.features.map(f => <li>{f}</li>)}
      </ul>
    </section>
  )}

  <!-- FAQ -->
  {data.faq && data.faq.length > 0 && (
    <section class="product-faq-section container">
      <h2 class="section-title">FAQ</h2>
      <div class="faq-list">
        {data.faq.map(({ q, a }) => (
          <div class="faq-item">
            <button class="faq-question">{q}<span class="faq-icon">+</span></button>
            <div class="faq-answer"><p>{a}</p></div>
          </div>
        ))}
      </div>
    </section>
  )}

  <!-- Enquiry CTA band -->
  <section class="product-enquiry-band">
    <div class="container">
      <h2>Ready to make it yours?</h2>
      <p>Talk to the team — we're based in Mutdapilly, QLD, and we build every camper ourselves.</p>
      <div class="product-ctas">
        {isComingSoon ? (
          <a href={enquiryUrl} class="btn-primary">Register Interest</a>
        ) : (
          <>
            <a href={enquiryUrl} class="btn-primary">Enquire Now</a>
            <a href="tel:+61430863819" class="btn-ghost">Call 0430 863 819</a>
          </>
        )}
      </div>
    </div>
  </section>
</BaseLayout>

<script>
  // Thumbnail gallery switcher
  document.querySelectorAll<HTMLButtonElement>('.thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const heroImg = document.getElementById('productHeroImg') as HTMLImageElement;
      if (heroImg) heroImg.src = btn.dataset.src ?? '';
      document.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // FAQ accordion
  document.querySelectorAll<HTMLButtonElement>('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.faq-item')?.classList.toggle('open');
    });
  });
</script>
```

**Step 1: Commit**
```bash
git add src/layouts/ProductLayout.astro
git commit -m "feat: ProductLayout template with gallery, specs, features, FAQ, enquiry CTA"
```

---

## Task 13: Dynamic product pages

**Files:**
- Create: `src/pages/[...slug].astro`
- Create: `src/pages/expedition/[slug].astro`

**`src/pages/[...slug].astro`** — handles top-level product slugs
```astro
---
import { getCollection } from 'astro:content';
import ProductLayout from '../layouts/ProductLayout.astro';

export async function getStaticPaths() {
  const products = await getCollection('products');
  return products
    .filter(p => !p.data.slug.startsWith('expedition/'))
    .map(p => ({ params: { slug: p.data.slug }, props: { product: p } }));
}
const { product } = Astro.props;
const { Content } = await product.render();
---
<ProductLayout product={product}>
  <Content />
</ProductLayout>
```

**`src/pages/expedition/[slug].astro`** — handles expedition sub-slugs
```astro
---
import { getCollection } from 'astro:content';
import ProductLayout from '../../layouts/ProductLayout.astro';

export async function getStaticPaths() {
  const products = await getCollection('products');
  return products
    .filter(p => p.data.slug.startsWith('expedition/'))
    .map(p => ({
      params: { slug: p.data.slug.replace('expedition/', '') },
      props: { product: p }
    }));
}
const { product } = Astro.props;
const { Content } = await product.render();
---
<ProductLayout product={product}>
  <Content />
</ProductLayout>
```

**Step 1: Commit**
```bash
git add src/pages/
git commit -m "feat: dynamic product page routes for top-level and expedition slugs"
```

---

## Task 14: Category pages

**Files:**
- Create: `src/pages/our-caravans/index.astro`
- Create: `src/pages/our-slide-on-campers/index.astro`
- Create: `src/pages/expedition/index.astro`

Each fetches products by category and renders a grid.

**`src/pages/our-caravans/index.astro`**
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProductCard from '../../components/ProductCard.astro';

const products = (await getCollection('products'))
  .filter(p => p.data.category === 'caravan')
  .sort((a, b) => (a.data.status === 'coming-soon' ? 1 : 0) - (b.data.status === 'coming-soon' ? 1 : 0));

const schema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "ByondRV Caravans",
  "url": "https://beyondrv.com.au/our-caravans/",
  "hasPart": products.map(p => ({
    "@type": "Product",
    "name": p.data.title,
    "url": `https://beyondrv.com.au/${p.data.slug}/`
  }))
};
---
<BaseLayout
  title="Off-Road Caravans | ByondRV Queensland"
  description="ByondRV builds composite off-road caravans for couples and families. The Sunpatch range — built in Queensland for serious Australian travel."
  activePath="/our-caravans/"
  structuredData={schema}
>
  <section class="page-hero">
    <div class="page-hero-bg" style="background-image: url('/images/products/sunpatch-15xc/sunpatch-15xc-01.jpg')"></div>
    <div class="hero-overlay"></div>
    <div class="page-hero-content">
      <div class="section-eyebrow"><div class="section-eyebrow-line"></div><span class="section-eyebrow-text">Off-Road Caravans</span></div>
      <h1 class="hero-title">Our Caravans</h1>
      <p class="hero-sub">Queensland-built off-road caravans for couples and families who refuse to stay on the beaten track.</p>
    </div>
  </section>

  <section class="category-grid container">
    <div class="product-grid">
      {products.map(p => (
        <ProductCard
          title={p.data.title}
          slug={p.data.slug}
          category="Caravan"
          tagline={p.data.tagline}
          price={p.data.price}
          status={p.data.status}
          heroImage={p.data.heroImage}
          priceBadge={p.data.priceBadge}
        />
      ))}
    </div>
  </section>
</BaseLayout>
```

Create equivalent files for slide-ons (`/our-slide-on-campers/`) and expedition (`/expedition/`) — same pattern, different category filter and copy.

**Step 1: Commit**
```bash
git add src/pages/our-caravans/ src/pages/our-slide-on-campers/ src/pages/expedition/index.astro
git commit -m "feat: category pages — caravans, slide-ons, expedition"
```

---

## Task 15: Home page

**Files:**
- Create: `src/pages/index.astro`

Port sections from `mockup.html`:
1. Hero (hero-bg + overlay + content — use `unimog-hero.jpg`)
2. Orange ticker strip
3. Range overview — 3 cards (Caravans / Slide-Ons / Expedition)
4. Featured products (3 cards: advent-2150, sunpatch-15xc, unimog-overlander)
5. Why ByondRV (trust grid — 4 value props)
6. Expedition highlight callout
7. Testimonials placeholder
8. CTA band → /inquiry-form/
9. Include Organization + WebSite structured data

**Step 1: Create `src/pages/index.astro`** — port `mockup.html` body content into Astro template, replace placeholder `<img src="...">` with correct public path references.

**Step 2: Commit**
```bash
git add src/pages/index.astro
git commit -m "feat: home page with hero, range overview, featured products, trust, expedition callout, CTA"
```

---

## Task 16: On Sale page

**Files:**
- Create: `src/pages/on-sale/index.astro`

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProductCard from '../../components/ProductCard.astro';
const products = (await getCollection('products')).filter(p => p.data.onSale);
---
<BaseLayout title="On Sale | Current Stock | ByondRV" description="Current in-stock ByondRV campers available for immediate delivery. Check what's on sale now.">
  <section class="page-hero page-hero--short">
    <div class="page-hero-content">
      <h1 class="hero-title">On Sale</h1>
      <p class="hero-sub">Ready-to-go stock, priced to move.</p>
    </div>
  </section>
  <section class="container">
    {products.length === 0
      ? <p class="muted-text" style="padding: 4rem 0; text-align: center;">No current specials — check back soon or <a href="/inquiry-form/">contact us</a> about availability.</p>
      : <div class="product-grid">{products.map(p => <ProductCard title={p.data.title} slug={p.data.slug} category={p.data.category} tagline={p.data.tagline} price={p.data.price} status={p.data.status} heroImage={p.data.heroImage} priceBadge={p.data.priceBadge} />)}</div>
    }
  </section>
</BaseLayout>
```

---

## Task 17: Enquiry form page

**Files:**
- Create: `src/pages/inquiry-form/index.astro`

The form uses Netlify Forms. The pre-fill query params (`?product=`, `?name=`) are read client-side to pre-fill the Message field.

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
const schema = { "@context": "https://schema.org", "@type": "ContactPage", "name": "ByondRV Enquiry Form", "url": "https://beyondrv.com.au/inquiry-form/" };
---
<BaseLayout title="Enquire | ByondRV" description="Get in touch with ByondRV. Tell us what you're interested in and when to call you back." structuredData={schema}>
  <section class="page-hero page-hero--short">
    <div class="page-hero-content">
      <div class="section-eyebrow"><div class="section-eyebrow-line"></div><span class="section-eyebrow-text">Get In Touch</span></div>
      <h1 class="hero-title">Enquire Now</h1>
      <p class="hero-sub">Tell us what you're after and when's a good time for us to give you a call.</p>
    </div>
  </section>

  <section class="enquiry-form-section container">
    <form name="beyondrv-enquiry" method="POST" data-netlify="true" netlify-honeypot="bot-field" class="enquiry-form" id="enquiryForm">
      <input type="hidden" name="form-name" value="beyondrv-enquiry" />
      <input type="hidden" name="product_interest" id="productInterestField" value="" />
      <p style="display:none"><label>Don't fill this out: <input name="bot-field" /></label></p>

      <div class="form-field">
        <label class="form-label" for="name">Full Name <span aria-hidden="true">*</span></label>
        <input class="form-input" type="text" id="name" name="name" required autocomplete="name" />
      </div>

      <div class="form-field">
        <label class="form-label" for="email">Email <span aria-hidden="true">*</span></label>
        <input class="form-input" type="email" id="email" name="email" required autocomplete="email" />
      </div>

      <div class="form-field">
        <label class="form-label" for="message">Message <span aria-hidden="true">*</span></label>
        <textarea class="form-textarea" id="message" name="message" rows="5" required></textarea>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label class="form-label" for="callbackDate">When should we call you? (Date)</label>
          <input class="form-input" type="date" id="callbackDate" name="callback_date" />
        </div>
        <div class="form-field">
          <label class="form-label" for="callbackTime">Preferred call-back time</label>
          <input class="form-input" type="time" id="callbackTime" name="callback_time" />
        </div>
      </div>

      <!-- Cloudflare Turnstile placeholder — add site key before launch -->
      <div class="cf-turnstile" data-sitekey="PLACEHOLDER_TURNSTILE_SITEKEY"></div>

      <button type="submit" class="btn-primary form-submit">Send Enquiry</button>
    </form>
  </section>
</BaseLayout>

<script>
  // Pre-fill message from query string
  const params = new URLSearchParams(window.location.search);
  const product = params.get('name') ?? params.get('product');
  const msgField = document.getElementById('message') as HTMLTextAreaElement;
  const hiddenField = document.getElementById('productInterestField') as HTMLInputElement;
  if (product && msgField) {
    msgField.value = `I'm interested in the ${decodeURIComponent(product)}. `;
    msgField.focus();
    msgField.setSelectionRange(msgField.value.length, msgField.value.length);
  }
  if (product && hiddenField) {
    hiddenField.value = decodeURIComponent(product);
  }
</script>
```

**Step 1: Commit**
```bash
git add src/pages/inquiry-form/
git commit -m "feat: enquiry form page with Netlify Forms, pre-fill logic, Turnstile placeholder"
```

---

## Task 18: Supporting static pages

**Files:**
- Create: `src/pages/about-us/index.astro`
- Create: `src/pages/warranty/index.astro`
- Create: `src/pages/custom/index.astro`
- Create: `src/pages/privacy-policy/index.astro`

Each follows the same pattern: BaseLayout + page-hero + content container. Use placeholder copy marked with `<!-- TODO: replace with client-supplied content -->`.

**About Us** — Sections: company story, Queensland workshop, certifications, address map placeholder.

**Warranty** — Port warranty terms from existing WordPress site. Frame with dark-themed content section.

**Custom** — Value prop for custom builds, process overview (3 steps), gallery placeholder, CTA to enquiry form with `?product=custom-build` pre-fill.

**Privacy Policy** — APP-compliant draft. Sections: data collected (enquiry submissions, analytics via PostHog, chatbot conversations), use of data, third parties (PostHog, Netlify, Cloudflare), user rights, contact for privacy queries. Mark with TODO: legal review before launch.

**Step 1: Create all four pages, commit**
```bash
git add src/pages/about-us/ src/pages/warranty/ src/pages/custom/ src/pages/privacy-policy/
git commit -m "feat: static pages — about, warranty, custom build, privacy policy"
```

---

## Task 19: 404 page

**Files:**
- Create: `src/pages/404.astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Page Not Found | ByondRV" description="This page has wandered off the map." noIndex={true}>
  <section class="not-found-section">
    <div class="not-found-content">
      <div class="section-eyebrow"><div class="section-eyebrow-line"></div><span class="section-eyebrow-text">404</span></div>
      <h1 class="hero-title">Looks like you've<br />gone <span class="accent">bush</span>.</h1>
      <p class="hero-sub">This page has wandered off the map. Happens to the best of us. Let's get you back somewhere with a view.</p>
      <p class="not-found-sub-copy"><em>Even the Unimog couldn't get here.</em></p>
      <div class="hero-actions">
        <a href="/" class="btn-primary">Back to Home</a>
        <a href="/our-slide-on-campers/" class="btn-ghost">Browse Campers</a>
        <a href="/inquiry-form/" class="btn-ghost">Get in Touch</a>
      </div>
    </div>
    <div class="not-found-image">
      <img src="/images/site/unimog-rear.png" alt="Unimog in the distance" loading="lazy" />
    </div>
  </section>
</BaseLayout>
```

**Step 1: Commit**
```bash
git add src/pages/404.astro
git commit -m "feat: 404 page — 'gone bush' tone, 3 CTAs"
```

---

## Task 20: robots.txt + public assets

**Files:**
- Create: `public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://beyondrv.com.au/sitemap-index.xml
```

**Step 1: Commit**
```bash
git add public/robots.txt
git commit -m "feat: robots.txt allowing all crawlers"
```

---

## Task 21: Build + verify

**Step 1: Run build**
```bash
npm run build
```
Expected: no TypeScript errors, 25+ pages generated in `dist/`

**Step 2: Run preview**
```bash
npm run preview
```

**Step 3: Verify key routes exist**
```bash
ls dist/ && ls dist/our-caravans/ && ls dist/our-slide-on-campers/ && \
  ls dist/expedition/ && ls dist/advent-2150-hardtop-slide-on/ && \
  ls dist/inquiry-form/
```

**Step 4: Check redirects in netlify.toml are syntactically valid**
```bash
grep -A3 "\[\[redirects\]\]" netlify.toml
```

**Step 5: Commit final**
```bash
git add -A
git commit -m "feat: Phase A foundation — full Astro build verified"
```

---

## Summary

25 pages | 1 content collection (15 products) | 1 dynamic route | 3 redirects | Full SEO scaffolding | Netlify Forms enquiry form

Missing assets flagged in content (Mercedes Sprinter photos, Expedition product photos) — all use fallback placeholders until client supplies them. Cloudflare Turnstile site key is a placeholder — replace before launch.
