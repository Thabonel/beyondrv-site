import { expect, test } from '@playwright/test';

test('setting a gallery photo as hero preserves the previous hero in that gallery position', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-products', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      products: [{
        slug: 'test-slide-on',
        title: 'Test Slide-On',
        price: '$75,000',
        status: 'available',
        category: 'slide-on',
        tagline: 'Test product for the hero image editor.',
        heroImage: '/hero-old.webp',
        gallery: ['/gallery-1.webp', '/gallery-2.webp', '/gallery-3.webp'],
        galleryCount: 3,
      }],
    }),
  }));
  await page.route('**/.netlify/functions/admin-orders', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] }),
  }));

  await page.goto('/admin/');
  await page.getByRole('button', { name: /Menu Dashboard/i }).click();
  await page.getByRole('button', { name: /^Products$/i }).click();
  await expect(page.getByText('Test Slide-On', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();

  await page.locator('[data-gallery-image="/gallery-2.webp"] [data-set-hero]').click();

  await expect(page.getByPlaceholder('Hero image URL or path')).toHaveValue('/gallery-2.webp');
  await expect(page.locator('[data-gallery-image="/gallery-2.webp"]')).toHaveCount(0);
  await expect(page.locator('[data-gallery-image="/hero-old.webp"]')).toHaveAttribute('data-gallery-position', '2');
  await expect(page.locator('[data-gallery-image]')).toHaveCount(3);
});
