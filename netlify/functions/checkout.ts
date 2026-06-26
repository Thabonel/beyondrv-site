import type { Handler } from '@netlify/functions';
import manifest from './shop-catalogue.json';
import productManifest from './product-catalogue.json';
import { buildCatalogue, validateCheckout, canPurchaseVehicleOnline, type ShopManifestEntry } from '../../src/lib/checkout';
import { calculateDepositAmount, parseMoneyValue } from '../../src/lib/payment';
import { json, siteUrl } from './stripe-shared';

/**
 * Required environment variables (set in the Netlify dashboard, functions scope):
 *   STRIPE_SECRET_KEY  — Stripe secret key (use a test key in non-production deploys).
 *   URL                — Site base URL (provided automatically by Netlify; falls back to the production domain).
 */

interface ProductCatalogueEntry {
  slug: string;
  title: string;
  price: string;
  status: 'available' | 'on-sale' | 'coming-soon';
  availability?: 'available_in_australia' | 'coming_next_container' | 'made_to_order' | 'ask_availability' | 'unavailable';
  purchasableOnline?: boolean;
  depositEnabled?: boolean;
  fullPaymentEnabled?: boolean;
}

interface CheckoutPayload {
  items?: unknown;
  unit_slug?: unknown;
  slug?: unknown;
  type?: unknown;
  purchaseType?: unknown;
}

const shopCatalogue = buildCatalogue(manifest as unknown as ShopManifestEntry[]);
const productCatalogue = productManifest as ProductCatalogueEntry[];
const productBySlug = Object.fromEntries(productCatalogue.map((product) => [product.slug, product]));
const SITE_URL = siteUrl();
const STRIPE_SESSIONS_API = 'https://api.stripe.com/v1/checkout/sessions';
const DEPOSIT_PERCENT = Number(process.env.STRIPE_DEPOSIT_PERCENT ?? '0.3');

function isCheckoutType(value: unknown): value is 'deposit' | 'full' {
  return value === 'deposit' || value === 'full';
}

function safeSlug(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSessionRequest(params: URLSearchParams, secret: string) {
  return fetch(STRIPE_SESSIONS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}

function productCancelUrl(slug: string) {
  return `${SITE_URL}/${slug.replace(/^\//, '').replace(/\/$/, '')}/`;
}

function resolveProductPurchase(slug: string, requestedType: unknown) {
  const vehicle = productBySlug[slug];
  if (!vehicle) return null;
  const type = isCheckoutType(requestedType) ? requestedType : 'full';
  if (!canPurchaseVehicleOnline(vehicle, type)) {
    return {
      ok: false as const,
      code: 'NOT_PURCHASABLE' as const,
      message: `"${vehicle.title}" is not available for online checkout yet. Please ask us about availability.`,
    };
  }

  const price = parseMoneyValue(vehicle.price);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      ok: false as const,
      code: 'INVALID_PRICE' as const,
      message: 'This item cannot be purchased online right now.',
    };
  }

  const amount = type === 'deposit' ? calculateDepositAmount(price, Number.isFinite(DEPOSIT_PERCENT) ? DEPOSIT_PERCENT : 0.3) : Math.round(price);
  if (amount <= 0) {
    return {
      ok: false as const,
      code: 'INVALID_PRICE' as const,
      message: 'This item cannot be purchased online right now.',
    };
  }

  return {
    ok: true as const,
    items: [
      {
        slug,
        name: vehicle.title,
        unitPrice: amount,
        quantity: 1,
      },
    ],
    successUrl: `${SITE_URL}/checkout/success/?session_id={CHECKOUT_SESSION_ID}&kind=product&slug=${encodeURIComponent(slug)}&type=${type}`,
    cancelUrl: productCancelUrl(slug),
    metadata: {
      purchase_kind: 'product',
      product_slug: slug,
      product_name: vehicle.title,
      payment_type: type,
      order_type: vehicle.status === 'on-sale' ? 'one_off_stock' : 'standard_model',
    },
    description: `${vehicle.title} (${type === 'deposit' ? 'Deposit' : 'Full Payment'})`,
  };
}

function resolveCheckoutPayload(payload: CheckoutPayload) {
  if (Array.isArray(payload.items)) {
    const result = validateCheckout(shopCatalogue, payload.items);
    if (!result.ok) return result;

    return {
      ok: true as const,
      kind: 'cart' as const,
      items: result.items.map((item) => ({
        slug: item.slug,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      successUrl: `${SITE_URL}/checkout/success/?session_id={CHECKOUT_SESSION_ID}&kind=cart`,
      cancelUrl: `${SITE_URL}/cart/`,
      metadata: {
        purchase_kind: 'cart',
        cart_item_count: String(result.items.length),
        cart_item_slugs: result.items.map((item) => item.slug).join(','),
        order_type: 'one_off_stock',
      },
      description: 'Beyond RV shop order',
    };
  }

  const slug = safeSlug(payload.unit_slug ?? payload.slug);
  if (!slug) {
    return {
      ok: false as const,
      code: 'INVALID_ITEM' as const,
      message: 'Your checkout request could not be read. Please refresh and try again.',
    };
  }

  const productResult = resolveProductPurchase(slug, payload.type ?? payload.purchaseType);
  if (!productResult) {
    return {
      ok: false as const,
      code: 'UNKNOWN_PRODUCT' as const,
      message: 'That item is no longer available.',
    };
  }

  return productResult;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let payload: CheckoutPayload;
  try {
    payload = JSON.parse(event.body ?? '{}') as CheckoutPayload;
  } catch {
    return json(400, { ok: false, code: 'INVALID_ITEM', message: 'Your checkout request could not be read. Please refresh and try again.' });
  }

  const resolved = resolveCheckoutPayload(payload);
  if (!resolved.ok) return json(400, resolved);
  if (!('items' in resolved)) {
    return json(400, { ok: false, code: 'INVALID_ITEM', message: 'Your checkout request could not be read. Please refresh and try again.' });
  }
  const checkoutItems: Array<{ slug: string; name: string; unitPrice: number; quantity: number }> = resolved.items;

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error('[checkout] STRIPE_SECRET_KEY is not configured');
    return json(500, { ok: false, code: 'CONFIG', message: 'Online checkout is temporarily unavailable. Please call 0430 863 819.' });
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', resolved.successUrl);
  params.set('cancel_url', resolved.cancelUrl);
  for (const [key, value] of Object.entries(resolved.metadata)) {
    params.set(`metadata[${key}]`, value);
  }
  params.set('payment_intent_data[description]', resolved.description);

  checkoutItems.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, 'aud');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(Math.round(item.unitPrice * 100)));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    params.set(`line_items[${index}][price_data][product_data][metadata][slug]`, item.slug);
  });

  try {
    const response = await buildSessionRequest(params, secret);
    if (!response.ok) {
      console.error('[checkout] Stripe rejected the session request:', response.status, await response.text());
      return json(502, { ok: false, code: 'STRIPE', message: 'We could not start checkout. Please try again or call 0430 863 819.' });
    }

    const session = (await response.json()) as { url?: string };
    if (!session.url) {
      return json(502, { ok: false, code: 'STRIPE', message: 'We could not start checkout. Please try again or call 0430 863 819.' });
    }

    return json(200, { ok: true, url: session.url });
  } catch (error) {
    console.error('[checkout] Stripe request failed:', error);
    return json(502, { ok: false, code: 'STRIPE', message: 'We could not start checkout. Please try again or call 0430 863 819.' });
  }
};
