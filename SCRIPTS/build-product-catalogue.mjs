/**
 * Build-time script: generates netlify/functions/product-catalogue.json
 * Run before astro build so the Netlify function can import it at deploy time.
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

const catalogue = mdFiles.map((filePath) => {
  const fileContent = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  const slug = slugFromPath(filePath);

  // Truncate markdown body to 300 chars, backing up to a word boundary
  const truncated = content.trim().slice(0, 300);
  const description = truncated.length === 300 ? truncated.replace(/\s+\S*$/, '') + '…' : truncated;

  // Keep only the first 4 keySpecs to save tokens
  const keySpecs = Array.isArray(data.keySpecs) ? data.keySpecs.slice(0, 4) : [];

  return {
    slug,
    title:       data.title       ?? '',
    price:       data.price       ?? '',
    status:      data.status      ?? '',
    category:    data.category    ?? '',
    tagline:     data.tagline     ?? '',
    featured:    data.featured    ?? false,
    onSale:      data.onSale      ?? false,
    heroImage:   data.heroImage   ?? '',
    gallery:     Array.isArray(data.gallery) ? data.gallery : [],
    galleryCount: Array.isArray(data.gallery) ? data.gallery.length : 0,
    relatedSlugs: Array.isArray(data.relatedSlugs) ? data.relatedSlugs : [],
    keySpecs,
    description,
  };
});

// Sort for deterministic output (slug alphabetical)
catalogue.sort((a, b) => a.slug.localeCompare(b.slug));

mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
writeFileSync(OUTPUT_FILE, JSON.stringify(catalogue, null, 2) + '\n', 'utf-8');

const chatbotKnowledge = existsSync(KNOWLEDGE_FILE)
  ? readFileSync(KNOWLEDGE_FILE, 'utf-8').trim()
  : '';

writeFileSync(
  KNOWLEDGE_OUTPUT_FILE,
  JSON.stringify({ content: chatbotKnowledge }, null, 2) + '\n',
  'utf-8'
);

console.log(`✓ Product catalogue written: ${OUTPUT_FILE}`);
console.log(`✓ Chatbot knowledge written: ${KNOWLEDGE_OUTPUT_FILE}`);
console.log(`  ${catalogue.length} products indexed:`);
for (const p of catalogue) {
  console.log(`    [${p.status}] ${p.slug} — ${p.title}`);
}
