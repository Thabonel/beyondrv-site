import { getStore } from '@netlify/blobs';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const STORE_NAME = 'product-media';

function mediaUrl(key: string) {
  return `/media/${key}`;
}

export const handler: Handler = async (event) => {
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (event.httpMethod === 'GET') {
    const slug = event.queryStringParameters?.slug ?? '';
    const prefix = slug ? `products/${slug}/` : 'products/';
    let blobs: Awaited<ReturnType<typeof store.list>>['blobs'];
    try {
      ({ blobs } = await store.list({ prefix }));
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
    let payload: { key?: string };
    try {
      payload = JSON.parse(event.body ?? '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const key = payload.key ?? '';
    if (!key.startsWith('products/')) {
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
