import type { Handler } from '@netlify/functions';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  appendGoogleAudit,
  encryptSecret,
  GOOGLE_CONNECTION_KEY,
  GOOGLE_OAUTH_STATE_STORE,
  GOOGLE_OAUTH_STORE,
  googleOAuthConfig,
} from './google-oauth-core';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function htmlResponse(title: string, message: string, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;background:#111;color:#fff;padding:2rem"><h1>${title}</h1><p>${message}</p><p><a style="color:#93c5fd" href="/admin/">Return to admin</a></p><script>setTimeout(function(){location.href='/admin/'},1800)</script></body></html>`,
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  connectBlobStore(event);

  const config = googleOAuthConfig(event);
  if (!config.ready) return htmlResponse('Google OAuth is not configured', `Missing ${config.missing.join(', ')}.`, 503);

  const params = event.queryStringParameters || {};
  const code = params.code || '';
  const state = params.state || '';
  const oauthError = params.error || '';
  if (oauthError) return htmlResponse('Google connection declined', oauthError, 400);
  if (!code || !state) return htmlResponse('Google connection failed', 'Missing authorization code or state.', 400);

  try {
    const stateStore = getBlobStore(GOOGLE_OAUTH_STATE_STORE);
    const storedState = await stateStore.get(`states/${state}.json`, { type: 'json' }) as { createdAt?: string } | null;
    const createdAt = Date.parse(storedState?.createdAt || '');
    if (!storedState || !Number.isFinite(createdAt) || Date.now() - createdAt > STATE_MAX_AGE_MS) {
      return htmlResponse('Google connection expired', 'Start the Google connection again from admin.', 400);
    }
    await stateStore.delete(`states/${state}.json`);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenText = await tokenRes.text();
    const tokenData = JSON.parse(tokenText) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed.');
    }

    const connectionStore = getBlobStore(GOOGLE_OAUTH_STORE);
    const previous = await connectionStore.get(GOOGLE_CONNECTION_KEY, { type: 'json' }) as Record<string, unknown> | null;
    const refreshToken = tokenData.refresh_token
      || (typeof previous?.encryptedRefreshToken === 'string' ? undefined : '');
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptSecret(tokenData.refresh_token, config.encryptionKey)
      : typeof previous?.encryptedRefreshToken === 'string'
        ? previous.encryptedRefreshToken
        : '';
    const expiresAt = new Date(Date.now() + Math.max(60, tokenData.expires_in || 3600) * 1000).toISOString();

    await connectionStore.setJSON(GOOGLE_CONNECTION_KEY, {
      connectedAt: new Date().toISOString(),
      connectedEmail: typeof previous?.connectedEmail === 'string' ? previous.connectedEmail : '',
      scopes: tokenData.scope ? tokenData.scope.split(/\s+/).filter(Boolean) : config.scopes,
      encryptedAccessToken: encryptSecret(tokenData.access_token, config.encryptionKey),
      encryptedRefreshToken,
      hasRefreshToken: Boolean(refreshToken || encryptedRefreshToken),
      expiresAt,
      tokenType: tokenData.token_type || 'Bearer',
      revokedAt: '',
      refreshFailedAt: '',
      lastSyncAt: '',
    });

    await appendGoogleAudit('google_oauth_connected', { scopes: tokenData.scope || config.scopes, expiresAt });
    return htmlResponse('Google connected', 'Read-only Gmail and Drive access has been stored for Owner Copilot.');
  } catch (error) {
    console.warn('google-oauth-callback: failed', { error: safeBlobStoreError(error) });
    return htmlResponse('Google connection failed', error instanceof Error ? error.message : blobStoreUserMessage(error), 503);
  }
};
