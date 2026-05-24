const OPTIMIZED_PRODUCT_PREFIX = '/images/optimized/products/';

function isOptimizedProductImage(src: string) {
  return src.startsWith(OPTIMIZED_PRODUCT_PREFIX) && src.endsWith('.webp');
}

function optimizedProductVariant(src: string, width: number) {
  if (width <= 480) return src.replace(/\.webp$/, '-480.webp');
  if (width <= 800) return src.replace(/\.webp$/, '-800.webp');
  if (width <= 1200) return src.replace(/\.webp$/, '-1200.webp');
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
  return widths.map((width) => `${displayImageUrl(src, width)} ${width}w`).join(', ');
}

export function thumbImageUrl(src: string) {
  if (isOptimizedProductImage(src)) return src.replace(/\.webp$/, '-thumb.webp');
  return displayImageUrl(src, 300);
}
