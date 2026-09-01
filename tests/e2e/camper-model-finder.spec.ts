import { expect, test } from '@playwright/test';

const page_path = '/slide-on-camper-weight-calculator/';
const result = 'camper-finder-result';

test('a tray length names the model built for it', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '2300');

  const panel = page.getByTestId(result);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Advent 2300');
  await expect(panel).toContainText('built for a 2300 mm tray');
  // The 2450 cannot be built onto a 2300 tray; that is a 2300.
  await expect(page.getByTestId('camper-finder-too-long')).toContainText('Advent 2450');
});

test('two models the same size are presented as a choice of camper', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '2150');

  await expect(page.getByTestId(result)).toContainText('Advent 2150');
  const also = page.getByTestId('camper-finder-also');
  await expect(also).toContainText('7ft Electric Pop-Top');
  await expect(also).toContainText('the difference is in the camper, not the fit');
});

// A truck tray reaches the expedition range, where the two 3.5m units are the
// same size and differ by fitout rather than roof.
test('a truck tray reaches the expedition campers', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '4700');

  await expect(page.getByTestId(result)).toContainText('4.7m Hardtop Truck Camper');
  await expect(page.getByTestId('camper-finder-also')).toContainText('3.5m');
});

test('a ute tray is not offered a truck camper', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '2300');

  await expect(page.getByTestId(result)).toContainText('Advent 2300');
  await expect(page.getByTestId('camper-finder-too-long')).toContainText('4.7m Hardtop Truck Camper');
});

// Built to order means a short tray is a conversation, never a refusal.
test('a tray shorter than every model invites a conversation', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '1500');

  const panel = page.getByTestId(result);
  await expect(panel).toContainText('builds to order');
  await expect(panel).not.toContainText('does not fit');
});

test('nothing is claimed before a tray length is entered', async ({ page }) => {
  await page.goto(page_path);

  await expect(page.getByTestId(result)).toBeHidden();
});

test('choosing the model fills the detailed check below', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '2300');
  await page.getByTestId('camper-finder-choose').click();

  await expect(page.locator('#requiredTrayLength')).toHaveValue('2300');
  await expect(page.locator('#trayLength')).toHaveValue('2300');
});

test('the figures are described as indicative while they are targets', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '2300');

  await expect(page.getByTestId('camper-finder-indicative')).toContainText('built to order');
});

// A 4.2m truck tray physically takes a 2120mm ute slide-on with two metres to
// spare. Offering that as an alternative is true and useless.
test('a truck tray is not offered the ute range as alternatives', async ({ page }) => {
  await page.goto(page_path);
  await page.fill('#finderTrayLength', '4200');

  await expect(page.getByTestId(result)).toContainText('3.5m');
  await expect(page.getByTestId('camper-finder-too-long')).toContainText('4.7m Hardtop Truck Camper');
  // The ute range is named quietly, not presented as a choice.
  const also = page.getByTestId('camper-finder-also');
  await expect(also).not.toContainText('Advent 2150');
  await expect(page.getByTestId('camper-finder-smaller')).toContainText('Advent 2150');
});
