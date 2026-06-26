import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDepositAmount, parseMoneyValue, STRIPE_DEPOSIT_PERCENT } from '../src/lib/payment.ts';

test('parseMoneyValue strips formatting and currency labels', () => {
  assert.equal(parseMoneyValue('$78,999'), 78999);
  assert.equal(parseMoneyValue('From $49,999'), 49999);
  assert.equal(Number.isNaN(parseMoneyValue('POA')), true);
});

test('calculateDepositAmount rounds to the nearest dollar', () => {
  assert.equal(STRIPE_DEPOSIT_PERCENT, 1 / 3);
  assert.equal(calculateDepositAmount(78999), 26333);
  assert.equal(calculateDepositAmount(49999), 16666);
});
