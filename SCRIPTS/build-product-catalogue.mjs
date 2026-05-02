/**
 * Build-time script: generates netlify/functions/product-catalogue.json
 * Run before astro build so the Netlify function can import it at deploy time.
 *
 * Usage:  node scripts/build-product-catalogue.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_DIR = join(ROOT, 'src/content/products');
const OUTPUT_FILE = join(ROOT, 'netlify/functions/product-catalogue.json');

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

const mdFiles = collectMdFiles(PRODUCTS_DIR);

const catalogue = mdFiles.map((filePath) => {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const slug = slugFromPath(filePath);

  // Truncate markdown body to first 300 chars (after frontmatter), trimmed
  const description = content.trim().slice(0, 300).trimEnd();

  // Keep only the first 4 keySpecs to save tokens
  const keySpecs = Array.isArray(data.keySpecs) ? data.keySpecs.slice(0, 4) : [];

  return {
    slug,
    title:       data.title       ?? '',
    price:       data.price       ?? '',
    status:      data.status      ?? '',
    category:    data.category    ?? '',
    tagline:     data.tagline     ?? '',
    keySpecs,
    description,
  };
});

// Sort for deterministic output (slug alphabetical)
catalogue.sort((a, b) => a.slug.localeCompare(b.slug));

writeFileSync(OUTPUT_FILE, JSON.stringify(catalogue, null, 2) + '\n', 'utf-8');

console.log(`✓ Product catalogue written: ${OUTPUT_FILE}`);
console.log(`  ${catalogue.length} products indexed:`);
for (const p of catalogue) {
  console.log(`    [${p.status}] ${p.slug} — ${p.title}`);
}
