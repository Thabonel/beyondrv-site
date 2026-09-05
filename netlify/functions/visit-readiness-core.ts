/**
 * A customer flew from Tasmania to see a camper that was still in a container
 * waiting on customs. The arrival date had been promised, relayed, and missed,
 * and nothing anywhere connected "the vehicle is not here" to "the customer
 * lands today". The company paid for the flights.
 *
 * Two dates failed independently, so this checks both.
 *
 * The container ETA was recorded and then never looked at again. Tasks and lead
 * follow-ups in this admin are compared against today and go red when they
 * pass; the ETA was only ever printed. A date nobody compares to today is a
 * date nobody is tracking.
 *
 * The visit date was never recorded at all. It lived in an email thread, so no
 * amount of checking would have found it. An order can now carry the date a
 * customer is coming, and that date is worthless unless something asks whether
 * the vehicle will actually be here.
 *
 * Everything here is pure and takes `today`, so the behaviour on the day before
 * and the day after an ETA is testable without waiting for tomorrow.
 */

/** A vehicle is only genuinely viewable once it is physically on the ground. */
export const ARRIVED_STATUSES = new Set([
  'arrived_mutdapilly',
  'local_fitout',
  'ready_for_handover',
  'delivered',
]);

/** Far enough ahead to still cancel a flight without paying for it. */
export const ETA_SOON_DAYS = 14;

export type EtaState = 'passed' | 'due_today' | 'soon' | 'ok' | 'unknown';

export type VisitSeverity = 'critical' | 'warning' | 'ok';

export interface VisitRisk {
  orderId: string;
  customerName: string;
  productTitle: string;
  visitDate: string;
  status: string;
  severity: VisitSeverity;
  vehicleHasArrived: boolean;
  daysUntilVisit: number;
  message: string;
}

export interface EtaRisk {
  slug: string;
  title: string;
  etaDate: string;
  state: EtaState;
  daysOverdue: number;
  message: string;
}

/** ISO date only, so string comparison is chronological. Anything else is unknown. */
function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function etaState(etaDate: unknown, today: string): EtaState {
  if (!isIsoDate(etaDate) || !isIsoDate(today)) return 'unknown';
  const days = daysBetween(today, etaDate);
  if (days < 0) return 'passed';
  if (days === 0) return 'due_today';
  if (days <= ETA_SOON_DAYS) return 'soon';
  return 'ok';
}

/**
 * A passed ETA is not proof the container is late — it may have landed and the
 * status simply moved on. So a product whose vehicle has arrived is not
 * reported, and the message says the date needs confirming rather than
 * asserting a delay we cannot see from here.
 */
export function etaRisks(
  products: ReadonlyArray<Record<string, unknown>>,
  today: string,
  arrivedSlugs: ReadonlySet<string> = new Set(),
): EtaRisk[] {
  const risks: EtaRisk[] = [];
  for (const product of products ?? []) {
    const etaDate = product.containerEtaDate;
    const state = etaState(etaDate, today);
    if (state !== 'passed' && state !== 'due_today') continue;
    const slug = typeof product.slug === 'string' ? product.slug : '';
    if (slug && arrivedSlugs.has(slug)) continue;
    const daysOverdue = state === 'passed' ? -daysBetween(today, etaDate as string) : 0;
    risks.push({
      slug,
      title: typeof product.title === 'string' ? product.title : slug,
      etaDate: etaDate as string,
      state,
      daysOverdue,
      message: state === 'due_today'
        ? 'Container ETA is today. Confirm it has landed and cleared customs before promising anyone a viewing.'
        : `Container ETA passed ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ago and the vehicle is not marked as arrived. `
          + 'Confirm the real date before promising anyone a viewing.',
    });
  }
  return risks.sort((a, b) => b.daysOverdue - a.daysOverdue || a.title.localeCompare(b.title));
}

/**
 * The expensive case: someone is travelling to see a vehicle that is not here.
 * Reported until the visit date passes, because the cost is incurred before the
 * visit, not on it.
 */
export function visitRisks(
  orders: ReadonlyArray<Record<string, unknown>>,
  today: string,
): VisitRisk[] {
  const risks: VisitRisk[] = [];
  for (const order of orders ?? []) {
    const visitDate = order.customerVisitDate;
    if (!isIsoDate(visitDate) || !isIsoDate(today)) continue;
    const daysUntilVisit = daysBetween(today, visitDate);
    if (daysUntilVisit < 0) continue;

    const status = typeof order.status === 'string' ? order.status : '';
    const vehicleHasArrived = ARRIVED_STATUSES.has(status);
    if (vehicleHasArrived) continue;

    // Close enough that a wasted trip can no longer be prevented cheaply.
    const severity: VisitSeverity = daysUntilVisit <= 2 ? 'critical' : 'warning';
    const when = daysUntilVisit === 0
      ? 'today'
      : daysUntilVisit === 1 ? 'tomorrow' : `in ${daysUntilVisit} days`;

    risks.push({
      orderId: typeof order.id === 'string' ? order.id : '',
      customerName: typeof order.customerName === 'string' ? order.customerName : 'Customer',
      productTitle: typeof order.productTitle === 'string' ? order.productTitle : '',
      visitDate,
      status,
      severity,
      vehicleHasArrived,
      daysUntilVisit,
      message: `Visiting ${when}, and the vehicle is not marked as arrived. `
        + 'Confirm it is on the ground before the customer travels.',
    });
  }
  return risks.sort((a, b) => a.daysUntilVisit - b.daysUntilVisit
    || a.customerName.localeCompare(b.customerName));
}

export interface VisitReadiness {
  visits: VisitRisk[];
  etas: EtaRisk[];
  criticalCount: number;
  warningCount: number;
}

export function visitReadiness(
  orders: ReadonlyArray<Record<string, unknown>>,
  products: ReadonlyArray<Record<string, unknown>>,
  today: string,
): VisitReadiness {
  // A product whose order says the vehicle is here should not also be reported
  // as an overdue container.
  const arrivedSlugs = new Set<string>();
  for (const order of orders ?? []) {
    const slug = order.productSlug;
    const status = typeof order.status === 'string' ? order.status : '';
    if (typeof slug === 'string' && slug && ARRIVED_STATUSES.has(status)) arrivedSlugs.add(slug);
  }

  const visits = visitRisks(orders, today);
  const etas = etaRisks(products, today, arrivedSlugs);
  return {
    visits,
    etas,
    criticalCount: visits.filter((risk) => risk.severity === 'critical').length,
    warningCount: visits.filter((risk) => risk.severity === 'warning').length + etas.length,
  };
}
