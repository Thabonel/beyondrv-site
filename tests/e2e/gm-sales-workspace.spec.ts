import { expect, test } from '@playwright/test';

const workspace = {
  generatedAt: '2026-08-09T02:00:00.000Z',
  summary: { peopleWaiting: 2, pipelineValueCents: 212_000_00, agreementsToFinish: 1, activeBuilds: 1 },
  actions: [
    {
      id: 'agreement:agreement-1', type: 'agreement', recordId: 'agreement-1', title: 'Prepare final agreement',
      customerName: 'Shane Dobie', phone: '0400 000 001', productName: '4.7m Hardtop Truck Camper',
      reason: 'Commercial details are approved and ready for the final copy.', dueDate: '', daysStale: 2,
      estimatedValueCents: 98_000_00, agreementId: 'agreement-1', canCreateAgreement: false,
    },
    {
      id: 'enquiry:enquiry-1', type: 'enquiry', recordId: 'enquiry-1', title: 'Follow up customer',
      customerName: 'Alex Smith', phone: '0400 000 002', productName: '3.5m Family Camper',
      reason: 'Contact the customer and offer a practical next step.', dueDate: '2026-08-08', daysStale: 4,
      estimatedValueCents: 140_000_00, agreementId: '', canCreateAgreement: true,
    },
  ],
  customers: [
    {
      id: 'customer-1', name: 'Shane Dobie', email: 'shane@example.com', phone: '0400 000 001',
      productInterest: '4.7m Hardtop Truck Camper', sourceEnquiryId: 'enquiry-2', agreementIds: ['agreement-1'],
      buildIds: ['build-1'], lastActivityAt: '2026-08-08T00:00:00.000Z', stage: 'build',
    },
  ],
  agreements: [
    {
      id: 'agreement-1', contractNumber: 'BRV-001', customerName: 'Shane Dobie', customerPhone: '0400 000 001',
      productName: '4.7m Hardtop Truck Camper', status: 'approved', acceptanceStatus: 'not_prepared',
      totalCents: 98_000_00, updatedAt: '2026-08-07T00:00:00.000Z',
    },
  ],
  builds: [
    {
      id: 'build-1', customerName: 'Shane Dobie', customerPhone: '0400 000 001', productName: '4.7m Hardtop Truck Camper',
      status: 'in_china_production', depositVerified: true, amountPaidCents: 29_400_00, nextActionDate: '2026-08-12',
      expectedArrivalDate: '2026-12-01', expectedHandoverDate: '2027-01-15', updatedAt: '2026-08-08T00:00:00.000Z',
    },
  ],
  products: [
    { slug: 'hardtop-47', title: '4.7m Hardtop Truck Camper', category: 'Expedition', price: '$98,000' },
    { slug: 'family-35', title: '3.5m Family Camper', category: 'Expedition', price: '$140,000' },
  ],
  leads: [{ id: 'enquiry-2', productInterest: '4.7m Hardtop Truck Camper' }],
};

const convertedContract = {
  id: 'agreement-enquiry-1', contractNumber: 'BRV-20260808-ABC123', version: 1,
  templateVersion: '12c-master-v2-manual-acceptance', termsVersion: '2026-08-09-v1-business-approved', status: 'draft',
  customerId: '', leadId: 'enquiry-1', buyer: { name: 'Alex Smith', organisation: '', address: '', phone: '0400 000 002', email: 'alex@example.com' },
  product: { slug: 'family-35', name: '3.5m Family Camper', category: 'Expedition', buildIdentifier: '', dimensions: '', weights: '' },
  lineItems: [{ id: 'base', description: '3.5m Family Camper', quantity: 1, unitPriceCents: 140_000_00, kind: 'base' }],
  specificationSections: [], exclusions: [], deliveryNotes: '', validityDate: '',
  salesContext: {
    source: 'website_enquiry', sourceReference: 'enquiry-1', statedProductInterest: '3.5m Family Camper',
    enquiryMessage: 'Please include the solar upgrade we discussed.', submittedAt: '2026-08-08T04:00:00.000Z', capturedAt: '2026-08-09T02:00:00.000Z',
  },
  acceptance: { status: 'not_prepared' }, createdAt: '2026-08-09T02:00:00.000Z', updatedAt: '2026-08-09T02:00:00.000Z',
};

test.use({ viewport: { width: 320, height: 568 } });

test.beforeEach(async ({ page }) => {
  await page.route('**/.netlify/functions/admin-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      actor: { id: 'gm', displayName: 'Workshop GM', role: 'gm', legacy: false },
      capabilities: ['sales:read', 'sales:write', 'agreements:read', 'agreements:write'],
    }),
  }));
  await page.route('**/.netlify/functions/admin-sales-workspace', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ workspace }),
  }));
});

test('GM lands on a focused mobile Today queue with usable touch targets', async ({ page }) => {
  await page.goto('/admin/');

  await expect(page.getByTestId('gm-sales-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByText('People waiting')).toBeVisible();
  await expect(page.getByText('$212,000')).toBeVisible();
  await expect(page.getByText('Admin Tools')).toHaveCount(0);

  const actions = page.locator('[data-testid^="gm-action-"]');
  await expect(actions).toHaveCount(2);
  await expect(actions.first()).toContainText('Prepare final agreement');
  await expect(actions.first().getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:0400 000 001');

  const mobileNavigation = page.getByRole('navigation', { name: 'Sales workspace mobile' });
  await expect(mobileNavigation).toBeVisible();
  for (const label of ['Today', 'Customers', 'Agreements', 'Builds']) {
    const target = mobileNavigation.getByRole('button', { name: label });
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
  }

  await mobileNavigation.getByRole('button', { name: 'Customers' }).click();
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search customers' }).fill('Shane');
  await expect(page.getByText('shane@example.com')).toBeVisible();

  await mobileNavigation.getByRole('button', { name: 'Builds' }).click();
  await expect(page.getByTestId('gm-build-build-1')).toContainText('In China Production');
  await expect(page.getByTestId('gm-build-build-1')).toContainText('Deposit: verified');
});

test('GM converts a website enquiry once and lands in the editable draft with non-contractual context', async ({ page }) => {
  let conversionRequests = 0;
  await page.route('**/.netlify/functions/admin-enquiry-agreement', async route => {
    conversionRequests += 1;
    expect(route.request().postDataJSON()).toEqual({ enquiryId: 'enquiry-1' });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, created: true, contract: convertedContract }),
    });
  });
  await page.route('**/.netlify/functions/admin-contracts', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ contracts: [convertedContract] }),
  }));

  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Create agreement' }).click();

  await expect(page.getByRole('heading', { name: 'Agreements' })).toBeVisible();
  await expect(page.getByTestId('website-enquiry-context')).toContainText('not yet contractual');
  await expect(page.getByTestId('website-enquiry-context')).toContainText('Please include the solar upgrade we discussed.');
  await expect(page.getByPlaceholder('Legal name *')).toHaveValue('Alex Smith');
  expect(conversionRequests).toBe(1);
});
