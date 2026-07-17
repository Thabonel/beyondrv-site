import { expect, test } from '@playwright/test';

test('recent builds refreshes products before using a product hero image', async ({ page }) => {
  let productRequests = 0;

  await page.route('**/.netlify/functions/admin-products', route => {
    productRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        products: [{
          slug: 'test-product',
          title: 'Current Test Product',
          price: '$75,000',
          status: 'available',
          category: 'slide-on',
          tagline: 'Test product for Recent Builds.',
          heroImage: productRequests === 1 ? '/old-hero.webp' : '/current-hero.webp',
          gallery: ['/gallery-1.webp'],
          galleryCount: 1,
        }],
      }),
    });
  });

  await page.goto('/admin/');
  await expect.poll(() => productRequests).toBeGreaterThanOrEqual(1);
  const initialProductRequests = productRequests;
  await page.getByRole('button', { name: /Menu Dashboard/i }).click();
  await page.getByRole('button', { name: /^Homepage$/i }).click();

  await expect(page.getByText('Product images are current. Select a product below.')).toBeVisible();
  await expect.poll(() => productRequests).toBeGreaterThan(initialProductRequests);

  const buildCards = page.locator('[data-recent-build-id]');
  await expect(buildCards).toHaveCount(3);
  const buildCard = buildCards.first();
  await buildCard.locator('[data-recent-build-product]').selectOption('test-product');

  await expect(buildCard.locator('[data-recent-build-image]')).toHaveValue('/current-hero.webp');
});
