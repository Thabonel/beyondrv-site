import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { getBlobStore } from './blob-store';

const STORE_NAME = 'product-media';
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  let payload: { slug?: string; filename?: string; contentType?: string; data?: string; alt?: string };
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const slug = safeSlug(payload.slug ?? '');
  const filename = safePart(payload.filename ?? '');
  const contentType = payload.contentType ?? '';
  const data = payload.data ?? '';

  if (!slug || !filename || !data) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing slug, filename, or image data' }) };
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported image type' }) };
  }

  const buffer = Buffer.from(data, 'base64');
  if (buffer.byteLength > MAX_BYTES) {
    return { statusCode: 413, body: JSON.stringify({ error: 'Image must be 12MB or smaller' }) };
  }

  const key = `products/${slug}/${Date.now()}-${randomUUID()}-${filename}`;
  const store = getBlobStore(STORE_NAME);
  const alt = (payload.alt ?? '').trim().slice(0, 180);

  const dataBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  await store.set(key, dataBuffer, {
    metadata: {
      alt,
      slug,
      filename,
      contentType,
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      url: `/media/${key}`,
      optimizedUrl: `/.netlify/images?url=${encodeURIComponent(`/media/${key}`)}&w=1200&fit=cover`,
      alt,
      filename,
      contentType,
    }),
  };
};
