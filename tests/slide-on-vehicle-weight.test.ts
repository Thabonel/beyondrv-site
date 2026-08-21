import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCurrentVehicleWeight } from '../src/lib/slideOnVehicleWeight.ts';

test('a tray that does not apply leaves the vehicle weight untouched', () => {
  const result = resolveCurrentVehicleWeight({ currentWeightRaw: '2200', trayMassRaw: '', trayRequired: false });
  assert.equal(result, '2200');
});

test('a required tray weight is added to the vehicle weight', () => {
  const result = resolveCurrentVehicleWeight({ currentWeightRaw: '2200', trayMassRaw: '120', trayRequired: true });
  assert.equal(result, '2320');
});

test('a required tray weight left blank makes the vehicle weight missing, not zero', () => {
  const result = resolveCurrentVehicleWeight({ currentWeightRaw: '2200', trayMassRaw: '', trayRequired: true });
  assert.equal(result, '');
});

test('a required tray weight that is negative makes the vehicle weight missing', () => {
  const result = resolveCurrentVehicleWeight({ currentWeightRaw: '2200', trayMassRaw: '-50', trayRequired: true });
  assert.equal(result, '');
});

test('a required tray weight that is not a number makes the vehicle weight missing', () => {
  const result = resolveCurrentVehicleWeight({ currentWeightRaw: '2200', trayMassRaw: 'abc', trayRequired: true });
  assert.equal(result, '');
});

test('a stray tray weight is ignored when no tray applies, so it cannot be double counted', () => {
  const result = resolveCurrentVehicleWeight({ currentWeightRaw: '2200', trayMassRaw: '120', trayRequired: false });
  assert.equal(result, '2200');
});

test('a blank vehicle weight passes straight through to the existing missing path', () => {
  assert.equal(resolveCurrentVehicleWeight({ currentWeightRaw: '', trayMassRaw: '120', trayRequired: true }), '');
  assert.equal(resolveCurrentVehicleWeight({ currentWeightRaw: '0', trayMassRaw: '120', trayRequired: true }), '0');
});
