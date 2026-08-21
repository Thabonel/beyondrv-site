import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductRecord, productSearchUrl } from '../src/lib/searchIndex.ts';
import { SEARCH_PAGES } from '../src/data/searchPages.ts';

test('a top-level vehicle product lives at the site root', () => {
  assert.equal(productSearchUrl('advent-2450-hardtop-slide-on', false, ''), '/advent-2450-hardtop-slide-on/');
});

test('an expedition product keeps its collection path in the url', () => {
  assert.equal(productSearchUrl('expedition/4-7m-hardtop-truck-camper', false, ''), '/expedition/4-7m-hardtop-truck-camper/');
});

test('a store product lives under /shop/ using its own slug', () => {
  assert.equal(productSearchUrl('accessories/twin-air-compressor-shield', true, 'twin-air-compressor-shield'), '/shop/twin-air-compressor-shield/');
});

test('a product record carries the fields the ranking module reads', () => {
  const record = buildProductRecord({
    id: 'advent-2450-hardtop-slide-on',
    data: {
      title: 'Advent 2450 Hardtop Ute Slide-On Camper',
      tagline: 'Hardtop slide-on for dual-cab utes.',
      category: 'slide-on',
      price: 'From $49,990',
      features: ['Electric lift roof'],
      keySpecs: [{ label: 'Payload', value: '900kg' }],
    },
  });

  assert.equal(record.kind, 'product');
  assert.equal(record.title, 'Advent 2450 Hardtop Ute Slide-On Camper');
  assert.equal(record.summary, 'Hardtop slide-on for dual-cab utes.');
  assert.equal(record.category, 'slide-on');
  assert.equal(record.price, 'From $49,990');
  assert.equal(record.url, '/advent-2450-hardtop-slide-on/');
  assert.deepEqual(record.keywords, ['Electric lift roof', 'Payload', '900kg']);
});

test('a product with no features or specs still builds a record', () => {
  const record = buildProductRecord({
    id: 'mercedes-sprinter-motorhome',
    data: { title: 'Mercedes Sprinter Motorhome', tagline: 'Van conversion.', category: 'expedition', price: 'POA' },
  });

  assert.deepEqual(record.keywords, []);
});

test('the static page catalogue covers every guide and tool', () => {
  assert.equal(SEARCH_PAGES.length, 6);
  assert.equal(SEARCH_PAGES.filter((page) => page.kind === 'guide').length, 3);
  assert.equal(SEARCH_PAGES.filter((page) => page.kind === 'tool').length, 3);
  for (const page of SEARCH_PAGES) {
    assert.match(page.url, /^\/[a-z0-9/-]+\/$/, `${page.id} should have a trailing-slash root-relative url`);
    assert.ok(page.title, `${page.id} needs a title`);
    assert.ok(page.summary, `${page.id} needs a summary`);
  }
});
