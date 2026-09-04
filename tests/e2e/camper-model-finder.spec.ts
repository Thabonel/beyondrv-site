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
  await expect(page.locator('#requiredTrayLength')).toHaveValue('2300');
  await expect(page.locator('#trayLengthFit')).toHaveText('Exact length match');
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
  await expect(panel).toContainText('No standard Beyond RV slide-on fits this 1,600 mm tray');
  await expect(panel).toContainText('needs about 2,120 mm — 520 mm more');
  await expect(page.locator('#camperModel')).toHaveCount(0);
  await expect(page.locator('#camperDryField')).toBeHidden();
  await expect(page.locator('#camperDetails')).toBeHidden();
  await expect(page.getByTestId('camper-finder-custom')).toHaveAttribute('href', /inquiry-form/);

  await expect(page.locator('#resultTitle')).toHaveText('No standard camper fits this tray');
  await expect(page.locator('#trayLengthFit')).toHaveText('520 mm short of shortest model');
  await expect(page.locator('#camperModelMatch')).toHaveText('None — shortest needs 2,120 mm');
  await expect(page.locator('#warningNotes')).not.toContainText('camper dry weight');
  await expect(page.locator('#sendResult')).toHaveText('Ask Beyond RV About a Custom Solution');
});

test('the standard recommendation and its questions return when the tray is long enough', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '1600');
  await expect(page.locator('#camperDryField')).toBeHidden();

  await page.fill('#trayLength', '2300');
  await expect(page.locator('#camperDryField')).toBeVisible();
  await expect(page.locator('#camperDetails')).toBeVisible();
  await expect(page.getByTestId(result)).toContainText('Advent 2300 Hardtop Ute Slide-On Camper');
  await expect(page.locator('#requiredTrayLength')).toHaveValue('2300');
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

test('the closest camper is applied without another customer action', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2300');

  await expect(page.locator('#requiredTrayLength')).toHaveValue('2300');
  await expect(page.locator('#trayLength')).toHaveValue('2300');
  await expect(page.locator('#camperDry')).toHaveValue('');
  await expect(page.locator('#requiredTrayWidth')).toHaveValue('');
  await expect(page.getByTestId(result)).toContainText('closest standard length match');
});

test('a 2550 mm verified tray immediately gets the Advent 2450 length result', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2550');
  await page.fill('#trayWidth', '1777');

  await expect(page.getByTestId(result)).toContainText('Advent 2450 Hardtop Ute Slide-On Camper');
  await expect(page.locator('#requiredTrayLength')).toHaveValue('2450');
  await expect(page.locator('#trayLengthFit')).toHaveText('100 mm spare');
  await expect(page.locator('#dataQuality')).not.toContainText('required tray length');
});

test('target dimensions are described as preliminary', async ({ page }) => {
  await page.goto(pagePath);
  await page.fill('#trayLength', '2300');

  await expect(page.getByTestId('camper-finder-indicative')).toContainText('Beyond RV confirms the final size');
});

// Beyond RV slide-ons mount on a flat tray. A tub cannot carry one at any length,
// so a tub owner told their tub is "270mm short" goes looking for a longer ute
// when what they need is a tray fitted.
test('a tub is told it needs a tray, not that it is too short', async ({ page }) => {
  await page.goto(pagePath);
  await page.selectOption('#trayType', 'Tub');
  await page.fill('#trayLength', '1850');

  const panel = page.getByTestId(result);
  await expect(panel).toContainText('mounts on a flat tray');
  await expect(panel).toContainText('replaced with a tray');
  // The arithmetic answer is right but the wrong thing to say to a tub owner.
  await expect(panel).not.toContainText('needs about');
});

test('a tray that is genuinely too short still gets the measurement answer', async ({ page }) => {
  await page.goto(pagePath);
  await page.selectOption('#trayType', 'Steel tray');
  await page.fill('#trayLength', '1850');

  const panel = page.getByTestId(result);
  await expect(panel).toContainText('needs about');
  await expect(panel).not.toContainText('replaced with a tray');
});
