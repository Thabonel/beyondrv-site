import type {
  ShopCatalogue,
  ShippingSize,
  ShippingDataStatus,
} from './checkout';

/**
 * Phase 4A — Australia Post readiness.
 *
 * This module computes a DEVELOPMENT-SAFE shipping estimate. The rate maths below
 * is a deterministic stub that stands in for the future Australia Post Parcel
 * Postage API. It is NOT real Australia Post pricing and must not be used to bill
 * customers for live freight. A quote whose status is `estimated` is dev/test-only
 * (e.g. when a product's packed weight has not yet been confirmed).
 *
 * Only `fulfilmentType: 'ship'`, non-oversized products with valid packed
 * dimensions and a packed weight may enter this flow. Everything else (pickup,
 * install, quote-required, oversized, unknown) is rejected so the caller can route
 * it to the enquiry/pickup/install path instead.
 */

export interface ShippableItem {
  slug: string;
  name: string;
  quantity: number;
  packedWeightKg: number;
  packedLengthCm: number;
  packedWidthCm: number;
  packedHeightCm: number;
  shippingSize: ShippingSize;
  shippingDataStatus: ShippingDataStatus;
}

export type ShippingErrorCode =
  | 'EMPTY_CART'
  | 'INVALID_ITEM'
  | 'INVALID_QUANTITY'
  | 'UNKNOWN_PRODUCT'
  | 'NOT_SHIPPABLE'
  | 'OVERSIZED'
  | 'MISSING_SHIPPING_DATA'
  | 'INVALID_POSTCODE';

export type ResolveShippableResult =
  | { ok: true; items: ShippableItem[] }
  | { ok: false; code: ShippingErrorCode; message: string };

export type ShippingQuote =
  | { ok: true; status: ShippingDataStatus; estimated: boolean; amount: number; currency: 'AUD' }
  | { ok: false; code: ShippingErrorCode; message: string };

const VOLUMETRIC_DIVISOR = 5000;
const BASE_HANDLING_AUD = 9.95;
const PER_KG_AUD = 2.5;
const MAX_QUANTITY = 99;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isValidPostcode(postcode: unknown): postcode is string {
  return typeof postcode === 'string' && /^\d{4}$/.test(postcode);
}

/**
 * Deterministic stub zone multiplier derived from the destination postcode.
 * Placeholder for Australia Post zone pricing — not real rates.
 */
function zoneMultiplier(postcode: string): number {
  const prefix = Number(postcode.slice(0, 1));
  if (postcode >= '0800' && postcode <= '0899') return 1.8;
  if (prefix === 6 || prefix === 7) return 1.45;
  if (prefix === 4 || prefix === 5) return 1.25;
  return 1.0;
}

function isShippingDataComplete(item: ShippableItem): boolean {
  return (
    item.packedWeightKg > 0 &&
    item.packedLengthCm > 0 &&
    item.packedWidthCm > 0 &&
    item.packedHeightCm > 0
  );
}

/**
 * Rebuilds trusted shippable line items from the published manifest.
 * The client may only supply { slug, quantity }; packed weight, dimensions and
 * shipping status are always taken from the trusted catalogue, never the client.
 */
export function resolveShippableItems(catalogue: ShopCatalogue, requested: unknown): ResolveShippableResult {
  if (!Array.isArray(requested) || requested.length === 0) {
    return { ok: false, code: 'EMPTY_CART', message: 'Your cart is empty.' };
  }

  const items: ShippableItem[] = [];

  for (const raw of requested) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, code: 'INVALID_ITEM', message: 'Your cart could not be read. Please refresh and try again.' };
    }

    const slug = (raw as { slug?: unknown }).slug;
    const quantity = (raw as { quantity?: unknown }).quantity;

    if (typeof slug !== 'string' || slug.length === 0) {
      return { ok: false, code: 'INVALID_ITEM', message: 'Your cart could not be read. Please refresh and try again.' };
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { ok: false, code: 'INVALID_QUANTITY', message: 'One of the quantities in your cart is not valid.' };
    }

    const product = catalogue[slug];
    if (!product) {
      return { ok: false, code: 'UNKNOWN_PRODUCT', message: 'One of the items in your cart is no longer available.' };
    }

    if (product.productType !== 'stock' || product.fulfilmentType !== 'ship') {
      return {
        ok: false,
        code: 'NOT_SHIPPABLE',
        message: `"${product.name}" cannot be shipped. Please enquire about delivery, pickup, or installation.`,
      };
    }

    if (
      typeof product.packedWeightKg !== 'number' ||
      typeof product.packedLengthCm !== 'number' ||
      typeof product.packedWidthCm !== 'number' ||
      typeof product.packedHeightCm !== 'number'
    ) {
      return { ok: false, code: 'MISSING_SHIPPING_DATA', message: `Shipping details for "${product.name}" are not available yet.` };
    }

    items.push({
      slug: product.slug,
      name: product.name,
      quantity,
      packedWeightKg: product.packedWeightKg,
      packedLengthCm: product.packedLengthCm,
      packedWidthCm: product.packedWidthCm,
      packedHeightCm: product.packedHeightCm,
      shippingSize: product.shippingSize ?? 'oversized',
      shippingDataStatus: product.shippingDataStatus ?? 'estimated',
    });
  }

  return { ok: true, items };
}

/**
 * Computes a development-safe shipping estimate for already-trusted shippable items.
 * Returns `estimated: true` when any item's packed weight is not yet confirmed —
 * such a quote is dev/test-only and must not be charged as a live rate.
 */
export function calculateShippingQuote(items: ShippableItem[], postcode: unknown): ShippingQuote {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, code: 'EMPTY_CART', message: 'Your cart is empty.' };
  }

  if (!isValidPostcode(postcode)) {
    return { ok: false, code: 'INVALID_POSTCODE', message: 'Please enter a valid 4-digit Australian postcode.' };
  }

  let billableKg = 0;
  let confirmed = true;

  for (const item of items) {
    if (item.shippingSize === 'oversized') {
      return { ok: false, code: 'OVERSIZED', message: `"${item.name}" is too large for automatic shipping. Please enquire for a freight quote.` };
    }
    if (!isShippingDataComplete(item)) {
      return { ok: false, code: 'MISSING_SHIPPING_DATA', message: `Shipping details for "${item.name}" are not available yet.` };
    }

    const volumetricKg = (item.packedLengthCm * item.packedWidthCm * item.packedHeightCm) / VOLUMETRIC_DIVISOR;
    const billablePerUnit = Math.max(item.packedWeightKg, volumetricKg);
    billableKg += billablePerUnit * item.quantity;

    if (item.shippingDataStatus !== 'confirmed') confirmed = false;
  }

  const amount = round2(BASE_HANDLING_AUD + PER_KG_AUD * billableKg * zoneMultiplier(postcode));

  return {
    ok: true,
    status: confirmed ? 'confirmed' : 'estimated',
    estimated: !confirmed,
    amount,
    currency: 'AUD',
  };
}
