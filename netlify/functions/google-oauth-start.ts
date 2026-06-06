import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { appendGoogleAudit, googleOAuthConfig, GOOGLE_OAUTH_STATE_STORE } from './google-oauth-core';

const STATE_TTL_SECONDS = 10 * 60;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  const config = googleOAuthConfig(event);
  if (!config.ready) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        error: `Google OAuth is not configured. Missing ${config.missing.join(', ')}.`,
        missing: config.missing,
        redirectUri: config.redirectUri,
      }),
    };
  }

  try {
    const state = randomUUID();
    const store = getBlobStore(GOOGLE_OAUTH_STATE_STORE);
    await store.setJSON(`states/${state}.json`, {
      state,
      createdAt: new Date().toISOString(),
      redirectUri: config.redirectUri,
      scopes: config.scopes,
    }, { metadata: { expiresAt: new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString() } });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    await appendGoogleAudit('google_oauth_start', { scopes: config.scopes, redirectUri: config.redirectUri });

    const headers: Record<string, string> = {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      'Cache-Control': 'no-store',
    };

    return {
      statusCode: 302,
      headers,
      body: '',
    };
  } catch (error) {
    console.warn('google-oauth-start: unavailable', { error: safeBlobStoreError(error) });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
};
