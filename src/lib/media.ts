import { existsSync } from 'node:fs';
import { join } from 'node:path';

const OPTIMIZED_PRODUCT_PREFIX = '/images/optimized/products/';
const PUBLIC_DIR = join(process.cwd(), 'public');

function isOptimizedProductImage(src: string) {
  return src.startsWith(OPTIMIZED_PRODUCT_PREFIX) && src.endsWith('.webp');
}

function publicAssetExists(src: string) {
  if (!src.startsWith('/')) return false;
  return existsSync(join(PUBLIC_DIR, src));
}

function optimizedProductVariant(src: string, width: number) {
  const candidates = [];
  if (width <= 400) candidates.push('-400.webp', '-480.webp');
  else if (width <= 480) candidates.push('-480.webp', '-400.webp');
  else if (width <= 800) candidates.push('-800.webp', '-480.webp', '-400.webp');
  else if (width <= 1200) candidates.push('-1200.webp', '-800.webp');
  for (const suffix of candidates) {
    const variant = src.replace(/\.webp$/, suffix);
    if (publicAssetExists(variant)) return variant;
  }
  return src;
}

export function displayImageUrl(src: string, width = 1200, fit: 'contain' | 'cover' | 'fill' = 'cover') {
  if (isOptimizedProductImage(src)) return optimizedProductVariant(src, width);
  if (src.startsWith('/media/')) {
    return src;
  }
  if (!src.startsWith('/images/') && !src.startsWith('/wp-content/uploads/')) {
    return src;
  }
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    fit,
  });
  return `/.netlify/images?${params.toString()}`;
}

export function imageSrcSet(src: string, widths = [400, 480, 800, 1200]) {
  const candidates = widths
    .map((width) => ({ width, url: displayImageUrl(src, width) }))
    .filter((candidate, index, all) => all.findIndex(item => item.url === candidate.url) === index);

  return candidates.map(({ width, url }) => `${url} ${width}w`).join(', ');
}

export function thumbImageUrl(src: string) {
  if (isOptimizedProductImage(src)) return src.replace(/\.webp$/, '-thumb.webp');
  return displayImageUrl(src, 300);
}
