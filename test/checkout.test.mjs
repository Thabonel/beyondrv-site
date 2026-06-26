import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue, validateCheckout } from '../src/lib/checkout.ts';

const catalogue = buildCatalogue([
  { slug: 'ship', name: 'Shippable Part', price: 500, image: '/i.webp', productType: 'stock', availability: 'available_in_australia', purchasableOnline: true, fulfilmentType: 'ship' },
  { slug: 'pickup', name: 'Pickup Part', price: 250, image: '/i.webp', productType: 'stock', availability: 'available_in_australia', purchasableOnline: true, fulfilmentType: 'pickup' },
  { slug: 'install', name: 'Install Part', price: 500, image: '/i.webp', productType: 'stock', availability: 'made_to_order', purchasableOnline: true, fulfilmentType: 'install' },
  { slug: 'quote', name: 'Quote Part', price: 500, image: '/i.webp', productType: 'stock', availability: 'made_to_order', purchasableOnline: true, fulfilmentType: 'quote_required' },
  { slug: 'gone', name: 'Unavailable Part', price: 100, image: '/i.webp', productType: 'stock', availability: 'unavailable', purchasableOnline: true, fulfilmentType: 'ship' },
  { slug: 'ask', name: 'Ask Part', price: 100, image: '/i.webp', productType: 'stock', availability: 'ask_availability', purchasableOnline: false, fulfilmentType: 'ship' },
  { slug: 'made-to-order', name: 'Made to Order Part', price: 100, image: '/i.webp', productType: 'stock', availability: 'made_to_order', purchasableOnline: true, fulfilmentType: 'ship' },
  { slug: 'not-online', name: 'Not Online Part', price: 100, image: '/i.webp', productType: 'stock', availability: 'available_in_australia', purchasableOnline: false, fulfilmentType: 'ship' },
  { slug: 'starlink', name: 'Starlink Install', price: 1500, image: '/i.webp', productType: 'service' },
]);

test('ship + purchasable + available is allowed with trusted price/title', () => {
  const result = validateCheckout(catalogue, [{ slug: 'ship', quantity: 2 }]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].unitPrice, 500);
    assert.equal(result.items[0].name, 'Shippable Part');
    assert.equal(result.items[0].quantity, 2);
  }
});

test('pickup + purchasable + available is allowed', () => {
  const result = validateCheckout(catalogue, [{ slug: 'pickup', quantity: 1 }]);
  assert.equal(result.ok, true);
});

test('install fulfilment is blocked', () => {
  const result = validateCheckout(catalogue, [{ slug: 'install', quantity: 1 }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'NOT_PURCHASABLE');
});

test('quote_required fulfilment is blocked', () => {
  const result = validateCheckout(catalogue, [{ slug: 'quote', quantity: 1 }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'NOT_PURCHASABLE');
});

test('service-only products are blocked', () => {
  const result = validateCheckout(catalogue, [{ slug: 'starlink', quantity: 1 }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'NOT_PURCHASABLE');
});

test('unavailable products are blocked even when fulfilment is ship', () => {
  const result = validateCheckout(catalogue, [{ slug: 'gone', quantity: 1 }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'NOT_PURCHASABLE');
});

test('ask_availability and non-purchasable products are blocked', () => {
  assert.equal(validateCheckout(catalogue, [{ slug: 'ask', quantity: 1 }]).ok, false);
  assert.equal(validateCheckout(catalogue, [{ slug: 'made-to-order', quantity: 1 }]).ok, false);
  assert.equal(validateCheckout(catalogue, [{ slug: 'not-online', quantity: 1 }]).ok, false);
});

test('unknown slug is blocked', () => {
  const result = validateCheckout(catalogue, [{ slug: 'does-not-exist', quantity: 1 }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'UNKNOWN_PRODUCT');
});

test('invalid quantities are blocked', () => {
  for (const quantity of [0, -1, 1.5, 100, '2', null]) {
    const result = validateCheckout(catalogue, [{ slug: 'ship', quantity }]);
    assert.equal(result.ok, false, `quantity ${String(quantity)} should be rejected`);
  }
});

test('client-supplied price, title and fulfilment type are ignored', () => {
  const result = validateCheckout(catalogue, [
    { slug: 'ship', quantity: 1, price: 1, unitPrice: 1, name: 'HACKED', fulfilmentType: 'ship', availability: 'available_in_australia', purchasableOnline: true },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.items[0].unitPrice, 500);
    assert.equal(result.items[0].name, 'Shippable Part');
  }
});

test('client cannot upgrade an install product to checkout by sending a ship fulfilment type', () => {
  const result = validateCheckout(catalogue, [{ slug: 'install', quantity: 1, fulfilmentType: 'ship' }]);
  assert.equal(result.ok, false);
});

test('empty or malformed carts are blocked', () => {
  assert.equal(validateCheckout(catalogue, []).ok, false);
  assert.equal(validateCheckout(catalogue, 'nope').ok, false);
  assert.equal(validateCheckout(catalogue, [null]).ok, false);
  assert.equal(validateCheckout(catalogue, [{ quantity: 1 }]).ok, false);
});

test('a single ineligible item blocks the whole checkout', () => {
  const result = validateCheckout(catalogue, [
    { slug: 'ship', quantity: 1 },
    { slug: 'install', quantity: 1 },
  ]);
  assert.equal(result.ok, false);
});
