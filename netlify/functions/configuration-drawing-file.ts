import type { Handler } from '@netlify/functions';
import { isAdminAuthorized } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';
import { CONFIGURATION_STORE, configurationKey, hydrateConfigurationRecord } from './configuration-core';
import { loadConfigurationForReviewToken } from './configuration-review-core';
import { CONFIGURATION_FILE_STORE } from './admin-configuration-drawings';
import type { ConfigurationRecord } from '../../src/lib/configurator/types';

function clean(value: unknown, max = 1000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') return { statusCode: 405, body: 'Method Not Allowed' };
  connectBlobStore(event);
  const drawingId = clean(event.queryStringParameters?.drawingId, 200);
  if (!drawingId) return { statusCode: 400, body: 'Missing drawing id.' };
  try {
    let configuration: ConfigurationRecord | null = null;
    const token = clean(event.queryStringParameters?.token, 500);
    if (token) {
      const loaded = await loadConfigurationForReviewToken(token);
      if (!loaded.state.valid) return { statusCode: 410, body: loaded.state.reason };
      configuration = loaded.configuration;
    } else if (isAdminAuthorized(event)) {
      const id = clean(event.queryStringParameters?.id, 200);
      const rawConfiguration = id ? await getBlobStore(CONFIGURATION_STORE).get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null : null;
      configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
    } else {
      return { statusCode: 401, body: 'Unauthorized' };
    }
    const drawing = configuration?.drawings.find(item => item.id === drawingId);
    if (!drawing) return { statusCode: 404, body: 'Drawing not found.' };
    if (token && drawing.status !== 'approved') return { statusCode: 403, body: 'Drawing is not approved for customer review.' };
    if (drawing.externalUrl) return { statusCode: 302, headers: { Location: drawing.externalUrl, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }, body: '' };
    if (!drawing.key || drawing.store !== CONFIGURATION_FILE_STORE) return { statusCode: 404, body: 'Drawing file not found.' };
    const headers = { 'Content-Type': drawing.contentType || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="${drawing.filename.replace(/["\r\n]/g, '')}"`, 'Referrer-Policy': 'no-referrer' };
    if (event.httpMethod === 'HEAD') return { statusCode: 200, headers, body: '' };
    const data = await getBlobStore(CONFIGURATION_FILE_STORE).get(drawing.key, { type: 'arrayBuffer' });
    if (!data) return { statusCode: 404, body: 'Drawing file not found.' };
    return { statusCode: 200, isBase64Encoded: true, headers, body: Buffer.from(data).toString('base64') };
  } catch {
    return { statusCode: 503, body: 'Drawing service unavailable.' };
  }
};
