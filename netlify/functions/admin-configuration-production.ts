import type { Handler } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import { CONFIGURATION_STORE, configurationKey, hydrateConfigurationRecord } from './configuration-core';
import type { ConfigurationProductionStatus, ConfigurationRecord } from '../../src/lib/configurator/types';

const ORDER_STORE = 'customer-orders';
const STATUSES: ConfigurationProductionStatus[] = ['deposit_received', 'ordered_from_factory', 'in_china_production', 'awaiting_shipping', 'in_transit', 'arrived_mutdapilly', 'local_fitout', 'ready_for_handover', 'delivered', 'cancelled'];
function json(statusCode: number, body: Record<string, unknown>) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }; }
function clean(value: unknown, max = 1000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function date(value: unknown) { const cleaned = clean(value, 40); if (cleaned && !/^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(cleaned)) throw new Error('Use YYYY-MM-DD dates.'); return cleaned; }
function orderKey(id: string) { return `orders/${encodeURIComponent(id)}.json`; }

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
    const configurationStore = getBlobStore(CONFIGURATION_STORE);
    const orderStore = getBlobStore(ORDER_STORE);
    const rawConfiguration = await configurationStore.get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null;
    const configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
    if (!configuration) return json(404, { error: 'Configuration not found.' });
    const action = clean(body.action, 40) || 'release';
    const now = new Date().toISOString();

    if (action === 'release') {
      if (configuration.status !== 'converted_to_contract' || !configuration.linkedContractIds.length) return json(409, { error: 'Create and verify the contract before production release.' });
      if (configuration.customerReview.status !== 'approved') return json(409, { error: 'Customer configuration approval is required before production release.' });
      if (configuration.customItems.some(item => item.kind === 'custom' && item.drawingStatus !== 'approved')) return json(409, { error: 'Every custom alteration drawing must be approved before production release.' });
      if (configuration.customItems.some(item => item.kind === 'custom' && !configuration.drawings.some(drawing => drawing.customItemId === item.id && drawing.status === 'approved'))) return json(409, { error: 'Every custom alteration requires approved drawing evidence before production release.' });
      const depositReference = clean(body.depositReference, 240);
      const depositReceivedAt = date(body.depositReceivedAt);
      if (!depositReference || !depositReceivedAt) return json(400, { error: 'Deposit reference and received date are required.' });
      if (configuration.production.orderId) return json(409, { error: 'This configuration is already linked to a production order.' });
      const orderId = `order-${Date.now()}-${randomUUID()}`;
      const eventRecord = { id: randomUUID(), status: 'deposit_received' as const, occurredAt: now, note: `Deposit ${depositReference} verified.`, recordedBy: 'owner' };
      const modelName = clean(body.productTitle, 240) || configuration.configurationNumber;
      const order = {
        id: orderId, configurationId: configuration.id, configurationNumber: configuration.configurationNumber,
        contractId: configuration.linkedContractIds[0], customerName: configuration.customer.name, customerEmail: configuration.customer.email, customerPhone: configuration.customer.phone,
        productSlug: clean(body.productSlug, 240), productTitle: modelName, productCategory: clean(body.productCategory, 80),
        orderType: 'custom_build', status: 'deposit_received', depositPaid: true, paymentType: 'deposit', paymentStatus: 'paid', currency: 'AUD', orderSource: 'configurator',
        factoryOrderDate: '', expectedArrivalDate: date(body.expectedArrivalDate), expectedHandoverDate: date(body.expectedHandoverDate), nextActionDate: date(body.nextActionDate),
        notes: clean(body.note, 4000), statusHistory: [eventRecord], createdAt: now, updatedAt: now, createdBy: 'owner',
      };
      const production = { status: 'deposit_received' as const, orderId, depositReference, depositReceivedAt, expectedArrivalDate: order.expectedArrivalDate, expectedHandoverDate: order.expectedHandoverDate, nextActionDate: order.nextActionDate, events: [eventRecord] };
      const updated: ConfigurationRecord = { ...configuration, status: 'ordered', linkedOrderIds: [orderId], production, updatedAt: now, updatedBy: 'owner' };
      await Promise.all([orderStore.setJSON(orderKey(orderId), order), configurationStore.setJSON(configurationKey(id), updated)]);
      await Promise.all([
        appendOwnerAudit('configuration_released_to_production', 'configuration', id, { orderId, depositReference, contractId: configuration.linkedContractIds[0] }),
        appendOwnerTimeline('production_status_updated', `${configuration.configurationNumber} released to production after deposit verification.`, { relatedCustomerId: configuration.customerId, relatedLeadId: configuration.leadId, source: 'admin-configuration-production' }),
      ]);
      return json(201, { ok: true, configuration: updated, order });
    }

    if (action !== 'update_status') return json(400, { error: 'Unsupported production action.' });
    const status = clean(body.status, 60) as ConfigurationProductionStatus;
    if (!STATUSES.includes(status)) return json(400, { error: 'Invalid production status.' });
    if (!configuration.production.orderId) return json(409, { error: 'Release this configuration to production first.' });
    const existingOrder = await orderStore.get(orderKey(configuration.production.orderId), { type: 'json' }) as Record<string, unknown> | null;
    if (!existingOrder) return json(404, { error: 'Linked production order not found.' });
    const eventRecord = { id: randomUUID(), status, occurredAt: now, note: clean(body.note, 1000), recordedBy: 'owner' };
    const production = {
      ...configuration.production, status,
      expectedArrivalDate: date(body.expectedArrivalDate) || configuration.production.expectedArrivalDate,
      expectedHandoverDate: date(body.expectedHandoverDate) || configuration.production.expectedHandoverDate,
      nextActionDate: date(body.nextActionDate) || configuration.production.nextActionDate,
      events: [...configuration.production.events, eventRecord].slice(-100),
    };
    const order = { ...existingOrder, status, expectedArrivalDate: production.expectedArrivalDate, expectedHandoverDate: production.expectedHandoverDate, nextActionDate: production.nextActionDate, statusHistory: [...(Array.isArray(existingOrder.statusHistory) ? existingOrder.statusHistory : []), eventRecord].slice(-100), updatedAt: now };
    const updated: ConfigurationRecord = { ...configuration, production, updatedAt: now, updatedBy: 'owner' };
    await Promise.all([orderStore.setJSON(orderKey(configuration.production.orderId), order), configurationStore.setJSON(configurationKey(id), updated)]);
    await appendOwnerTimeline('production_status_updated', `${configuration.configurationNumber} moved to ${status.replace(/_/g, ' ')}.`, { relatedCustomerId: configuration.customerId, relatedLeadId: configuration.leadId, source: 'admin-configuration-production' });
    return json(200, { ok: true, configuration: updated, order });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : blobStoreUserMessage(error) });
  }
};
