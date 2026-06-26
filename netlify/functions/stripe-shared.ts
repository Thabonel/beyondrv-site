import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const STRIPE_API_BASE = 'https://api.stripe.com/v1';
export const RESEND_API = 'https://api.resend.com/emails';
export const DEFAULT_PAYMENT_TO_EMAIL = 'beyondcaravans@gmail.com';
export const DEFAULT_PAYMENT_FROM_EMAIL = 'Beyond RV Website <enquiries@beyondrv.com.au>';
export const POSTHOG_CAPTURE_HOST = process.env.POSTHOG_CAPTURE_HOST ?? 'https://us.i.posthog.com';

export function siteUrl() {
  return (process.env.URL ?? 'https://beyondrv.com.au').replace(/\/$/, '');
}

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function hashStableValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function parseStripeSignature(signatureHeader: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts
    .map((part) => part.split('='))
    .find(([key]) => key === 't')?.[1];
  const signatures = parts
    .map((part) => part.split('='))
    .filter(([key]) => key === 'v1')
    .map(([, value]) => value)
    .filter(Boolean);

  return { timestamp, signatures };
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | undefined, secret: string, toleranceSeconds = 300) {
  if (!signatureHeader || !secret) return false;

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;
  if (!/^\d+$/.test(timestamp)) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (ageSeconds > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatures.some((signature) => {
    if (!/^[0-9a-f]+$/i.test(signature) || signature.length !== expected.length) return false;
    const actualBuffer = Buffer.from(signature, 'hex');
    if (actualBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

export async function sendResendEmail(params: {
  subject: string;
  text: string;
  html: string;
  to?: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' };

  const from = process.env.CONTACT_FROM_EMAIL ?? DEFAULT_PAYMENT_FROM_EMAIL;
  const to = params.to ?? process.env.CONTACT_TO_EMAIL ?? DEFAULT_PAYMENT_TO_EMAIL;
  const body: Record<string, unknown> = {
    from,
    to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  };

  if (params.replyTo) body.reply_to = params.replyTo;

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    return {
      sent: false,
      reason: `Email provider rejected the message (${response.status}): ${bodyText.slice(0, 240)}`,
    };
  }

  return { sent: true };
}

export async function capturePosthogEvent(params: {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}) {
  const apiKey = process.env.POSTHOG_CAPTURE_KEY ?? process.env.PUBLIC_POSTHOG_KEY;
  if (!apiKey) return { sent: false, reason: 'POSTHOG_CAPTURE_KEY not configured' };

  try {
    const response = await fetch(`${POSTHOG_CAPTURE_HOST.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: params.event,
        distinct_id: params.distinctId,
        properties: params.properties ?? {},
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      return {
        sent: false,
        reason: `PostHog rejected the event (${response.status}): ${bodyText.slice(0, 240)}`,
      };
    }
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'Unknown PostHog error',
    };
  }

  return { sent: true };
}

