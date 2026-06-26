import type { Handler } from '@netlify/functions';
import { json, siteUrl } from './stripe-shared';

const STRIPE_SESSIONS_API = 'https://api.stripe.com/v1/checkout/sessions';

interface StripeSessionResponse {
  id: string;
  object: 'checkout.session';
  status?: string;
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

function safeSessionId(value: string | null) {
  return typeof value === 'string' && /^cs_[A-Za-z0-9_]+$/.test(value) ? value : '';
}

async function retrieveSession(sessionId: string, secret: string) {
  const url = new URL(`${STRIPE_SESSIONS_API}/${encodeURIComponent(sessionId)}`);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stripe session lookup failed (${response.status}): ${body.slice(0, 240)}`);
  }

  return response.json() as Promise<StripeSessionResponse>;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const sessionId = safeSessionId(event.queryStringParameters?.session_id ?? event.queryStringParameters?.id ?? null);
  if (!sessionId) {
    return json(400, { ok: false, code: 'INVALID_SESSION', message: 'A valid Stripe session id is required.' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error('[session-status] STRIPE_SECRET_KEY is not configured');
    return json(500, { ok: false, code: 'CONFIG', message: 'Stripe verification is temporarily unavailable.' });
  }

  try {
    const session = await retrieveSession(sessionId, secret);
    const paymentStatus = session.payment_status ?? 'unpaid';

    return json(200, {
      ok: true,
      verified: true,
      session_id: session.id,
      status: session.status ?? 'unknown',
      payment_status: paymentStatus,
      paid: paymentStatus === 'paid',
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? 'aud',
      customer_email: session.customer_details?.email ?? '',
      customer_name: session.customer_details?.name ?? '',
      metadata: session.metadata ?? {},
      payment_intent: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? '',
      site_url: siteUrl(),
    });
  } catch (error) {
    console.error('[session-status] lookup failed:', error);
    return json(404, { ok: false, code: 'NOT_FOUND', message: 'We could not verify that payment session.' });
  }
};

