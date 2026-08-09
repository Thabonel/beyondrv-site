import type { Handler } from '@netlify/functions';
import { connectBlobStore } from './blob-store';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import { configurationKey, evaluateConfigurationRecord } from './configuration-core';
import { loadConfigurationForReviewToken } from './configuration-review-core';
import { getEffectiveConfiguratorCatalogue } from './configurator-catalogue-core';
import type { ConfigurationRecord } from '../../src/lib/configurator/types';

function json(statusCode: number, body: Record<string, unknown>) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }, body: JSON.stringify(body) }; }
function clean(value: unknown, max = 1000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

async function publicPayload(configuration: ConfigurationRecord, token: string) {
  const { catalogue } = await getEffectiveConfiguratorCatalogue();
  const evaluation = evaluateConfigurationRecord(configuration, catalogue);
  const model = evaluation.model;
  return {
    configuration: {
      id: configuration.id,
      configurationNumber: configuration.configurationNumber,
      revision: configuration.revision,
      status: configuration.status,
      customer: { name: configuration.customer.name, email: configuration.customer.email },
      customerNotes: configuration.customerNotes,
      customItems: configuration.customItems.filter(item => item.kind === 'custom').map(item => ({ id: item.id, description: item.description, retailPriceCents: item.retailPriceCents, visualBrief: item.visualBrief, drawingStatus: item.drawingStatus })),
      drawings: configuration.drawings.filter(drawing => drawing.status === 'approved').map(drawing => ({
        id: drawing.id, customItemId: drawing.customItemId, version: drawing.version, filename: drawing.filename,
        contentType: drawing.contentType, notes: drawing.notes,
        url: `/.netlify/functions/configuration-drawing-file?token=${encodeURIComponent(token)}&drawingId=${encodeURIComponent(drawing.id)}`,
      })),
      customerReview: { status: configuration.customerReview.status, expiresAt: configuration.customerReview.expiresAt, viewedAt: configuration.customerReview.viewedAt, decidedAt: configuration.customerReview.decidedAt, decisionNotes: configuration.customerReview.decisionNotes },
    },
    model: model ? {
      id: model.id, name: model.name, description: model.description, productSlug: model.productSlug,
      priceQualifier: model.priceQualifier, orderProcess: model.orderProcess, heroImage: model.heroImage, visualAsset: model.visualAsset,
    } : null,
    selections: evaluation.selections.map(selection => ({ optionId: selection.optionId, name: selection.option.name, shortDescription: selection.option.shortDescription, quantity: selection.quantity, retailTotalCents: selection.retailTotalCents })),
    pricing: { basePriceCents: evaluation.pricing.basePriceCents, optionsTotalCents: evaluation.pricing.optionsTotalCents, customItemsTotalCents: evaluation.pricing.customItemsTotalCents, configuredTotalCents: evaluation.pricing.configuredTotalCents },
    warnings: evaluation.warnings.map(warning => ({ message: warning.message })),
  };
}

export const handler: Handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  connectBlobStore(event);
  const queryToken = clean(event.queryStringParameters?.token, 500);
  let body: Record<string, unknown> = {};
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
    catch { return json(400, { error: 'Invalid JSON request.' }); }
  }
  const token = queryToken || clean(body.token, 500);
  if (!token) return json(400, { error: 'Missing review token.' });

  try {
    const { configuration, state, store } = await loadConfigurationForReviewToken(token);
    if (!configuration || !state.valid) return json(410, { error: state.reason });
    if (event.httpMethod === 'GET') {
      if (configuration.customerReview.status === 'pending') {
        configuration.customerReview.status = 'viewed';
        configuration.customerReview.viewedAt = new Date().toISOString();
        await store.setJSON(configurationKey(configuration.id), configuration);
        await appendOwnerAudit('configuration_review_viewed', 'configuration', configuration.id, { configurationNumber: configuration.configurationNumber });
      }
      return json(200, await publicPayload(configuration, token));
    }

    const action = clean(body.action, 40);
    if (!['approve', 'request_changes'].includes(action)) return json(400, { error: 'Choose approve or request changes.' });
    if (['approved', 'changes_requested'].includes(configuration.customerReview.status)) return json(409, { error: 'A decision has already been recorded for this review.' });
    const name = clean(body.name, 240);
    const email = clean(body.email, 320).toLowerCase();
    const notes = clean(body.notes, 4000);
    if (!name || !email) return json(400, { error: 'Enter your name and email to record the decision.' });
    if (action === 'request_changes' && !notes) return json(400, { error: 'Describe the changes you need.' });
    const now = new Date().toISOString();
    configuration.customerReview = {
      ...configuration.customerReview,
      status: action === 'approve' ? 'approved' : 'changes_requested',
      decidedAt: now,
      decidedByName: name,
      decidedByEmail: email,
      decisionNotes: notes,
    };
    await store.setJSON(configurationKey(configuration.id), configuration);
    await Promise.all([
      appendOwnerAudit(action === 'approve' ? 'configuration_customer_approved' : 'configuration_changes_requested', 'configuration', configuration.id, { decidedByName: name, decidedByEmail: email, notes }),
      appendOwnerTimeline(action === 'approve' ? 'configuration_customer_approved' : 'configuration_changes_requested', `${configuration.configurationNumber} ${action === 'approve' ? 'approved by customer' : 'changes requested by customer'}.`, { relatedLeadId: configuration.leadId, relatedCustomerId: configuration.customerId, source: 'configuration-review' }),
    ]);
    return json(200, { ok: true, customerReview: configuration.customerReview });
  } catch {
    return json(503, { error: 'The review service is temporarily unavailable.' });
  }
};
