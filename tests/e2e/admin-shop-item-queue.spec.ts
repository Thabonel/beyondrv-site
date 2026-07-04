import { expect, test } from '@playwright/test';

test('shop item queue button shows validation and queues a draft card', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-products', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ products: [] }),
  }));
  await page.route('**/.netlify/functions/admin-orders', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] }),
  }));
  await page.route('**/.netlify/functions/admin-chat', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      text: 'Queued shop item.',
      pendingChanges: [{
        path: 'src/content/products/accessories/test-shop-widget.md',
        content: '---\ntitle: Test Shop Widget\nstore: true\n---\nTest body\n',
        description: 'Create Test Shop Widget shop item',
        proposal_id: 'test-proposal',
        judgeDecision: 'allow',
        risk_flags: [],
      }],
    }),
  }));

  await page.goto('/admin/');
  await page.getByRole('button', { name: /Menu Dashboard/i }).click();
  await page.getByRole('button', { name: /^Shop$/i }).click();
  await page.getByRole('button', { name: 'Add Shop Item' }).click();

  await page.getByRole('button', { name: 'Queue Shop Item' }).click();
  await expect(page.getByText('The new product form needs:')).toBeVisible();
  await expect(page.getByText('packed weight')).toHaveCount(0);

  await page.getByPlaceholder('Shop item title').fill('Test Shop Widget');
  await page.getByPlaceholder('Shop category, e.g. Air Systems').fill('Accessories');
  await page.getByPlaceholder('$72,000').fill('$99');
  await page.getByPlaceholder('Short shop description').fill('Small test accessory');
  await page.getByPlaceholder('Item description').fill('A compact accessory used to verify queue behavior.');
  await page.getByPlaceholder('Add image URL or path').fill('/images/products/test-widget.jpg');
  await page.getByRole('button', { name: 'Add' }).click();

  await page.getByRole('button', { name: 'Queue Shop Item' }).click();

  await expect(page.getByText('Shop Manager')).toBeVisible();
  await expect(page.getByText('Test Shop Widget', { exact: true })).toBeVisible();
  await expect(page.getByText('Create Test Shop Widget shop item')).toBeVisible();
  await page.getByRole('button', { name: /Menu Shop/i }).click();
  await expect(page.getByRole('button', { name: 'Pending (1)' })).toBeVisible();
});
