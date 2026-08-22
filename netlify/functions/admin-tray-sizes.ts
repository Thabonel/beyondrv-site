import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { mapWithConcurrency, removeTraySize, TRAY_SIZE_STORE, traySizeKey, type TraySizeRecord } from './tray-size-core';
import variantIndex from './vehicle-variant-index.json';

// Moderating by variant id means decoding strings like
// ford-ranger-2022my-4x4-xl-double-cc-singleturbo. Send the label the picker
// already shows instead.
const LABELS = new Map(
  (variantIndex.variants as Array<{ id: string; label: string }>).map((v) => [v.id, v.label]),
);

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (!['GET', 'DELETE'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  const capability = event.httpMethod === 'GET' ? 'site:read' : 'site:write';
  if (!hasAdminCapability(actor, capability)) return forbiddenResponse(capability);
  connectBlobStore(event);

  try {
    const store = getBlobStore(TRAY_SIZE_STORE);

    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const loaded = await mapWithConcurrency(
        blobs, 8,
        (blob) => store.get(blob.key, { type: 'json' }) as Promise<TraySizeRecord | null>,
      );
      const records = loaded.filter((record): record is TraySizeRecord => Boolean(record?.variantId));
      records.sort((a, b) => b.totalReports - a.totalReports || a.variantId.localeCompare(b.variantId));
      return json(200, {
        records: records.map((record) => ({ ...record, label: LABELS.get(record.variantId) ?? record.variantId })),
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.body ?? '{}');
    } catch {
      return json(400, { error: 'Invalid request' });
    }
    // JSON.parse('null') succeeds, so guard the shape before reading fields.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return json(400, { error: 'Invalid request' });
    }
    const body = parsed as Record<string, unknown>;

    const variantId = typeof body.variantId === 'string' ? body.variantId : '';
    const lengthMm = Number(body.lengthMm);
    const widthMm = Number(body.widthMm);
    if (!variantId || !Number.isInteger(lengthMm) || !Number.isInteger(widthMm)) {
      return json(400, { error: 'Provide the vehicle and the exact size to remove.' });
    }

    const key = traySizeKey(variantId);
    const existing = await store.get(key, { type: 'json' }) as TraySizeRecord | null;
    if (!existing) return json(404, { error: 'No reports for that vehicle.' });

    // Remove one size, never the whole vehicle: a single bad entry should not
    // discard the good reports beside it.
    await store.setJSON(key, removeTraySize(existing, lengthMm, widthMm, new Date().toISOString()));
    return json(200, { ok: true });
  } catch (error) {
    console.warn('admin-tray-sizes: unavailable', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
