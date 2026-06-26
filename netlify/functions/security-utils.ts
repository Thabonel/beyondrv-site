import { createHash } from 'crypto';
import type { HandlerEvent } from '@netlify/functions';
import { connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';

const RATE_LIMIT_STORE = 'security-rate-limits';

function clientIp(event: HandlerEvent) {
  return (
    event.headers['x-nf-client-connection-ip'] ??
    event.headers['client-ip'] ??
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function rateLimitKey(event: HandlerEvent, scope: string, windowSeconds: number) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const ipHash = createHash('sha256').update(clientIp(event)).digest('hex').slice(0, 32);
  return `${scope}/${bucket}/${ipHash}.json`;
}

export async function isRateLimited(event: HandlerEvent, scope: string, limit: number, windowSeconds: number) {
  connectBlobStore(event);

  try {
    const store = getBlobStore(RATE_LIMIT_STORE);
    const key = rateLimitKey(event, scope, windowSeconds);
    const existing = await store.get(key, { type: 'json' }) as { count?: number; firstSeenAt?: string } | null;
    const count = Math.max(0, Number(existing?.count ?? 0)) + 1;
    await store.setJSON(key, {
      count,
      firstSeenAt: existing?.firstSeenAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return count > limit;
  } catch (error) {
    console.warn('[security] rate limiter unavailable:', safeBlobStoreError(error));
    return false;
  }
}

export function rateLimitResponse() {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '900',
    },
    body: JSON.stringify({ ok: false, error: 'Too many requests. Please wait a few minutes and try again.' }),
  };
}
