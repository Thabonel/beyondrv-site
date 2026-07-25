import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPROVED_SELLER,
  CONTRACT_TERMS_VERSION,
  calculateContractTotal,
  calculatePaymentStages,
  createContractRevision,
  diffContractVersions,
  normaliseContractInput,
  parseMoneyToCents,
  renderContractHtml,
  validateContract,
} from '../netlify/functions/contract-core.ts';
import {
  calculateAddendumPricing,
  calculateEffectiveDeal,
  normaliseAddendumInput,
  renderAddendumHtml,
  validateAddendum,
} from '../netlify/functions/contract-change-core.ts';
import {
  markPrepared,
  markSent,
  recordAcceptance,
  termsApprovedForCustomerUse,
  validateAcceptanceEvidence,
} from '../netlify/functions/agreement-acceptance-core.ts';

function validContractInput() {
  return {
    buyer: {
      name: 'Alex Buyer',
      email: 'alex@example.com',
      phone: '0400 000 000',
      address: '1 Test Road, Brisbane QLD 4000',
    },
    product: {
      slug: 'sunpatch-12c-couples-caravan',
      name: 'Sunpatch 12C Couples Off-Road Van',
      category: 'caravan',
      dimensions: '5550 x 2050 x 2750mm',
      weights: 'ATM 2420kg; GTM 2260kg; TARE 2000kg',
    },
    lineItems: [
      { id: 'base', description: 'Sunpatch 12C', quantity: 1, unitPriceCents: 39_999_00, kind: 'base' },
      { id: 'solar', description: 'Additional solar', quantity: 1, unitPriceCents: 500_00, kind: 'extra' },
      { id: 'discount', description: 'Owner-approved discount', quantity: 1, unitPriceCents: 499_00, kind: 'discount', reason: 'Agreed promotion' },
    ],
    specificationSections: [{ heading: 'Internal Features', items: ['Queen bed', 'Air conditioner'] }],
    deliveryNotes: 'Collection from Mutdapilly after final payment.',
  };
}

test('approved seller identity uses the master agreement company and new Mutdapilly address', () => {
  assert.equal(APPROVED_SELLER.legalName, 'Passion Industries Pty Ltd');
  assert.equal(APPROVED_SELLER.abn, '45 145 189 297');
  assert.equal(APPROVED_SELLER.address, '77 Coleyville Rd, Mutdapilly QLD 4307');
});

test('payment stages use 30 percent, 20 percent, and the exact remaining balance', () => {
  const stages = calculatePaymentStages(39_999_99);
  assert.deepEqual(stages.map(stage => stage.percentage), [30, 20, 50]);
  assert.equal(stages[0].trigger, 'On signing the contract');
  assert.equal(stages[1].trigger, 'When the camper arrives in Australia');
  assert.equal(stages[2].trigger, 'On taking delivery');
  assert.equal(stages.reduce((sum, stage) => sum + stage.amountCents, 0), 39_999_99);
});

test('contract totals include extras and subtract approved discounts', () => {
  const contract = normaliseContractInput(validContractInput());
  assert.equal(calculateContractTotal(contract.lineItems), 40_000_00);
});

test('money parser accepts Australian display values without floating point drift', () => {
  assert.equal(parseMoneyToCents('$39,999.95'), 3_999_995);
  assert.equal(parseMoneyToCents('not a price'), 0);
});

test('validation blocks missing buyer, product, price, and specifications', () => {
  const validation = validateContract(normaliseContractInput({}));
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /buyer’s legal name/i);
  assert.match(validation.errors.join(' '), /buyer email/i);
  assert.match(validation.errors.join(' '), /product/i);
  assert.match(validation.errors.join(' '), /price line item/i);
  assert.match(validation.errors.join(' '), /specification/i);
});

test('renderer includes the approved policy and escapes customer-provided HTML', () => {
  const input = validContractInput();
  input.buyer.name = '<script>alert(1)</script>';
  const contract = normaliseContractInput(input);
  const html = renderContractHtml(contract);
  assert.match(html, /Passion Industries Pty Ltd/);
  assert.match(html, /77 Coleyville Rd, Mutdapilly QLD 4307/);
  assert.match(html, /When the camper arrives in Australia/);
  assert.match(html, /On taking delivery/);
  assert.match(html, new RegExp(CONTRACT_TERMS_VERSION));
  assert.match(html, /by paying the Deposit after receiving the complete Agreement/i);
  assert.match(html, /Payment does not replace a signature where a signature is required by law/i);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('contract records default to the versioned manual acceptance workflow', () => {
  const contract = normaliseContractInput(validContractInput());
  assert.equal(contract.templateVersion, '12c-master-v2-manual-acceptance');
  assert.equal(contract.termsVersion, CONTRACT_TERMS_VERSION);
  assert.equal(contract.acceptance.status, 'not_prepared');
  assert.equal(contract.acceptance.method, '');
});

test('manual acceptance lifecycle preserves delivery and deposit evidence', () => {
  const contract = normaliseContractInput(validContractInput());
  const prepared = markPrepared(contract.acceptance, new Date('2026-07-23T00:00:00Z'));
  const sent = markSent(prepared, 'alex@example.com', new Date('2026-07-24T00:00:00Z'));
  const validation = validateAcceptanceEvidence({
    method: 'deposit_payment',
    acceptedByName: 'Alex Buyer',
    acceptedByEmail: 'alex@example.com',
    acceptedAt: '2026-07-25T01:00:00Z',
    evidenceReference: 'Gmail thread 123 / bank receipt 456',
    depositAmountCents: 12_000_00,
    depositReference: 'BRV-123',
  }, { expectedEmail: 'alex@example.com', depositDueCents: 12_000_00, allowDeposit: true });
  assert.equal(validation.valid, true);
  const accepted = recordAcceptance(sent, validation.evidence, new Date('2026-07-25T02:00:00Z'));
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.method, 'deposit_payment');
  assert.equal(accepted.depositAmountCents, 12_000_00);
  assert.equal(accepted.evidenceReference, 'Gmail thread 123 / bank receipt 456');
});

test('deposit evidence is rejected for an addendum and unapproved terms are gated', () => {
  const validation = validateAcceptanceEvidence({
    method: 'deposit_payment',
    acceptedByName: 'Alex Buyer',
    acceptedByEmail: 'alex@example.com',
    acceptedAt: '2026-07-25T01:00:00Z',
    evidenceReference: 'Receipt',
    depositAmountCents: 1_000_00,
    depositReference: 'DEP-1',
  }, { expectedEmail: 'alex@example.com', allowDeposit: false });
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /cannot be used/i);
  const previous = process.env.CONTRACT_TERMS_APPROVED_VERSION;
  delete process.env.CONTRACT_TERMS_APPROVED_VERSION;
  assert.equal(termsApprovedForCustomerUse(CONTRACT_TERMS_VERSION), false);
  process.env.CONTRACT_TERMS_APPROVED_VERSION = CONTRACT_TERMS_VERSION;
  assert.equal(termsApprovedForCustomerUse(CONTRACT_TERMS_VERSION), true);
  if (previous === undefined) delete process.env.CONTRACT_TERMS_APPROVED_VERSION;
  else process.env.CONTRACT_TERMS_APPROVED_VERSION = previous;
});

test('a pre-signature revision preserves the contract number and resets signature state', () => {
  const parent = normaliseContractInput(validContractInput());
  parent.status = 'approved';
  parent.signature.documentId = 'test-document';
  const revision = createContractRevision(parent, 2, 'Customer changed the selected extras', new Date('2026-07-23T00:00:00Z'));
  assert.equal(revision.contractNumber, parent.contractNumber);
  assert.equal(revision.version, 2);
  assert.equal(revision.parentContractId, parent.id);
  assert.equal(revision.revisionReason, 'Customer changed the selected extras');
  assert.equal(revision.status, 'draft');
  assert.equal(revision.acceptance.status, 'not_prepared');
  assert.equal(revision.signature.documentId, '');
  assert.equal(revision.documentSnapshot.sha256, '');
});

test('revision comparison records commercial differences', () => {
  const previous = normaliseContractInput(validContractInput());
  const revised = createContractRevision(previous, 2, 'Price change');
  revised.lineItems[1].unitPriceCents += 250_00;
  const comparison = diffContractVersions(previous, revised);
  assert.equal(comparison.changes.some(change => change.field === 'Pricing'), true);
  assert.equal(comparison.priceDeltaCents, 250_00);
});

test('addendum pricing normalises additions and removals and updates effective signed deal state', () => {
  const base = normaliseContractInput(validContractInput());
  base.status = 'signed';
  const addendum = normaliseAddendumInput({
    sourceType: 'phone', requestNote: 'Swap appliance and add awning upgrade', paymentImpact: 'Added to final payment', deliveryImpact: 'No change',
    changes: [
      { action: 'add', item: 'Awning upgrade', revisedValue: 'Premium awning', priceDeltaCents: 800_00, ownerConfirmed: true },
      { action: 'remove', item: 'Standard appliance', revisedValue: 'Removed', priceDeltaCents: 300_00, ownerConfirmed: true },
    ],
  }, base, calculateContractTotal(base.lineItems), 1);
  assert.deepEqual(calculateAddendumPricing(addendum.previousTotalCents, addendum.changes), {
    previousTotalCents: 40_000_00, addedCostCents: 800_00, removedCostCents: 300_00, netChangeCents: 500_00, revisedTotalCents: 40_500_00,
  });
  assert.equal(validateAddendum(addendum, base).valid, true);
  assert.equal(calculateEffectiveDeal(base, [addendum]).effectiveTotalCents, 40_000_00);
  addendum.status = 'signed';
  assert.equal(calculateEffectiveDeal(base, [addendum]).effectiveTotalCents, 40_500_00);
});

test('addendum approval validation requires explicit owner, payment, and delivery confirmations', () => {
  const base = normaliseContractInput(validContractInput());
  base.status = 'signed';
  const addendum = normaliseAddendumInput({ requestNote: 'Change colour', changes: [{ action: 'replace', item: 'Colour', revisedValue: 'Blue' }] }, base, calculateContractTotal(base.lineItems), 1);
  const validation = validateAddendum(addendum, base);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /confirm the change/i);
  assert.match(validation.errors.join(' '), /payment impact/i);
  assert.match(validation.errors.join(' '), /delivery impact/i);
});

test('addendum renderer links the signed contract and escapes owner-entered content', () => {
  const base = normaliseContractInput(validContractInput());
  base.status = 'signed';
  const addendum = normaliseAddendumInput({
    requestNote: '<script>unsafe</script>', paymentImpact: 'No change', deliveryImpact: 'No change',
    changes: [{ action: 'clarify', item: 'Upholstery', revisedValue: 'Charcoal', ownerConfirmed: true }],
  }, base, calculateContractTotal(base.lineItems), 1);
  const html = renderAddendumHtml(addendum, base);
  assert.match(html, new RegExp(base.contractNumber));
  assert.match(html, /Continuing terms/);
  assert.doesNotMatch(html, /<script>unsafe/);
  assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
});

test('new addenda use manual acceptance and do not treat payment as the default acceptance method', () => {
  const base = normaliseContractInput(validContractInput());
  base.status = 'signed';
  const addendum = normaliseAddendumInput({
    requestNote: 'Add accessory', paymentImpact: 'Added to delivery balance', deliveryImpact: 'No change',
    changes: [{ action: 'add', item: 'Accessory', revisedValue: 'Included', priceDeltaCents: 250_00, ownerConfirmed: true }],
  }, base, calculateContractTotal(base.lineItems), 1);
  assert.equal(addendum.acceptance.status, 'not_prepared');
  assert.equal(addendum.acceptance.method, '');
  assert.match(renderAddendumHtml(addendum, base), /Payment alone is not used to accept an addendum/i);
});
