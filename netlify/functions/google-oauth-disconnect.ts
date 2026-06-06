import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { appendGoogleAudit, GOOGLE_CONNECTION_KEY, GOOGLE_OAUTH_STORE, getGoogleConnection } from './google-oauth-core';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  try {
    const existing = await getGoogleConnection();
    const store = getBlobStore(GOOGLE_OAUTH_STORE);
    await store.setJSON(GOOGLE_CONNECTION_KEY, {
      ...(existing || {}),
      encryptedAccessToken: '',
      encryptedRefreshToken: '',
      hasRefreshToken: false,
      revokedAt: new Date().toISOString(),
      refreshFailedAt: '',
    });
    await appendGoogleAudit('google_oauth_disconnected', {});
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.warn('google-oauth-disconnect: unavailable', { error: safeBlobStoreError(error) });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
};
