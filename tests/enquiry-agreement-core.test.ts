import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgreementInputFromEnquiry, findTrustedEnquiryProduct } from '../netlify/functions/enquiry-agreement-core.ts';
import { normaliseContractInput, renderContractHtml } from '../netlify/functions/contract-core.ts';

const products = [
  { slug: '3-5m-electric-poptop-cabover-family-camper', title: '3.5m Electric Pop-Top Cabover Family Camper', category: 'Expedition', price: 'From $140,000' },
  { slug: '4-7m-hardtop-truck-camper', title: '4.7m Hardtop Truck Camper', category: 'Expedition', price: 'From $98,000' },
];

test('website enquiry conversion safely prefills an exact product and keeps the message non-contractual', () => {
  const input = buildAgreementInputFromEnquiry({
    id: 'enquiry-1',
    name: 'Alex Smith',
    email: 'ALEX@EXAMPLE.COM',
    phone: '0400 000 002',
    product_interest: '3.5m Electric Pop-Top Cabover Family Camper',
    message: 'We discussed a larger battery and delivery before Christmas.',
    submittedAt: '2026-08-08T04:00:00.000Z',
  }, products, new Date('2026-08-09T02:00:00.000Z'));

  assert.equal(input.buyer.name, 'Alex Smith');
  assert.equal(input.buyer.email, 'alex@example.com');
  assert.equal(input.product.slug, '3-5m-electric-poptop-cabover-family-camper');
  assert.equal(input.lineItems[0].unitPriceCents, 14_000_000);
  assert.equal(input.specificationSections.length, 0);
  assert.equal(input.deliveryNotes, '');
  assert.equal(input.salesContext.enquiryMessage, 'We discussed a larger battery and delivery before Christmas.');
  assert.equal(JSON.stringify(input.lineItems).includes('larger battery'), false);
  const contract = normaliseContractInput(input);
  assert.equal(contract.salesContext?.enquiryMessage, 'We discussed a larger battery and delivery before Christmas.');
  assert.equal(renderContractHtml(contract).includes('larger battery'), false);
});

test('ambiguous product wording is not promoted into contractual pricing', () => {
  const ambiguousProducts = [
    { slug: 'family-camper-a', title: 'Family Camper Alpha', price: '$100,000' },
    { slug: 'family-camper-b', title: 'Family Camper Bravo', price: '$120,000' },
  ];
  const enquiry = {
    id: 'enquiry-2',
    name: 'Sam Buyer',
    product_interest: 'Family Camper',
    message: 'Please call me.',
    submittedAt: '2026-08-08T04:00:00.000Z',
  };

  assert.equal(findTrustedEnquiryProduct(enquiry, ambiguousProducts), null);
  const input = buildAgreementInputFromEnquiry(enquiry, ambiguousProducts);
  assert.equal(input.product.slug, '');
  assert.deepEqual(input.lineItems, []);
  assert.equal(input.salesContext.statedProductInterest, 'Family Camper');
});
