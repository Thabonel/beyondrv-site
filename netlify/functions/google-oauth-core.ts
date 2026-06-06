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

export function publicGoogleConnectionState(connection: Record<string, unknown> | null, missing: string[]) {
  if (missing.length) return 'not_configured';
  if (!connection) return 'not_connected';
  if (connection.revokedAt) return 'access_revoked';
  if (connection.refreshFailedAt) return 'refresh_failed';
  if (typeof connection.expiresAt === 'string' && Date.parse(connection.expiresAt) < Date.now()) return 'token_expired';
  return 'connected';
}
