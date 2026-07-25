import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deterministicContractEmailTriage,
  matchEmailToContracts,
  modelChangePrompt,
  validateContractChangeExtraction,
} from '../netlify/functions/contract-ai-core.ts';
import { normaliseContractInput } from '../netlify/functions/contract-core.ts';
import {
  decodeGmailBase64Url,
  extractGmailMessageText,
  htmlToSafeText,
  isExcludedGmailMessage,
} from '../netlify/functions/gmail-message-core.ts';

function contract(status: 'draft' | 'signed' = 'draft') {
  const record = normaliseContractInput({
    buyer: { name: 'Alex Buyer', email: 'alex@example.com' },
    product: { name: 'Sunpatch 12C' },
    lineItems: [{ id: 'base', description: 'Camper', quantity: 1, unitPriceCents: 40_000_00, kind: 'base' }],
    specificationSections: [{ heading: 'Features', items: ['Standard awning'] }],
  });
  record.contractNumber = 'BRV-2026-0012';
  record.status = status;
  return record;
}

test('Gmail body extraction prefers plain text and safely falls back to HTML', () => {
  const encode = (value: string) => Buffer.from(value).toString('base64url');
  const plain = extractGmailMessageText({
    mimeType: 'multipart/alternative',
    parts: [
      { mimeType: 'text/html', body: { data: encode('<p>HTML version</p>') } },
      { mimeType: 'text/plain', body: { data: encode('Please add the premium awning.') } },
    ],
  });
  assert.equal(plain, 'Please add the premium awning.');
  assert.equal(extractGmailMessageText({ mimeType: 'text/html', body: { data: encode('<p>Hello<br>there</p><script>bad()</script>') } }), 'Hello\nthere');
});

test('Gmail helpers decode URL-safe data and exclude unsafe message classes', () => {
  const encoded = Buffer.from('contract change').toString('base64url');
  assert.equal(decodeGmailBase64Url(encoded), 'contract change');
  assert.equal(isExcludedGmailMessage({ labelIds: ['SENT'], fromEmail: 'alex@example.com' }), true);
  assert.equal(isExcludedGmailMessage({ fromEmail: 'no-reply@signwell.com', subject: 'Completed document' }), true);
  assert.equal(isExcludedGmailMessage({ labelIds: ['INBOX'], fromEmail: 'alex@example.com', subject: 'Please update contract' }), false);
  assert.equal(htmlToSafeText('<style>x{}</style><p>A &amp; B</p>'), 'A & B');
});

test('contract matching prefers an exact contract number then exact buyer email', () => {
  const first = contract('draft');
  const second = contract('signed');
  second.id = 'second';
  second.contractNumber = 'BRV-2026-0099';
  second.buyer.email = 'second@example.com';
  const byNumber = matchEmailToContracts('unknown@example.com', 'Re BRV-2026-0012', 'Please change the awning', [first, second]);
  assert.equal(byNumber.contract?.id, first.id);
  assert.equal(byNumber.method, 'contract_number');
  const byEmail = matchEmailToContracts('second@example.com', 'Update please', 'Please add solar', [first, second]);
  assert.equal(byEmail.contract?.id, second.id);
  assert.equal(byEmail.method, 'buyer_email');
});

test('contract-number matching selects the current revision from a preserved version chain', () => {
  const previous = contract('draft');
  previous.status = 'superseded';
  const current = contract('draft');
  current.id = 'current-revision';
  current.version = 2;
  const result = matchEmailToContracts('alex@example.com', 'Re BRV-2026-0012', 'Please change the awning', [previous, current]);
  assert.equal(result.contract?.id, 'current-revision');
  assert.equal(result.ambiguous, false);
});

test('deterministic triage chooses revision before signing and addendum after signing', () => {
  assert.equal(deterministicContractEmailTriage('Change request', 'Please add an awning', contract('draft')).classification, 'pre_signature_change');
  assert.equal(deterministicContractEmailTriage('Change request', 'Please add an awning', contract('signed')).classification, 'post_signature_addendum');
  assert.equal(deterministicContractEmailTriage('Question', 'Could you confirm the delivery date?', contract('signed')).classification, 'price_or_delivery_question');
  assert.equal(deterministicContractEmailTriage('Hello', 'Thanks for your help', contract('signed')).classification, 'no_change');
});

test('structured extraction validation limits untrusted values and keeps owner confirmations required', () => {
  const extraction = validateContractChangeExtraction({
    classification: 'post_signature_addendum',
    confidence: 2,
    customerEmail: ' ALEX@EXAMPLE.COM ',
    mentionedContractNumber: 'BRV-2026-0012',
    mentionedProduct: 'Sunpatch 12C',
    requestedChanges: [{ action: 'add', item: 'Awning', requestedValue: 'Premium', sourceExcerpt: 'add the premium awning', needsPriceConfirmation: false, needsDeliveryConfirmation: false }],
    unresolvedQuestions: ['Confirm price'],
    ownerSummary: 'Customer requested an awning upgrade.',
  });
  assert.ok(extraction);
  assert.equal(extraction.confidence, 1);
  assert.equal(extraction.customerEmail, 'alex@example.com');
  assert.equal(extraction.requestedChanges[0].needsPriceConfirmation, true);
});

test('model routing prompt explains the cost boundary and alternatives', () => {
  const prompt = modelChangePrompt('triage', 'The email requests multiple specification changes.');
  assert.equal(prompt.currentModel, 'gpt-5.4-nano');
  assert.equal(prompt.recommendedModel, 'gpt-5.6-luna');
  assert.match(prompt.reason, /multiple specification changes/i);
  assert.ok(prompt.alternatives.length > 0);
});
