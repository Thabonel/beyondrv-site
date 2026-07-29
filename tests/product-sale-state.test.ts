import assert from 'node:assert/strict';
import test from 'node:test';
import { vehicleSaleStateForStatus, vehicleSaleStateForToggle } from '../src/lib/productSaleState.ts';

test('selecting an available vehicle status clears the sale flag', () => {
  assert.deepEqual(vehicleSaleStateForStatus('available'), { status: 'available', onSale: false });
});

test('selecting the on-sale vehicle status enables the sale flag', () => {
  assert.deepEqual(vehicleSaleStateForStatus('on-sale'), { status: 'on-sale', onSale: true });
});

test('unticking On sale returns an on-sale vehicle to available', () => {
  assert.deepEqual(vehicleSaleStateForToggle('on-sale', false), { status: 'available', onSale: false });
});

test('ticking On sale updates the vehicle status consistently', () => {
  assert.deepEqual(vehicleSaleStateForToggle('coming-soon', true), { status: 'on-sale', onSale: true });
});
