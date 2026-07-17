import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceProductHero } from '../src/lib/productImages.ts';

test('swaps a selected gallery image with the previous hero', () => {
  assert.deepEqual(
    replaceProductHero('/hero-old.webp', '/gallery-2.webp', [
      '/gallery-1.webp',
      '/gallery-2.webp',
      '/gallery-3.webp',
    ]),
    {
      heroImage: '/gallery-2.webp',
      gallery: ['/gallery-1.webp', '/hero-old.webp', '/gallery-3.webp'],
    },
  );
});

test('puts the previous hero first when the new hero is not in the gallery', () => {
  assert.deepEqual(
    replaceProductHero('/hero-old.webp', '/uploaded-new.webp', [
      '/gallery-1.webp',
      '/gallery-2.webp',
    ]),
    {
      heroImage: '/uploaded-new.webp',
      gallery: ['/hero-old.webp', '/gallery-1.webp', '/gallery-2.webp'],
    },
  );
});

test('preserves the previous hero once and removes the promoted image from the gallery', () => {
  assert.deepEqual(
    replaceProductHero('/hero-old.webp', '/gallery-2.webp', [
      '/hero-old.webp',
      '/gallery-1.webp',
      '/gallery-2.webp',
      '/hero-old.webp',
      '/gallery-3.webp',
    ]),
    {
      heroImage: '/gallery-2.webp',
      gallery: ['/gallery-1.webp', '/hero-old.webp', '/gallery-3.webp'],
    },
  );
});

test('does not change gallery order when the hero is unchanged', () => {
  assert.deepEqual(
    replaceProductHero('/hero.webp', '/hero.webp', ['/gallery-1.webp', '/gallery-2.webp']),
    {
      heroImage: '/hero.webp',
      gallery: ['/gallery-1.webp', '/gallery-2.webp'],
    },
  );
});
