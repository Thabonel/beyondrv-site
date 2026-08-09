import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import type { ConfigurationRecord } from '../../src/lib/configurator/types';
import { CONFIGURATION_STORE, configurationKey, hydrateConfigurationRecord, renderConfigurationSummaryHtml } from './configuration-core';
import { getEffectiveConfiguratorCatalogue } from './configurator-catalogue-core';

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'configurations:read')) return forbiddenResponse('configurations:read');
  const blobRuntimeSource = connectBlobStore(event);
  const id = clean(event.queryStringParameters?.id);
  if (!id) return { statusCode: 400, body: 'Missing configuration id.' };

  try {
    const store = getBlobStore(CONFIGURATION_STORE);
    const rawConfiguration = await store.get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null;
    const configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
    if (!configuration) return { statusCode: 404, body: 'Configuration not found.' };
    const { catalogue } = await getEffectiveConfiguratorCatalogue();
    const download = event.queryStringParameters?.download === '1';
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        ...(download ? { 'Content-Disposition': `attachment; filename="${configuration.configurationNumber}-R${configuration.revision}.html"` } : {}),
      },
      body: renderConfigurationSummaryHtml(configuration, undefined, catalogue),
    };
  } catch (error) {
    console.warn('admin-configuration-summary: unavailable', { blobRuntimeSource, error: safeBlobStoreError(error) });
    return { statusCode: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: blobStoreUserMessage(error) };
  }
};
