import { getBlobStore, safeBlobStoreError } from './blob-store.ts';
import type { AdminActor } from './admin-auth.ts';

export const SALES_ACTIVITY_STORE = 'sales-activity-events';

export type SalesActivitySource =
  | 'website'
  | 'gm_ui'
  | 'voice_capture'
  | 'customer_link'
  | 'gmail'
  | 'system';

export interface SalesActivityEvent {
  id: string;
  commandId: string;
  occurredAt: string;
  recordedAt: string;
  actorUserId: string;
  actorRole: string;
  customerId: string;
  opportunityId: string;
  enquiryId: string;
  agreementId: string;
  configurationId: string;
  buildId: string;
  activityType: string;
  outcome: string;
  source: SalesActivitySource;
  sourceReference: string;
  summary: string;
  metadata: Record<string, unknown>;
}

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function eventId(now = new Date()) {
  return `activity_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function salesActivityKey(id: string) {
  return `activity/${encodeURIComponent(id)}.json`;
}

export function buildSalesActivityEvent(
  input: Partial<SalesActivityEvent> & Pick<SalesActivityEvent, 'activityType' | 'summary'>,
  actor: Pick<AdminActor, 'id' | 'role'>,
  now = new Date(),
): SalesActivityEvent {
  const id = clean(input.id, 200) || eventId(now);
  return {
    id,
    commandId: clean(input.commandId, 240),
    occurredAt: clean(input.occurredAt, 80) || now.toISOString(),
    recordedAt: now.toISOString(),
    actorUserId: clean(actor.id, 180) || 'legacy-admin',
    actorRole: clean(actor.role, 80) || 'legacy_admin',
    customerId: clean(input.customerId, 240),
    opportunityId: clean(input.opportunityId, 240),
    enquiryId: clean(input.enquiryId, 240),
    agreementId: clean(input.agreementId, 240),
    configurationId: clean(input.configurationId, 240),
    buildId: clean(input.buildId, 240),
    activityType: clean(input.activityType, 120),
    outcome: clean(input.outcome, 120),
    source: ['website', 'gm_ui', 'voice_capture', 'customer_link', 'gmail', 'system'].includes(String(input.source))
      ? input.source as SalesActivitySource
      : 'gm_ui',
    sourceReference: clean(input.sourceReference, 500),
    summary: clean(input.summary, 1000),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  };
}

export async function appendSalesActivity(event: SalesActivityEvent) {
  try {
    await getBlobStore(SALES_ACTIVITY_STORE).setJSON(salesActivityKey(event.id), event);
    return event;
  } catch (error) {
    console.warn('sales-activity-core: append failed', {
      activityType: event.activityType,
      agreementId: event.agreementId,
      error: safeBlobStoreError(error),
    });
    return null;
  }
}
