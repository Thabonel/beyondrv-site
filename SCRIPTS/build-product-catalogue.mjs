/**
 * Build-time script: generates netlify/functions/product-catalogue.json,
 * netlify/functions/chatbot-knowledge.json, public/llms.txt, and public/llms-full.txt.
 *
 * Usage:  node SCRIPTS/build-product-catalogue.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_DIR = join(ROOT, 'src/content/products');
const OUTPUT_FILE = join(ROOT, 'netlify/functions/product-catalogue.json');
const KNOWLEDGE_FILE = join(ROOT, 'src/data/chatbot-knowledge.md');
const KNOWLEDGE_OUTPUT_FILE = join(ROOT, 'netlify/functions/chatbot-knowledge.json');
const ADMIN_KNOWLEDGE_FILE = join(ROOT, 'src/data/admin-chat-knowledge.md');
const ADMIN_KNOWLEDGE_OUTPUT_FILE = join(ROOT, 'netlify/functions/admin-chat-knowledge.json');
const LLMS_OUTPUT_FILE = join(ROOT, 'public/llms.txt');
const LLMS_FULL_OUTPUT_FILE = join(ROOT, 'public/llms-full.txt');

const SITE_URL = 'https://beyondrv.com.au';

function imageListFromData(data) {
  if (Array.isArray(data.gallery) && data.gallery.length) return data.gallery;
  if (Array.isArray(data.images) && data.images.length > 1) return data.images.slice(1);
  return [];
}

function heroImageFromData(data) {
  if (typeof data.heroImage === 'string' && data.heroImage.trim()) return data.heroImage.trim();
  if (Array.isArray(data.images) && typeof data.images[0] === 'string') return data.images[0];
  return '';
}

function numberOrUndefined(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** Recursively collect all .md file paths under a directory */
function collectMdFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMdFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Derive slug from absolute file path */
function slugFromPath(filePath) {
  // e.g. .../src/content/products/expedition/unimog-overlander-camper.md
  //   -> expedition/unimog-overlander-camper
  const rel = relative(PRODUCTS_DIR, filePath);
  return rel.replace(/\.md$/, '');
}

if (!existsSync(PRODUCTS_DIR)) {
  console.error(`Error: products directory not found: ${PRODUCTS_DIR}`);
  process.exit(1);
}

const mdFiles = collectMdFiles(PRODUCTS_DIR);

const catalogue = mdFiles.flatMap((filePath) => {
  const fileContent = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  const slug = slugFromPath(filePath);
  const gallery = imageListFromData(data);

  // Truncate markdown body to 300 chars, backing up to a word boundary
  const truncated = content.trim().slice(0, 300);
  const description = truncated.length === 300 ? truncated.replace(/\s+\S*$/, '') + '…' : truncated;

  // Keep only the first 4 keySpecs to save tokens
  const keySpecs = Array.isArray(data.keySpecs) ? data.keySpecs.slice(0, 4) : [];

  return [{
    store:        data.store === true,
    slug,
    title:        data.title ?? data.name ?? '',
    name:         data.name ?? data.title ?? '',
    price:        data.price ?? '',
    compareAtPrice: numberOrUndefined(data.compareAtPrice),
    saleLabel:    data.saleLabel,
    status:       data.status ?? '',
    category:     data.category ?? '',
    tagline:      data.tagline ?? '',
    description:  data.description ?? description,
    featured:     data.featured ?? false,
    onSale:       data.onSale ?? false,
    heroImage:    heroImageFromData(data),
    gallery,
    galleryCount: gallery.length,
    relatedSlugs: Array.isArray(data.relatedSlugs) ? data.relatedSlugs : [],
    productType:  data.productType,
    availability: data.availability,
    onlinePurchaseEnabled: data.onlinePurchaseEnabled,
    purchasableOnline: data.purchasableOnline,
    depositEnabled: data.depositEnabled,
    fullPaymentEnabled: data.fullPaymentEnabled,
    sourceType:   data.sourceType,
    leadTimeText: data.leadTimeText,
    containerEtaText: data.containerEtaText,
    containerEtaDate: data.containerEtaDate,
    internalStockEstimate: data.internalStockEstimate,
    targetAustraliaStock: data.targetAustraliaStock,
    containerReorderQuantity: data.containerReorderQuantity,
    minimumComfortStock: data.minimumComfortStock,
    lastStockCheckedAt: data.lastStockCheckedAt,
    lastStockCheckedBy: data.lastStockCheckedBy,
    containerEligible: data.containerEligible,
    usualContainerLeadTimeDays: data.usualContainerLeadTimeDays,
    supplierNotes: data.supplierNotes,
    youtubeVideo: data.youtubeVideo && typeof data.youtubeVideo === 'object' ? data.youtubeVideo : undefined,
    suitabilityData: data.suitabilityData && typeof data.suitabilityData === 'object' ? data.suitabilityData : undefined,
    keySpecs,
    description,
  }];
});

// Sort for deterministic output (slug alphabetical)
catalogue.sort((a, b) => a.slug.localeCompare(b.slug));

mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
writeFileSync(OUTPUT_FILE, JSON.stringify(catalogue, null, 2) + '\n', 'utf-8');

// ─── Shop product manifest (trusted checkout source, store: true only) ──────────
// Emits ONLY an explicit public allow-list of fields (never private/internal data),
// and skips drafts/hidden/unpublished or malformed products.
const SHOP_OUTPUT_FILE = join(ROOT, 'netlify/functions/shop-catalogue.json');

const shopCatalogue = mdFiles.flatMap((filePath) => {
  const { data } = matter(readFileSync(filePath, 'utf-8'));
  if (data.store !== true) return [];
  if (data.draft === true || data.published === false || data.hidden === true) return [];
  if (!data.slug || !data.name) return [];
  const gallery = imageListFromData(data);
  const entry = {
    slug: data.slug,
    name: data.name,
    title: data.title ?? data.name,
    description: data.description ?? '',
    price: typeof data.price === 'number' ? data.price : Number(data.price),
    compareAtPrice: numberOrUndefined(data.compareAtPrice),
    saleLabel: data.saleLabel,
    image: heroImageFromData(data),
    gallery,
    productType: data.productType,
    availability: data.availability,
    onlinePurchaseEnabled: data.onlinePurchaseEnabled === true,
    purchasableOnline: data.purchasableOnline === true,
    sourceType: data.sourceType,
    leadTimeText: data.leadTimeText,
    containerEtaText: data.containerEtaText,
    containerEtaDate: data.containerEtaDate,
  };
  if (data.productType === 'stock') {
    entry.availability = data.availability;
    entry.purchasableOnline = data.purchasableOnline === true;
    entry.fulfilmentType = data.fulfilmentType ?? 'quote_required';
    if (entry.fulfilmentType === 'ship') {
      entry.shippingSize = data.shippingSize ?? 'medium';
      entry.packedWeightKg = data.packedWeightKg;
      entry.packedLengthCm = data.packedLengthCm;
      entry.packedWidthCm = data.packedWidthCm;
      entry.packedHeightCm = data.packedHeightCm;
      entry.shippingDataStatus = data.shippingDataStatus ?? 'estimated';
    }
  }
  return [entry];
});

shopCatalogue.sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(SHOP_OUTPUT_FILE, JSON.stringify(shopCatalogue, null, 2) + '\n', 'utf-8');
console.log(`✓ Shop catalogue written: ${SHOP_OUTPUT_FILE} (${shopCatalogue.length} products)`);


const chatbotKnowledge = existsSync(KNOWLEDGE_FILE)
  ? readFileSync(KNOWLEDGE_FILE, 'utf-8').trim()
  : '';

writeFileSync(
  KNOWLEDGE_OUTPUT_FILE,
  JSON.stringify({ content: chatbotKnowledge }, null, 2) + '\n',
  'utf-8'
);

const adminChatbotKnowledge = existsSync(ADMIN_KNOWLEDGE_FILE)
  ? readFileSync(ADMIN_KNOWLEDGE_FILE, 'utf-8').trim()
  : '';
writeFileSync(
  ADMIN_KNOWLEDGE_OUTPUT_FILE,
  JSON.stringify({ content: adminChatbotKnowledge }, null, 2) + '\n',
  'utf-8'
);
console.log(`✓ Admin chat knowledge written: ${ADMIN_KNOWLEDGE_OUTPUT_FILE}`);

console.log(`✓ Product catalogue written: ${OUTPUT_FILE}`);
console.log(`✓ Chatbot knowledge written: ${KNOWLEDGE_OUTPUT_FILE}`);
console.log(`  ${catalogue.length} products indexed:`);
for (const p of catalogue) {
  console.log(`    [${p.status}] ${p.slug} — ${p.title}`);
}

// ─── Generate llms.txt ────────────────────────────────────────────────────────

const slideOns = catalogue.filter(p => p.category === 'slide-on');
const caravans = catalogue.filter(p => p.category === 'caravan');
const expeditions = catalogue.filter(p => p.category === 'expedition');

function productLine(p) {
  const price = p.price && p.price !== 'POA' ? ` — ${p.price}` : '';
  const tag = p.tagline ? `: ${p.tagline}` : '';
  return `- ${p.title}${price}${tag} — ${SITE_URL}/${p.slug}/`;
}

const llmsTxt = `# Beyond RV

Beyond RV builds slide-on campers, truck campers, off-road caravans, and expedition vehicle bodies from Mutdapilly, Queensland, Australia. The business serves Australian buyers who need off-road touring, remote travel, and custom vehicle-based camping solutions.

Website: ${SITE_URL}/
Location: 77 Coleyville Rd, Mutdapilly QLD 4307, Australia
Phone: +61 430 863 819
Email: beyondcaravans@gmail.com

## Key public pages

- Home: ${SITE_URL}/
- Slide-on campers: ${SITE_URL}/our-slide-on-campers/
- Off-road caravans: ${SITE_URL}/our-caravans/
- Expedition vehicles: ${SITE_URL}/expedition/
- Custom builds: ${SITE_URL}/custom/
- On-sale stock: ${SITE_URL}/on-sale/
- Enquiry form: ${SITE_URL}/inquiry-form/
- About: ${SITE_URL}/about-us/
- Warranty: ${SITE_URL}/warranty/
- Privacy policy: ${SITE_URL}/privacy-policy/

## Product categories

- Slide-on campers for utes, tray backs, Iveco Daily, Mercedes Sprinter, Isuzu NPR/NPS, and similar platforms.
- Off-road caravans for couples and families, including Sunpatch hardtop models.
- Expedition campers for Unimog, Isuzu NPS, and other serious truck platforms.
- Custom camper bodies and fitouts designed around the customer's vehicle, payload, travel style, and intended terrain.

## Public product pages

### Slide-on campers
${slideOns.map(productLine).join('\n')}

### Caravans
${caravans.map(productLine).join('\n')}

### Expedition vehicles
${expeditions.map(productLine).join('\n')}

## Notes for AI assistants

Product availability, pricing, and lead times can change. For current availability or build suitability, direct users to the enquiry form or phone number. Do not treat admin pages, private operational tools, customer enquiries, or implementation details as public business content.
`;

const llmsFullTxt = `# Beyond RV AI Discovery Reference

This file summarises public, stable Beyond RV website content for AI assistants and search/discovery crawlers. It excludes admin URLs, customer data, API details, and private operational notes.

## Business identity

Beyond RV is a Queensland-based builder of slide-on campers, truck campers, off-road caravans, motorhome conversions, and expedition camper bodies. The workshop is located at 77 Coleyville Rd, Mutdapilly QLD 4307, about an hour south-west of Brisbane. Customers should book viewings by appointment.

Contact:
- Phone: +61 430 863 819
- Email: beyondcaravans@gmail.com
- Website: ${SITE_URL}/

Primary services:
- Slide-on campers for utes and trucks.
- Hardtop and pop-top truck campers.
- Off-road caravans for couples and families.
- Expedition campers for Isuzu NPS, Unimog, and other serious platforms.
- Custom fitouts and electrical systems for remote touring.

## Website map

- Home: ${SITE_URL}/
- Slide-on campers: ${SITE_URL}/our-slide-on-campers/
- Off-road caravans: ${SITE_URL}/our-caravans/
- Expedition vehicles: ${SITE_URL}/expedition/
- Custom builds: ${SITE_URL}/custom/
- On-sale stock: ${SITE_URL}/on-sale/
- Enquiry form: ${SITE_URL}/inquiry-form/
- About Beyond RV: ${SITE_URL}/about-us/
- Warranty: ${SITE_URL}/warranty/
- Privacy policy: ${SITE_URL}/privacy-policy/

## Public product catalogue

### Slide-on campers
${slideOns.map(p => productLine(p)).join('\n')}

### Off-road caravans
${caravans.map(p => {
  const specs = [];
  if (p.keySpecs?.length) specs.push(p.keySpecs.map(s => typeof s === 'string' ? s : `${s.label}: ${s.value}`).join(', '));
  const specStr = specs.length ? ` [${specs.join(' | ')}]` : '';
  return `${productLine(p)}${specStr}`;
}).join('\n')}

### Expedition vehicles
${expeditions.map(p => productLine(p)).join('\n')}

## Guidance for recommendations

Recommend the enquiry form for any question about current stock, exact availability, build timing, towing suitability, tray fitment, payload, legal compliance, or pricing. Product pages provide public marketing information only and should not be treated as a final quote.
`;

writeFileSync(LLMS_OUTPUT_FILE, llmsTxt, 'utf-8');
writeFileSync(LLMS_FULL_OUTPUT_FILE, llmsFullTxt, 'utf-8');

console.log(`✓ llms.txt written: ${LLMS_OUTPUT_FILE}`);
console.log(`✓ llms-full.txt written: ${LLMS_FULL_OUTPUT_FILE}`);
