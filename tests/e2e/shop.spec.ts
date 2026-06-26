import { expect, test } from '@playwright/test';

test.describe('shop catalogue', () => {
  test('search filters products and reports the result count', async ({ page }) => {
    await page.goto('/shop/');

    const catalogueCards = page.locator('[data-catalogue-grid] [data-shop-product]');
    await expect(catalogueCards).toHaveCount(1);
    await expect(page.locator('.shop-featured')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Buy now' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View details' })).toBeVisible();

    await page.getByLabel('Search products').fill('Twin');
    await expect(page.locator('#shopResultCount')).toHaveText('1 product');
    await expect(page.locator('[data-catalogue-grid] [data-shop-product]:visible')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Twin Air Compressor Shield' }).last()).toBeVisible();
  });

  test('category selection filters the catalogue', async ({ page }) => {
    await page.goto('/shop/');
    await page.getByLabel('Category').selectOption({ label: 'Air Systems' });

    await expect(page.locator('#shopResultCount')).toHaveText('1 product');
    await expect(page.locator('[data-catalogue-grid] [data-shop-product]:visible')).toHaveCount(1);
  });

  test('product detail exposes indexable product metadata', async ({ page }) => {
    await page.goto('/shop/twin-air-compressor-shield/');

    await expect(page.getByRole('heading', { level: 1, name: 'Twin Air Compressor Shield' })).toBeVisible();
    await expect(page.locator('.shop-detail-price')).toHaveText('$188.00');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://beyondrv.com.au/shop/twin-air-compressor-shield/');
    const productSchema = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(productSchema).toContain('"@type":"Product"');
  });
});
