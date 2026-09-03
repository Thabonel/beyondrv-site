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

test('a short tray gives one clear no-fit result and removes irrelevant camper questions', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '1600');

  const panel = page.getByTestId(result);
  await expect(panel).toContainText('No standard Beyond RV slide-on fits this 1,600 mm tub or tray');
  await expect(panel).toContainText('needs about 2,120 mm — 520 mm more');
  await expect(page.locator('#camperModel')).toBeDisabled();
  await expect(page.locator('#camperModel option')).toHaveCount(1);
  await expect(page.locator('#camperModel')).toHaveValue('');
  await expect(page.locator('#camperModel option')).toHaveText('No standard camper fits 1,600 mm');
  await expect(page.locator('#camperDryField')).toBeHidden();
  await expect(page.locator('#camperDetails')).toBeHidden();
  await expect(page.getByTestId('camper-finder-custom')).toHaveAttribute('href', /inquiry-form/);

  await expect(page.locator('#resultTitle')).toHaveText('No standard camper fits this tub or tray');
  await expect(page.locator('#trayLengthFit')).toHaveText('520 mm short of shortest model');
  await expect(page.locator('#camperModelMatch')).toHaveText('None — shortest needs 2,120 mm');
  await expect(page.locator('#warningNotes')).not.toContainText('camper dry weight');
  await expect(page.locator('#sendResult')).toHaveText('Ask Beyond RV About a Custom Solution');
});

test('compatible camper choices return when the tray is made long enough', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '1600');
  await expect(page.locator('#camperModel')).toBeDisabled();

  await page.fill('#trayLength', '2300');
  await expect(page.locator('#camperModel')).toBeEnabled();
  await expect(page.locator('#camperDryField')).toBeVisible();
  await expect(page.locator('#camperDetails')).toBeVisible();
  await expect(page.locator('#camperModel option')).toContainText([
    'Show matches from my tray length',
    'Advent 2300 Hardtop Ute Slide-On Camper',
    'Advent 2150 Hardtop Ute Slide-On Camper',
    '7ft Electric Pop-Top Slide-On Camper',
  ]);
  await expect(page.locator('#camperModel')).not.toContainText('Advent 2450 Hardtop Ute Slide-On Camper');
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
