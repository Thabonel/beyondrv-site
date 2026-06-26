import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue } from '../src/lib/checkout.ts';
import { resolveShippableItems, calculateShippingQuote } from '../src/lib/shipping.ts';

const catalogue = buildCatalogue([
  { slug: 'ship-confirmed', name: 'Confirmed Part', price: 100, image: '/i.webp', productType: 'stock', availability: 'available_in_australia', purchasableOnline: true, fulfilmentType: 'ship', shippingSize: 'medium', packedWeightKg: 2, packedLengthCm: 40, packedWidthCm: 30, packedHeightCm: 20, shippingDataStatus: 'confirmed' },
  { slug: 'ship-estimated', name: 'Estimated Part', price: 188, image: '/i.webp', productType: 'stock', availability: 'available_in_australia', purchasableOnline: true, fulfilmentType: 'ship', shippingSize: 'medium', packedWeightKg: 1, packedLengthCm: 51, packedWidthCm: 32, packedHeightCm: 22, shippingDataStatus: 'estimated' },
  { slug: 'ship-oversized', name: 'Oversized Part', price: 900, image: '/i.webp', productType: 'stock', availability: 'available_in_australia', purchasableOnline: true, fulfilmentType: 'ship', shippingSize: 'oversized', packedWeightKg: 40, packedLengthCm: 200, packedWidthCm: 80, packedHeightCm: 80, shippingDataStatus: 'confirmed' },
  { slug: 'ship-nodata', name: 'No Data Part', price: 50, image: '/i.webp', productType: 'stock', availability: 'available_in_australia', purchasableOnline: true, fulfilmentType: 'ship', shippingSize: 'medium', shippingDataStatus: 'estimated' },
  { slug: 'install', name: 'Install Part', price: 500, image: '/i.webp', productType: 'stock', availability: 'made_to_order', purchasableOnline: false, fulfilmentType: 'install' },
  { slug: 'service', name: 'Service Part', price: 1500, image: '/i.webp', productType: 'service' },
]);

test('resolveShippableItems rebuilds packed data from the manifest and ignores client-sent values', () => {
  const result = resolveShippableItems(catalogue, [{ slug: 'ship-confirmed', quantity: 2, packedWeightKg: 999, packedLengthCm: 1 }]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].packedWeightKg, 2);
    assert.equal(result.items[0].packedLengthCm, 40);
    assert.equal(result.items[0].quantity, 2);
  }
});

test('resolveShippableItems rejects non-ship products', () => {
  assert.equal(resolveShippableItems(catalogue, [{ slug: 'install', quantity: 1 }]).ok, false);
  assert.equal(resolveShippableItems(catalogue, [{ slug: 'service', quantity: 1 }]).ok, false);
  const installResult = resolveShippableItems(catalogue, [{ slug: 'install', quantity: 1 }]);
  if (!installResult.ok) assert.equal(installResult.code, 'NOT_SHIPPABLE');
});

test('resolveShippableItems rejects unknown slug, bad quantity, and empty cart', () => {
  assert.equal(resolveShippableItems(catalogue, [{ slug: 'nope', quantity: 1 }]).ok, false);
  assert.equal(resolveShippableItems(catalogue, [{ slug: 'ship-confirmed', quantity: 0 }]).ok, false);
  assert.equal(resolveShippableItems(catalogue, [{ slug: 'ship-confirmed', quantity: 1.5 }]).ok, false);
  assert.equal(resolveShippableItems(catalogue, []).ok, false);
});

test('resolveShippableItems rejects ship products missing packed data', () => {
  const result = resolveShippableItems(catalogue, [{ slug: 'ship-nodata', quantity: 1 }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'MISSING_SHIPPING_DATA');
});

test('confirmed item with valid postcode returns a confirmed, non-estimated quote', () => {
  const resolved = resolveShippableItems(catalogue, [{ slug: 'ship-confirmed', quantity: 1 }]);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const quote = calculateShippingQuote(resolved.items, '3000');
  assert.equal(quote.ok, true);
  if (quote.ok) {
    assert.equal(quote.status, 'confirmed');
    assert.equal(quote.estimated, false);
    assert.equal(quote.currency, 'AUD');
    assert.equal(quote.amount, 21.95);
  }
});

test('estimated item is flagged as dev-only (estimated: true)', () => {
  const resolved = resolveShippableItems(catalogue, [{ slug: 'ship-estimated', quantity: 1 }]);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const quote = calculateShippingQuote(resolved.items, '3000');
  assert.equal(quote.ok, true);
  if (quote.ok) {
    assert.equal(quote.status, 'estimated');
    assert.equal(quote.estimated, true);
    assert.ok(quote.amount > 0);
  }
});

test('oversized items are rejected for a freight enquiry', () => {
  const resolved = resolveShippableItems(catalogue, [{ slug: 'ship-oversized', quantity: 1 }]);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const quote = calculateShippingQuote(resolved.items, '3000');
  assert.equal(quote.ok, false);
  if (!quote.ok) assert.equal(quote.code, 'OVERSIZED');
});

test('invalid postcodes are rejected', () => {
  const resolved = resolveShippableItems(catalogue, [{ slug: 'ship-confirmed', quantity: 1 }]);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  for (const postcode of ['', '30', '30000', 'abcd', 3000, null]) {
    assert.equal(calculateShippingQuote(resolved.items, postcode).ok, false, `postcode ${String(postcode)} should be rejected`);
  }
});

test('an empty item list is rejected by the quote engine', () => {
  assert.equal(calculateShippingQuote([], '3000').ok, false);
});

test('quotes are deterministic and zone-sensitive', () => {
  const resolved = resolveShippableItems(catalogue, [{ slug: 'ship-confirmed', quantity: 1 }]);
  if (!resolved.ok) return;
  const metroA = calculateShippingQuote(resolved.items, '3000');
  const metroB = calculateShippingQuote(resolved.items, '3000');
  const remote = calculateShippingQuote(resolved.items, '0800');
  assert.equal(metroA.ok && metroB.ok && remote.ok, true);
  if (metroA.ok && metroB.ok && remote.ok) {
    assert.equal(metroA.amount, metroB.amount);
    assert.ok(remote.amount > metroA.amount);
  }
});
