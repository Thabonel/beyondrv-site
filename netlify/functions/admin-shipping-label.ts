import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import manifest from './shop-catalogue.json';
import { buildCatalogue, type ShopManifestEntry } from '../../src/lib/checkout';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { escapeHtml, json, sendResendEmail, siteUrl } from './stripe-shared';
import {
  buildShippingLabelRecord,
  evaluateShippingLabelEligibility,
  renderShippingLabelHtml,
  type ShippingLabelRecord,
  type ShippingOrderRecordLike,
  type ShippingMethod,
} from './shipping-label-core';

const ORDER_STORE = 'customer-orders';
const catalogue = buildCatalogue(manifest as unknown as ShopManifestEntry[]);

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function orderKey(id: string) {
  return `orders/${encodeURIComponent(id)}.json`;
}

function printUrl(orderId: string) {
  return `${siteUrl()}/.netlify/functions/admin-shipping-label?orderId=${encodeURIComponent(orderId)}&format=print`;
}

function orderLabelEmailText(label: ShippingLabelRecord) {
  return [
    `Delivery method: ${label.deliveryMethod === 'brisbane_local_delivery' ? 'Local Brisbane ute delivery' : 'Australia Post'}`,
    `Tracking/reference: ${label.trackingNumber || 'To be added'}`,
    `Carrier: ${label.carrier}`,
    `Service: ${label.service}`,
    `Delivery charge: ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(label.shippingChargeCents / 100)}`,
    `Address: ${[label.shippingName, label.shippingAddressLine1, label.shippingAddressLine2, [label.shippingCity, label.shippingState, label.shippingPostcode].filter(Boolean).join(' '), label.shippingCountry].filter(Boolean).join(' | ')}`,
    `Order: ${label.orderId}`,
  ].join('\n');
}

function orderLabelEmailHtml(label: ShippingLabelRecord) {
  return `
    <h2>Your delivery is ready</h2>
    <p><strong>Method:</strong> ${escapeHtml(label.deliveryMethod === 'brisbane_local_delivery' ? 'Local Brisbane ute delivery' : 'Australia Post')}</p>
    <p><strong>Tracking / reference:</strong> ${escapeHtml(label.trackingNumber || 'To be added')}</p>
    <p><strong>Carrier:</strong> ${escapeHtml(label.carrier)}</p>
    <p><strong>Service:</strong> ${escapeHtml(label.service)}</p>
    <p><strong>Charge:</strong> ${escapeHtml(new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(label.shippingChargeCents / 100))}</p>
    <p><strong>Delivery address:</strong><br />
      ${escapeHtml(label.shippingName)}<br />
      ${escapeHtml(label.shippingAddressLine1)}<br />
      ${label.shippingAddressLine2 ? `${escapeHtml(label.shippingAddressLine2)}<br />` : ''}
      ${escapeHtml([label.shippingCity, label.shippingState, label.shippingPostcode].filter(Boolean).join(' '))}<br />
      ${escapeHtml(label.shippingCountry)}
    </p>
    <p><strong>Order ID:</strong> ${escapeHtml(label.orderId)}</p>
    <p>Open the order in admin if you need to update tracking or mark the shipment as sent.</p>
  `;
}

async function readOrder(store: ReturnType<typeof getBlobStore>, orderId: string) {
  return await store.get(orderKey(orderId), { type: 'json' }) as ShippingOrderRecordLike | null;
}

async function saveOrder(store: ReturnType<typeof getBlobStore>, order: ShippingOrderRecordLike) {
  await store.setJSON(orderKey(order.id), order);
}

export const handler: Handler = async (event) => {
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(ORDER_STORE);
  } catch (error) {
    console.warn('admin-shipping-label: order store unavailable', {
      store: ORDER_STORE,
      blobRuntimeSource,
      error: safeBlobStoreError(error),
    });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }

  const orderId = clean(event.queryStringParameters?.orderId ?? event.queryStringParameters?.id ?? '', 180);

  if (event.httpMethod === 'GET') {
    if (!orderId) {
      return json(400, { ok: false, error: 'Missing order id' });
    }
    const order = await readOrder(store, orderId);
    if (!order) {
      return json(404, { ok: false, error: 'Order not found' });
    }
    const eligibility = evaluateShippingLabelEligibility(order, catalogue);
    if (!eligibility.ok) {
      return json(200, {
        ok: true,
        eligible: false,
        message: eligibility.message,
        code: eligibility.code,
        order,
      });
    }

    const label: ShippingLabelRecord = buildShippingLabelRecord({
      order,
      product: eligibility.product,
      labelId: clean(order.shippingLabelId ?? `draft-${order.id}`, 160),
      createdAt: clean(order.shippingLabelCreatedAt ?? new Date().toISOString(), 80),
      createdBy: 'admin',
      deliveryMethod: eligibility.method,
      carrier: order.shippingCarrier,
      service: order.shippingService,
      trackingNumber: order.trackingNumber,
      shippingChargeCents: order.shippingChargeCents ?? 0,
      printUrl: order.shippingLabelUrl ?? printUrl(order.id),
    });

    if ((event.queryStringParameters?.format ?? '').toLowerCase() === 'print') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        body: renderShippingLabelHtml(label, order, eligibility.product),
      };
    }

    return json(200, { ok: true, eligible: true, order, label });
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'Invalid request' });
  }

  const resolvedOrderId = orderId || clean(body.orderId, 180);
  if (!resolvedOrderId) {
    return json(400, { ok: false, error: 'Missing order id' });
  }

  const order = await readOrder(store, resolvedOrderId);
  if (!order) {
    return json(404, { ok: false, error: 'Order not found' });
  }

  const candidateOrder: ShippingOrderRecordLike = {
    ...order,
    shippingMethod: (clean(body.deliveryMethod, 40) as ShippingMethod) || order.shippingMethod,
    shippingCarrier: clean(body.carrier, 120) || order.shippingCarrier,
    shippingService: clean(body.service, 120) || order.shippingService,
    trackingNumber: clean(body.trackingNumber, 160) || order.trackingNumber,
    shippingChargeCents: typeof body.shippingChargeCents === 'number' && Number.isFinite(body.shippingChargeCents)
      ? Math.max(0, Math.round(body.shippingChargeCents))
      : order.shippingChargeCents,
  };

  const eligibility = evaluateShippingLabelEligibility(candidateOrder, catalogue);
  if (!eligibility.ok) {
    await saveOrder(store, {
      ...order,
      shippingStatus: 'blocked',
      shippingBlockReason: eligibility.message,
      updatedAt: new Date().toISOString(),
    });
    return json(400, { ok: false, code: eligibility.code, error: eligibility.message });
  }

  const now = new Date().toISOString();
  const labelId = clean(order.shippingLabelId ?? `label-${resolvedOrderId}-${randomUUID()}`, 160);
  const deliveryMethod = eligibility.method;
  const carrier = candidateOrder.shippingCarrier || (deliveryMethod === 'brisbane_local_delivery' ? 'Beyond RV Local Delivery' : 'Australia Post');
  const service = candidateOrder.shippingService || (deliveryMethod === 'brisbane_local_delivery' ? 'Brisbane delivery' : 'Parcel Post');
  const trackingNumber = candidateOrder.trackingNumber || '';
  const shippingChargeCents = candidateOrder.shippingChargeCents ?? 0;
  const printUrlValue = printUrl(resolvedOrderId);

  const label = buildShippingLabelRecord({
    order: candidateOrder,
    product: eligibility.product,
    labelId,
    createdAt: now,
    createdBy: 'admin',
    deliveryMethod,
    carrier,
    service,
    trackingNumber,
    shippingChargeCents,
    printUrl: printUrlValue,
  });

  const updatedOrder: ShippingOrderRecordLike = {
    ...candidateOrder,
    shippingMethod: deliveryMethod,
    shippingCarrier: label.carrier,
    shippingService: label.service,
    trackingNumber: label.trackingNumber,
    shippingChargeCents: label.shippingChargeCents,
    shippingStatus: 'label_created',
    shippingLabelId: label.labelId,
    shippingLabelCreatedAt: now,
    shippingLabelUrl: printUrlValue,
    shippingBlockReason: '',
    updatedAt: now,
  };

  try {
    await saveOrder(store, updatedOrder);
  } catch (error) {
    console.warn('admin-shipping-label: failed to save label', {
      orderId: resolvedOrderId,
      error: safeBlobStoreError(error),
    });
    return json(500, { ok: false, error: blobStoreUserMessage(error) });
  }

  let emailSent = false;
  if (updatedOrder.customerEmail) {
    const emailResult = await sendResendEmail({
      to: updatedOrder.customerEmail,
      subject: `Your Beyond RV delivery is ready${trackingNumber ? ` - ${trackingNumber}` : ''}`,
      text: orderLabelEmailText(label),
      html: orderLabelEmailHtml(label),
    });
    emailSent = emailResult.sent;
  }

  return json(200, {
    ok: true,
    order: updatedOrder,
    label,
    printUrl: printUrlValue,
    emailSent,
  });
};
