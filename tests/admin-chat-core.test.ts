import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildChangeEvidence,
  buildOwnerIntent,
  findProductMatches,
  parseJudgeVerdict,
  productCatalogueEntries,
  resolveGitHubBranch,
  resolveProductMetadata,
  validateRecentBuildReplacement,
  validateRecentBuildProductReferences,
} from '../netlify/functions/admin-chat-core.ts';

test('generated product catalogue array is available to Admin AI lookup', () => {
  const rawCatalogue = JSON.parse(readFileSync('netlify/functions/product-catalogue.json', 'utf8')) as unknown;
  const products = productCatalogueEntries(rawCatalogue);
  const [match] = findProductMatches(products, 'Advent 2450');

  assert.ok(products.length > 0);
  assert.equal(match.slug, 'advent-2450-hardtop-slide-on');
});

test('buildOwnerIntent keeps the full owner instruction sequence', () => {
  const intent = buildOwnerIntent([
    { role: 'user', content: 'Replace the third Recent Build with the Advent 2450.' },
    { role: 'assistant', content: 'Please confirm the image.' },
    { role: 'user', content: 'Use its current blue ute hero image and product link.' },
    { role: 'user', content: 'The ute is a Ford Super Duty.' },
    { role: 'user', content: 'Apply the updates.' },
  ]);

  assert.match(intent, /Replace the third Recent Build/);
  assert.match(intent, /current blue ute hero image/);
  assert.match(intent, /Ford Super Duty/);
  assert.match(intent, /Apply the updates/);
  assert.doesNotMatch(intent, /Please confirm the image/);
});

test('buildChangeEvidence gives the judge the actual before and after values', () => {
  const evidence = buildChangeEvidence(
    '{\n  "image": "/old.webp",\n  "link": "/old/"\n}',
    '{\n  "image": "/media/products/advent-2450/img_0609.webp",\n  "link": "/advent-2450-hardtop-slide-on/"\n}',
  );

  assert.match(evidence, /\/old\.webp/);
  assert.match(evidence, /img_0609\.webp/);
  assert.match(evidence, /advent-2450-hardtop-slide-on/);
});

test('parseJudgeVerdict never exposes an undefined block reason', () => {
  const verdict = parseJudgeVerdict(JSON.stringify({
    decision: 'block',
    rationale: 'The instruction is ambiguous.',
    risk_flags: ['ambiguous_scope'],
    revision_instructions: null,
    block_reason: null,
    escalation_reason: null,
  }));

  assert.equal(verdict.decision, 'block');
  assert.equal(verdict.block_reason, 'The instruction is ambiguous.');
});

test('parseJudgeVerdict fails closed on invalid output', () => {
  const verdict = parseJudgeVerdict('not json');
  assert.equal(verdict.decision, 'block');
  assert.match(verdict.block_reason || '', /could not be verified safely/i);
  assert.deepEqual(verdict.risk_flags, ['judge_parse_error']);
});

test('resolveGitHubBranch follows the deployed preview branch', () => {
  assert.equal(resolveGitHubBranch({ CONTEXT: 'deploy-preview', HEAD: 'staging', GITHUB_BRANCH: 'main' }), 'staging');
  assert.equal(resolveGitHubBranch({ CONTEXT: 'branch-deploy', BRANCH: 'staging', GITHUB_BRANCH: 'main' }), 'staging');
  assert.equal(resolveGitHubBranch({ CONTEXT: 'production', BRANCH: 'main', GITHUB_BRANCH: 'release' }), 'release');
});

test('product lookup resolves the exact current source metadata instead of guessing paths', () => {
  const products = [
    { slug: 'advent-2300-hardtop-slide-on', title: 'Advent 2300 Hardtop Ute Slide-On Camper' },
    { slug: 'advent-2450-hardtop-slide-on', title: 'Advent 2450 Hardtop Ute Slide-On Camper' },
  ];
  const [match] = findProductMatches(products, 'new Advent 2450 Hardtop Ute Slide-On Camper');
  assert.equal(match.slug, 'advent-2450-hardtop-slide-on');

  const metadata = resolveProductMetadata(match, `---
title: Advent 2450 Hardtop Ute Slide-On Camper
category: slide-on
tagline: A larger hardtop slide-on.
heroImage: /media/products/advent-2450-hardtop-slide-on/current-blue-hero.webp
gallery:
  - /images/gallery-one.webp
  - /images/gallery-two.webp
---`);

  assert.equal(metadata.heroImage, '/media/products/advent-2450-hardtop-slide-on/current-blue-hero.webp');
  assert.equal(metadata.pagePath, '/advent-2450-hardtop-slide-on/');
  assert.equal(metadata.sourcePath, 'src/content/products/advent-2450-hardtop-slide-on.md');
  assert.deepEqual(metadata.gallery, ['/images/gallery-one.webp', '/images/gallery-two.webp']);
});

test('Recent Builds rejects fabricated product paths and accepts current product metadata', () => {
  const productContent = readFileSync('src/content/products/advent-2450-hardtop-slide-on.md', 'utf8');
  const metadata = resolveProductMetadata({
    slug: 'advent-2450-hardtop-slide-on',
    title: 'Advent 2450 Hardtop Ute Slide-On Camper',
  }, productContent);
  const recentBuilds = JSON.parse(readFileSync('src/data/homepage/recent-builds.json', 'utf8')) as Array<Record<string, unknown>>;
  const incorrect = recentBuilds.map((entry, index) => index === 2 ? {
    ...entry,
    id: metadata.slug,
    title: metadata.title,
    image: '/images/optimized/products/advent-2450-hardtop-ute/guessed-blue-hero.webp',
    link: '/advent-2450-hardtop-ute/',
  } : entry);
  const incorrectIssues = validateRecentBuildProductReferences(JSON.stringify(incorrect), [metadata]);
  assert.ok(incorrectIssues.length >= 2);
  assert.match(incorrectIssues.join('\n'), /advent-2450-hardtop-slide-on/);
  assert.match(incorrectIssues.join('\n'), /Current hero/);

  const corrected = recentBuilds.map((entry, index) => index === 2 ? {
    ...entry,
    id: metadata.slug,
    title: metadata.title,
    image: metadata.heroImage,
    link: metadata.pagePath,
    productSlug: metadata.slug,
  } : entry);
  assert.deepEqual(validateRecentBuildProductReferences(JSON.stringify(corrected), [metadata]), []);
});

test('Recent Builds replacement is deterministically approved only for one grounded item', () => {
  const currentContent = readFileSync('src/data/homepage/recent-builds.json', 'utf8');
  const current = JSON.parse(currentContent) as Array<Record<string, unknown>>;
  const productContent = readFileSync('src/content/products/advent-2450-hardtop-slide-on.md', 'utf8');
  const product = resolveProductMetadata({
    slug: 'advent-2450-hardtop-slide-on',
    title: 'Advent 2450 Hardtop Ute Slide-On Camper',
  }, productContent);
  const proposed = current.map((entry, index) => index === 2 ? {
    id: product.slug,
    title: product.title,
    image: product.heroImage,
    alt: 'Advent 2450 Hardtop Ute Slide-On Camper build at Beyond RV',
    tags: ['Built for a Ford Super Duty', ...((entry.tags as string[]) ?? []).slice(1)],
    link: product.pagePath,
    isVisible: entry.isVisible,
    sortOrder: entry.sortOrder,
    productSlug: product.slug,
  } : entry);

  assert.deepEqual(validateRecentBuildReplacement(
    currentContent,
    JSON.stringify(proposed),
    'Replace the 3rd item and use the current hero image.',
    [product],
  ), []);

  proposed[2].sortOrder = 9;
  assert.match(validateRecentBuildReplacement(
    currentContent,
    JSON.stringify(proposed),
    'Replace the 3rd item and use the current hero image.',
    [product],
  ).join('\n'), /preserve the existing sortOrder/);
});
