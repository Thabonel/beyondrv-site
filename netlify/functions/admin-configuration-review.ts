import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import { appendOwnerAudit } from './owner-copilot-store-utils';
import { CONFIGURATION_STORE, configurationKey, evaluateConfigurationRecord, hydrateConfigurationRecord } from './configuration-core';
import { createReviewToken, reviewTokenKey, type ReviewTokenIndex } from './configuration-review-core';
import { getEffectiveConfiguratorCatalogue } from './configurator-catalogue-core';
import type { ConfigurationRecord } from '../../src/lib/configurator/types';

function json(statusCode: number, body: Record<string, unknown>) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }; }
function clean(value: unknown, max = 1000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);
  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
  catch { return json(400, { error: 'Invalid JSON request.' }); }
  const id = clean(body.id, 200);
  if (!id) return json(400, { error: 'Missing configuration id.' });

  try {
    const store = getBlobStore(CONFIGURATION_STORE);
    const rawConfiguration = await store.get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null;
    const configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
    if (!configuration) return json(404, { error: 'Configuration not found.' });
    const action = clean(body.action, 40) || 'create';
    if (action === 'revoke') {
      const updated = { ...configuration, customerReview: { ...configuration.customerReview, status: 'revoked' as const } };
      await store.setJSON(configurationKey(id), updated);
      await appendOwnerAudit('configuration_review_revoked', 'configuration', id, { configurationNumber: configuration.configurationNumber });
      return json(200, { ok: true, configuration: updated });
    }
    if (!['draft', 'ready_for_review'].includes(configuration.status)) return json(409, { error: 'Create customer review links before internal approval.' });
    if (!configuration.customer.email) return json(400, { error: 'Add the customer email before creating a review link.' });
    const { catalogue } = await getEffectiveConfiguratorCatalogue();
    const evaluation = evaluateConfigurationRecord(configuration, catalogue);
    if (!evaluation.valid) return json(400, { error: 'Resolve configuration and drawing issues before customer review.', evaluation });
    if (configuration.customItems.some(item => item.kind === 'custom' && !configuration.drawings.some(drawing => drawing.customItemId === item.id && drawing.status === 'approved'))) {
      return json(409, { error: 'Approve a recorded drawing version for every custom alteration before customer review.' });
    }
    const generated = createReviewToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const updated: ConfigurationRecord = {
      ...configuration,
      status: 'ready_for_review',
      customerReview: {
        status: 'pending', tokenHash: generated.hash, tokenHint: generated.hint,
        createdAt: now.toISOString(), expiresAt, viewedAt: '', decidedAt: '', decidedByName: '', decidedByEmail: '', decisionNotes: '',
        configurationUpdatedAt: configuration.updatedAt,
      },
    };
    const index: ReviewTokenIndex = { configurationId: id, tokenHash: generated.hash, expiresAt, createdAt: now.toISOString() };
    await Promise.all([store.setJSON(configurationKey(id), updated), store.setJSON(reviewTokenKey(generated.hash), index)]);
    await appendOwnerAudit('configuration_review_created', 'configuration', id, { expiresAt, tokenHint: generated.hint });
    const origin = clean(body.origin, 500).replace(/\/$/, '');
    const reviewPath = `/configuration-review?token=${encodeURIComponent(generated.token)}`;
    return json(201, { ok: true, configuration: updated, token: generated.token, reviewUrl: origin ? `${origin}${reviewPath}` : reviewPath, expiresAt });
  } catch (error) {
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
