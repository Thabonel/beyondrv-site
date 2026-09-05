/**
 * A visit or a handover is a date on an order. Whoever finds one, the GM in
 * the popup, the mailbox sync, or a confirmed call note, writes it to the
 * same two fields, so the order stays the one place the date lives.
 *
 * Pure: field names and the rule for matching a customer to an order.
 */

export type OrderDateKind = 'customer_visit' | 'expected_handover';

export const ORDER_DATE_FIELDS: Record<OrderDateKind, { date: string; time: string; label: string }> = {
  customer_visit:    { date: 'customerVisitDate',    time: 'customerVisitTime',    label: 'customer visit' },
  expected_handover: { date: 'expectedHandoverDate', time: 'expectedHandoverTime', label: 'handover' },
};

export function isOrderDateKind(kind: string): kind is OrderDateKind {
  return Object.prototype.hasOwnProperty.call(ORDER_DATE_FIELDS, kind);
}

/** Orders a customer can still visit for or take delivery of. */
export const LIVE_ORDER_STATUSES = new Set([
  'enquiry', 'quoted', 'deposit_received', 'factory_ordered', 'in_production', 'in_transit',
  'arrived_mutdapilly', 'local_fitout', 'ready_for_handover',
]);

export interface OrderLike {
  id?: unknown;
  status?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
  customerName?: unknown;
  productTitle?: unknown;
  productSlug?: unknown;
}

export interface CustomerClues {
  email?: string;
  phone?: string;
  name?: string;
  productInterest?: string;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function digits(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D+/g, '') : '';
}

/**
 * Which order a call note or an email is about. An email address is a
 * definite match; a phone number nearly so; a name only when exactly one
 * live order carries it, narrowed by the product when two do. Anything less
 * certain returns null: a date on the wrong customer's order is worse than a
 * date left on the calendar for someone to place.
 */
export function matchOrderForCustomer<T extends OrderLike>(orders: ReadonlyArray<T>, clues: CustomerClues): T | null {
  const live = orders.filter((order) => text(order.id) && (!text(order.status) || LIVE_ORDER_STATUSES.has(text(order.status))));
  const email = text(clues.email);
  if (email) {
    const byEmail = live.filter((order) => text(order.customerEmail) === email);
    if (byEmail.length === 1) return byEmail[0];
    if (byEmail.length > 1) return narrowByProduct(byEmail, clues.productInterest);
  }
  const phone = digits(clues.phone);
  if (phone.length >= 8) {
    const byPhone = live.filter((order) => digits(order.customerPhone).endsWith(phone.slice(-9)));
    if (byPhone.length === 1) return byPhone[0];
    if (byPhone.length > 1) return narrowByProduct(byPhone, clues.productInterest);
  }
  const name = text(clues.name);
  if (name) {
    const byName = live.filter((order) => text(order.customerName) === name);
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) return narrowByProduct(byName, clues.productInterest);
  }
  return null;
}

function narrowByProduct<T extends OrderLike>(orders: T[], productInterest?: string): T | null {
  const wanted = text(productInterest);
  if (!wanted) return null;
  const matched = orders.filter((order) => {
    const title = text(order.productTitle);
    const slug = text(order.productSlug);
    return (title && (wanted.includes(title) || title.includes(wanted))) || (slug && wanted.replace(/\s+/g, '-').includes(slug));
  });
  return matched.length === 1 ? matched[0] : null;
}
