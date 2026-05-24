export function displayImageUrl(src: string, width = 1200, fit: 'contain' | 'cover' | 'fill' = 'cover') {
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
