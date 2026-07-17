import { expect, test } from '@playwright/test';

test('admin chat message box grows as a multiline message is entered', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-products', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ products: [] }),
  }));

  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Chat' }).click();

  const messageBox = page.getByTestId('admin-chat-input');
  const initialHeight = await messageBox.evaluate(element => element.getBoundingClientRect().height);
  const message = [
    'Replace the oldest recent build with the Advent 2450.',
    'Use the current product hero image and product link.',
    'Keep the other two builds unchanged.',
    'Preserve the current order and visibility settings.',
    'Queue the change for review before deployment.',
  ].join('\n');

  await messageBox.fill(message);

  await expect(messageBox).toHaveValue(message);
  await expect.poll(async () => messageBox.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(initialHeight);
});
