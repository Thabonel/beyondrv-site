import { expect, test } from '@playwright/test';

const pagePath = '/slide-on-camper-weight-calculator/';
const result = 'camper-finder-result';

test('a tray length immediately shortlists the nearest slide-on', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2300');

  const panel = page.getByTestId(result);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Advent 2300');
  await expect(panel).toContainText('closest standard length match');
  await expect(panel).not.toContainText('4.7m Hardtop Truck Camper');
});

test('models with the same nominal length are presented as camper choices', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2150');

  await expect(page.getByTestId(result)).toContainText('Advent 2150');
  const sameSize = page.getByTestId('camper-finder-same-size');
  await expect(sameSize).toContainText('7ft Electric Pop-Top');
  await expect(sameSize).toContainText('difference is in the camper, not the fit');
});

test('a short tray invites a conversation rather than making a false fit claim', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '1500');

  const panel = page.getByTestId(result);
  await expect(panel).toContainText('builds to order');
  await expect(panel).not.toContainText('does not fit');
});

test('nothing is claimed before a tray length is entered', async ({ page }) => {
  await page.goto(pagePath);
  await expect(page.getByTestId(result)).toBeHidden();
});

test('both customer tray dimensions are visible without opening advanced details', async ({ page }) => {
  await page.goto(pagePath);

  await expect(page.locator('#trayLength')).toBeVisible();
  await expect(page.locator('#trayWidth')).toBeVisible();
  await expect(page.locator('#camperDetails')).not.toHaveAttribute('open', '');
});

test('choosing a suggested camper fills only the camper requirement', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2300');
  await page.getByTestId('camper-finder-choose').click();

  await expect(page.locator('#camperModel')).toHaveValue('advent-2300-hardtop-slide-on');
  await expect(page.locator('#requiredTrayLength')).toHaveValue('2300');
  await expect(page.locator('#trayLength')).toHaveValue('2300');
  await expect(page.getByTestId(result)).toContainText('camper you are checking');
});

test('the suggestion button stays readable and turns orange on hover', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2300');

  const button = page.getByTestId('camper-finder-choose');
  await expect(button).toHaveCSS('color', 'rgb(17, 17, 17)');
  await button.hover();
  await expect(button).toHaveCSS('color', 'rgb(232, 84, 10)');
});

test('selecting a camper directly fills recorded dimensions and keeps unverified data blank', async ({ page }) => {
  await page.goto(pagePath);
  await page.selectOption('#camperModel', 'advent-2450-hardtop-slide-on');

  await expect(page.locator('#requiredTrayLength')).toHaveValue('2450');
  await expect(page.locator('#camperDry')).toHaveValue('');
  await expect(page.locator('#requiredTrayWidth')).toHaveValue('');
});

test('target dimensions are described as preliminary', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2300');
  await page.getByTestId('camper-finder-choose').click();

  await expect(page.getByTestId('camper-finder-indicative')).toContainText('preliminary length check');
});
