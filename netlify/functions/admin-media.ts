import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';

const STORE_NAME = 'product-media';
const ALLOWED_SCOPES = new Set(['products', 'pages']);

function mediaUrl(key: string) {
  return `/media/${key}`;
}

function safePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function safeSlug(value: string) {
  return value
    .split('/')
    .map(safePart)
    .filter(Boolean)
    .join('/');
}

function legacySafeSlug(value: string) {
  return safePart(value);
}

export const handler: Handler = async (event) => {
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  if (event.httpMethod === 'GET') {
    const rawSlug = event.queryStringParameters?.slug ?? '';
    const rawScope = event.queryStringParameters?.scope ?? 'products';
    const scope = ALLOWED_SCOPES.has(rawScope) ? rawScope : 'products';
    const slug = safeSlug(rawSlug);
    const prefixes = slug
      ? scope === 'products'
        ? [...new Set([`products/${slug}/`, `products/${legacySafeSlug(rawSlug)}/`])]
        : [`pages/${slug}/`]
      : [`${scope}/`];
    const store = getBlobStore(STORE_NAME);
    let blobs: Awaited<ReturnType<typeof store.list>>['blobs'];
    try {
      const results = await Promise.all(prefixes.map((prefix) => store.list({ prefix })));
      const byKey = new Map(results.flatMap((result) => result.blobs).map((blob) => [blob.key, blob]));
      blobs = [...byKey.values()];
    } catch (error) {
      console.warn('admin-media: media store unavailable', error);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [] }),
      };
    }

    const files = await Promise.all(
      blobs.map(async (blob) => {
        let metadata = null;
        try {
          metadata = await store.getMetadata(blob.key, { consistency: 'strong' });
        } catch {
          metadata = null;
        }
        return {
          key: blob.key,
          url: mediaUrl(blob.key),
          optimizedUrl: `/.netlify/images?url=${encodeURIComponent(mediaUrl(blob.key))}&w=1200&fit=cover`,
          metadata: metadata?.metadata ?? {},
          etag: blob.etag,
        };
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    };
  }

  if (event.httpMethod === 'DELETE') {
    const store = getBlobStore(STORE_NAME);
    let payload: { key?: string };
    try {
      payload = JSON.parse(event.body ?? '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const key = payload.key ?? '';
    if (!key.startsWith('products/') && !key.startsWith('pages/')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid media key' }) };
    }

    await store.delete(key);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
