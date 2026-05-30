import type { Handler } from '@netlify/functions';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';

const STORE_NAME = 'product-media';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const blobConnection = connectBlobStore(event);

  const key = event.queryStringParameters?.key ?? '';
  if (!key.startsWith('products/') && !key.startsWith('pages/')) {
    return { statusCode: 400, body: 'Invalid media key' };
  }

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(STORE_NAME);
  } catch (error) {
    console.warn('media-serve: media store unavailable', {
      store: STORE_NAME,
      blobConnection,
      error: safeBlobStoreError(error),
    });
    return { statusCode: 503, body: blobStoreUserMessage(error) };
  }

  let metadata: Awaited<ReturnType<typeof store.getMetadata>>;
  try {
    metadata = await store.getMetadata(key);
  } catch (error) {
    console.warn('media-serve: media metadata read failed', {
      store: STORE_NAME,
      key,
      error: safeBlobStoreError(error),
    });
    return { statusCode: 503, body: blobStoreUserMessage(error) };
  }
  if (!metadata) return { statusCode: 404, body: 'Not Found' };

  const contentType =
    typeof metadata.metadata?.contentType === 'string'
      ? metadata.metadata.contentType
      : 'application/octet-stream';

  if (event.httpMethod === 'HEAD') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: '',
    };
  }

  let data: ArrayBuffer | null;
  try {
    data = await store.get(key, { type: 'arrayBuffer' });
  } catch (error) {
    console.warn('media-serve: media data read failed', {
      store: STORE_NAME,
      key,
      error: safeBlobStoreError(error),
    });
    return { statusCode: 503, body: blobStoreUserMessage(error) };
  }
  if (!data) return { statusCode: 404, body: 'Not Found' };

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: Buffer.from(data).toString('base64'),
  };
};
