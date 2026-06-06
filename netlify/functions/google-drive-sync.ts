import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, safeBlobStoreError } from './blob-store';
import { getGoogleConnection, googleOAuthConfig, publicGoogleConnectionState } from './google-oauth-core';

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  const config = googleOAuthConfig(event);
  try {
    const connection = await getGoogleConnection();
    const state = publicGoogleConnectionState(connection, config.missing);
    return {
      statusCode: state === 'connected' ? 200 : 409,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ready: state === 'connected',
        state,
        message: state === 'connected'
          ? 'Drive connection is ready. Drive ingestion is held until the owner approves folders and file categories.'
          : 'Connect Google before Drive ingestion can run.',
        requiredOwnerInputs: [
          'Approved Drive folder IDs for product, customer, and operations files.',
          'Allowed file types for Owner Copilot knowledge.',
          'Whether customer documents can be summarized or only linked.',
        ],
      }),
    };
  } catch (error) {
    console.warn('google-drive-sync: unavailable', { error: safeBlobStoreError(error) });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
};
