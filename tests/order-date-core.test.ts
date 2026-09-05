import assert from 'node:assert/strict';
import test from 'node:test';
import { isOrderDateKind, matchOrderForCustomer, ORDER_DATE_FIELDS } from '../netlify/functions/order-date-core.ts';

const orders = [
  { id: 'o1', status: 'in_transit', customerEmail: 'tas@example.com', customerPhone: '+61 400 111 222', customerName: 'Tasmanian Customer', productTitle: 'Advent 2450', productSlug: 'advent-2450' },
  { id: 'o2', status: 'delivered', customerEmail: 'old@example.com', customerPhone: '0400 333 444', customerName: 'Old Customer', productTitle: 'Sunpatch 15' },
  { id: 'o3', status: 'quoted', customerEmail: '', customerPhone: '', customerName: 'Sam Two', productTitle: 'Advent 2300' },
  { id: 'o4', status: 'quoted', customerEmail: '', customerPhone: '', customerName: 'Sam Two', productTitle: 'Sunpatch 19' },
];

test('visits and handovers each write a date field and a time field on the order', () => {
  assert.equal(ORDER_DATE_FIELDS.expected_handover.date, 'expectedHandoverDate');
  assert.equal(ORDER_DATE_FIELDS.expected_handover.time, 'expectedHandoverTime');
  assert.equal(isOrderDateKind('expected_handover'), true);
  assert.equal(isOrderDateKind('meeting'), false);
});

test('an email address is a definite match', () => {
  assert.equal(matchOrderForCustomer(orders, { email: 'TAS@example.com' })?.id, 'o1');
});

test('a phone number matches on its last digits, however it was typed', () => {
  assert.equal(matchOrderForCustomer(orders, { phone: '0400111222' })?.id, 'o1');
  assert.equal(matchOrderForCustomer(orders, { phone: '1222' }), null, 'too short to trust');
});

test('a delivered order is not a live one, so its customer does not match', () => {
  assert.equal(matchOrderForCustomer(orders, { email: 'old@example.com' }), null);
});

test('a name matches only when it is unambiguous, or the product settles it', () => {
  assert.equal(matchOrderForCustomer(orders, { name: 'tasmanian customer' })?.id, 'o1');
  assert.equal(matchOrderForCustomer(orders, { name: 'Sam Two' }), null, 'two live orders, no way to choose');
  assert.equal(matchOrderForCustomer(orders, { name: 'Sam Two', productInterest: 'the Advent 2300 pop-top' })?.id, 'o3');
});

test('no clues means no order, never a guess', () => {
  assert.equal(matchOrderForCustomer(orders, {}), null);
});
