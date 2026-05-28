import type { Handler } from '@netlify/functions';
import { getBlobStore } from './blob-store';

const STORE_NAME = 'product-media';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const key = event.queryStringParameters?.key ?? '';
  if (!key.startsWith('products/') && !key.startsWith('pages/')) {
    return { statusCode: 400, body: 'Invalid media key' };
  }

  const store = getBlobStore(STORE_NAME);
  const metadata = await store.getMetadata(key);
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

  const data = await store.get(key, { type: 'arrayBuffer' });
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
