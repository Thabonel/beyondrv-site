import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isPublicProduct } from '../lib/productVisibility';
import { buildProductRecord } from '../lib/searchIndex';
import { SEARCH_PAGES } from '../data/searchPages';

export const GET: APIRoute = async () => {
  const products = (await getCollection('products')).filter(isPublicProduct);
  const records = [
    ...products.map((product) => buildProductRecord({ id: product.id, data: product.data as Record<string, unknown> })),
    ...SEARCH_PAGES,
  ];

  return new Response(JSON.stringify({ records }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
