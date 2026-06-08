import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { getBlobStore, safeBlobStoreError } from './blob-store';
import {
  auditLogKey,
  newOwnerCopilotId,
  OWNER_COPILOT_AUDIT_STORE,
} from './owner-copilot-core';

export const GOOGLE_OAUTH_STORE = 'owner-copilot-google-oauth';
export const GOOGLE_OAUTH_STATE_STORE = 'owner-copilot-google-oauth-states';
export const GOOGLE_CONNECTION_KEY = 'google-oauth/owner.json';
export const GOOGLE_SETTINGS_KEY = 'google-oauth/settings.json';

export const GOOGLE_SCOPES = {
  gmailReadonly: 'https://www.googleapis.com/auth/gmail.readonly',
  driveMetadataReadonly: 'https://www.googleapis.com/auth/drive.metadata.readonly',
  driveReadonly: 'https://www.googleapis.com/auth/drive.readonly',
};

export const GOOGLE_DEFAULT_SCOPES = [
  GOOGLE_SCOPES.gmailReadonly,
  GOOGLE_SCOPES.driveMetadataReadonly,
];

export function googleRedirectUri(event: { headers: Record<string, string | undefined> }) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${siteOrigin(event)}/.netlify/functions/google-oauth-callback`;
}

export function siteOrigin(event: { headers: Record<string, string | undefined> }) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host || process.env.URL?.replace(/^https?:\/\//, '') || 'beyondrv.com.au';
  return `${proto}://${host}`;
}

export function googleOAuthConfig(event: { headers: Record<string, string | undefined> }) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const encryptionKey = process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY || process.env.ADMIN_COOKIE_SECRET || '';
  const redirectUri = googleRedirectUri(event);
  const missing = [
    !clientId && 'GOOGLE_OAUTH_CLIENT_ID',
    !clientSecret && 'GOOGLE_OAUTH_CLIENT_SECRET',
    !encryptionKey && 'GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY or ADMIN_COOKIE_SECRET',
    !redirectUri && 'GOOGLE_OAUTH_REDIRECT_URI',
  ].filter(Boolean) as string[];

  return {
    clientId,
    clientSecret,
    encryptionKey,
    redirectUri,
    scopes: GOOGLE_DEFAULT_SCOPES,
    ready: missing.length === 0,
    missing,
  };
}

function keyFromSecret(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string, secret: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted token payload.');
  const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export async function appendGoogleAudit(action: string, detail: Record<string, unknown>) {
  try {
    const store = getBlobStore(OWNER_COPILOT_AUDIT_STORE);
    const id = newOwnerCopilotId('audit');
    await store.setJSON(auditLogKey(id), {
      id,
      action,
      targetType: 'google_oauth',
      targetId: 'owner',
      actor: 'owner',
      detail,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('google-oauth-core: audit append failed', { action, error: safeBlobStoreError(error) });
  }
}

export async function getGoogleConnection() {
  const store = getBlobStore(GOOGLE_OAUTH_STORE);
  try {
    return await store.get(GOOGLE_CONNECTION_KEY, { type: 'json' }) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

export async function getGoogleOwnerSettings() {
  const store = getBlobStore(GOOGLE_OAUTH_STORE);
  try {
    const settings = await store.get(GOOGLE_SETTINGS_KEY, { type: 'json' }) as Record<string, unknown> | null;
    return {
      gmailQuery: typeof settings?.gmailQuery === 'string' ? settings.gmailQuery : 'newer_than:30d',
      gmailMaxResults: Number.isFinite(Number(settings?.gmailMaxResults)) ? Math.max(1, Math.min(50, Number(settings?.gmailMaxResults))) : 10,
      ignoredSenders: Array.isArray(settings?.ignoredSenders) ? settings.ignoredSenders.filter((item): item is string => typeof item === 'string') : [],
      driveFolderIds: Array.isArray(settings?.driveFolderIds) ? settings.driveFolderIds.filter((item): item is string => typeof item === 'string') : [],
      driveMaxResults: Number.isFinite(Number(settings?.driveMaxResults)) ? Math.max(1, Math.min(50, Number(settings?.driveMaxResults))) : 10,
      summarizeDriveFiles: Boolean(settings?.summarizeDriveFiles),
      updatedAt: typeof settings?.updatedAt === 'string' ? settings.updatedAt : '',
    };
  } catch {
    return {
      gmailQuery: 'newer_than:30d',
      gmailMaxResults: 10,
      ignoredSenders: [] as string[],
      driveFolderIds: [] as string[],
      driveMaxResults: 10,
      summarizeDriveFiles: false,
      updatedAt: '',
    };
  }
}

export async function saveGoogleOwnerSettings(settings: Record<string, unknown>) {
  const store = getBlobStore(GOOGLE_OAUTH_STORE);
  const cleanSettings = {
    gmailQuery: typeof settings.gmailQuery === 'string' && settings.gmailQuery.trim()
      ? settings.gmailQuery.trim().slice(0, 500)
      : 'newer_than:30d',
    gmailMaxResults: Math.max(1, Math.min(50, Number(settings.gmailMaxResults) || 10)),
    ignoredSenders: Array.isArray(settings.ignoredSenders)
      ? settings.ignoredSenders.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(Boolean).slice(0, 50)
      : [],
    driveFolderIds: Array.isArray(settings.driveFolderIds)
      ? settings.driveFolderIds.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 20)
      : [],
    driveMaxResults: Math.max(1, Math.min(50, Number(settings.driveMaxResults) || 10)),
    summarizeDriveFiles: Boolean(settings.summarizeDriveFiles),
    updatedAt: new Date().toISOString(),
  };
  await store.setJSON(GOOGLE_SETTINGS_KEY, cleanSettings);
  return cleanSettings;
}

export async function getGoogleAccessToken(config: ReturnType<typeof googleOAuthConfig>) {
  const store = getBlobStore(GOOGLE_OAUTH_STORE);
  const connection = await getGoogleConnection();
  if (!connection || connection.revokedAt) throw new Error('Google is not connected.');
  const encryptedAccessToken = typeof connection.encryptedAccessToken === 'string' ? connection.encryptedAccessToken : '';
  const encryptedRefreshToken = typeof connection.encryptedRefreshToken === 'string' ? connection.encryptedRefreshToken : '';
  const expiresAt = typeof connection.expiresAt === 'string' ? Date.parse(connection.expiresAt) : 0;

  if (encryptedAccessToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return decryptSecret(encryptedAccessToken, config.encryptionKey);
  }
  if (!encryptedRefreshToken) throw new Error('Google token has expired and no refresh token is stored. Reconnect Google.');

  const refreshToken = decryptSecret(encryptedRefreshToken, config.encryptionKey);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json() as { access_token?: string; expires_in?: number; token_type?: string; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    await store.setJSON(GOOGLE_CONNECTION_KEY, {
      ...connection,
      refreshFailedAt: new Date().toISOString(),
      refreshFailureReason: data.error_description || data.error || 'Google token refresh failed.',
    });
    throw new Error(data.error_description || data.error || 'Google token refresh failed.');
  }

  const updated = {
    ...connection,
    encryptedAccessToken: encryptSecret(data.access_token, config.encryptionKey),
    expiresAt: new Date(Date.now() + Math.max(60, data.expires_in || 3600) * 1000).toISOString(),
    tokenType: data.token_type || connection.tokenType || 'Bearer',
    scopes: data.scope ? data.scope.split(/\s+/).filter(Boolean) : connection.scopes,
    refreshFailedAt: '',
    refreshFailureReason: '',
  };
  await store.setJSON(GOOGLE_CONNECTION_KEY, updated);
  return data.access_token;
}

export function publicGoogleConnectionState(connection: Record<string, unknown> | null, missing: string[]) {
  if (missing.length) return 'not_configured';
  if (!connection) return 'not_connected';
  if (connection.revokedAt) return 'access_revoked';
  if (connection.refreshFailedAt) return 'refresh_failed';
  if (typeof connection.expiresAt === 'string' && Date.parse(connection.expiresAt) < Date.now() && !connection.encryptedRefreshToken) return 'token_expired';
  return 'connected';
}
