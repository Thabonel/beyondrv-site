import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PRODUCTS_DIR = path.join(ROOT, 'src/content/products');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const WIDTHS = [480, 800, 1200, 1600];
const DISPLAY_WIDTH = 1600;
const THUMB_WIDTH = 300;
const IMAGE_REF_RE = /["'](\/(?:wp-content\/uploads|images\/products|images\/site)\/[^"']+\.(?:jpe?g|png|webp))["']/gi;

function slugFromProductPath(file) {
  return path.relative(PRODUCTS_DIR, file).replace(/\.md$/, '').split(path.sep).join('/');
}

function slugPath(slug) {
  return slug.split('/').map((part) => safeName(part)).join('/');
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function listMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
  }));
  return files.flat().sort();
}

function publicPathToFile(src) {
  return path.join(PUBLIC_ROOT, src.replace(/^\//, ''));
}

function outputPathFor(slug, index, src, width = DISPLAY_WIDTH) {
  const base = safeName(path.basename(src));
  const suffix = width === DISPLAY_WIDTH ? '' : `-${width}`;
  return `/images/optimized/products/${slugPath(slug)}/${String(index + 1).padStart(2, '0')}-${base}${suffix}.webp`;
}

function thumbPathFor(displayPath) {
  return displayPath.replace(/\.webp$/, '-thumb.webp');
}

async function convertImage(sourceFile, displayPath) {
  const outputs = [
    ...WIDTHS.map((width) => ({
      publicPath: width === DISPLAY_WIDTH ? displayPath : displayPath.replace(/\.webp$/, `-${width}.webp`),
      width,
      quality: width < 800 ? 76 : 82,
    })),
    { publicPath: thumbPathFor(displayPath), width: THUMB_WIDTH, quality: 74 },
  ];

  await Promise.all(outputs.map(async ({ publicPath, width, quality }) => {
    const target = publicPathToFile(publicPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await sharp(sourceFile)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toFile(target);
  }));
}

async function fileSize(file) {
  try {
    const stat = await fs.stat(file);
    return stat.size;
  } catch {
    return 0;
  }
}

async function main() {
  const write = process.argv.includes('--write');
  const productFiles = await listMarkdownFiles(PRODUCTS_DIR);
  const report = [];
  let converted = 0;
  let missing = 0;

  for (const file of productFiles) {
    const slug = slugFromProductPath(file);
    let content = await fs.readFile(file, 'utf8');
    const refs = [...new Set([...content.matchAll(IMAGE_REF_RE)].map((match) => match[1]))];
    const replacements = new Map();

    for (let index = 0; index < refs.length; index += 1) {
      const src = refs[index];
      if (src.startsWith('/images/optimized/products/')) continue;

      const sourceFile = publicPathToFile(src);
      try {
        await fs.access(sourceFile);
      } catch {
        missing += 1;
        report.push({ slug, status: 'missing', src });
        continue;
      }

      const displayPath = outputPathFor(slug, index, src);
      replacements.set(src, displayPath);

      if (write) {
        await convertImage(sourceFile, displayPath);
        converted += 1;
      }

      report.push({
        slug,
        status: write ? 'converted' : 'would-convert',
        src,
        displayPath,
        originalBytes: await fileSize(sourceFile),
        optimizedBytes: write ? await fileSize(publicPathToFile(displayPath)) : 0,
      });
    }

    if (write && replacements.size > 0) {
      for (const [from, to] of replacements) {
        content = content.split(from).join(to);
      }
      await fs.writeFile(file, content);
    }
  }

  await fs.mkdir(path.join(ROOT, 'docs/reports'), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, 'docs/reports/product-image-optimization-report.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), write, converted, missing, report }, null, 2)}\n`
  );

  console.log(`${write ? 'Converted' : 'Would convert'} ${converted || report.filter((item) => item.status === 'would-convert').length} referenced product images.`);
  if (missing) console.log(`Missing referenced files: ${missing}`);
  console.log('Report: docs/reports/product-image-optimization-report.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
