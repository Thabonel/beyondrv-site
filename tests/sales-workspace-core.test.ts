import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSalesWorkspaceProjection } from '../netlify/functions/sales-workspace-core.ts';

test('sales workspace ranks ready commercial work by priority then deal value', () => {
  const workspace = buildSalesWorkspaceProjection({
    now: new Date('2026-08-09T02:00:00.000Z'),
    products: [
      { slug: 'camper-a', title: 'Camper A', price: '$72,000' },
      { slug: 'camper-b', title: 'Camper B', price: '$140,000' },
    ],
    enquiries: [
      {
        id: 'enquiry-a',
        submittedAt: '2026-08-01T00:00:00.000Z',
        name: 'Lower Value',
        phone: '0400 000 001',
        product_interest: 'Camper A',
        leadStatus: { enquiryId: 'enquiry-a', status: 'follow-up-scheduled', nextFollowUpDate: '2026-08-08', updatedAt: '2026-08-01T00:00:00.000Z' },
      },
      {
        id: 'enquiry-b',
        submittedAt: '2026-08-02T00:00:00.000Z',
        name: 'Higher Value',
        phone: '0400 000 002',
        product_interest: 'Camper B',
        leadStatus: { enquiryId: 'enquiry-b', status: 'follow-up-scheduled', nextFollowUpDate: '2026-08-08', updatedAt: '2026-08-02T00:00:00.000Z' },
      },
    ],
    agreements: [{
      id: 'agreement-a',
      contractNumber: 'BRV-001',
      status: 'approved',
      buyer: { name: 'Agreement Buyer', phone: '0400 000 003' },
      product: { name: 'Camper A' },
      lineItems: [{ quantity: 1, unitPriceCents: 72_000_00, kind: 'base' }],
      acceptance: { status: 'not_prepared' },
      updatedAt: '2026-08-07T00:00:00.000Z',
    }],
    orders: [],
  });

  assert.equal(workspace.actions[0].type, 'agreement');
  assert.equal(workspace.actions[1].customerName, 'Higher Value');
  assert.equal(workspace.actions[2].customerName, 'Lower Value');
  assert.equal(workspace.summary.peopleWaiting, 2);
  assert.equal(workspace.summary.agreementsToFinish, 1);
  assert.equal(workspace.summary.pipelineValueCents, 28_400_000);
});

test('sales workspace merges exact customer contact details across enquiry, agreement, and build', () => {
  const workspace = buildSalesWorkspaceProjection({
    now: new Date('2026-08-09T02:00:00.000Z'),
    products: [],
    enquiries: [{
      id: 'enquiry-a',
      submittedAt: '2026-08-01T00:00:00.000Z',
      name: 'Shane',
      email: 'SHANE@example.com',
      phone: '0400 000 001',
      product_interest: 'Slide-on',
    }],
    agreements: [{
      id: 'agreement-a',
      sourceEnquiryId: 'enquiry-a',
      customerId: 'customer-a',
      buyer: { name: 'Shane Dobie', email: 'shane@example.com', phone: '+61 400 000 001' },
      product: { name: 'Slide-on' },
      status: 'signed',
      acceptance: { status: 'accepted' },
      updatedAt: '2026-08-05T00:00:00.000Z',
    }],
    orders: [{
      id: 'build-a',
      sourceEnquiryId: 'enquiry-a',
      customerName: 'Shane Dobie',
      customerEmail: 'shane@example.com',
      customerPhone: '0400 000 001',
      productTitle: 'Slide-on',
      status: 'in_china_production',
      depositPaid: true,
      updatedAt: '2026-08-08T00:00:00.000Z',
    }],
  });

  assert.equal(workspace.customers.length, 1);
  assert.deepEqual(workspace.customers[0].agreementIds, ['agreement-a']);
  assert.deepEqual(workspace.customers[0].buildIds, ['build-a']);
  assert.equal(workspace.customers[0].stage, 'build');
});

test('closed enquiries and completed builds do not create Today actions', () => {
  const workspace = buildSalesWorkspaceProjection({
    now: new Date('2026-08-09T02:00:00.000Z'),
    products: [],
    enquiries: [{
      id: 'lost',
      submittedAt: '2026-07-01T00:00:00.000Z',
      name: 'Lost Lead',
      leadStatus: { enquiryId: 'lost', status: 'lost', nextFollowUpDate: '2026-08-01' },
    }],
    agreements: [],
    orders: [{ id: 'delivered', customerName: 'Done', productTitle: 'Camper', status: 'delivered' }],
  });

  assert.equal(workspace.actions.length, 0);
  assert.equal(workspace.builds.length, 0);
});

test('an enquiry with an active agreement produces one agreement action, not a duplicate enquiry action', () => {
  const workspace = buildSalesWorkspaceProjection({
    now: new Date('2026-08-09T02:00:00.000Z'),
    products: [{ slug: 'camper', title: 'Camper', price: '$72,000' }],
    enquiries: [{
      id: 'enquiry-linked',
      submittedAt: '2026-08-01T00:00:00.000Z',
      name: 'Linked Buyer',
      product_interest: 'Camper',
      leadStatus: { enquiryId: 'enquiry-linked', status: 'new', updatedAt: '2026-08-01T00:00:00.000Z' },
    }],
    agreements: [{
      id: 'agreement-linked',
      sourceEnquiryId: 'enquiry-linked',
      status: 'draft',
      buyer: { name: 'Linked Buyer' },
      product: { name: 'Camper' },
      lineItems: [{ quantity: 1, unitPriceCents: 7_200_000, kind: 'base' }],
      updatedAt: '2026-08-08T00:00:00.000Z',
    }],
    orders: [],
  });

  assert.deepEqual(workspace.actions.map(action => action.type), ['agreement']);
  assert.equal(workspace.actions[0].agreementId, 'agreement-linked');
  assert.equal(workspace.actions[0].canCreateAgreement, false);
  assert.equal(workspace.summary.peopleWaiting, 0);
  assert.equal(workspace.summary.pipelineValueCents, 7_200_000);
});
