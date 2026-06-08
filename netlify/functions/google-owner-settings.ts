import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, safeBlobStoreError } from './blob-store';
import { appendGoogleAudit, getGoogleOwnerSettings, saveGoogleOwnerSettings } from './google-oauth-core';

function splitList(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  return value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  try {
    if (event.httpMethod === 'GET') {
      const settings = await getGoogleOwnerSettings();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ settings }) };
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const settings = await saveGoogleOwnerSettings({
      gmailQuery: body.gmailQuery,
      gmailMaxResults: body.gmailMaxResults,
      ignoredSenders: splitList(body.ignoredSenders),
      driveFolderIds: splitList(body.driveFolderIds),
      driveMaxResults: body.driveMaxResults,
      summarizeDriveFiles: body.summarizeDriveFiles,
    });
    await appendGoogleAudit('google_owner_settings_saved', {
      gmailQuery: settings.gmailQuery,
      gmailMaxResults: settings.gmailMaxResults,
      ignoredSenderCount: settings.ignoredSenders.length,
      driveFolderCount: settings.driveFolderIds.length,
      driveMaxResults: settings.driveMaxResults,
      summarizeDriveFiles: settings.summarizeDriveFiles,
    });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, settings }) };
  } catch (error) {
    console.warn('google-owner-settings: failed', { error: safeBlobStoreError(error) });
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: blobStoreUserMessage(error) }) };
  }
};
