import assert from 'node:assert/strict';
import test from 'node:test';
import {
  daysBetween,
  etaRisks,
  etaState,
  visitReadiness,
  visitRisks,
} from '../netlify/functions/visit-readiness-core.ts';

const TODAY = '2026-09-05';

test('the Tasmania case: a customer travelling to a vehicle still in transit is reported', () => {
  const orders = [{
    id: 'o1',
    customerName: 'Tasmanian customer',
    productTitle: 'Advent 2450',
    productSlug: 'advent-2450',
    status: 'in_transit',
    customerVisitDate: TODAY,
  }];
  const [risk] = visitRisks(orders, TODAY);
  assert.equal(risk.severity, 'critical');
  assert.equal(risk.vehicleHasArrived, false);
  assert.equal(risk.daysUntilVisit, 0);
  assert.match(risk.message, /Visiting today/);
  assert.match(risk.message, /not marked as arrived/);
});

test('a visit is not reported once the vehicle is actually on the ground', () => {
  for (const status of ['arrived_mutdapilly', 'local_fitout', 'ready_for_handover', 'delivered']) {
    const orders = [{ id: 'o1', customerName: 'A', status, customerVisitDate: TODAY }];
    assert.deepEqual(visitRisks(orders, TODAY), [], `${status} should not be reported`);
  }
});

test('a visit two days out is critical, further out is a warning', () => {
  const mk = (visitDate: string) => visitRisks(
    [{ id: 'o1', customerName: 'A', status: 'in_transit', customerVisitDate: visitDate }], TODAY,
  )[0];
  assert.equal(mk('2026-09-05').severity, 'critical');
  assert.equal(mk('2026-09-07').severity, 'critical');
  assert.equal(mk('2026-09-08').severity, 'warning');
});

test('a visit that has already happened is not reported, because the cost is already spent', () => {
  const orders = [{ id: 'o1', customerName: 'A', status: 'in_transit', customerVisitDate: '2026-09-04' }];
  assert.deepEqual(visitRisks(orders, TODAY), []);
});

test('an order with no visit date is never reported', () => {
  const orders = [
    { id: 'o1', customerName: 'A', status: 'in_transit' },
    { id: 'o2', customerName: 'B', status: 'in_transit', customerVisitDate: '' },
    { id: 'o3', customerName: 'C', status: 'in_transit', customerVisitDate: 'next Tuesday' },
  ];
  assert.deepEqual(visitRisks(orders, TODAY), []);
});

test('visits sort soonest first, so the most expensive mistake is at the top', () => {
  const orders = [
    { id: 'far', customerName: 'Far', status: 'in_transit', customerVisitDate: '2026-09-20' },
    { id: 'today', customerName: 'Today', status: 'in_transit', customerVisitDate: TODAY },
    { id: 'soon', customerName: 'Soon', status: 'in_transit', customerVisitDate: '2026-09-08' },
  ];
  assert.deepEqual(visitRisks(orders, TODAY).map((r) => r.orderId), ['today', 'soon', 'far']);
});

test('etaState distinguishes passed, today, soon and comfortable', () => {
  assert.equal(etaState('2026-09-04', TODAY), 'passed');
  assert.equal(etaState(TODAY, TODAY), 'due_today');
  assert.equal(etaState('2026-09-12', TODAY), 'soon');
  assert.equal(etaState('2026-10-30', TODAY), 'ok');
});

test('a malformed or missing ETA is unknown rather than a false alarm', () => {
  for (const bad of [undefined, null, '', 'soon', '05/09/2026', '2026-13-45', 42]) {
    assert.equal(etaState(bad, TODAY), 'unknown', `${String(bad)} should be unknown`);
  }
});

test('a container ETA that slid past is reported with how late it is', () => {
  const [risk] = etaRisks([{ slug: 'advent-2450', title: 'Advent 2450', containerEtaDate: '2026-08-29' }], TODAY);
  assert.equal(risk.state, 'passed');
  assert.equal(risk.daysOverdue, 7);
  assert.match(risk.message, /passed 7 days ago/);
});

test('an ETA of today asks for confirmation rather than assuming it landed', () => {
  const [risk] = etaRisks([{ slug: 's', title: 'T', containerEtaDate: TODAY }], TODAY);
  assert.equal(risk.state, 'due_today');
  assert.match(risk.message, /Confirm it has landed and cleared customs/);
});

test('a future ETA is not reported', () => {
  assert.deepEqual(etaRisks([{ slug: 's', title: 'T', containerEtaDate: '2026-09-30' }], TODAY), []);
});

test('a passed ETA is suppressed once that vehicle is marked arrived', () => {
  const products = [{ slug: 'advent-2450', title: 'Advent 2450', containerEtaDate: '2026-08-29' }];
  const orders = [{ id: 'o1', customerName: 'A', productSlug: 'advent-2450', status: 'arrived_mutdapilly' }];
  const readiness = visitReadiness(orders, products, TODAY);
  assert.deepEqual(readiness.etas, [], 'the container landed; a passed ETA is not news');
});

test('the whole scenario end to end, with counts the dashboard can render', () => {
  const orders = [
    { id: 'tas', customerName: 'Tasmanian customer', productTitle: 'Advent 2450', productSlug: 'advent-2450', status: 'in_transit', customerVisitDate: TODAY },
    { id: 'later', customerName: 'Someone else', productSlug: 'sunpatch-15xc', status: 'awaiting_shipping', customerVisitDate: '2026-09-19' },
    { id: 'fine', customerName: 'Happy', productSlug: 'advent-2150', status: 'ready_for_handover', customerVisitDate: TODAY },
  ];
  const products = [
    { slug: 'advent-2450', title: 'Advent 2450', containerEtaDate: '2026-08-29' },
    { slug: 'advent-2150', title: 'Advent 2150', containerEtaDate: '2026-08-20' },
  ];
  const r = visitReadiness(orders, products, TODAY);
  assert.equal(r.criticalCount, 1, 'the Tasmanian visit');
  assert.equal(r.visits.length, 2, 'the arrived one drops out');
  assert.equal(r.etas.length, 1, 'the 2150 landed, so only the 2450 ETA is reported');
  assert.equal(r.warningCount, 2, 'one future visit plus one overdue container');
});

test('daysBetween is inclusive of direction and stable across a month boundary', () => {
  assert.equal(daysBetween('2026-08-29', '2026-09-05'), 7);
  assert.equal(daysBetween('2026-09-05', '2026-08-29'), -7);
  assert.equal(daysBetween(TODAY, TODAY), 0);
});

test('empty and missing inputs produce an empty report, not a crash', () => {
  const r = visitReadiness([], [], TODAY);
  assert.deepEqual(r, { visits: [], etas: [], criticalCount: 0, warningCount: 0 });
});
