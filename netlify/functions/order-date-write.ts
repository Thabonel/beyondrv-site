/**
 * Writes a visit or handover date onto the order that owns it. Shared by the
 * mailbox sync and the call-note confirmation, so both leave the same trail
 * and neither invents a second home for the date.
 */
import { getBlobStore } from './blob-store';
import { moveWarning } from './calendar-write-core';
import { ORDER_DATE_FIELDS, type OrderDateKind } from './order-date-core';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';

export const ORDER_STORE = 'customer-orders';

export async function findOrder(orderId: string) {
  const store = getBlobStore(ORDER_STORE);
  // Orders live at orders/<id>.json; older records may sit at the bare id.
  for (const key of [`orders/${encodeURIComponent(orderId)}.json`, orderId]) {
    const order = await store.get(key, { type: 'json' }) as Record<string, unknown> | null;
    if (order) return { store, key, order };
  }
  return null;
}

export interface OrderDateWrite {
  kind: OrderDateKind;
  orderId: string;
  date: string;
  time: string;
  /** Who or what decided this: 'gmail-calendar-sync', 'voice-capture', an admin actor. */
  source: string;
  /** Why, for the audit trail: an email subject, a call note id. */
  reason: string;
}

export async function writeOrderDate(input: OrderDateWrite) {
  const found = await findOrder(input.orderId);
  if (!found) return { ok: false as const, error: `No order found with id ${input.orderId}.` };
  const fields = ORDER_DATE_FIELDS[input.kind];
  const before = typeof found.order[fields.date] === 'string' ? found.order[fields.date] as string : '';
  await found.store.setJSON(found.key, {
    ...found.order,
    [fields.date]: input.date,
    [fields.time]: input.time,
    updatedAt: new Date().toISOString(),
  });
  const who = typeof found.order.customerName === 'string' ? found.order.customerName : input.orderId;
  const status = typeof found.order.status === 'string' ? found.order.status : '';
  const summary = `${fields.label[0].toUpperCase()}${fields.label.slice(1)} for ${who} set to ${input.date}${input.time ? ` ${input.time}` : ''}${before && before !== input.date ? ` (was ${before})` : ''} from ${input.reason}.`;
  await Promise.all([
    appendOwnerAudit('order_date_set', 'order', input.orderId, { kind: input.kind, date: input.date, time: input.time, before, reason: input.reason }, input.source),
    appendOwnerTimeline('order_date_set', summary, { source: input.source, aiGenerated: input.source !== 'owner' }),
  ]);
  return { ok: true as const, message: summary, warning: moveWarning(input.kind, status), before };
}
