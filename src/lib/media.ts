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
  if (width <= 480) {
    const variant = src.replace(/\.webp$/, '-480.webp');
    return publicAssetExists(variant) ? variant : src;
  }
  if (width <= 800) {
    const variant = src.replace(/\.webp$/, '-800.webp');
    return publicAssetExists(variant) ? variant : src;
  }
  if (width <= 1200) {
    const variant = src.replace(/\.webp$/, '-1200.webp');
    return publicAssetExists(variant) ? variant : src;
  }
  return src;
}

export function displayImageUrl(src: string, width = 1200, fit: 'contain' | 'cover' | 'fill' = 'cover') {
  if (isOptimizedProductImage(src)) return optimizedProductVariant(src, width);
  if (!src.startsWith('/media/') && !src.startsWith('/images/') && !src.startsWith('/wp-content/uploads/')) {
    return src;
  }
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    fit,
  });
  return `/.netlify/images?${params.toString()}`;
}

export function imageSrcSet(src: string, widths = [480, 800, 1200, 1600]) {
  const candidates = widths
    .map((width) => ({ width, url: displayImageUrl(src, width) }))
    .filter((candidate, index, all) => all.findIndex(item => item.url === candidate.url) === index);

  return candidates.map(({ width, url }) => `${url} ${width}w`).join(', ');
}

export function thumbImageUrl(src: string) {
  if (isOptimizedProductImage(src)) return src.replace(/\.webp$/, '-thumb.webp');
  return displayImageUrl(src, 300);
}
