import type { SearchRecord } from './search.ts';

/**
 * Expedition entries keep their `expedition/` collection prefix, which already
 * matches the route at src/pages/expedition/[slug].astro. Store products are
 * the only ones that move, onto /shop/ under their own slug.
 */
export function productSearchUrl(id: string, store: boolean, storeSlug: string) {
  if (store) return `/shop/${storeSlug}/`;
  return `/${id}/`;
}

interface SpecRow {
  label: string;
  value: string;
}

export function buildProductRecord(entry: { id: string; data: Record<string, unknown> }): SearchRecord {
  const data = entry.data;
  const features = Array.isArray(data.features) ? (data.features as string[]) : [];
  const keySpecs = Array.isArray(data.keySpecs) ? (data.keySpecs as SpecRow[]) : [];
  const keywords = [
    ...features,
    ...keySpecs.flatMap((spec) => [spec.label, spec.value]),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return {
    id: entry.id,
    title: String(data.title ?? ''),
    summary: String(data.tagline ?? ''),
    url: productSearchUrl(entry.id, data.store === true, String(data.slug ?? '')),
    kind: 'product',
    category: String(data.category ?? ''),
    price: String(data.price ?? ''),
    keywords,
  };
}
