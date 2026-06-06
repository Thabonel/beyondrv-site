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
          ? 'Gmail connection is ready. Mail ingestion is held until the owner confirms labels/search windows and privacy rules.'
          : 'Connect Google before Gmail ingestion can run.',
        requiredOwnerInputs: [
          'Which Gmail labels or search queries are approved for lead ingestion.',
          'How far back the first import should look.',
          'Which sender domains or message types should be ignored.',
        ],
      }),
    };
  } catch (error) {
    console.warn('google-gmail-sync: unavailable', { error: safeBlobStoreError(error) });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
};
