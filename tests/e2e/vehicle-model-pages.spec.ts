import { test, expect } from '@playwright/test';
test('Ranger answers first, cites figures and prefills without starting calculation', async ({ page }) => {
  await page.goto('/slide-on-campers/ford-ranger/');
  const answer = page.getByTestId('model-answer');
  await expect(answer).toContainText('3,130');
  await expect(answer).toContainText('1,412');
  const box = await answer.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height);
  const related = await page.getByRole('region', { name: 'Other vehicle payload pages' }).boundingBox();
  expect(related!.y).toBeGreaterThan(box!.y + box!.height);
  await expect(answer.locator('a').first()).toHaveAttribute('href', /^#source-/);
  await expect(page.locator('#variants')).toContainText('68 kg');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const link = page.getByRole('link', { name: /Calculate .*XL/i }).first();
  const href = await link.getAttribute('href');
  const query = new URL(href!, 'https://beyondrv.com.au').searchParams;
  await link.click();
  await expect(page.locator('#gvm')).toHaveValue(query.get('vehicleGvm')!);
  await expect(page.locator('#currentWeight')).toHaveValue(query.get('currentVehicleWeight')!);
  await expect(page.locator('#resultPanel')).toHaveAttribute('data-status', 'neutral');
});
test('invalid query fields stay empty and valid dimensions are accepted', async ({ page }) => {
  await page.goto('/slide-on-camper-weight-calculator/?vehicleGvm=-1&currentVehicleWeight=Infinity&trayLength=2150&trayWidth=1850');
  await expect(page.locator('#gvm')).toHaveValue('');
  await expect(page.locator('#currentWeight')).toHaveValue('');
  await expect(page.locator('#trayLength')).toHaveValue('2150');
  await expect(page.locator('#trayWidth')).toHaveValue('1850');
  await expect(page.locator('#resultPanel')).toHaveAttribute('data-status', 'neutral');
});
test('heavy pages distinguish missing masses and chassis rear axle headroom', async ({ page }) => {
  await page.goto('/slide-on-campers/mercedes-benz-unimog/');
  // A missing mass must say the arithmetic cannot be done, not report its result as "unavailable".
  await expect(page.getByTestId('model-answer')).toContainText('cannot be calculated from it');
  await expect(page.getByTestId('model-answer')).not.toContainText('minus that mass is unavailable');
  await expect(page.locator('#variants')).toContainText('Not published');
  await page.goto('/slide-on-campers/mercedes-benz-unimog-u1700l/');
  await expect(page.getByTestId('model-answer')).toContainText('12,000 kg');
  await expect(page.getByTestId('model-answer')).toContainText('5,200 kg to 5,400 kg');
  await expect(page.locator('#sources-heading + p + ol')).toContainText('Offline document, not web-retrievable');
  await page.goto('/slide-on-campers/iveco-daily-4x4/');
  await expect(page.locator('#variants')).toContainText('3,967 kg');
});
