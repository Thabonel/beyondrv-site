import { expect, test } from '@playwright/test';

test('shop item queue button shows validation and queues a draft card', async ({ page }) => {
  let queuedPrompt = '';

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
    body: (() => {
      const postData = route.request().postDataJSON() as { messages?: { content?: string }[] };
      queuedPrompt = postData.messages?.at(-1)?.content ?? '';
      return JSON.stringify({
        text: 'Queued shop item.',
        pendingChanges: [{
          path: 'src/content/products/accessories/fibreglass-sheet.md',
          content: '---\ntitle: Fibreglass Sheet\nstore: true\n---\nTest body\n',
          description: 'Create Fibreglass Sheet shop item',
          proposal_id: 'test-proposal',
          judgeDecision: 'allow',
          risk_flags: [],
        }],
      });
    })(),
  }));

  await page.goto('/admin/');
  await page.getByRole('button', { name: /Menu Dashboard/i }).click();
  await page.getByRole('button', { name: /^Shop$/i }).click();
  await page.getByRole('button', { name: 'Add Shop Item' }).click();

  await page.getByRole('button', { name: 'Queue Shop Item' }).click();
  await expect(page.getByText('The new product form needs:')).toBeVisible();
  await expect(page.getByText('packed weight')).toHaveCount(0);

  await page.getByPlaceholder('Shop item title').fill('Fibreglass Sheet');
  await page.getByPlaceholder('Shop category, e.g. Air Systems').fill('Accessories');
  await page.getByPlaceholder('$72,000').fill('$99');
  await page.getByPlaceholder('Short shop description').fill('Small test accessory');
  await page.getByPlaceholder('W cm', { exact: true }).fill('120');
  await page.getByPlaceholder('Item description').fill('A fibreglass sheet with only a known width.');
  await page.getByPlaceholder('Add image URL or path').fill('/images/products/test-widget.jpg');
  await page.getByRole('button', { name: 'Add' }).click();

  await page.getByRole('button', { name: 'Queue Shop Item' }).click();

  await expect(page.getByText('Shop Manager')).toBeVisible();
  await expect(page.getByText('Fibreglass Sheet', { exact: true })).toBeVisible();
  await expect(page.getByText('Create Fibreglass Sheet shop item')).toBeVisible();
  await expect.poll(() => queuedPrompt).toContain('Actual item dimensions cm, before packaging: width 120 cm');
  await expect.poll(() => queuedPrompt).toContain('do not invent missing length, width, or height');
  await page.getByRole('button', { name: /Menu Shop/i }).click();
  await expect(page.getByRole('button', { name: 'Pending (1)' })).toBeVisible();
});
