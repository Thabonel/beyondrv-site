import type { Handler } from '@netlify/functions';
import { connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  capturePosthogEvent,
  escapeHtml,
  hashStableValue,
  json,
  sendResendEmail,
  verifyStripeSignature,
} from './stripe-shared';

const EVENT_STORE = 'stripe-events';
const ORDER_STORE = 'customer-orders';
const DEFAULT_TO_EMAIL = 'beyondcaravans@gmail.com';
const VALID_ORDER_TYPES = new Set(['standard_model', 'one_off_stock', 'demo_unit', 'used_stock', 'custom_build']);

interface StripeCheckoutSession {
  id: string;
  object: 'checkout.session';
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  customer_details?: {
    email?: string | null;
    name?: string | null;
  } | null;
  metadata?: Record<string, string>;
  payment_intent?: string | { id?: string | null } | null;
}

interface StripeOrderRecord {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productSlug: string;
  productTitle: string;
  productCategory: string;
  sourceEnquiryId?: string;
  orderType: string;
  status: string;
  depositPaid: boolean;
  factoryOrderDate: string;
  expectedArrivalDate: string;
  expectedHandoverDate: string;
  nextActionDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  paymentType?: 'deposit' | 'full';
  purchaseKind?: 'product' | 'cart';
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeEventId?: string;
  paymentStatus?: string;
  amountPaidCents?: number;
  currency?: string;
  orderSource?: string;
}

interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  metadata?: Record<string, string>;
  last_payment_error?: { message?: string | null } | null;
}

type StripeEvent =
  | { id: string; type: 'checkout.session.completed' | 'checkout.session.async_payment_succeeded'; data: { object: StripeCheckoutSession } }
  | { id: string; type: 'checkout.session.expired'; data: { object: StripeCheckoutSession } }
  | { id: string; type: 'payment_intent.payment_failed'; data: { object: StripePaymentIntent } }
  | { id: string; type: string; data: { object: Record<string, unknown> } };

function safeText(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined) {
  const resolvedCurrency = currency?.toUpperCase() === 'AUD' ? 'AUD' : 'AUD';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: resolvedCurrency,
  }).format((amount ?? 0) / 100);
}

function paymentSummaryFromSession(session: StripeCheckoutSession) {
  const paymentType = session.metadata?.payment_type === 'deposit' ? 'Deposit' : 'Full Payment';
  const purchaseKind = session.metadata?.purchase_kind === 'product' ? 'product' : 'cart';
  const productName = safeText(session.metadata?.product_name ?? '', 160);
  const productSlug = safeText(session.metadata?.product_slug ?? '', 120);
  return {
    paymentType,
    purchaseKind,
    productName,
    productSlug,
  };
}

function paymentTypeFromSession(session: StripeCheckoutSession) {
  return session.metadata?.payment_type === 'deposit' ? 'deposit' : 'full';
}

function purchaseKindFromSession(session: StripeCheckoutSession) {
  return session.metadata?.purchase_kind === 'product' ? 'product' : 'cart';
}

function orderTypeFromSession(session: StripeCheckoutSession) {
  const candidate = safeText(session.metadata?.order_type ?? '', 40);
  if (VALID_ORDER_TYPES.has(candidate)) return candidate;
  if (purchaseKindFromSession(session) === 'cart') return 'one_off_stock';
  return 'standard_model';
}

function orderStatusFromSession(session: StripeCheckoutSession) {
  return paymentTypeFromSession(session) === 'deposit' ? 'deposit_received' : 'ordered_from_factory';
}

function buildStripeOrder(session: StripeCheckoutSession, eventId: string): StripeOrderRecord {
  const now = new Date().toISOString();
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? '';
  const paymentType = paymentTypeFromSession(session);
  const purchaseKind = purchaseKindFromSession(session);
  const customerName = safeText(
    session.customer_details?.name ?? session.metadata?.customer_name ?? session.customer_details?.email ?? '',
    180
  ) || 'Stripe customer';
  const customerEmail = safeText(session.customer_details?.email ?? session.metadata?.customer_email ?? '', 240);
  const customerPhone = safeText(session.metadata?.customer_phone ?? '', 80);
  const productSlug = safeText(session.metadata?.product_slug ?? session.metadata?.cart_item_slugs ?? '', 240);
  const productTitle = safeText(
    session.metadata?.product_name ?? (purchaseKind === 'cart' ? 'Shop cart order' : 'Stripe checkout order'),
    160
  );
  const sourceEnquiryId = safeText(session.metadata?.source_enquiry_id ?? session.metadata?.enquiry_id ?? '', 240);

  return {
    id: `stripe-${session.id}`,
    customerName,
    customerEmail,
    customerPhone,
    productSlug,
    productTitle,
    productCategory: safeText(session.metadata?.product_category ?? 'shop', 80) || 'shop',
    sourceEnquiryId: sourceEnquiryId || undefined,
    orderType: orderTypeFromSession(session),
    status: orderStatusFromSession(session),
    depositPaid: paymentType === 'deposit',
    factoryOrderDate: '',
    expectedArrivalDate: '',
    expectedHandoverDate: '',
    nextActionDate: '',
    notes: [
      `Stripe session: ${session.id}`,
      paymentIntent ? `Payment intent: ${paymentIntent}` : '',
      `Payment type: ${paymentType}`,
      `Purchase kind: ${purchaseKind}`,
      customerEmail ? `Customer email: ${customerEmail}` : '',
      customerPhone ? `Customer phone: ${customerPhone}` : '',
      productSlug ? `Product slug(s): ${productSlug}` : '',
      session.metadata?.base_product_price ? `Base product price: $${session.metadata.base_product_price}` : '',
      session.metadata?.selected_extra_ids ? `Selected extra IDs: ${session.metadata.selected_extra_ids}` : '',
      session.metadata?.selected_extra_names ? `Selected extras: ${session.metadata.selected_extra_names}` : '',
      session.metadata?.selected_extras_total ? `Selected extras total: $${session.metadata.selected_extras_total}` : '',
      session.metadata?.configured_total ? `Configured total: $${session.metadata.configured_total}` : '',
      session.metadata?.deposit_percentage ? `Deposit percentage: ${session.metadata.deposit_percentage}` : '',
    ].filter(Boolean).join('\n'),
    createdAt: now,
    updatedAt: now,
    createdBy: 'stripe-webhook',
    orderSource: 'stripe_checkout',
    paymentType,
    purchaseKind,
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntent || undefined,
    stripeEventId: eventId,
    paymentStatus: session.payment_status ?? 'paid',
    amountPaidCents: session.amount_total ?? 0,
    currency: (session.currency ?? 'aud').toUpperCase(),
  };
}

function paymentEmailText(session: StripeCheckoutSession) {
  const summary = paymentSummaryFromSession(session);
  const customerEmail = safeText(session.customer_details?.email ?? '', 180);
  const customerName = safeText(session.customer_details?.name ?? '', 180);
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? '';

  return [
    `Payment type: ${summary.paymentType}`,
    `Purchase kind: ${summary.purchaseKind}`,
    summary.productName ? `Item: ${summary.productName}` : '',
    summary.productSlug ? `Slug: ${summary.productSlug}` : '',
    `Amount: ${formatAmount(session.amount_total ?? 0, session.currency ?? 'aud')}`,
    customerName ? `Customer name: ${customerName}` : '',
    customerEmail ? `Customer email: ${customerEmail}` : '',
    paymentIntent ? `Stripe payment/session ID: ${paymentIntent}` : '',
  ].filter(Boolean).join('\n');
}

function paymentEmailHtml(session: StripeCheckoutSession) {
  const summary = paymentSummaryFromSession(session);
  const customerEmail = safeText(session.customer_details?.email ?? '', 180);
  const customerName = safeText(session.customer_details?.name ?? '', 180);
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? '';

  return `
    <h2>New payment received</h2>
    <p><strong>Payment type:</strong> ${escapeHtml(summary.paymentType)}</p>
    <p><strong>Purchase kind:</strong> ${escapeHtml(summary.purchaseKind)}</p>
    ${summary.productName ? `<p><strong>Item:</strong> ${escapeHtml(summary.productName)}</p>` : ''}
    ${summary.productSlug ? `<p><strong>Slug:</strong> ${escapeHtml(summary.productSlug)}</p>` : ''}
    <p><strong>Amount:</strong> ${escapeHtml(formatAmount(session.amount_total ?? 0, session.currency ?? 'aud'))}</p>
    ${customerName ? `<p><strong>Customer name:</strong> ${escapeHtml(customerName)}</p>` : ''}
    ${customerEmail ? `<p><strong>Customer email:</strong> <a href="mailto:${escapeHtml(customerEmail)}">${escapeHtml(customerEmail)}</a></p>` : ''}
    ${paymentIntent ? `<p><strong>Stripe payment/session ID:</strong> ${escapeHtml(paymentIntent)}</p>` : ''}
  `;
}

function eventDistinctId(event: StripeEvent) {
  if (event.type === 'payment_intent.payment_failed') {
    return (event.data.object as StripePaymentIntent).id;
  }
  const session = event.data.object as StripeCheckoutSession;
  const email = session.customer_details?.email ?? '';
  return email ? hashStableValue(email.toLowerCase()) : session.id;
}

async function hasProcessedEvent(eventId: string) {
  try {
    const store = getBlobStore(EVENT_STORE);
    const existing = await store.get(eventId, { type: 'json' });
    return Boolean(existing);
  } catch (error) {
    console.warn('[stripe-webhook] event dedupe unavailable:', safeBlobStoreError(error));
    return false;
  }
}

async function markProcessedEvent(eventId: string, record: Record<string, unknown>) {
  try {
    const store = getBlobStore(EVENT_STORE);
    await store.setJSON(eventId, record);
    return true;
  } catch (error) {
    console.warn('[stripe-webhook] failed to persist processed event:', safeBlobStoreError(error));
    return false;
  }
}

async function hasProcessedSession(sessionId: string) {
  try {
    const store = getBlobStore(EVENT_STORE);
    const existing = await store.get(`session/${sessionId}`, { type: 'json' });
    return Boolean(existing);
  } catch (error) {
    console.warn('[stripe-webhook] session dedupe unavailable:', safeBlobStoreError(error));
    return false;
  }
}

async function markProcessedSession(sessionId: string, record: Record<string, unknown>) {
  try {
    const store = getBlobStore(EVENT_STORE);
    await store.setJSON(`session/${sessionId}`, record);
    return true;
  } catch (error) {
    console.warn('[stripe-webhook] failed to persist processed session:', safeBlobStoreError(error));
    return false;
  }
}

async function upsertStripeOrder(session: StripeCheckoutSession, eventId: string) {
  try {
    const store = getBlobStore(ORDER_STORE);
    const order = buildStripeOrder(session, eventId);
    const key = `orders/${encodeURIComponent(order.id)}.json`;
    const existing = await store.get(key, { type: 'json' }) as Partial<StripeOrderRecord> | null;
    await store.setJSON(key, {
      ...existing,
      ...order,
      createdAt: existing?.createdAt ?? order.createdAt,
      createdBy: existing?.createdBy ?? order.createdBy,
    });
    return { saved: true, order };
  } catch (error) {
    console.warn('[stripe-webhook] order storage unavailable:', safeBlobStoreError(error));
    return { saved: false, error };
  }
}

function eventSignature(event: Parameters<Handler>[0]) {
  return event.headers['stripe-signature'] ?? event.headers['Stripe-Signature'];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return json(500, { ok: false, code: 'CONFIG', message: 'Webhook verification is not configured.' });
  }

  const rawBody = event.body ?? '';
  if (!verifyStripeSignature(rawBody, eventSignature(event), secret)) {
    return json(400, { ok: false, code: 'INVALID_SIGNATURE', message: 'Invalid Stripe signature.' });
  }

  let payload: StripeEvent;
  try {
    payload = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json(400, { ok: false, code: 'INVALID_EVENT', message: 'Malformed Stripe event payload.' });
  }

  connectBlobStore(event);

  if (await hasProcessedEvent(payload.id)) {
    return json(200, { ok: true, skipped: true, reason: 'Event already processed.' });
  }

  if (payload.type === 'checkout.session.completed' || payload.type === 'checkout.session.async_payment_succeeded') {
    const session = payload.data.object as StripeCheckoutSession;
    if (await hasProcessedSession(session.id)) {
      await markProcessedEvent(payload.id, {
        id: payload.id,
        type: payload.type,
        status: 'skipped',
        reason: 'Session already processed.',
        processedAt: new Date().toISOString(),
        sessionId: session.id,
      });
      return json(200, { ok: true, skipped: true, reason: 'Session already processed.' });
    }
    if (session.payment_status !== 'paid') {
      await markProcessedEvent(payload.id, {
        id: payload.id,
        type: payload.type,
        status: 'ignored',
        reason: 'Session was not marked paid.',
        processedAt: new Date().toISOString(),
      });
      return json(200, { ok: true, skipped: true, reason: 'Session was not paid.' });
    }

    const ownerEmail = process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO_EMAIL;
    const replyTo = session.customer_details?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(session.customer_details.email)
      ? session.customer_details.email
      : undefined;
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? '';
    const subjectName = safeText(session.metadata?.product_name ?? session.metadata?.cart_item_slugs ?? 'Shop order', 160);
    const subject = `New payment received${subjectName ? ` — ${subjectName}` : ''}`;
    const text = paymentEmailText(session);
    const html = paymentEmailHtml(session);

    const [emailResult, posthogResult] = await Promise.all([
      sendResendEmail({
        subject,
        text,
        html,
        to: ownerEmail,
        replyTo,
      }),
      capturePosthogEvent({
        event: 'payment_completed',
        distinctId: eventDistinctId(payload),
        properties: {
          payment_type: session.metadata?.payment_type ?? 'full',
          purchase_kind: session.metadata?.purchase_kind ?? 'cart',
          product_slug: session.metadata?.product_slug ?? '',
          product_name: session.metadata?.product_name ?? '',
          amount_total: session.amount_total ?? 0,
          currency: session.currency ?? 'aud',
          payment_intent: paymentIntent,
          stripe_event_id: payload.id,
        },
      }),
    ]);

    const orderResult = await upsertStripeOrder(session, payload.id);
    await markProcessedSession(session.id, {
      sessionId: session.id,
      eventId: payload.id,
      type: payload.type,
      processedAt: new Date().toISOString(),
      orderSaved: orderResult.saved,
    });

    await markProcessedEvent(payload.id, {
      id: payload.id,
      type: payload.type,
      status: 'processed',
      processedAt: new Date().toISOString(),
      emailSent: emailResult.sent,
      posthogSent: posthogResult.sent,
      sessionId: session.id,
      orderSaved: orderResult.saved,
    });

    return json(200, {
      ok: true,
      processed: true,
      email_sent: emailResult.sent,
      posthog_sent: posthogResult.sent,
      order_saved: orderResult.saved,
    });
  }

  if (payload.type === 'checkout.session.expired' || payload.type === 'payment_intent.payment_failed') {
    const object = payload.data.object as StripeCheckoutSession | StripePaymentIntent;
    const amount = 'amount' in object && typeof object.amount === 'number' ? object.amount : undefined;
    const currency = 'currency' in object && typeof object.currency === 'string' ? object.currency : 'aud';
    const metadata = 'metadata' in object && object.metadata && typeof object.metadata === 'object'
      ? (object.metadata as Record<string, string>)
      : {};
    await capturePosthogEvent({
      event: payload.type === 'checkout.session.expired' ? 'checkout_expired' : 'payment_failed',
      distinctId: eventDistinctId(payload),
      properties: {
        stripe_event_id: payload.id,
        amount_total: amount ?? 0,
        currency,
        product_slug: typeof metadata.product_slug === 'string' ? metadata.product_slug : '',
      },
    });
    await markProcessedEvent(payload.id, {
      id: payload.id,
      type: payload.type,
      status: 'logged',
      processedAt: new Date().toISOString(),
    });
    return json(200, { ok: true, logged: true });
  }

  await markProcessedEvent(payload.id, {
    id: payload.id,
    type: payload.type,
    status: 'ignored',
    processedAt: new Date().toISOString(),
  });

  return json(200, { ok: true, ignored: true });
};
