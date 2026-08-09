import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import { appendOwnerAudit } from './owner-copilot-store-utils';
import { validateConfiguratorCatalogue } from '../../src/lib/configurator/engine';
import {
  CONFIGURATOR_CATALOGUE_KEY,
  CONFIGURATOR_CATALOGUE_STORE,
  getEffectiveConfiguratorCatalogue,
  normaliseCatalogueDraft,
} from './configurator-catalogue-core';

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }, body: JSON.stringify(body) };
}

export const handler: Handler = async event => {
  if (!['GET', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (event.httpMethod === 'GET' && !hasAdminCapability(actor, 'configurations:read')) return forbiddenResponse('configurations:read');
  connectBlobStore(event);

  if (event.httpMethod === 'GET') return json(200, await getEffectiveConfiguratorCatalogue());

  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
  catch { return json(400, { error: 'Invalid JSON request.' }); }
  const requiredCapability = body.action === 'approve' ? 'configurations:approve' : 'configurations:write';
  if (!hasAdminCapability(actor, requiredCapability)) return forbiddenResponse(requiredCapability);

  try {
    const draft = normaliseCatalogueDraft(body.catalogue);
    if (body.action === 'approve') {
      if (body.confirmation !== 'APPROVE CATALOGUE') return json(400, { error: 'Type APPROVE CATALOGUE to confirm internal catalogue approval.' });
      draft.readiness = 'approved_internal';
    }
    const validation = validateConfiguratorCatalogue(draft);
    if (!validation.valid) return json(400, { error: 'Catalogue validation failed.', validation });
    const store = getBlobStore(CONFIGURATOR_CATALOGUE_STORE);
    await store.setJSON(CONFIGURATOR_CATALOGUE_KEY, draft);
    await appendOwnerAudit('configurator_catalogue_updated', 'catalogue', draft.catalogueVersion, {
      modelCount: draft.models.length,
      optionCount: draft.options.length,
      readiness: draft.readiness,
      action: body.action === 'approve' ? 'approved' : 'saved',
    }, actor);
    return json(200, { ok: true, catalogue: draft, validation, source: 'operational' });
  } catch (error) {
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
