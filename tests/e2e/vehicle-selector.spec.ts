import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/slide-on-camper-weight-calculator/');
});

test('picking a vehicle fills the published figures', async ({ page }) => {
  await page.selectOption('#vehicleMake', 'Mazda');
  await page.selectOption('#vehicleModel', 'BT-50');
  const variant = page.locator('#vehicleVariant option').nth(1);
  await page.selectOption('#vehicleVariant', await variant.getAttribute('value') ?? '');

  await expect(page.locator('#gvm')).not.toHaveValue('');
  await expect(page.locator('#currentWeight')).not.toHaveValue('');
  await expect(page.locator('#vehicleProvenance')).toContainText('Published by Mazda Australia');
});

test('a figure the customer typed survives re-picking a vehicle', async ({ page }) => {
  await page.selectOption('#vehicleMake', 'Mazda');
  await page.selectOption('#vehicleModel', 'BT-50');
  const options = page.locator('#vehicleVariant option');
  await page.selectOption('#vehicleVariant', await options.nth(1).getAttribute('value') ?? '');

  await page.fill('#gvm', '9999');
  await page.selectOption('#vehicleVariant', await options.nth(2).getAttribute('value') ?? '');
  await expect(page.locator('#gvm')).toHaveValue('9999');
});

test('the form still works if the catalogue fails to load', async ({ page, context }) => {
  // Spec section 9: the selector enhances a working tool and is never a dependency of it.
  // Case 1: the catalogue element is absent entirely.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('vehicleCatalogueData')?.remove();
    });
  });
  await page.reload();
  await page.fill('#gvm', '3350');
  await page.fill('#currentWeight', '2200');
  await expect(page.locator('#gvm')).toHaveValue('3350');

  // Case 2: the catalogue element is present but its JSON is malformed. This
  // used to throw at top-level script scope and kill the whole form; it is
  // now caught, so manual entry must still work.
  const malformedPage = await context.newPage();
  await malformedPage.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('vehicleCatalogueData');
      if (el) el.textContent = '{not valid json';
    });
  });
  await malformedPage.goto('/slide-on-camper-weight-calculator/');
  await malformedPage.fill('#gvm', '3350');
  await malformedPage.fill('#currentWeight', '2200');
  await expect(malformedPage.locator('#gvm')).toHaveValue('3350');
  await malformedPage.close();
});

test('the form still works when no vehicle is picked', async ({ page }) => {
  await page.fill('#gvm', '3350');
  await page.fill('#currentWeight', '2200');
  await expect(page.locator('#gvm')).toHaveValue('3350');
  await expect(page.locator('#trayMassField')).toBeHidden();
});
