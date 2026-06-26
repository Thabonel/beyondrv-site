import { expect, test } from '@playwright/test';

const SHIP_PRODUCT_PAGE = '/shop/twin-air-compressor-shield/';
const INSTALL_PRODUCT_PAGE = '/shop/additional-200w-solar-panel/';
const INSTALL_PRODUCT_SLUG = 'additional-200w-solar-panel';
const SERVICE_PRODUCT_PAGE = '/shop/starlink-mini-supply-and-install/';

test.describe('shop fulfilment behaviour', () => {
  test('a shippable product can be added and reaches an eligible checkout', async ({ page }) => {
    await page.goto(SHIP_PRODUCT_PAGE);

    const addButton = page.locator('[data-add-to-cart]');
    await expect(addButton).toBeEnabled();
    await expect(page.locator('.shop-fulfilment-note')).toContainText('Shipping available');
    await addButton.click();
    await expect(page.locator('[data-cart-count]')).toHaveText('1');

    await page.goto('/cart/');
    await expect(page.locator('.cart-row')).toHaveCount(1);
    await expect(page.locator('.cart-row-name')).toHaveText('Twin Air Compressor Shield');
    await expect(page.locator('.cart-row-fulfilment')).toContainText('Shipping available');
    await expect(page.locator('[data-cart-subtotal]')).toHaveText('$188.00');
    await expect(page.getByRole('button', { name: 'Proceed to checkout' })).toBeVisible();
    await expect(page.locator('[data-cart-blocked]')).toHaveCount(0);
    await expect(page.locator('[data-shipping-postcode]')).toBeVisible();
  });

  test('quantity can be increased and decreased, updating the subtotal', async ({ page }) => {
    await page.goto(SHIP_PRODUCT_PAGE);
    await page.locator('[data-add-to-cart]').click();
    await page.goto('/cart/');

    await page.locator('[data-cart-inc]').click();
    await expect(page.locator('[data-cart-qty]')).toHaveText('2');
    await expect(page.locator('[data-cart-subtotal]')).toHaveText('$376.00');

    await page.locator('[data-cart-dec]').click();
    await expect(page.locator('[data-cart-qty]')).toHaveText('1');
    await expect(page.locator('[data-cart-subtotal]')).toHaveText('$188.00');
  });

  test('an install-only product has no add to cart, only an enquiry CTA', async ({ page }) => {
    await page.goto(INSTALL_PRODUCT_PAGE);

    await expect(page.locator('[data-add-to-cart]')).toHaveCount(0);
    await expect(page.locator('.shop-fulfilment-note')).toContainText('requires installation by the ByondRV team');
    await expect(page.getByRole('link', { name: 'Ask about availability' })).toBeVisible();
  });

  test('service products have no add to cart, only an enquiry CTA', async ({ page }) => {
    await page.goto(SERVICE_PRODUCT_PAGE);

    await expect(page.locator('[data-add-to-cart]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ask about availability' })).toBeVisible();
  });

  test('an empty cart shows the empty state', async ({ page }) => {
    await page.goto('/cart/');
    await expect(page.locator('.cart-empty')).toBeVisible();
    await expect(page.locator('.cart-row')).toHaveCount(0);
  });

  test('a cart holding a non-eligible item shows its fulfilment notice and blocks checkout', async ({ page }) => {
    await page.addInitScript((slug) => {
      window.localStorage.setItem('byondrv-cart', JSON.stringify([{ slug, quantity: 1 }]));
    }, INSTALL_PRODUCT_SLUG);

    await page.goto('/cart/');

    await expect(page.locator('.cart-row')).toHaveCount(1);
    await expect(page.locator('.cart-row-fulfilment')).toContainText('requires installation by the ByondRV team');
    await expect(page.locator('[data-cart-blocked]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proceed to checkout' })).toHaveCount(0);
    await expect(page.locator('[data-shipping-postcode]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Enquire about these items' })).toBeVisible();
  });
});
