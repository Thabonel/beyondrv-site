import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRows, toSql } from '../SCRIPTS/load-tray-specifications.mjs';

const base = {
  manufacturer: 'Norweld',
  tray_model: 'Elite Tray',
  vehicle_make: 'Isuzu',
  vehicle_model: 'D-Max',
  cab_type: 'dual',
  length_mm: '1826',
  width_mm: '1850',
  dimension_basis: 'outside',
  dimension_basis_quote: 'Outside dimensions, headboard front to tray rear.',
  source_id: 'norweld-elite-tray-specs',
  source_manufacturer: 'Norweld',
  source_title: 'Norweld Elite Tray technical specifications',
  source_url: 'https://norweld.com.au/specs.pdf',
  source_accessed_date: '2026-09-04',
  source_locator: 'Vehicle model table',
};

test('a complete row is accepted and keeps its basis', () => {
  const result = validateRows([{ ...base }]);
  assert.equal(result.valid, true, result.errors.join('\n'));
  const sql = toSql(result);
  assert.match(sql, /'outside'/);
  assert.match(sql, /headboard front to tray rear/);
});

// The reason the column exists. Norweld publishes outside dimensions while the
// calculator asks for the usable floor, and the camper finder matches within
// 50mm, so a figure whose basis is unknown cannot be used.
test('a dimension with no stated basis is refused', () => {
  for (const value of ['', 'nominal', 'approx', 'overall']) {
    const result = validateRows([{ ...base, dimension_basis: value }]);
    assert.equal(result.valid, false, `basis ${JSON.stringify(value)} should be refused`);
    assert.ok(result.errors.some((e) => e.includes('dimension_basis')), result.errors.join('\n'));
  }
});

test('both dimension bases are allowed, and they stay distinct', () => {
  const outside = validateRows([{ ...base, dimension_basis: 'outside' }]);
  const usable = validateRows([{ ...base, dimension_basis: 'usable' }]);
  assert.equal(outside.valid, true);
  assert.equal(usable.valid, true);
  assert.match(toSql(outside), /'outside'/);
  assert.match(toSql(usable), /'usable'/);
});

test('a half-named vehicle is refused, because nothing can match it', () => {
  assert.equal(validateRows([{ ...base, vehicle_model: '' }]).valid, false);
  assert.equal(validateRows([{ ...base, vehicle_make: '' }]).valid, false);
  // Neither is fine: that is a size that fits a class rather than one vehicle.
  const classRow = validateRows([{ ...base, vehicle_make: '', vehicle_model: '' }]);
  assert.equal(classRow.valid, true, classRow.errors.join('\n'));
});

test('a measurement that is not a whole number of millimetres is refused', () => {
  for (const value of ['1.826m', '1826mm', '1,826', '', 'about 1800']) {
    assert.equal(validateRows([{ ...base, length_mm: value }]).valid, false, `length ${JSON.stringify(value)}`);
  }
});

test('a measurement no tray could have is refused', () => {
  assert.equal(validateRows([{ ...base, length_mm: '18260' }]).valid, false);
  assert.equal(validateRows([{ ...base, length_mm: '120' }]).valid, false);
  assert.equal(validateRows([{ ...base, width_mm: '9000' }]).valid, false);
});

test('the same source described two ways is refused', () => {
  const result = validateRows([
    { ...base },
    { ...base, cab_type: 'single', length_mm: '2526', source_title: 'A different title' },
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('two different ways')), result.errors.join('\n'));
});

test('a duplicate row is refused rather than silently overwriting', () => {
  const result = validateRows([{ ...base }, { ...base }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('duplicate')));
});

test('one bad row refuses the whole file', () => {
  const result = validateRows([{ ...base }, { ...base, cab_type: 'ute', length_mm: '2526' }]);
  assert.equal(result.valid, false);
  // A partial load would leave a state nobody chose.
  assert.equal(result.errors.length >= 1, true);
});

test('rows are never customer selectable straight from a crawl', () => {
  const sql = toSql(validateRows([{ ...base }]));
  const values = sql.slice(sql.lastIndexOf('VALUES'));
  assert.match(values, /'source_verified', 0,/);
});
