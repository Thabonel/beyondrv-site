import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'yaml';
import {
  archiveProductMarkdown,
  isSafeProductSlug,
  productPathCandidates,
  restoreProductMarkdown,
} from '../netlify/functions/product-archive-core.ts';
import { isPublicProduct } from '../src/lib/productVisibility.ts';

function frontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match);
  return parse(match[1]) as Record<string, unknown>;
}

test('archive preserves the product file and adds archive metadata', () => {
  const current = `---
title: Sold Camper
price: $10,000
status: on-sale
---

Product body remains available for records.
`;
  const archivedAt = '2026-07-29T04:30:00.000Z';
  const result = archiveProductMarkdown(current, archivedAt);
  const data = frontmatter(result.content);

  assert.equal(result.title, 'Sold Camper');
  assert.equal(result.alreadyArchived, false);
  assert.equal(data.archived, true);
  assert.equal(data.archivedAt, archivedAt);
  assert.match(result.content, /Product body remains available for records\./);
});

test('archive is idempotent for an already archived product', () => {
  const current = `---
name: Archived Shop Item
archived: true
archivedAt: 2026-07-20T00:00:00.000Z
---

Kept.
`;
  const result = archiveProductMarkdown(current, '2026-07-29T04:30:00.000Z');

  assert.equal(result.alreadyArchived, true);
  assert.equal(result.content, current);
  assert.equal(result.title, 'Archived Shop Item');
});

test('restore removes archive metadata and preserves the product content', () => {
  const current = `---
title: Archived Camper
price: $42,000
archived: true
archivedAt: 2026-07-29T04:30:00.000Z
---

The complete product record remains intact.
`;
  const result = restoreProductMarkdown(current);
  const data = frontmatter(result.content);

  assert.equal(result.title, 'Archived Camper');
  assert.equal(result.alreadyActive, false);
  assert.equal(data.archived, undefined);
  assert.equal(data.archivedAt, undefined);
  assert.match(result.content, /The complete product record remains intact\./);
});

test('restore is idempotent for an active product', () => {
  const current = `---
title: Active Camper
price: $42,000
---

Still active.
`;
  const result = restoreProductMarkdown(current);

  assert.equal(result.alreadyActive, true);
  assert.equal(result.content, current);
});

test('product archive paths accept nested products and reject unsafe slugs', () => {
  assert.equal(isSafeProductSlug('expedition/unimog-overlander-camper'), true);
  assert.equal(isSafeProductSlug('../secret'), false);
  assert.deepEqual(productPathCandidates('advent-2450-hardtop-slide-on'), [
    'src/content/products/advent-2450-hardtop-slide-on.md',
    'src/content/products/accessories/advent-2450-hardtop-slide-on.md',
  ]);
});

test('archived products are excluded by the public visibility rule', () => {
  assert.equal(isPublicProduct({ data: {} }), true);
  assert.equal(isPublicProduct({ data: { archived: false } }), true);
  assert.equal(isPublicProduct({ data: { archived: true } }), false);
});
