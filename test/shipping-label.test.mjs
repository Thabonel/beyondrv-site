import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue } from '../src/lib/checkout.ts';
import {
  buildShippingLabelRecord,
  evaluateShippingLabelEligibility,
  renderShippingLabelHtml,
} from '../netlify/functions/shipping-label-core.ts';

const catalogue = buildCatalogue([
  {
    slug: 'post-item',
    name: 'Post Item',
    price: 100,
    image: '/i.webp',
    productType: 'stock',
    availability: 'available_in_australia',
    purchasableOnline: true,
    fulfilmentType: 'ship',
    shippingSize: 'medium',
    packedWeightKg: 5,
    packedLengthCm: 80,
    packedWidthCm: 50,
    packedHeightCm: 40,
    shippingDataStatus: 'confirmed',
  },
  {
    slug: 'ute-item',
    name: 'Ute Item',
    price: 100,
    image: '/i.webp',
    productType: 'stock',
    availability: 'available_in_australia',
    purchasableOnline: true,
    fulfilmentType: 'pickup',
    shippingSize: 'medium',
    packedWeightKg: 18,
    packedLengthCm: 150,
    packedWidthCm: 120,
    packedHeightCm: 60,
    shippingDataStatus: 'confirmed',
  },
  {
    slug: 'oversized-item',
    name: 'Oversized Item',
    price: 100,
    image: '/i.webp',
    productType: 'stock',
    availability: 'available_in_australia',
    purchasableOnline: true,
    fulfilmentType: 'ship',
    shippingSize: 'oversized',
    packedWeightKg: 180,
    packedLengthCm: 320,
    packedWidthCm: 220,
    packedHeightCm: 260,
    shippingDataStatus: 'confirmed',
  },
]);

const baseOrder = {
  id: 'order-1',
  customerName: 'Alex Buyer',
  customerEmail: 'alex@example.com',
  customerPhone: '0400 000 000',
  productSlug: 'post-item',
  productTitle: 'Post Item',
  status: 'deposit_received',
  depositPaid: true,
  shippingName: 'Alex Buyer',
  shippingAddressLine1: '77 Coleyville Rd',
  shippingCity: 'Brisbane',
  shippingState: 'QLD',
  shippingPostcode: '4000',
  shippingCountry: 'Australia',
};

test('eligible Australia Post order can create a label', () => {
  const result = evaluateShippingLabelEligibility({ ...baseOrder, shippingMethod: 'australia_post' }, catalogue);
  assert.equal(result.ok, true);
});

test('eligible Brisbane ute delivery order can create a label', () => {
  const result = evaluateShippingLabelEligibility({
    ...baseOrder,
    productSlug: 'ute-item',
    productTitle: 'Ute Item',
    shippingMethod: 'brisbane_local_delivery',
    shippingCity: 'Brisbane',
    shippingPostcode: '4000',
  }, catalogue);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.method, 'brisbane_local_delivery');
});

test('pickup-only order cannot create a shipping label', () => {
  const result = evaluateShippingLabelEligibility({
    ...baseOrder,
    productSlug: 'ute-item',
    productTitle: 'Ute Item',
    shippingMethod: 'pickup',
  }, catalogue);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'pickup_only');
});

test('order without a complete address cannot create a label', () => {
  const result = evaluateShippingLabelEligibility({
    ...baseOrder,
    shippingAddressLine1: '',
  }, catalogue);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'missing_address');
});

test('oversized items are blocked', () => {
  const result = evaluateShippingLabelEligibility({
    ...baseOrder,
    productSlug: 'oversized-item',
    productTitle: 'Oversized Item',
    shippingMethod: 'australia_post',
  }, catalogue);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'oversized');
});

test('printable label HTML includes tracking and address details', () => {
  const label = buildShippingLabelRecord({
    order: { ...baseOrder, shippingMethod: 'australia_post' },
    product: catalogue['post-item'],
    labelId: 'label-test',
    createdAt: '2026-06-26T00:00:00.000Z',
    createdBy: 'admin',
    deliveryMethod: 'australia_post',
    carrier: 'Australia Post',
    service: 'Parcel Post',
    trackingNumber: 'TRACK123',
    shippingChargeCents: 1295,
    printUrl: 'https://example.com/print',
  });
  const html = renderShippingLabelHtml(label, { ...baseOrder, shippingMethod: 'australia_post' }, catalogue['post-item']);
  assert.match(html, /TRACK123/);
  assert.match(html, /Alex Buyer/);
  assert.match(html, /Australia Post/);
});
