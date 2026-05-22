export function displayImageUrl(src: string, width = 1200, fit: 'contain' | 'cover' | 'fill' = 'cover') {
  if (!src.startsWith('/media/')) return src;
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    fit,
  });
  return `/.netlify/images?${params.toString()}`;
}
