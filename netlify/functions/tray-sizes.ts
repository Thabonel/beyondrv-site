import type { Handler } from '@netlify/functions';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { isRateLimited, rateLimitResponse } from './security-utils';
import variantIndex from './vehicle-variant-index.json';
import {
  acceptTraySizeSubmission,
  recordTraySizeWithRetry,
  TRAY_SIZE_STORE,
  winningTraySize,
  type ConditionalStore,
  type TraySizeRecord,
} from './tray-size-core';

const CAB_CHASSIS = new Set(
  (variantIndex.variants as Array<{ id: string; bodyType: string }>)
    .filter((variant) => variant.bodyType === 'cab_chassis')
    .map((variant) => variant.id),
);

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  connectBlobStore(event);

  try {
    const store = getBlobStore(TRAY_SIZE_STORE);

    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const sizes: Record<string, { lengthMm: number; widthMm: number; reports: number }> = {};
      for (const blob of blobs) {
        const record = await store.get(blob.key, { type: 'json' }) as TraySizeRecord | null;
        const winner = winningTraySize(record);
        if (record?.variantId && winner) sizes[record.variantId] = winner;
      }
      return json(200, { sizes });
    }

    if (await isRateLimited(event, 'tray-sizes', 10, 60 * 60)) return rateLimitResponse();

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    } catch {
      return json(400, { error: 'Invalid request' });
    }

    const accepted = acceptTraySizeSubmission(body, (id) => CAB_CHASSIS.has(id));
    if (!accepted.ok) return json(400, { error: accepted.error });

    const written = await recordTraySizeWithRetry(
      store as unknown as ConditionalStore,
      accepted.variantId,
      accepted.lengthMm,
      accepted.widthMm,
      () => new Date().toISOString(),
    );
    if (!written.ok) {
      return json(409, { error: 'That vehicle is busy right now. Please try again.' });
    }

    return json(200, { ok: true, size: winningTraySize(written.record) });
  } catch (error) {
    console.warn('tray-sizes: unavailable', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
