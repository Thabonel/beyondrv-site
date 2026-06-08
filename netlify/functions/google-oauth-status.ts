import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, safeBlobStoreError } from './blob-store';
import { getGoogleConnection, getGoogleOwnerSettings, googleOAuthConfig, publicGoogleConnectionState } from './google-oauth-core';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  const config = googleOAuthConfig(event);
  try {
    const connection = await getGoogleConnection();
    const settings = await getGoogleOwnerSettings();
    const state = publicGoogleConnectionState(connection, config.missing);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        state,
        configured: config.ready,
        missing: config.missing,
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        connectedEmail: typeof connection?.connectedEmail === 'string' ? connection.connectedEmail : '',
        connectedAt: typeof connection?.connectedAt === 'string' ? connection.connectedAt : '',
        expiresAt: typeof connection?.expiresAt === 'string' ? connection.expiresAt : '',
        lastSyncAt: typeof connection?.lastSyncAt === 'string' ? connection.lastSyncAt : '',
        settings,
        setupChecklist: [
          'Create or choose the Google Cloud project owned by Beyond RV.',
          'Configure OAuth consent for the owner account.',
          `Add this redirect URI: ${config.redirectUri}`,
          'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Netlify.',
          'Set GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY in Netlify.',
          'Owner clicks Connect Google in admin and grants read-only Gmail/Drive scopes.',
          'Owner chooses approved Drive folders for product/customer files.',
        ],
      }),
    };
  } catch (error) {
    console.warn('google-oauth-status: unavailable', { error: safeBlobStoreError(error) });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error), state: 'unavailable' }),
    };
  }
};
