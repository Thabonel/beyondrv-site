import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import type { ConfigurationRecord, ConfigurationSnapshot } from '../../src/lib/configurator/types';
import {
  CONFIGURATION_STORE,
  configurationKey,
  configurationSnapshotKey,
  createConfigurationCopy,
  createConfigurationSnapshot,
  evaluateConfigurationRecord,
  hydrateConfigurationRecord,
  normaliseConfigurationInput,
} from './configuration-core';
import { getEffectiveConfiguratorCatalogue } from './configurator-catalogue-core';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    body: JSON.stringify(body),
  };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function readBody(raw: string | null) {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function listConfigurations() {
  const store = getBlobStore(CONFIGURATION_STORE);
  const { blobs } = await store.list({ prefix: 'configurations/' });
  const records = await Promise.all(blobs.map(async blob => {
    try {
      const record = await store.get(blob.key, { type: 'json' }) as ConfigurationRecord | null;
      return record ? hydrateConfigurationRecord(record) : null;
    } catch {
      return null;
    }
  }));
  return records
    .filter((record): record is ConfigurationRecord => Boolean(record?.id))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export const handler: Handler = async event => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'configurations:read')) return forbiddenResponse('configurations:read');
  const blobRuntimeSource = connectBlobStore(event);
  const { catalogue, validation: catalogueValidation, source: catalogueSource } = await getEffectiveConfiguratorCatalogue();

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(CONFIGURATION_STORE);
  } catch (error) {
    console.warn('admin-configurations: store unavailable', { blobRuntimeSource, error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }

  if (event.httpMethod === 'GET') {
    const id = clean(event.queryStringParameters?.id);
    if (id) {
      const rawConfiguration = await store.get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null;
      const configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
      if (!configuration) return json(404, { error: 'Configuration not found.' });
      return json(200, { configuration, evaluation: evaluateConfigurationRecord(configuration, catalogue), catalogue, catalogueValidation, catalogueSource });
    }
    return json(200, { configurations: await listConfigurations(), catalogue, catalogueValidation, catalogueSource });
  }

  const body = readBody(event.body);
  if (!body) return json(400, { error: 'Invalid JSON request.' });

  const requiredCapability = event.httpMethod === 'POST' && body.action === 'preview'
    ? 'configurations:read'
    : event.httpMethod === 'PATCH' && body.action === 'approve'
      ? 'configurations:approve'
      : 'configurations:write';
  if (!hasAdminCapability(actor, requiredCapability)) return forbiddenResponse(requiredCapability);

  if (event.httpMethod === 'POST' && body.action === 'preview') {
    const configurationInput = body.configuration && typeof body.configuration === 'object' ? body.configuration as Record<string, unknown> : body;
    const configuration = normaliseConfigurationInput(configurationInput, undefined, new Date(), catalogue);
    return json(200, { configuration, evaluation: evaluateConfigurationRecord(configuration, catalogue), catalogue, catalogueValidation, catalogueSource });
  }

  if (event.httpMethod === 'POST' && (body.action === 'duplicate' || body.action === 'revise')) {
    const id = clean(body.id);
    if (!id) return json(400, { error: 'Missing configuration id.' });
    const rawSource = await store.get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null;
    const source = rawSource ? hydrateConfigurationRecord(rawSource) : null;
    if (!source) return json(404, { error: 'Configuration not found.' });
    const copy = createConfigurationCopy(source, body.action === 'revise' ? 'revision' : 'duplicate', new Date(), catalogue);
    await store.setJSON(configurationKey(copy.id), copy);
    await Promise.all([
      appendOwnerAudit(body.action === 'revise' ? 'configuration_revision_created' : 'configuration_duplicated', 'configuration', copy.id, {
        sourceConfigurationId: source.id,
        configurationNumber: copy.configurationNumber,
        revision: copy.revision,
      }, actor),
      appendOwnerTimeline('configuration_created', `${copy.configurationNumber} ${body.action === 'revise' ? `revision ${copy.revision}` : 'copy'} created.`, {
        relatedLeadId: copy.leadId,
        relatedCustomerId: copy.customerId,
        source: 'admin-configurations',
      }),
    ]);
    return json(201, { ok: true, configuration: copy, evaluation: evaluateConfigurationRecord(copy, catalogue) });
  }

  if (event.httpMethod === 'POST') {
    const requested = body.configuration && typeof body.configuration === 'object' ? body.configuration as Record<string, unknown> : body;
    const configuration = normaliseConfigurationInput({ ...requested, status: 'draft' }, undefined, new Date(), catalogue);
    const evaluation = evaluateConfigurationRecord(configuration, catalogue);
    await store.setJSON(configurationKey(configuration.id), configuration);
    await Promise.all([
      appendOwnerAudit('configuration_created', 'configuration', configuration.id, {
        configurationNumber: configuration.configurationNumber,
        modelId: configuration.modelId,
        configuredTotalCents: evaluation.pricing.configuredTotalCents,
      }, actor),
      appendOwnerTimeline('configuration_created', `${configuration.configurationNumber} created for ${configuration.customer.name || configuration.customer.email || evaluation.model?.name || 'camper'}.`, {
        relatedLeadId: configuration.leadId,
        relatedCustomerId: configuration.customerId,
        source: 'admin-configurations',
      }),
    ]);
    return json(201, { ok: true, configuration, evaluation });
  }

  const id = clean(body.id);
  if (!id) return json(400, { error: 'Missing configuration id.' });
  const rawExisting = await store.get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null;
  const existing = rawExisting ? hydrateConfigurationRecord(rawExisting) : null;
  if (!existing) return json(404, { error: 'Configuration not found.' });
  const expectedUpdatedAt = clean(body.expectedUpdatedAt, 100);
  if (expectedUpdatedAt && expectedUpdatedAt !== existing.updatedAt) {
    return json(409, { error: 'This configuration changed after it was opened. Refresh it before saving.', configuration: existing });
  }
  if (['approved', 'quoted', 'converted_to_contract', 'ordered', 'superseded'].includes(existing.status) && body.action !== 'archive') {
    return json(409, { error: 'Approved and downstream configuration revisions are immutable. Create a revision instead.' });
  }

  const requested = body.configuration && typeof body.configuration === 'object'
    ? body.configuration as Record<string, unknown>
    : body;
  const action = clean(body.action, 80) || 'save';
  const requestedStatus = action === 'approve' ? 'approved' : action === 'ready_for_review' ? 'ready_for_review' : action === 'archive' ? 'archived' : existing.status === 'ready_for_review' ? 'ready_for_review' : 'draft';
  let configuration = normaliseConfigurationInput({ ...requested, status: requestedStatus }, existing, new Date(), catalogue);
  const evaluation = evaluateConfigurationRecord(configuration, catalogue);

  let snapshot: ConfigurationSnapshot | null = null;
  if (action === 'approve') {
    if (configuration.catalogueVersion !== catalogue.catalogueVersion) return json(409, { error: 'Upgrade this draft to the current catalogue before approval.' });
    if (!evaluation.valid) return json(400, { error: 'Fix configuration errors before approval.', evaluation });
    if (configuration.customerReview.status !== 'approved') return json(409, { error: 'Record customer approval through the secure review page before internal approval.' });
    if (configuration.customItems.some(item => item.kind === 'custom' && !configuration.drawings.some(drawing => drawing.customItemId === item.id && drawing.status === 'approved'))) return json(409, { error: 'Every custom alteration requires an approved drawing version in the drawing register.' });
    snapshot = createConfigurationSnapshot(configuration, 'owner', new Date(), catalogue);
    const snapshotKey = configurationSnapshotKey(configuration.id, configuration.revision);
    configuration = {
      ...configuration,
      status: 'approved',
      approvedSnapshotKey: snapshotKey,
      approvedSnapshotDigest: snapshot.digest,
      approvedAt: snapshot.approvedAt,
      approvedBy: snapshot.approvedBy,
    };
    await store.setJSON(snapshotKey, snapshot);

    if (configuration.parentConfigurationId) {
      const parent = await store.get(configurationKey(configuration.parentConfigurationId), { type: 'json' }) as ConfigurationRecord | null;
      if (parent && parent.status === 'approved') {
        await store.setJSON(configurationKey(parent.id), { ...parent, status: 'superseded', updatedAt: new Date().toISOString(), updatedBy: 'owner' });
      }
    }
  }

  await store.setJSON(configurationKey(configuration.id), configuration);
  await Promise.all([
    appendOwnerAudit(action === 'approve' ? 'configuration_approved' : action === 'archive' ? 'configuration_archived' : 'configuration_updated', 'configuration', configuration.id, {
      configurationNumber: configuration.configurationNumber,
      revision: configuration.revision,
      previousStatus: existing.status,
      status: configuration.status,
      configuredTotalCents: evaluation.pricing.configuredTotalCents,
      snapshotDigest: snapshot?.digest || '',
    }, actor),
    appendOwnerTimeline(action === 'approve' ? 'configuration_approved' : 'configuration_updated', `${configuration.configurationNumber} revision ${configuration.revision} ${action === 'approve' ? 'approved' : 'updated'}.`, {
      relatedLeadId: configuration.leadId,
      relatedCustomerId: configuration.customerId,
      source: 'admin-configurations',
    }),
  ]);
  return json(200, { ok: true, configuration, evaluation, snapshot });
};
