import { expect, test } from '@playwright/test';

test('the homepage and navigation name the vehicle tools plainly', async ({ page }) => {
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
  if (await menuButton.isVisible()) await menuButton.click();

  await expect(page.getByRole('link', { name: 'Vehicle Check', exact: true })).toHaveAttribute('href', '/vehicle-suitability-checker/');
  await expect(page.getByRole('link', { name: 'Slide-on Weight Calculator', exact: true })).toHaveAttribute('href', '/slide-on-camper-weight-calculator/');
  await expect(page.getByRole('link', { name: 'Caravan Towing Calculator', exact: true })).toHaveAttribute('href', '/caravan-towing-calculator/');
});

test('a slide-on product links directly to the payload calculator', async ({ page }) => {
  await page.goto('/advent-2150-hardtop-slide-on/');

  await expect(page.getByRole('link', { name: 'Check Ute Fit & Payload', exact: true }).first())
    .toHaveAttribute('href', '/slide-on-camper-weight-calculator/');
});

test('the calculator exposes its first input in the initial desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/slide-on-camper-weight-calculator/');

  const firstInput = page.locator('#finderTrayLength');
  await expect(firstInput).toBeVisible();
  const box = await firstInput.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
});

test('calculator purpose and FAQ are available in static page metadata', async ({ page }) => {
  await page.goto('/slide-on-camper-weight-calculator/');

  await expect(page).toHaveTitle('Slide-On Camper Weight Calculator | Beyond RV');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /payload, GVM margin and tray size/i);
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = schemas.flatMap((raw) => {
    const parsed = JSON.parse(raw) as Record<string, unknown> | Record<string, unknown>[];
    return (Array.isArray(parsed) ? parsed : [parsed]).map((entry) => entry['@type']);
  });
  expect(types).toContain('WebPage');
  expect(types).toContain('FAQPage');
});
