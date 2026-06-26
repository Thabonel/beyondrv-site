import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildUnifiedLifecycleRecords,
  normalizeUnifiedEnquiry,
  normalizeUnifiedOrder,
} from '../netlify/functions/unified-lifecycle.ts';

test('normalizeUnifiedOrder keeps order details and flags paid orders', () => {
  const record = normalizeUnifiedOrder({
    id: 'order-1',
    customerName: 'Alex Buyer',
    customerEmail: 'alex@example.com',
    customerPhone: '0400 000 000',
    productSlug: 'advent-2150-hardtop-slide-on',
    productTitle: 'Advent 2150 Hardtop Slide-On',
    paymentStatus: 'paid',
    depositPaid: true,
    status: 'deposit_received',
    shippingStatus: 'awaiting_shipping',
    notes: 'Container arriving from China next month.',
    createdAt: '2026-06-20T08:00:00.000Z',
    updatedAt: '2026-06-22T10:00:00.000Z',
  });

  assert.equal(record.sourceType, 'stripe_order');
  assert.equal(record.recordType, 'paid_shop_order');
  assert.equal(record.containerFollowUp, true);
  assert.equal(record.customerName, 'Alex Buyer');
  assert.equal(record.productTitle, 'Advent 2150 Hardtop Slide-On');
  assert.equal(record.paymentStatus, 'paid');
  assert.equal(record.fulfilmentStatus, 'awaiting_shipping');
  assert.equal(record.sourceStore, 'customer-orders');
});

test('normalizeUnifiedEnquiry detects availability and quote requests', () => {
  const availability = normalizeUnifiedEnquiry({
    id: 'enquiry-1',
    submittedAt: '2026-06-23T09:00:00.000Z',
    name: 'Sam Camper',
    email: 'sam@example.com',
    phone: '0411 111 111',
    message: 'Will this fit my Hilux?',
    product_interest: 'advent-2150-hardtop-slide-on',
    enquiry_intent: 'vehicle-suitability',
  });

  const quote = normalizeUnifiedEnquiry({
    id: 'enquiry-2',
    submittedAt: '2026-06-24T09:00:00.000Z',
    name: 'Priya Buyer',
    email: 'priya@example.com',
    phone: '0422 222 222',
    message: 'Can you quote the deposit and final price?',
    product_interest: 'advent-2300-hardtop-slide-on',
    leadStatus: {
      status: 'quoted',
      notes: 'Customer asked for a quote and container timing.',
      updatedAt: '2026-06-25T09:00:00.000Z',
    },
  });

  assert.equal(availability.sourceType, 'availability_request');
  assert.equal(availability.recordType, 'availability_request');
  assert.equal(availability.sourceLabel, 'Availability Request');
  assert.equal(quote.sourceType, 'quote_request');
  assert.equal(quote.recordType, 'quote_request');
  assert.equal(quote.containerFollowUp, true);
});

test('buildUnifiedLifecycleRecords sorts newest records first and tolerates missing optional fields', () => {
  const records = buildUnifiedLifecycleRecords({
    orders: [
      { id: 'order-old', createdAt: '2026-06-20T00:00:00.000Z' },
      { id: 'order-new', createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-26T00:00:00.000Z' },
    ],
    enquiries: [
      { id: 'enquiry-old', submittedAt: '2026-06-21T00:00:00.000Z', name: '' },
      { id: 'enquiry-new', submittedAt: '2026-06-24T00:00:00.000Z', name: '' },
    ],
  });

  assert.equal(records[0].id, 'lifecycle-order:order-new');
  assert.equal(records[1].id, 'lifecycle-enquiry:enquiry-new');
  assert.equal(records.at(-1)?.id, 'lifecycle-order:order-old');
  assert.ok(records.every((record) => typeof record.customerName === 'string'));
  assert.ok(records.every((record) => typeof record.createdAt === 'string'));
});
