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

async function importTsWithoutImports(path) {
  const source = readFileSync(path, 'utf8').replace(/import[\s\S]*?from ['"][^'"]+['"];?\n/g, '');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

async function importTsWithoutLocalImports(path) {
  const source = readFileSync(path, 'utf8')
    .replace(/from 'crypto'/g, "from 'node:crypto'")
    .replace(/import \{ getBlobStore, safeBlobStoreError \} from '\.\/blob-store';\n/g, '')
    .replace(/import \{\n[\s\S]*?\} from '\.\/owner-copilot-core';\n/g, '');
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
const recordSync = await importTsWithoutImports(new URL('../netlify/functions/owner-copilot-record-sync.ts', import.meta.url));
const aiGuardrails = await importTs(new URL('../netlify/functions/ai-guardrails-core.ts', import.meta.url));
const googleOAuth = await importTsWithoutLocalImports(new URL('../netlify/functions/google-oauth-core.ts', import.meta.url));

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

test('findMatchingCustomer matches by normalized email first', () => {
  const match = recordSync.findMatchingCustomer(
    [
      { id: 'customer-1', email: 'sales@example.com', phone: '0400 000 000', name: 'Alex Buyer' },
      { id: 'customer-2', email: 'owner@example.com', phone: '0411 111 111', name: 'Sam Owner' },
    ],
    { email: ' OWNER@EXAMPLE.COM ', phone: '', name: '' }
  );

  assert.equal(match.id, 'customer-2');
});

test('findMatchingCustomer matches by normalized phone', () => {
  const match = recordSync.findMatchingCustomer(
    [{ id: 'customer-1', email: '', phone: '0430-863-819', name: 'Beyond RV' }],
    { email: '', phone: '0430 863 819', name: '' }
  );

  assert.equal(match.id, 'customer-1');
});

test('findMatchingCustomer does not match name alone without a contact method', () => {
  const match = recordSync.findMatchingCustomer(
    [{ id: 'customer-1', email: '', phone: '', name: 'Alex Buyer' }],
    { email: '', phone: '', name: 'Alex Buyer' }
  );

  assert.equal(match, null);
});

test('validateDraftOutput flags unsupported availability and fitment claims', () => {
  const result = aiGuardrails.validateDraftOutput('This camper is in stock and will fit your Hilux. It is $89,990.');

  assert.ok(result.warnings.some((warning) => warning.includes('availability')));
  assert.ok(result.warnings.some((warning) => warning.includes('Vehicle suitability')));
  assert.ok(result.warnings.some((warning) => warning.includes('pricing')));
  assert.ok(result.blockedPhrases.includes('in stock'));
});

test('validateDraftOutput allows cautious owner-confirmation wording', () => {
  const result = aiGuardrails.validateDraftOutput('I will confirm current availability and vehicle suitability before giving you a firm answer.');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.blockedPhrases, []);
});

test('Google OAuth token encryption round-trips without exposing plaintext', () => {
  const encrypted = googleOAuth.encryptSecret('owner-refresh-token', 'test-secret');

  assert.notEqual(encrypted, 'owner-refresh-token');
  assert.ok(!encrypted.includes('owner-refresh-token'));
  assert.equal(googleOAuth.decryptSecret(encrypted, 'test-secret'), 'owner-refresh-token');
  assert.throws(() => googleOAuth.decryptSecret(encrypted, 'wrong-secret'));
});

test('publicGoogleConnectionState reports setup and connection lifecycle states', () => {
  assert.equal(googleOAuth.publicGoogleConnectionState(null, ['GOOGLE_OAUTH_CLIENT_ID']), 'not_configured');
  assert.equal(googleOAuth.publicGoogleConnectionState(null, []), 'not_connected');
  assert.equal(googleOAuth.publicGoogleConnectionState({ revokedAt: '2026-06-01T00:00:00.000Z' }, []), 'access_revoked');
  assert.equal(googleOAuth.publicGoogleConnectionState({ refreshFailedAt: '2026-06-01T00:00:00.000Z' }, []), 'refresh_failed');
  assert.equal(googleOAuth.publicGoogleConnectionState({ expiresAt: '2026-06-01T00:00:00.000Z' }, []), 'token_expired');
  assert.equal(googleOAuth.publicGoogleConnectionState({ expiresAt: '2999-06-01T00:00:00.000Z' }, []), 'connected');
});
