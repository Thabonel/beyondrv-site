import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';

const STORE_NAME = 'customer-orders';

const VALID_ORDER_TYPES = new Set(['standard_model', 'one_off_stock', 'demo_unit', 'used_stock', 'custom_build']);
const VALID_PAYMENT_TYPES = new Set(['deposit', 'full']);
const VALID_PURCHASE_KINDS = new Set(['product', 'cart']);
const VALID_SHIPPING_STATUSES = new Set(['pending', 'ready', 'label_created', 'in_transit', 'delivered', 'blocked']);
const VALID_ORDER_STATUSES = new Set([
  'enquiry',
  'deposit_received',
  'ordered_from_factory',
  'in_china_production',
  'awaiting_shipping',
  'in_transit',
  'arrived_mutdapilly',
  'local_fitout',
  'ready_for_handover',
  'delivered',
  'cancelled',
]);

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanWithFallback(body: Record<string, unknown>, existing: Record<string, unknown> | null, key: string, max = 1000) {
  return key in body ? clean(body[key], max) : clean(existing?.[key], max);
}

function cleanBooleanWithFallback(body: Record<string, unknown>, existing: Record<string, unknown> | null, key: string) {
  return key in body ? body[key] === true : existing?.[key] === true;
}

function cleanNumberWithFallback(body: Record<string, unknown>, existing: Record<string, unknown> | null, key: string) {
  const candidate = key in body ? body[key] : existing?.[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

function isDateFieldValid(value: string) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function orderKey(id: string) {
  return `orders/${encodeURIComponent(id)}.json`;
}

function normalizeOrder(body: Record<string, unknown>, existing: Record<string, unknown> | null) {
  const now = new Date().toISOString();
  const id = clean(existing?.id || body.id, 180) || `order-${now}-${randomUUID()}`;
  const orderType = clean(body.orderType, 40) || clean(existing?.orderType, 40) || 'standard_model';
  const status = clean(body.status, 40) || clean(existing?.status, 40) || 'enquiry';
  const customerName = cleanWithFallback(body, existing, 'customerName', 180);
  const productTitle = cleanWithFallback(body, existing, 'productTitle', 240);
  const factoryOrderDate = cleanWithFallback(body, existing, 'factoryOrderDate', 40);
  const expectedArrivalDate = cleanWithFallback(body, existing, 'expectedArrivalDate', 40);
  const expectedHandoverDate = cleanWithFallback(body, existing, 'expectedHandoverDate', 40);
  const nextActionDate = cleanWithFallback(body, existing, 'nextActionDate', 40);
  const paymentType = cleanWithFallback(body, existing, 'paymentType', 20);
  const purchaseKind = cleanWithFallback(body, existing, 'purchaseKind', 20);
  const paymentStatus = cleanWithFallback(body, existing, 'paymentStatus', 40);
  const currency = cleanWithFallback(body, existing, 'currency', 10).toUpperCase();
  const orderSource = cleanWithFallback(body, existing, 'orderSource', 40);
  const shippingStatus = cleanWithFallback(body, existing, 'shippingStatus', 40);

  if (!VALID_ORDER_TYPES.has(orderType)) throw new Error('Invalid order type');
  if (!VALID_ORDER_STATUSES.has(status)) throw new Error('Invalid order status');
  if (paymentType && !VALID_PAYMENT_TYPES.has(paymentType)) throw new Error('Invalid payment type');
  if (purchaseKind && !VALID_PURCHASE_KINDS.has(purchaseKind)) throw new Error('Invalid purchase kind');
  if (shippingStatus && !VALID_SHIPPING_STATUSES.has(shippingStatus)) throw new Error('Invalid shipping status');
  if (!customerName) throw new Error('Missing customer name');
  if (!productTitle) throw new Error('Missing product');
  if (![factoryOrderDate, expectedArrivalDate, expectedHandoverDate, nextActionDate].every(isDateFieldValid)) {
    throw new Error('Invalid date format');
  }

  return {
    ...existing,
    id,
    customerName,
    customerEmail: cleanWithFallback(body, existing, 'customerEmail', 240),
    customerPhone: cleanWithFallback(body, existing, 'customerPhone', 80),
    productSlug: cleanWithFallback(body, existing, 'productSlug', 240),
    productTitle,
    productCategory: cleanWithFallback(body, existing, 'productCategory', 80),
    sourceEnquiryId: cleanWithFallback(body, existing, 'sourceEnquiryId', 240),
    orderType,
    status,
    depositPaid: cleanBooleanWithFallback(body, existing, 'depositPaid'),
    paymentType: paymentType || undefined,
    purchaseKind: purchaseKind || undefined,
    stripeSessionId: cleanWithFallback(body, existing, 'stripeSessionId', 160),
    stripePaymentIntentId: cleanWithFallback(body, existing, 'stripePaymentIntentId', 160),
    stripeEventId: cleanWithFallback(body, existing, 'stripeEventId', 160),
    paymentStatus: paymentStatus || undefined,
    amountPaidCents: cleanNumberWithFallback(body, existing, 'amountPaidCents'),
    currency: currency || undefined,
    orderSource: orderSource || undefined,
    shippingName: cleanWithFallback(body, existing, 'shippingName', 180),
    shippingAddressLine1: cleanWithFallback(body, existing, 'shippingAddressLine1', 240),
    shippingAddressLine2: cleanWithFallback(body, existing, 'shippingAddressLine2', 240),
    shippingCity: cleanWithFallback(body, existing, 'shippingCity', 120),
    shippingState: cleanWithFallback(body, existing, 'shippingState', 80),
    shippingPostcode: cleanWithFallback(body, existing, 'shippingPostcode', 10),
    shippingCountry: cleanWithFallback(body, existing, 'shippingCountry', 80),
    shippingStatus: shippingStatus || undefined,
    shippingCarrier: cleanWithFallback(body, existing, 'shippingCarrier', 120),
    shippingService: cleanWithFallback(body, existing, 'shippingService', 120),
    trackingNumber: cleanWithFallback(body, existing, 'trackingNumber', 160),
    shippingLabelId: cleanWithFallback(body, existing, 'shippingLabelId', 160),
    shippingLabelCreatedAt: cleanWithFallback(body, existing, 'shippingLabelCreatedAt', 80),
    shippingLabelPrintedAt: cleanWithFallback(body, existing, 'shippingLabelPrintedAt', 80),
    shippingLabelUrl: cleanWithFallback(body, existing, 'shippingLabelUrl', 300),
    shippingBlockReason: cleanWithFallback(body, existing, 'shippingBlockReason', 240),
    shippingNotes: cleanWithFallback(body, existing, 'shippingNotes', 4000),
    factoryOrderDate,
    expectedArrivalDate,
    expectedHandoverDate,
    nextActionDate,
    notes: cleanWithFallback(body, existing, 'notes', 4000),
    createdAt: clean(existing?.createdAt, 80) || now,
    updatedAt: now,
    createdBy: clean(existing?.createdBy, 80) || 'admin',
  };
}

async function readOrder(store: ReturnType<typeof getBlobStore>, key: string) {
  try {
    return await store.get(key, { type: 'json' }) as Record<string, unknown> | null;
  } catch (error) {
    console.warn('admin-orders: skipped unreadable order record', {
      key,
      error: safeBlobStoreError(error),
    });
    return null;
  }
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobConnection = connectBlobStore(event);

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(STORE_NAME);
  } catch (error) {
    console.warn('admin-orders: order store unavailable', {
      store: STORE_NAME,
      blobConnection,
      error: safeBlobStoreError(error),
    });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }

  if (event.httpMethod === 'GET') {
    try {
      const { blobs } = await store.list({ prefix: 'orders/' });
      const orders = (await Promise.all(
        blobs.map(async (blob) => readOrder(store, blob.key))
      ))
        .filter((order): order is Record<string, unknown> => Boolean(order?.id))
        .sort((a, b) => clean(b.updatedAt || b.createdAt).localeCompare(clean(a.updatedAt || a.createdAt)));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      };
    } catch (error) {
      console.warn('admin-orders: order read failed', {
        store: STORE_NAME,
        blobConnection,
        error: safeBlobStoreError(error),
      });
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: blobStoreUserMessage(error) }),
      };
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  }

  const id = clean(body.id, 180);
  let existing: Record<string, unknown> | null = null;
  if (event.httpMethod === 'PATCH') {
    if (!id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing order id' }),
      };
    }
    existing = await store.get(orderKey(id), { type: 'json' }) as Record<string, unknown> | null;
    if (!existing) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Order not found' }),
      };
    }
  }

  try {
    const order = normalizeOrder(body, existing);
    await store.setJSON(orderKey(order.id), order);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, order }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Could not save order' }),
    };
  }
};
