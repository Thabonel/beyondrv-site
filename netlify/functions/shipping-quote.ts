import type { Handler } from '@netlify/functions';
import manifest from './shop-catalogue.json';
import { buildCatalogue, type ShopManifestEntry } from '../../src/lib/checkout';
import { resolveShippableItems, calculateShippingQuote } from '../../src/lib/shipping';
import { isRateLimited, rateLimitResponse } from './security-utils';

/**
 * Phase 4A — development-safe Australia Post shipping estimate.
 *
 * The client sends only { items: [{ slug, quantity }], postcode }. Packed weight,
 * dimensions and shipping status are rebuilt from the trusted manifest, never the
 * client. The returned amount is a development stub and is flagged `estimated`
 * when a product's packed weight is not yet confirmed.
 */

const catalogue = buildCatalogue(manifest as unknown as ShopManifestEntry[]);

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (await isRateLimited(event, 'shipping-quote', 60, 10 * 60)) return rateLimitResponse();

  let payload: { items?: unknown; postcode?: unknown };
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { ok: false, code: 'INVALID_ITEM', message: 'Your cart could not be read. Please refresh and try again.' });
  }

  const resolved = resolveShippableItems(catalogue, payload.items);
  if (!resolved.ok) return json(400, resolved);

  const quote = calculateShippingQuote(resolved.items, payload.postcode);
  if (!quote.ok) return json(400, quote);

  return json(200, quote);
};
