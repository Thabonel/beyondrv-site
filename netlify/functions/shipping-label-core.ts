import type { ShopCatalogue, ShopManifestEntry } from '../../src/lib/checkout';
import { escapeHtml } from './stripe-shared.ts';

export type ShippingMethod = 'australia_post' | 'brisbane_local_delivery' | 'pickup';

export interface ShippingAddressFields {
  shippingName?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostcode?: string;
  shippingCountry?: string;
}

export interface ShippingOrderRecordLike extends ShippingAddressFields {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  productSlug: string;
  productTitle?: string;
  productCategory?: string;
  orderType?: string;
  status: string;
  depositPaid?: boolean;
  shippingMethod?: ShippingMethod;
  shippingChargeCents?: number;
  shippingStatus?: string;
  shippingCarrier?: string;
  shippingService?: string;
  trackingNumber?: string;
  shippingLabelId?: string;
  shippingLabelUrl?: string;
  shippingLabelCreatedAt?: string;
  shippingLabelPrintedAt?: string;
  shippingBlockReason?: string;
  shippingNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShippingLabelRecord {
  labelId: string;
  orderId: string;
  createdAt: string;
  createdBy: string;
  deliveryMethod: ShippingMethod;
  carrier: string;
  service: string;
  trackingNumber: string;
  shippingChargeCents: number;
  printUrl: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingName: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostcode: string;
  shippingCountry: string;
  productSlug: string;
  productTitle: string;
  productCategory: string;
  notes: string;
}

export type ShippingLabelEligibility =
  | { ok: true; product: ShopManifestEntry; method: ShippingMethod }
  | { ok: false; code: string; message: string };

const APPROVED_ORDER_STATUSES = new Set([
  'deposit_received',
  'ordered_from_factory',
  'in_china_production',
  'awaiting_shipping',
  'in_transit',
  'arrived_mutdapilly',
  'local_fitout',
  'ready_for_handover',
  'delivered',
]);

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function hasRequiredAddressFields(order: ShippingAddressFields) {
  return Boolean(
    clean(order.shippingName ?? '', 180) &&
    clean(order.shippingAddressLine1 ?? '', 240) &&
    clean(order.shippingCity ?? '', 120) &&
    clean(order.shippingState ?? '', 80) &&
    clean(order.shippingPostcode ?? '', 10) &&
    clean(order.shippingCountry ?? '', 80)
  );
}

function postcodeIsBrisbaneArea(postcode: string, state: string) {
  const numeric = Number(postcode);
  return Number.isInteger(numeric) && numeric >= 4000 && numeric <= 4999 && /qld|queensland/i.test(state);
}

function canFitOnUte(product: ShopManifestEntry) {
  return Boolean(
    typeof product.packedWeightKg === 'number' &&
    typeof product.packedLengthCm === 'number' &&
    typeof product.packedWidthCm === 'number' &&
    typeof product.packedHeightCm === 'number'
  );
}

export function resolveShippingMethod(order: ShippingOrderRecordLike): ShippingMethod {
  if (order.shippingMethod === 'pickup' || order.shippingMethod === 'brisbane_local_delivery' || order.shippingMethod === 'australia_post') {
    return order.shippingMethod;
  }
  return 'australia_post';
}

export function evaluateShippingLabelEligibility(order: ShippingOrderRecordLike, catalogue: ShopCatalogue): ShippingLabelEligibility {
  const product = catalogue[order.productSlug];
  if (!product) {
    return { ok: false, code: 'missing_product', message: 'This order does not match a shippable catalogue item.' };
  }

  if (!APPROVED_ORDER_STATUSES.has(order.status)) {
    return { ok: false, code: 'order_not_approved', message: 'This order is not approved for fulfilment yet.' };
  }

  const method = resolveShippingMethod(order);

  if (method === 'pickup') {
    return { ok: false, code: 'pickup_only', message: 'This order is marked pickup only.' };
  }

  if (!hasRequiredAddressFields(order)) {
    return { ok: false, code: 'missing_address', message: 'This order needs a complete shipping address before a label can be created.' };
  }

  if (method === 'australia_post') {
    if (product.productType !== 'stock' || product.fulfilmentType !== 'ship') {
      return { ok: false, code: 'not_shippable', message: 'This item is not configured for Australia Post delivery.' };
    }
    if (product.availability !== 'available_in_australia') {
      return { ok: false, code: 'needs_availability_confirmation', message: 'This order needs availability confirmed before shipping.' };
    }
    if (product.shippingSize === 'oversized') {
      return { ok: false, code: 'oversized', message: 'This item is too large for Australia Post shipping.' };
    }
    if (!canFitOnUte(product)) {
      return { ok: false, code: 'missing_shipping_data', message: 'This item is missing the packed dimensions or weight needed for postage.' };
    }
    return { ok: true, product, method };
  }

  if (product.shippingSize === 'oversized') {
    return { ok: false, code: 'too_large_for_ute', message: 'This item is too large for ute delivery.' };
  }

  if (!postcodeIsBrisbaneArea(clean(order.shippingPostcode ?? '', 10), clean(order.shippingState ?? '', 80))) {
    return { ok: false, code: 'outside_local_area', message: 'Brisbane delivery is only available for local area addresses.' };
  }

  if (!canFitOnUte(product)) {
    return { ok: false, code: 'too_large_for_ute', message: 'This item is too large for ute delivery.' };
  }

  if (product.availability !== 'available_in_australia') {
    return { ok: false, code: 'needs_availability_confirmation', message: 'This order needs availability confirmed before local delivery.' };
  }

  return { ok: true, product, method };
}

export function buildShippingLabelRecord(params: {
  order: ShippingOrderRecordLike;
  product: ShopManifestEntry;
  labelId: string;
  createdAt: string;
  createdBy: string;
  deliveryMethod: ShippingMethod;
  carrier?: string;
  service?: string;
  trackingNumber?: string;
  shippingChargeCents?: number;
  printUrl: string;
}) : ShippingLabelRecord {
  const order = params.order;
  return {
    labelId: params.labelId,
    orderId: order.id,
    createdAt: params.createdAt,
    createdBy: params.createdBy,
    deliveryMethod: params.deliveryMethod,
    carrier: clean(params.carrier ?? '', 120) || (params.deliveryMethod === 'brisbane_local_delivery' ? 'Beyond RV Local Delivery' : 'Australia Post'),
    service: clean(params.service ?? '', 120) || (params.deliveryMethod === 'brisbane_local_delivery' ? 'Brisbane delivery' : 'Parcel Post'),
    trackingNumber: clean(params.trackingNumber ?? '', 160),
    shippingChargeCents: Number.isFinite(params.shippingChargeCents) ? Math.max(0, Math.round(Number(params.shippingChargeCents))) : 0,
    printUrl: params.printUrl,
    customerName: clean(order.customerName, 180),
    customerEmail: clean(order.customerEmail, 240),
    customerPhone: clean(order.customerPhone, 80),
    shippingName: clean(order.shippingName ?? order.customerName, 180),
    shippingAddressLine1: clean(order.shippingAddressLine1, 240),
    shippingAddressLine2: clean(order.shippingAddressLine2, 240),
    shippingCity: clean(order.shippingCity, 120),
    shippingState: clean(order.shippingState, 80),
    shippingPostcode: clean(order.shippingPostcode, 10),
    shippingCountry: clean(order.shippingCountry, 80),
    productSlug: clean(order.productSlug, 240),
    productTitle: clean(order.productTitle ?? params.product.name, 240),
    productCategory: clean(order.productCategory ?? '', 80),
    notes: clean(order.shippingNotes ?? '', 4000),
  };
}

export function renderShippingLabelHtml(label: ShippingLabelRecord, order: ShippingOrderRecordLike, product: ShopManifestEntry) {
  const trackingText = label.trackingNumber || 'Tracking to be added';
  const deliveryText = label.deliveryMethod === 'brisbane_local_delivery' ? 'Local Brisbane ute delivery' : 'Australia Post';
  const chargeText = label.shippingChargeCents > 0
    ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(label.shippingChargeCents / 100)
    : 'Not set';

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shipping Label ${escapeHtml(label.labelId)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; color: #111; }
      .sheet { max-width: 820px; margin: 0 auto; background: #fff; border: 2px solid #111; border-radius: 16px; padding: 24px; }
      .top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
      .brand { font-size: 24px; font-weight: 800; letter-spacing: 0.04em; }
      .meta { font-size: 12px; color: #555; line-height: 1.5; text-align: right; }
      .recipient { border: 2px solid #111; border-radius: 12px; padding: 20px; margin: 18px 0; min-height: 180px; }
      .recipient h1 { margin: 0 0 10px; font-size: 28px; }
      .recipient .line { font-size: 20px; line-height: 1.35; margin: 2px 0; font-weight: 600; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
      .box { border: 1px solid #ccc; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.45; }
      .label { color: #666; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 4px; }
      .footer { margin-top: 18px; font-size: 12px; color: #555; line-height: 1.5; }
      @media print {
        body { background: #fff; padding: 0; }
        .sheet { border: none; border-radius: 0; max-width: none; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="top">
        <div>
          <div class="brand">Beyond RV</div>
          <div class="meta">${escapeHtml(deliveryText)}<br />Label ID: ${escapeHtml(label.labelId)}</div>
        </div>
        <div class="meta">
          Order: ${escapeHtml(order.id)}<br />
          Product: ${escapeHtml(product.name)}<br />
          Created: ${escapeHtml(label.createdAt)}
        </div>
      </div>

      <section class="recipient">
        <h1>Deliver to</h1>
        <div class="line">${escapeHtml(label.shippingName || order.customerName)}</div>
        <div class="line">${escapeHtml(label.shippingAddressLine1)}</div>
        ${label.shippingAddressLine2 ? `<div class="line">${escapeHtml(label.shippingAddressLine2)}</div>` : ''}
        <div class="line">${escapeHtml([label.shippingCity, label.shippingState, label.shippingPostcode].filter(Boolean).join(' '))}</div>
        <div class="line">${escapeHtml(label.shippingCountry)}</div>
      </section>

      <div class="grid">
        <div class="box">
          <div class="label">Tracking</div>
          <div>${escapeHtml(trackingText)}</div>
        </div>
        <div class="box">
          <div class="label">Charge</div>
          <div>${escapeHtml(chargeText)}</div>
        </div>
        <div class="box">
          <div class="label">Carrier</div>
          <div>${escapeHtml(label.carrier)}</div>
        </div>
        <div class="box">
          <div class="label">Service</div>
          <div>${escapeHtml(label.service)}</div>
        </div>
        <div class="box">
          <div class="label">Product</div>
          <div>${escapeHtml(label.productTitle)}</div>
        </div>
        <div class="box">
          <div class="label">Order status</div>
          <div>${escapeHtml(order.status)}</div>
        </div>
      </div>

      <div class="footer">
        Dimensions: ${escapeHtml(typeof product.packedLengthCm === 'number' ? `${product.packedLengthCm} x ${product.packedWidthCm} x ${product.packedHeightCm} cm` : 'Not set')}<br />
        Weight: ${escapeHtml(typeof product.packedWeightKg === 'number' ? `${product.packedWeightKg} kg` : 'Not set')}<br />
        Notes: ${escapeHtml(label.notes || order.shippingNotes || 'None')}
      </div>
    </main>
    <script>
      window.print();
    </script>
  </body>
  </html>`;
}
