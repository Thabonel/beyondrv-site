import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const catalogue = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../src/data/vehicle-selector/catalogue.json', import.meta.url)), 'utf8')
);

test.beforeEach(async ({ page }) => {
  await page.goto('/slide-on-camper-weight-calculator/');
});

test('picking a vehicle fills the published figures', async ({ page }) => {
  const variant = catalogue.variants.find((v: any) => v.make === 'Mazda' && v.model === 'BT-50');
  if (!variant) throw new Error('Expected a Mazda BT-50 variant in the catalogue used by this test.');

  await page.selectOption('#vehicleMake', 'Mazda');
  await page.selectOption('#vehicleModel', 'BT-50');
  await page.selectOption('#vehicleVariant', variant.id);

  await expect(page.locator('#gvm')).toHaveValue(String(variant.gvmKg));
  await expect(page.locator('#currentWeight')).toHaveValue(String(variant.kerbKg));
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
  const pageErrors: Error[] = [];
  page.on('pageerror', (err) => pageErrors.push(err));
  await page.route('**/slide-on-camper-weight-calculator/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace(catalogueTag, '') });
  });
  await page.goto('/slide-on-camper-weight-calculator/');

  // Positive evidence the catalogue-absent path actually ran: parseCatalogue()
  // returns an empty catalogue, so the make dropdown has only its placeholder
  // option — none of the 13 real makes it shows when the catalogue loads.
  // toHaveCount(1) alone can't tell a working guard from a crashed script (both
  // leave the one server-rendered option), so also assert the script never threw.
  await expect(page.locator('#vehicleMake option')).toHaveCount(1);
  expect(pageErrors).toEqual([]);

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

test('tray weight sums into the vehicle weight, but a negative entry cannot reduce it', async ({ page }) => {
  // Ford Ranger XL double cab (single turbo): kerb mass excludes the tray,
  // so the tray field is shown and published kerb mass pre-fills at 2046kg.
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');
  await expect(page.locator('#trayMassField')).toBeVisible();

  // Every other required field is set to 1kg (parseRequired demands > 0
  // throughout the calculator, so 0 would itself trigger the missing-field
  // path) so #loadedWeight reads back the combined current-weight-plus-tray
  // figure plus a fixed, known 7kg of other additions.
  await page.fill('#gvm', '5000');
  await page.fill('#passengers', '1');
  await page.fill('#accessories', '1');
  await page.fill('#luggageGear', '1');
  await page.fill('#camperDry', '1');
  await page.fill('#camperWater', '1');
  await page.fill('#camperGear', '1');
  await page.fill('#camperOptions', '1');
  await page.fill('#trayLength', '2000');
  await page.fill('#trayWidth', '1800');
  await page.fill('#requiredTrayLength', '1900');
  await page.fill('#requiredTrayWidth', '1700');
  await page.check('#rearAxleChecked');
  await page.check('#tyreRatingsChecked');
  await page.check('#centreOfGravityChecked');

  // Ordinary case: 2046kg current weight + 120kg tray + 7kg fixed additions = 2173kg.
  await page.fill('#trayMass', '120');
  await expect(page.locator('#loadedWeight')).toHaveText(/2,?173 kg/);

  // A negative tray entry is not a tray weight of zero. On a vehicle whose kerb
  // mass excludes the tray, silently proceeding without it under-counts the
  // vehicle and overstates the payload, so the result goes to needs-review
  // instead. It can still never reduce the weight below the published figure.
  await page.fill('#trayMass', '-50');
  await expect(page.locator('#statusLabel')).toContainText(/not enough information/i);
  await expect(page.locator('#loadedWeight')).not.toHaveText(/1,?9\d\d kg/);
});

test('a zero current vehicle weight still needs review even with a tray entered', async ({ page }) => {
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  await page.fill('#currentWeight', '0');
  await page.fill('#trayMass', '120');

  // A zero current weight must still fall into the missing-field path, not
  // silently be replaced by the tray weight alone.
  await expect(page.locator('#resultSummary')).toContainText('Needs review');
  await expect(page.locator('#loadedWeight')).toHaveText('0 kg');
});

test('an invisible tray value from a previous vehicle cannot leak into the calculation', async ({ page }) => {
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');
  await expect(page.locator('#trayMassField')).toBeVisible();
  await page.fill('#trayMass', '150');

  // Switch to a variant whose kerb mass already includes the tray (same make
  // and model, so this exercises applyVariant's hide path, not the broader
  // make/model reset). The field must hide, and the old tray entry must not
  // survive hidden.
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-pickup-singleturbo');
  await expect(page.locator('#trayMassField')).toBeHidden();
  await expect(page.locator('#trayMass')).toHaveValue('');

  await page.fill('#gvm', '5000');
  await page.fill('#passengers', '1');
  await page.fill('#accessories', '1');
  await page.fill('#luggageGear', '1');
  await page.fill('#camperDry', '1');
  await page.fill('#camperWater', '1');
  await page.fill('#camperGear', '1');
  await page.fill('#camperOptions', '1');
  await page.fill('#trayLength', '2000');
  await page.fill('#trayWidth', '1800');
  await page.fill('#requiredTrayLength', '1900');
  await page.fill('#requiredTrayWidth', '1700');
  await page.check('#rearAxleChecked');
  await page.check('#tyreRatingsChecked');
  await page.check('#centreOfGravityChecked');

  // 2201kg published kerb mass + 7kg fixed additions = 2208kg, with no 150kg
  // carried over from the previous vehicle's tray.
  await expect(page.locator('#loadedWeight')).toHaveText(/2,?208 kg/);
});

test('a vehicle whose kerb mass excludes the tray will not calculate until the tray weight is entered', async ({ page }) => {
  await page.goto('/slide-on-camper-weight-calculator/');

  // Ford Ranger XL cab chassis: published kerb mass excludes the tray.
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  const options = await page.locator('#vehicleVariant option').allTextContents();
  const excluded = options.find((o) => o.includes('cab chassis'));
  await page.selectOption('#vehicleVariant', { label: excluded! });

  await expect(page.locator('#trayMassField')).toBeVisible();

  // Everything else filled in, tray weight deliberately left blank.
  for (const [id, v] of [['passengers', '180'], ['accessories', '80'], ['luggageGear', '50'],
    ['camperDry', '900'], ['camperWater', '80'], ['camperGear', '60'], ['camperOptions', '1'],
    ['trayLength', '2400'], ['trayWidth', '1800'], ['requiredTrayLength', '2100'], ['requiredTrayWidth', '1700']] as const) {
    await page.fill(`#${id}`, v);
  }

  // A blank tray weight must not be read as zero and pass the vehicle.
  await expect(page.locator('#statusLabel')).toContainText(/not enough information/i);
  await expect(page.locator('#resultPanel')).toHaveAttribute('data-status', 'amber');

  await page.fill('#trayMass', '120');
  await expect(page.locator('#statusLabel')).not.toContainText(/not enough information/i);
});
