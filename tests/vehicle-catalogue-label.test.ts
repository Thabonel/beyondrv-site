import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVariantLabels } from '../src/lib/vehicleCatalogue/label.ts';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'x', make: 'Toyota', model: 'HiLux', modelYear: 2026, grade: 'SR',
    cabType: 'double_cab', bodyType: 'cab_chassis', drivetrain: '4x4',
    engine: '2.8L turbo-diesel', transmission: '6-speed automatic', wheelbaseMm: 3085,
    ...over,
  };
}

test('a label names the body type, because it decides whether a slide-on applies', () => {
  const [label] = buildVariantLabels([row()]);
  assert.match(label, /cab chassis/);
  assert.match(label, /Toyota HiLux SR/);
  assert.match(label, /\(2026\)/);
});

test('an unambiguous variant is not cluttered with engine or transmission', () => {
  const [label] = buildVariantLabels([row()]);
  assert.doesNotMatch(label, /turbo-diesel/);
  assert.doesNotMatch(label, /speed/);
});

test('variants differing only by body type are separated by it', () => {
  const labels = buildVariantLabels([
    row({ id: 'a', bodyType: 'cab_chassis' }),
    row({ id: 'b', bodyType: 'pickup_tub' }),
  ]);
  assert.equal(new Set(labels).size, 2);
  assert.match(labels[0], /cab chassis/);
  assert.match(labels[1], /pickup tub/);
});

test('variants differing only by transmission are separated by it', () => {
  const labels = buildVariantLabels([
    row({ id: 'a', transmission: '6-speed manual' }),
    row({ id: 'b', transmission: '6-speed automatic' }),
  ]);
  assert.equal(new Set(labels).size, 2);
  assert.ok(labels.some((l) => l.includes('6-speed manual')), labels.join(' | '));
});

test('variants differing only by engine are separated by it', () => {
  const labels = buildVariantLabels([
    row({ id: 'a', engine: '2.2L turbo-diesel' }),
    row({ id: 'b', engine: '3.0L turbo-diesel' }),
  ]);
  assert.equal(new Set(labels).size, 2);
  assert.ok(labels.some((l) => l.includes('2.2L turbo-diesel')), labels.join(' | '));
});

test('variants differing only by wheelbase are separated by it', () => {
  const labels = buildVariantLabels([
    row({ id: 'a', wheelbaseMm: 3697 }),
    row({ id: 'b', wheelbaseMm: 3997 }),
  ]);
  assert.equal(new Set(labels).size, 2);
  assert.ok(labels.some((l) => l.includes('3697')), labels.join(' | '));
});

test('variants that nothing in the data can separate are still given distinct labels', () => {
  const labels = buildVariantLabels([row({ id: 'a' }), row({ id: 'b' })]);
  assert.equal(new Set(labels).size, 2, `labels collided: ${labels.join(' | ')}`);
});

test('the engine is trimmed to its description, not its power figures', () => {
  const labels = buildVariantLabels([
    row({ id: 'a', engine: '2.0L bi-turbo diesel; 154 kW / 500 Nm' }),
    row({ id: 'b', engine: '2.0L single-turbo diesel; 125 kW / 405 Nm' }),
  ]);
  assert.ok(labels.some((l) => l.endsWith('2.0L bi-turbo diesel')), labels.join(' | '));
  assert.ok(labels.every((l) => !l.includes('kW')), labels.join(' | '));
});

test('variants separated only by their payload rating say so, rather than showing an id', () => {
  const labels = buildVariantLabels([
    row({ id: 'a', payloadKg: 910 }),
    row({ id: 'b', payloadKg: 1030 }),
  ]);
  assert.equal(new Set(labels).size, 2);
  assert.ok(labels.some((l) => l.includes('910 kg payload')), labels.join(' | '));
  assert.ok(labels.every((l) => !l.includes('[')), labels.join(' | '));
});

test('a grade the model already states is not repeated', () => {
  const [label] = buildVariantLabels([
    row({ id: 'a', model: 'Ranger Super Duty', grade: 'Super Duty' }),
  ]);
  assert.ok(label.includes('Ranger Super Duty'), label);
  assert.ok(!label.includes('Super Duty Super Duty'), label);
});

test('a grade that only shares a word with the model is still shown', () => {
  const [label] = buildVariantLabels([
    row({ id: 'a', model: 'Ranger Super Duty', grade: 'Super' }),
  ]);
  assert.ok(label.includes('Ranger Super Duty Super'), label);
});

test('dropping a repeated grade never merges two distinct variants', () => {
  const labels = buildVariantLabels([
    row({ id: 'a', model: 'Ranger Super Duty', grade: 'Super Duty' }),
    row({ id: 'b', model: 'Ranger Super Duty', grade: 'XLT' }),
  ]);
  assert.equal(new Set(labels).size, 2, `labels collided: ${labels.join(' | ')}`);
});
