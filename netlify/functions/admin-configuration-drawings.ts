import type { Handler } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import { appendOwnerAudit } from './owner-copilot-store-utils';
import { CONFIGURATION_STORE, configurationKey, hydrateConfigurationRecord } from './configuration-core';
import type { ConfigurationDrawingVersion, ConfigurationRecord } from '../../src/lib/configurator/types';

export const CONFIGURATION_FILE_STORE = 'byondrv-configuration-files';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'model/gltf-binary', 'application/octet-stream']);

function json(statusCode: number, body: Record<string, unknown>) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }; }
function clean(value: unknown, max = 1000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function safeFilename(value: string) { return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160); }

export const handler: Handler = async event => {
  if (!['POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  const requiredCapability = event.httpMethod === 'PATCH' ? 'configurations:approve' : 'configurations:write';
  if (!hasAdminCapability(actor, requiredCapability)) return forbiddenResponse(requiredCapability);
  connectBlobStore(event);
  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
  catch { return json(400, { error: 'Invalid JSON request.' }); }

  const configurationId = clean(body.id, 200);
  if (!configurationId) return json(400, { error: 'Missing configuration id.' });
  try {
    const configurationStore = getBlobStore(CONFIGURATION_STORE);
    const rawConfiguration = await configurationStore.get(configurationKey(configurationId), { type: 'json' }) as ConfigurationRecord | null;
    const configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
    if (!configuration) return json(404, { error: 'Configuration not found.' });
    if (!['draft', 'ready_for_review'].includes(configuration.status)) return json(409, { error: 'Create a revision before changing drawings on this configuration.' });

    if (event.httpMethod === 'PATCH') {
      const drawingId = clean(body.drawingId, 200);
      const status = clean(body.status, 40) as ConfigurationDrawingVersion['status'];
      if (!['in_review', 'changes_requested', 'approved'].includes(status)) return json(400, { error: 'Invalid drawing review status.' });
      const target = configuration.drawings.find(drawing => drawing.id === drawingId);
      if (!target) return json(404, { error: 'Drawing version not found.' });
      const now = new Date().toISOString();
      const drawings = configuration.drawings.map(drawing => {
        if (drawing.id === target.id) return { ...drawing, status, notes: clean(body.notes, 4000) || drawing.notes, reviewedAt: now, reviewedBy: 'owner' };
        if (status === 'approved' && drawing.customItemId === target.customItemId && drawing.status === 'approved') return { ...drawing, status: 'superseded' as const };
        return drawing;
      });
      const customItems = configuration.customItems.map(item => item.id === target.customItemId
        ? { ...item, drawingStatus: status === 'approved' ? 'approved' as const : status === 'changes_requested' ? 'in_progress' as const : 'ready_for_review' as const }
        : item);
      const updated = { ...configuration, drawings, customItems, updatedAt: now, updatedBy: 'owner' };
      await configurationStore.setJSON(configurationKey(configuration.id), updated);
      await appendOwnerAudit('configuration_drawing_reviewed', 'configuration', configuration.id, { drawingId, customItemId: target.customItemId, status, version: target.version }, actor);
      return json(200, { ok: true, configuration: updated });
    }

    const customItemId = clean(body.customItemId, 200);
    const customItem = configuration.customItems.find(item => item.id === customItemId && item.kind === 'custom');
    if (!customItem) return json(400, { error: 'Choose a custom alteration before adding a drawing.' });
    const externalUrl = clean(body.externalUrl, 1000);
    if (externalUrl && !/^https:\/\//i.test(externalUrl)) return json(400, { error: 'Drawing links must use HTTPS.' });
    const filename = safeFilename(clean(body.filename, 240)) || (externalUrl ? 'linked-drawing' : 'drawing');
    const contentType = clean(body.contentType, 160) || 'application/octet-stream';
    const data = clean(body.data, 40_000_000);
    if (!externalUrl && !data) return json(400, { error: 'Choose a file or provide an HTTPS drawing link.' });
    if (!externalUrl && !ALLOWED_TYPES.has(contentType)) return json(400, { error: 'Use PDF, PNG, JPEG, WebP, or GLB files.' });
    if (contentType === 'application/octet-stream' && !filename.endsWith('.glb')) return json(400, { error: 'Generic binary uploads must be GLB files.' });
    const buffer = externalUrl ? Buffer.alloc(0) : Buffer.from(data, 'base64');
    if (buffer.byteLength > MAX_BYTES) return json(413, { error: 'Drawing files must be 25MB or smaller.' });

    const priorVersions = configuration.drawings.filter(drawing => drawing.customItemId === customItemId);
    const version = Math.max(0, ...priorVersions.map(drawing => drawing.version)) + 1;
    const id = randomUUID();
    const key = externalUrl ? '' : `drawings/${configuration.id}/${customItemId}/v${version}/${id}-${filename}`;
    if (!externalUrl) {
      const fileStore = getBlobStore(CONFIGURATION_FILE_STORE);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await fileStore.set(key, arrayBuffer, { metadata: { configurationId, customItemId, filename, contentType, uploadedAt: new Date().toISOString() } });
    }
    const drawing: ConfigurationDrawingVersion = {
      id, customItemId, version, filename, contentType, sizeBytes: buffer.byteLength,
      store: externalUrl ? '' : CONFIGURATION_FILE_STORE, key, externalUrl,
      notes: clean(body.notes, 4000), status: 'uploaded', uploadedAt: new Date().toISOString(), uploadedBy: 'owner', reviewedAt: '', reviewedBy: '',
    };
    const now = new Date().toISOString();
    const updated: ConfigurationRecord = {
      ...configuration,
      drawings: [...configuration.drawings, drawing],
      customItems: configuration.customItems.map(item => item.id === customItemId ? { ...item, drawingStatus: 'ready_for_review' } : item),
      updatedAt: now,
      updatedBy: 'owner',
    };
    await configurationStore.setJSON(configurationKey(configuration.id), updated);
    await appendOwnerAudit('configuration_drawing_added', 'configuration', configuration.id, { drawingId: id, customItemId, version, source: externalUrl ? 'link' : 'upload' }, actor);
    return json(201, { ok: true, configuration: updated, drawing });
  } catch (error) {
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
