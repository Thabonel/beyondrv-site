# BeyondRV New Site — Handover Document

**Live site:** https://beyondrv.netlify.app  
**GitHub repo:** https://github.com/Thabonel/beyondrv-site  
**Netlify dashboard:** https://app.netlify.com/projects/beyondrv  
**Local project:** `/Users/thabonel/Code/Byond_RV/`  
**Last updated:** April 2026

---

## 1. What Was Built

A full static marketing site replacing the old WordPress/Elementor site. Built with **Astro 4** and hosted on **Netlify**.

### What's live now
- 27 pages — home, 3 category pages, 11 product pages, 4 expedition pages, enquiry form, about, warranty, privacy policy, 404
- Full design system (dark theme, orange accent, Bebas Neue headings, custom cursor)
- Product content system — each product is a Markdown file, no database
- Enquiry form with Netlify Forms (submissions go to the Netlify dashboard and can be forwarded to email)
- Three-layer referral/commission attribution tracking (see §6)
- SEO scaffolding — structured data (JSON-LD), OG/Twitter meta, robots.txt on every page
- 3 legacy URL redirects (old WordPress slugs → new category pages)
- Security headers via netlify.toml
- New BeyondRV logo

### What's not built yet (Phase A remainder)
- AI admin chat (owner types "drop Sunpatch price $5k" → goes live in 30 sec)
- Customer-facing site chatbot (Claude Haiku, answers product Q&A)
- PostHog analytics + cookie consent banner

### Phase B & C (after Phase A complete)
- Stripe payment / deposit (Phase B)
- 3D camper configurator (Phase C)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Astro 4 (static output) |
| Hosting | Netlify (free tier) |
| Content | Markdown files in `src/content/products/` |
| Styling | Single CSS file — `src/styles/global.css` |
| Forms | Netlify Forms (no server required) |
| Images | Stored in `public/images/` |
| Deploy | Netlify CLI (`netlify deploy --prod --dir dist`) |

---

## 3. Project Structure

```
src/
  components/
    BaseHead.astro       ← SEO meta, structured data, fonts
    Header.astro         ← Nav bar, hamburger menu
    Footer.astro         ← Footer grid, socials
    ProductCard.astro    ← Card used on category pages
  content/
    config.ts            ← Zod schema for product fields
    products/
      sunpatch-15xc-couples-offroad-van.md   ← One file per product
      advent-2150-hardtop-slide-on.md
      expedition/
        unimog-overlander-camper.md          ← Expedition products in subfolder
        ...
  layouts/
    BaseLayout.astro     ← Wraps every page (header + footer + cursor + referral script)
    ProductLayout.astro  ← Template for all product pages (gallery, specs, FAQ, CTAs)
  pages/
    index.astro          ← Home page
    our-caravans/        ← Category pages
    our-slide-on-campers/
    expedition/
    on-sale/
    inquiry-form/
    about-us/
    custom/
    warranty/
    privacy-policy/
    404.astro
    [...slug].astro      ← Dynamic route for non-expedition products
    expedition/[slug].astro ← Dynamic route for expedition products
  styles/
    global.css           ← Entire design system (1000+ lines)

public/
  images/
    site/                ← Logo, hero images, Unimog photos
    products/
      sunpatch-15xc/     ← Product photos, named sunpatch-15xc-01.jpg etc.
      advent-2150/
      ...
  robots.txt

docs/                    ← This folder — handover docs, plans, old HTML files
netlify.toml             ← Build config, redirects, security headers
astro.config.mjs         ← Astro config (site URL, integrations)
package.json
```

---

## 4. How to Make Changes

### Edit a product price, tagline, or spec

Open the relevant Markdown file in `src/content/products/`. Every product is self-contained. Example — to change the Sunpatch 15-XC price:

```
src/content/products/sunpatch-15xc-couples-offroad-van.md
```

Change the `price:` field in the frontmatter at the top of the file. Save, build, deploy.

### Add a new product

1. Create a new `.md` file in `src/content/products/` (or `expedition/` for expedition builds)
2. Copy the frontmatter structure from an existing product
3. Add product photos to `public/images/products/<product-slug>/`
4. Reference the hero image and gallery in the frontmatter

The route is generated automatically from the filename — `my-new-camper.md` → `/my-new-camper/`

### Edit page copy

Each page is in `src/pages/`. Open the relevant `.astro` file and edit the HTML directly.

### Change the nav links

Edit the `navLinks` array in `src/components/Header.astro`.

### Add a redirect

Add a line to the `[[redirects]]` section in `netlify.toml`:

```toml
[[redirects]]
  from = "/old-url/"
  to   = "/new-url/"
  status = 301
```

---

## 5. How to Deploy

### Prerequisites
- Node.js 20
- Netlify CLI: `npm install -g netlify-cli`
- Logged into Netlify CLI: `netlify login`

### Deploy command (from the project folder)

```bash
npm run build && netlify deploy --prod --dir dist
```

That's it. Build takes ~2 seconds, upload takes a few minutes depending on how many images changed.

### After pushing code changes to GitHub

GitHub does **not** trigger an automatic Netlify build — images are excluded from git and need to be present locally for the build. Always deploy via the CLI command above.

### Adding new product photos to a deployed site

1. Add the images to `public/images/products/<product-slug>/`
2. Reference them in the product's Markdown frontmatter
3. Run the deploy command — Netlify CDN-diffs files and only uploads what changed

---

## 6. Referral / Commission Tracking

Thabo Nel earns a commission on expedition build sales originating from his marketing. The tracking system has three layers that together make attribution as airtight as possible.

### How to create a referral link

Add `?ref=thabo` to any BeyondRV URL you share. Optionally add UTM parameters for campaign-level detail:

```
https://beyondrv.netlify.app/expedition/unimog-overlander-camper/?ref=thabo&utm_source=instagram&utm_campaign=unimog_apr26
```

You can use any page — home page, category page, specific product page. The referral is stored on first visit regardless of which page they land on.

### How it works (Layer 1 — primary)

When a visitor clicks a link containing `?ref=thabo`, the site stores a referral record in their browser's `localStorage` with a **30-day expiry**. This record includes:

- Who referred them (`ref = thabo`)
- Which page they first landed on
- Exact timestamp of first click
- Which UTM campaign drove the visit

**This survives:** browser close, navigating away, coming back days later, typing the URL directly.

**First-touch wins:** if the same visitor later clicks a different link (without `?ref=`), their original referral is NOT overwritten.

### When they submit an enquiry form

Six fields are automatically included in every Netlify form submission:

| Field | What it contains |
|---|---|
| `referral_partner` | `thabo` (from `?ref=thabo`) |
| `referral_entry_page` | Which page they first landed on |
| `referral_first_touch` | ISO timestamp of first click |
| `referral_utm_source` | e.g. `instagram` |
| `referral_utm_campaign` | e.g. `unimog_apr26` |
| `referral_source_self_reported` | Customer's dropdown selection |

### How to check who referred a submission

1. Go to https://app.netlify.com/projects/beyondrv
2. Click **Forms** in the left sidebar
3. Click **beyondrv-enquiry**
4. Open any submission — scroll down to see all fields including the referral fields

### Layer 2 — UTM-only (no ref=)

If a visitor comes from a UTM-tagged link without `?ref=`, their `utm_source` and `utm_campaign` are still stored and submitted. Useful for proving a campaign drove traffic even without the explicit `ref=` parameter.

### Layer 3 — Dropdown (customer self-reported)

The enquiry form has a "How did you hear about us?" dropdown. Options include "Referred by Thabo Nel". Even if a customer cleared their browser data, they can still self-identify as a Thabo referral.

---

## 7. Enquiry Form Setup

**Form name in Netlify:** `beyondrv-enquiry`

### Setting up email notifications

By default, submissions sit in the Netlify dashboard. To get email alerts:

1. Go to https://app.netlify.com/projects/beyondrv
2. **Forms → beyondrv-enquiry → Form notifications**
3. Add email address for notifications

### Fields submitted with every enquiry

| Field | Description |
|---|---|
| `name` | Customer full name |
| `email` | Customer email |
| `message` | Their message (auto-prefilled with product context) |
| `callback_date` | When they want a call back |
| `callback_time` | Preferred call time |
| `product_interest` | Product slug (e.g. `expedition/unimog-overlander-camper`) |
| `enquiry_intent` | `buy`, `register`, or blank |
| `referral_partner` | e.g. `thabo` |
| `referral_entry_page` | First page they visited |
| `referral_first_touch` | Timestamp of first click |
| `referral_utm_source` | Platform (instagram, facebook, etc.) |
| `referral_utm_campaign` | Campaign name |
| `referral_source_self_reported` | Customer dropdown answer |

---

## 8. Custom Domain (beyondrv.com.au)

DNS cutover is intentionally deferred until Phase B and Phase C are also complete. When ready:

1. In Netlify: **Site settings → Domain management → Add custom domain** → add `beyondrv.com.au`
2. Netlify will show you the DNS records to set (either CNAME or A record)
3. Update DNS at your domain registrar
4. Netlify handles SSL automatically via Let's Encrypt

**Important:** The current WordPress site at beyondrv.com.au stays live until cutover. Do not change DNS until all three phases are complete and reviewed.

---

## 9. File Naming Conventions

Product images must use lowercase, hyphenated filenames (no spaces, no uppercase):

- Good: `unimog-overlander-01.jpg`
- Bad: `Unimog Overlander 01.JPG`

Product folders match the product slug:
- `public/images/products/sunpatch-15xc/`
- `public/images/products/advent-2150/`
- `public/images/products/expedition/` (for expedition product images)

---

## 10. Key Contacts & Credentials

| What | Details |
|---|---|
| Site email | beyondcaravans@gmail.com |
| Phone | 0430 863 819 |
| Workshop address | 77 Coleyville Rd, Mutdapilly QLD 4307 |
| Netlify account | thabonel0@gmail.com |
| GitHub repo | https://github.com/Thabonel/beyondrv-site |
| Facebook | https://www.facebook.com/BeyondCaravans |
| Instagram | https://www.instagram.com/beyondrvaus/ |
| YouTube | https://www.youtube.com/@beyondrvcampers4129 |
