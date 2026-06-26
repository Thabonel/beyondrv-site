import { expect, test } from '@playwright/test';

test.describe('shop catalogue', () => {
  test('search filters products and reports the result count', async ({ page }) => {
    await page.goto('/shop/');

    const catalogueCards = page.locator('[data-catalogue-grid] [data-shop-product]');
    await expect(catalogueCards).toHaveCount(4);

    await page.getByLabel('Search products').fill('Starlink');
    await expect(page.locator('#shopResultCount')).toHaveText('1 product');
    await expect(page.locator('[data-catalogue-grid] [data-shop-product]:visible')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Starlink Mini Supply and Installation' }).last()).toBeVisible();
  });

  test('category selection filters the catalogue', async ({ page }) => {
    await page.goto('/shop/');
    await page.getByLabel('Category').selectOption({ label: 'Connectivity' });

    await expect(page.locator('#shopResultCount')).toHaveText('1 product');
    await expect(page.locator('[data-catalogue-grid] [data-shop-product]:visible')).toHaveCount(1);
  });

  test('product detail exposes indexable product metadata', async ({ page }) => {
    await page.goto('/shop/additional-200w-solar-panel/');

    await expect(page.getByRole('heading', { level: 1, name: 'Additional 200W Solar Panel' })).toBeVisible();
    await expect(page.locator('.shop-detail-price')).toHaveText('$500.00');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://beyondrv.com.au/shop/additional-200w-solar-panel/');
    const productSchema = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(productSchema).toContain('"@type":"Product"');
  });
});
