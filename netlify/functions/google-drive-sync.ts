import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  appendGoogleAudit,
  getGoogleAccessToken,
  getGoogleConnection,
  getGoogleOwnerSettings,
  googleOAuthConfig,
  publicGoogleConnectionState,
} from './google-oauth-core';
import {
  driveFileKey,
  OWNER_COPILOT_CUSTOMER_STORE,
  OWNER_COPILOT_DRIVE_FILE_STORE,
  OWNER_COPILOT_LEAD_STORE,
} from './owner-copilot-core';
import { scoreDriveFileMatches } from './owner-copilot-matching-core';
import { listJsonStore } from './owner-copilot-store-utils';

async function googleJson<T>(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Google request failed with ${res.status}`);
  return data as T;
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  const config = googleOAuthConfig(event);
  try {
    const connection = await getGoogleConnection();
    const state = publicGoogleConnectionState(connection, config.missing);
    if (state !== 'connected') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          ready: false,
          state,
          message: 'Connect Google before Drive ingestion can run.',
          requiredOwnerInputs: [
            'Approved Drive folder IDs for product, customer, and operations files.',
            'Allowed file types for Owner Copilot knowledge.',
            'Whether customer documents can be summarized or only linked.',
          ],
        }),
      };
    }

    const settings = await getGoogleOwnerSettings();
    if (settings.driveFolderIds.length === 0) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          ready: false,
          state,
          message: 'Add at least one approved Drive folder ID before Drive sync can run.',
          requiredOwnerInputs: ['Approved Drive folder IDs for product, customer, and operations files.'],
        }),
      };
    }

    const accessToken = await getGoogleAccessToken(config);
    const store = getBlobStore(OWNER_COPILOT_DRIVE_FILE_STORE);
    const [customers, leads] = await Promise.all([
      listJsonStore(OWNER_COPILOT_CUSTOMER_STORE).catch(() => []),
      listJsonStore(OWNER_COPILOT_LEAD_STORE).catch(() => []),
    ]);

    let saved = 0;
    for (const folderId of settings.driveFolderIds) {
      const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
      listUrl.searchParams.set('pageSize', String(settings.driveMaxResults));
      listUrl.searchParams.set('fields', 'files(id,name,mimeType,webViewLink,modifiedTime,description,parents)');
      listUrl.searchParams.set('q', `'${escapeDriveQuery(folderId)}' in parents and trashed = false`);
      const data = await googleJson<{ files?: Array<{ id: string; name?: string; mimeType?: string; webViewLink?: string; modifiedTime?: string; description?: string; parents?: string[] }> }>(listUrl.toString(), accessToken);
      for (const file of data.files || []) {
        const record = {
          id: file.id,
          fileId: file.id,
          name: file.name || '',
          mimeType: file.mimeType || '',
          webViewLink: file.webViewLink || '',
          folderId,
          folderName: folderId,
          description: file.description || '',
          productInterest: '',
          modifiedAt: file.modifiedTime || new Date().toISOString(),
          source: 'drive_metadata_readonly_sync',
          updatedAt: new Date().toISOString(),
        };
        const existing = await store.get(driveFileKey(record.id), { type: 'json' }) as Record<string, unknown> | null;
        const suggestions = scoreDriveFileMatches(record, customers as never, leads as never);
        await store.setJSON(driveFileKey(record.id), {
          ...existing,
          ...record,
          createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : record.updatedAt,
          matchDecision: existing?.matchDecision || '',
          linkedTargetType: existing?.linkedTargetType || '',
          linkedTargetId: existing?.linkedTargetId || '',
          suggestions,
        });
        saved += 1;
      }
    }

    await appendGoogleAudit('drive_metadata_sync_completed', { folderCount: settings.driveFolderIds.length, saved });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ready: true,
        state,
        synced: saved,
        message: `Drive sync saved ${saved} read-only file record${saved === 1 ? '' : 's'}.`,
        requiredOwnerInputs: [],
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
