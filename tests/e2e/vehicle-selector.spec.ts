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
  //
  // The calculator's inline script is type="module", which per the HTML spec
  // finishes executing BEFORE DOMContentLoaded fires. Mutating the DOM from a
  // DOMContentLoaded listener (as an earlier version of this test did) is too
  // late: parseCatalogue() has already read and parsed the original, valid
  // catalogue by then. To genuinely exercise catalogue failure, the markup
  // itself must be broken before the browser ever parses it — so we rewrite
  // the HTML response in flight with page.route.
  const catalogueTag = /<script[^>]*id="vehicleCatalogueData"[^>]*>[\s\S]*?<\/script>/;
  const catalogueTagOpenClose = /(<script[^>]*id="vehicleCatalogueData"[^>]*>)[\s\S]*?(<\/script>)/;

  // Case 1: the catalogue element is absent entirely from the markup.
  await page.route('**/slide-on-camper-weight-calculator/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace(catalogueTag, '') });
  });
  await page.goto('/slide-on-camper-weight-calculator/');

  // Positive evidence the catalogue-absent path actually ran: parseCatalogue()
  // returns an empty catalogue, so the make dropdown has only its placeholder
  // option — none of the 13 real makes it shows when the catalogue loads.
  await expect(page.locator('#vehicleMake option')).toHaveCount(1);

  await page.fill('#gvm', '3350');
  await page.fill('#currentWeight', '2200');
  await expect(page.locator('#gvm')).toHaveValue('3350');

  // Case 2: the catalogue element is present in the markup but its JSON is
  // malformed. This used to throw at top-level script scope and kill the
  // whole form; it is now caught, so manual entry must still work.
  const malformedPage = await context.newPage();
  const consoleWarnings: string[] = [];
  malformedPage.on('console', (msg) => {
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  await malformedPage.route('**/slide-on-camper-weight-calculator/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace(catalogueTagOpenClose, '$1{not valid json$2') });
  });
  await malformedPage.goto('/slide-on-camper-weight-calculator/');

  // Positive evidence the catch branch actually ran: it logs the warning the
  // calculator script emits on a parse failure, and the make dropdown falls
  // back to only its placeholder option.
  await expect(malformedPage.locator('#vehicleMake option')).toHaveCount(1);
  expect(consoleWarnings.some((text) => text.includes('Vehicle catalogue data could not be parsed'))).toBe(true);

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
