import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function importTs(path) {
  const source = readFileSync(path, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

const productKnowledge = await importTs(new URL('../netlify/functions/product-knowledge-core.ts', import.meta.url));
const ownerCopilot = await importTs(new URL('../netlify/functions/owner-copilot-core.ts', import.meta.url));

test('buildProductKnowledgeContext returns grounded product sources with guardrails', () => {
  const context = productKnowledge.buildProductKnowledgeContext({
    query: 'Can the Advent 2150 fit my Hilux and what is the price?',
    productInterest: 'advent-2150-hardtop-slide-on',
    products: [
      {
        slug: 'advent-2150-hardtop-slide-on',
        title: 'Advent 2150 Hardtop Slide-On',
        price: '$89,990',
        status: 'available',
        category: 'slide-on',
        tagline: 'Compact hardtop slide-on camper',
        keySpecs: [{ label: 'Body length', value: '2150mm' }],
      },
    ],
    businessKnowledge: 'Vehicle suitability depends on payload, tray dimensions, axle loads, and GVM. Pricing must be confirmed before quoting.',
  });

  assert.equal(context.sources[0].title, 'Advent 2150 Hardtop Slide-On');
  assert.equal(context.sources[0].url, '/advent-2150-hardtop-slide-on/');
  assert.match(context.sources[0].facts.join(' '), /Catalogue price: \$89,990/);
  assert.ok(context.warnings.some((warning) => warning.includes('Vehicle suitability')));
  assert.ok(context.warnings.some((warning) => warning.includes('Price and availability')));
  assert.ok(context.missingFacts.some((fact) => fact.includes('Vehicle year/model')));
});

test('buildProductKnowledgeContext flags missing catalogue matches', () => {
  const context = productKnowledge.buildProductKnowledgeContext({
    query: 'Do you have a warranty for an unknown camper?',
    products: [],
    businessKnowledge: '',
  });

  assert.deepEqual(context.sources, []);
  assert.ok(context.missingFacts.includes('No specific product catalogue match was found.'));
  assert.ok(context.warnings.some((warning) => warning.includes('Warranty')));
});

test('buildLeadIntelligence prioritises hot purchase-intent enquiries', () => {
  const intelligence = ownerCopilot.buildLeadIntelligence(
    {
      id: 'enquiry-1',
      submittedAt: '2026-06-05T10:00:00.000Z',
      phone: '0400000000',
      message: 'Can you call me about price, availability, delivery, finance, and whether it fits my Isuzu?',
    },
    { enquiryId: 'enquiry-1', status: 'new' },
    new Date('2026-06-06T10:00:00.000Z')
  );

  assert.equal(intelligence.score, 100);
  assert.equal(intelligence.urgency, 'waiting_on_byondrv');
  assert.equal(intelligence.waitingOn, 'byondrv');
  assert.ok(intelligence.reasons.some((reason) => reason.includes('price')));
});

test('buildLeadIntelligence de-prioritises lost or stale leads', () => {
  const intelligence = ownerCopilot.buildLeadIntelligence(
    {
      id: 'enquiry-2',
      submittedAt: '2026-04-01T10:00:00.000Z',
      message: 'Just researching campers.',
    },
    {
      enquiryId: 'enquiry-2',
      status: 'lost',
      outcomeReason: 'bought-elsewhere',
      lastContactedAt: '2026-04-15T10:00:00.000Z',
    },
    new Date('2026-06-06T10:00:00.000Z')
  );

  assert.equal(intelligence.score, 0);
  assert.equal(intelligence.urgency, 'lost');
  assert.ok(intelligence.reasons.some((reason) => reason.includes('bought elsewhere')));
});
