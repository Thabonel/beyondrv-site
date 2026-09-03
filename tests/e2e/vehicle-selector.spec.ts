import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { vehicleCatalogueFixture } from '../fixtures/vehicle-catalogue';

const catalogue = vehicleCatalogueFixture;
const calculatorPath = '/slide-on-camper-weight-calculator/';
const catalogueTag = /<script[^>]*id="vehicleCatalogueData"[^>]*>[\s\S]*?<\/script>/;
const catalogueTagOpenClose = /(<script[^>]*id="vehicleCatalogueData"[^>]*>)[\s\S]*?(<\/script>)/;

async function rewriteCalculatorCatalogue(page: Page, replacement: string) {
  await page.route(`**${calculatorPath}`, async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    delete headers['content-encoding'];
    delete headers['content-length'];
    const html = await response.text();
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace(catalogueTagOpenClose, `$1${replacement}$2`),
    });
  });
}

async function openCalculatorWithFixture(page: Page) {
  await rewriteCalculatorCatalogue(page, JSON.stringify(catalogue));
  await page.goto(calculatorPath);
}

// Every field change triggers a full recalculation and re-render, so the fill
// immediately before these shifts the layout underneath them. page.check()
// clicks and then reads the state once, throwing if it does not match rather
// than retrying the click. Clicking and asserting separately lets the
// assertion retry, and still fails loudly if the click really did not land.
/** Retry the complete pointer interaction when recalculation shifts layout. */
async function tick(page: Page, id: string) {
  const box = page.locator(`#${id}`);
  await expect(box).toBeVisible();
  await expect(box).toBeEnabled();
  await expect(async () => {
    if (!(await box.isChecked())) await box.click();
    await expect(box).toBeChecked();
  }).toPass();
}

async function confirmChecks(page: Page) {
  for (const id of ['rearAxleChecked', 'tyreRatingsChecked', 'centreOfGravityChecked']) {
    await tick(page, id);
  }
}

async function completeManualCalculation(page: Page) {
  for (const [id, value] of [
    ['gvm', '5000'], ['currentWeight', '2200'], ['passengers', '1'], ['accessories', '1'],
    ['luggageGear', '1'], ['camperDry', '1'], ['camperWater', '1'], ['camperGear', '1'],
    ['camperOptions', '1'], ['trayLength', '2000'], ['trayWidth', '1800'],
    ['requiredTrayLength', '1900'], ['requiredTrayWidth', '1700'],
  ] as const) {
    await page.fill(`#${id}`, value);
  }
  for (const id of ['rearAxleChecked', 'tyreRatingsChecked', 'centreOfGravityChecked']) {
    await page.locator(`#${id}`).press('Space');
  }
  await expect(page.locator('#loadedWeight')).toHaveText(/2,?207 kg/);
}

test('picking a vehicle fills the published figures', async ({ page }) => {
  await openCalculatorWithFixture(page);
  const variant = catalogue.variants.find((v) => v.make === 'Mazda' && v.model === 'BT-50');
  if (!variant) throw new Error('Expected a Mazda BT-50 variant in the catalogue used by this test.');

  await page.selectOption('#vehicleMake', 'Mazda');
  await page.selectOption('#vehicleModel', 'BT-50');
  await page.selectOption('#vehicleVariant', variant.id);

  await expect(page.locator('#gvm')).toHaveValue(String(variant.gvmKg));
  await expect(page.locator('#currentWeight')).toHaveValue(String(variant.kerbKg));
  await expect(page.locator('#vehicleProvenance')).toContainText('Published by Mazda Australia');
});

test('a figure the customer typed survives re-picking a vehicle', async ({ page }) => {
  await openCalculatorWithFixture(page);
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
  // Case 1: the catalogue element is absent entirely from the markup.
  const pageErrors: Error[] = [];
  page.on('pageerror', (err) => pageErrors.push(err));
  await page.route('**/slide-on-camper-weight-calculator/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const headers = response.headers();
    delete headers['content-encoding'];
    delete headers['content-length'];
    await route.fulfill({ status: response.status(), headers, body: html.replace(catalogueTag, '') });
  });
  await page.goto('/slide-on-camper-weight-calculator/');

  // Positive evidence the catalogue-absent path actually ran: parseCatalogue()
  // returns an empty catalogue, so the make dropdown has only its placeholder
  // option — none of the 13 real makes it shows when the catalogue loads.
  // toHaveCount(1) alone can't tell a working guard from a crashed script (both
  // leave the one server-rendered option), so also assert the script never threw.
  await expect(page.locator('#vehicleMake option')).toHaveCount(1);
  expect(pageErrors).toEqual([]);

  await completeManualCalculation(page);

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
    const headers = response.headers();
    delete headers['content-encoding'];
    delete headers['content-length'];
    const html = await response.text();
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace(catalogueTagOpenClose, '$1{not valid json$2'),
    });
  });
  await malformedPage.goto('/slide-on-camper-weight-calculator/');

  // Positive evidence the catch branch actually ran: it logs the warning the
  // calculator script emits on a parse failure, and the make dropdown falls
  // back to only its placeholder option.
  await expect(malformedPage.locator('#vehicleMake option')).toHaveCount(1);
  expect(consoleWarnings.some((text) => text.includes('Vehicle catalogue data could not be parsed'))).toBe(true);

  await completeManualCalculation(malformedPage);
  await malformedPage.close();
});

test('the form still works when no vehicle is picked', async ({ page }) => {
  await page.goto(calculatorPath);
  await completeManualCalculation(page);
  await expect(page.locator('#trayMassField')).toBeHidden();
});

test('tray weight sums into the vehicle weight, but a negative entry cannot reduce it', async ({ page }) => {
  await openCalculatorWithFixture(page);
  // Ford Ranger XL double cab (single turbo): kerb mass excludes the tray,
  // so the tray field is shown and published kerb mass pre-fills at 2046kg.
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');
  await expect(page.locator('#trayMassField')).toBeVisible();

  // Use fixed, known additions so #loadedWeight reads back the combined
  // current-weight-plus-tray figure plus exactly 7kg.
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
  await confirmChecks(page);

  // Ordinary case: 2046kg current weight + 120kg tray + 7kg fixed additions = 2173kg.
  await page.fill('#trayMass', '120');
  await expect(page.locator('#loadedWeight')).toHaveText(/2,?173 kg/);

  // A negative tray entry is not a tray weight of zero. On a vehicle whose kerb
  // mass excludes the tray, silently proceeding without it under-counts the
  // vehicle and overstates the payload, so vehicle-weight results stay
  // unavailable. It can still never reduce the weight below the published figure.
  await page.fill('#trayMass', '-50');
  await expect(page.locator('#statusLabel')).toContainText('Partial estimate');
  await expect(page.locator('#dataQuality')).toContainText('current vehicle weight');
  await expect(page.locator('#loadedWeight')).toHaveText('Not calculated');
});

test('a zero current vehicle weight still needs review even with a tray entered', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  await page.fill('#currentWeight', '0');
  await page.fill('#trayMass', '120');

  // A zero current weight must still fall into the missing-field path, not
  // silently be replaced by the tray weight alone.
  await expect(page.locator('#statusLabel')).toContainText('Partial estimate');
  await expect(page.locator('#dataQuality')).toContainText('current vehicle weight');
  await expect(page.locator('#loadedWeight')).toHaveText('Not calculated');
});

test('an invisible tray value from a previous vehicle cannot leak into the calculation', async ({ page }) => {
  await openCalculatorWithFixture(page);
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
  await confirmChecks(page);

  // 2201kg published kerb mass + 7kg fixed additions = 2208kg, with no 150kg
  // carried over from the previous vehicle's tray.
  await expect(page.locator('#loadedWeight')).toHaveText(/2,?208 kg/);
});

test('a vehicle whose kerb mass excludes the tray will not calculate until the tray weight is entered', async ({ page }) => {
  await openCalculatorWithFixture(page);

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
  await expect(page.locator('#statusLabel')).toContainText('Partial estimate');
  await expect(page.locator('#loadedCamper')).toHaveText(/1,?041 kg/);
  await expect(page.locator('#trayLengthFit')).toHaveText('300 mm');
  await expect(page.locator('#loadedWeight')).toHaveText('Not calculated');
  await expect(page.locator('#resultPanel')).toHaveAttribute('data-status', 'amber');

  await page.fill('#trayMass', '120');
  await expect(page.locator('#statusLabel')).not.toContainText('Partial estimate');
});

test('a weighbridge weight that already includes the tray does not demand the tray again', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');
  await expect(page.locator('#trayMassField')).toBeVisible();

  // The page tells people to use a weighbridge figure; that figure includes
  // the tray already bolted on.
  await page.fill('#currentWeight', '2350');
  for (const [id, v] of [['gvm', '5000'], ['passengers', '1'], ['accessories', '1'], ['luggageGear', '1'],
    ['camperDry', '1'], ['camperWater', '1'], ['camperGear', '1'], ['camperOptions', '1'],
    ['trayLength', '2000'], ['trayWidth', '1800'], ['requiredTrayLength', '1900'], ['requiredTrayWidth', '1700']] as const) {
    await page.fill(`#${id}`, v);
  }

  // Blank tray weight still blocks, because nothing has said the figure includes it.
  await expect(page.locator('#statusLabel')).toContainText('Partial estimate');
  await expect(page.locator('#loadedWeight')).toHaveText('Not calculated');

  await tick(page, 'trayIncluded');

  // Now it calculates, and the tray is counted once: 2350 + 7 = 2357kg.
  await expect(page.locator('#statusLabel')).not.toContainText('Partial estimate');
  await expect(page.locator('#loadedWeight')).toHaveText(/2,?357 kg/);

  // The tray field is gone, so it cannot be entered twice.
  await expect(page.locator('#trayMassRow')).toBeHidden();
});

test('overriding a prefilled figure is disclosed in the provenance panel straight away', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  const provenance = page.locator('#vehicleProvenance');
  await expect(provenance).toContainText('Published by');
  await expect(provenance).not.toContainText('You supplied');

  // Override the manufacturer GVM. The panel must stop implying that figure
  // came from the manufacturer document.
  await page.fill('#gvm', '3500');

  await expect(provenance).toContainText('You supplied GVM');
  await expect(provenance).toContainText('not from the manufacturer document');
});

test('the provenance panel names every figure the customer has overridden', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  await page.fill('#gvm', '3500');
  await page.fill('#currentWeight', '2350');

  const provenance = page.locator('#vehicleProvenance');
  await expect(provenance).toContainText('You supplied GVM');
  await expect(provenance).toContainText('the current vehicle weight');
});

const RANGER_CC_A = 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo';
const RANGER_CC_B = 'ford-ranger-2022my-4x4-xl-double-cc-biturbo';

async function pickRanger(page: Page, variantId: string) {
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', variantId);
}

test('switching variant re-asks whether the weight includes the tray', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await pickRanger(page, RANGER_CC_A);

  // Both variants publish a kerb mass that excludes the tray.
  await expect(page.locator('#trayMassField')).toBeVisible();
  await tick(page, 'trayIncluded');
  await expect(page.locator('#trayMassRow')).toBeHidden();

  // Switching replaces the weight with the new vehicle's published kerb, which
  // excludes its tray, so the earlier claim cannot carry over.
  await page.selectOption('#vehicleVariant', RANGER_CC_B);

  await expect(page.locator('#currentWeight')).toHaveValue('2072');
  await expect(page.locator('#trayIncluded')).not.toBeChecked();
  await expect(page.locator('#trayMassRow')).toBeVisible();
});

test('a carried-over inclusion claim cannot produce a green result on a fresh variant', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await pickRanger(page, RANGER_CC_A);
  await tick(page, 'trayIncluded');

  for (const [id, v] of [['gvm', '5000'], ['passengers', '1'], ['accessories', '1'], ['luggageGear', '1'],
    ['camperDry', '1'], ['camperWater', '1'], ['camperGear', '1'], ['camperOptions', '1'],
    ['trayLength', '2000'], ['trayWidth', '1800'], ['requiredTrayLength', '1900'], ['requiredTrayWidth', '1700']] as const) {
    await page.fill(`#${id}`, v);
  }

  await page.selectOption('#vehicleVariant', RANGER_CC_B);

  // The published kerb excludes the tray and nobody has said otherwise for this
  // vehicle, so the result must not pass on a bare-chassis weight.
  await expect(page.locator('#statusLabel')).toContainText('Partial estimate');
  await expect(page.locator('#loadedWeight')).toHaveText('Not calculated');
});

test('the provenance panel stops crediting a tray weight once it is cleared', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await pickRanger(page, RANGER_CC_A);

  await page.fill('#trayMass', '120');
  const provenance = page.locator('#vehicleProvenance');
  await expect(provenance).toContainText('the tray weight');

  // Ticking this clears the tray weight without firing an input event.
  await tick(page, 'trayIncluded');

  await expect(page.locator('#trayMass')).toHaveValue('');
  await expect(provenance).not.toContainText('the tray weight');
});

test('an empty catalogue hides the picker and explains why', async ({ page }) => {
  await rewriteCalculatorCatalogue(page, JSON.stringify({
    ...catalogue, sourceDatabaseRowCount: 0, models: [], variants: [],
  }));
  await page.goto(calculatorPath);

  // Three dead dropdowns read as a broken page; say what is happening instead.
  await expect(page.locator('.vehicle-picker')).toBeHidden();
  const notice = page.getByTestId('vehicle-picker-unavailable');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/review/i);
  // Advice for a control that is not on screen is worse than none.
  await expect(page.locator('#vehiclePickerHelp')).toBeHidden();

  // The manual path must still work exactly as before.
  await completeManualCalculation(page);
});

test('a populated catalogue shows the picker and no notice', async ({ page }) => {
  await openCalculatorWithFixture(page);

  await expect(page.locator('.vehicle-picker')).toBeVisible();
  await expect(page.getByTestId('vehicle-picker-unavailable')).toBeHidden();
});

// A figure Beyond RV corrected did not come from the manufacturer document the
// panel links to. Crediting it to them would be a false statement about a
// number customers use to decide whether they are over GVM.
test('a corrected figure is disclosed as Beyond RV\'s, not the manufacturer\'s', async ({ page }) => {
  const corrected = {
    ...catalogue,
    variants: catalogue.variants.map((variant, index) => (
      index === 0 ? { ...variant, correctedFields: ['gvmKg', 'payloadKg'] } : variant
    )),
  };
  await rewriteCalculatorCatalogue(page, JSON.stringify(corrected));
  await page.goto(calculatorPath);

  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  const note = page.getByTestId('vehicle-provenance-corrected');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Beyond RV corrected the GVM, the payload');
  await expect(note).toContainText('not from the manufacturer document');
});

test('an uncorrected variant shows no correction note', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  await expect(page.locator('#vehicleProvenance')).toBeVisible();
  await expect(page.getByTestId('vehicle-provenance-corrected')).toHaveCount(0);
});

// A truck's maximum body length is what the chassis is rated for, not the tray
// someone fitted. Prefilling it, or letting it read as a tray length, would
// point a customer at a longer camper than their vehicle carries.
test('a truck states its maximum body length without filling the tray fields', async ({ page }) => {
  const withTruck = {
    ...catalogue,
    sourceDatabaseRowCount: catalogue.sourceDatabaseRowCount + 1,
    models: [...catalogue.models, { make: 'Hino', model: '300 Series 817 4x4', modelYears: [2022] }],
    variants: [...catalogue.variants, {
      ...catalogue.variants[0],
      id: 'hino-817-single', make: 'Hino', model: '300 Series 817 4x4', modelYear: 2022,
      grade: '817 4x4', cabType: 'single', bodyType: 'cab_chassis',
      label: 'Hino 300 Series 817 4x4 single cab', platform: 'truck',
      gvmKg: 7500, kerbKg: 3160, payloadKg: 4340,
      trayLengthMm: null, trayWidthMm: null, trayState: 'excluded',
      maxBodyLengthMm: 4865,
    }],
  };
  await rewriteCalculatorCatalogue(page, JSON.stringify(withTruck));
  await page.goto(calculatorPath);

  await page.selectOption('#vehicleMake', 'Hino');
  await page.selectOption('#vehicleModel', '300 Series 817 4x4');
  await page.selectOption('#vehicleVariant', 'hino-817-single');

  const note = page.getByTestId('vehicle-max-body-length');
  await expect(note).toContainText('4865 mm');
  await expect(note).toContainText('not the tray fitted to your vehicle');

  // The chassis mass fills, the tray does not.
  await expect(page.locator('#gvm')).toHaveValue('7500');
  await expect(page.locator('#currentWeight')).toHaveValue('3160');
  await expect(page.locator('#trayLength')).toHaveValue('');
  // A cab chassis carries no body, so the tray weight must be asked for.
  await expect(page.locator('#trayMassField')).toBeVisible();
});

test('a ute shows no maximum body length note', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  await expect(page.getByTestId('vehicle-max-body-length')).toHaveCount(0);
});

// A lightest-equipment kerb mass yields the largest payload, so the number
// shown is the best case. The customer has to be told, because the error runs
// toward more headroom than the vehicle has.
test('an optimistic kerb mass is disclosed to the customer', async ({ page }) => {
  const flagged = {
    ...catalogue,
    variants: catalogue.variants.map((v, i) => (i === 0 ? { ...v, kerbIsOptimistic: true } : v)),
  };
  await rewriteCalculatorCatalogue(page, JSON.stringify(flagged));
  await page.goto(calculatorPath);

  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  const note = page.getByTestId('vehicle-optimistic-kerb');
  await expect(note).toContainText('lightest-equipment figure');
  await expect(note).toContainText('best case');
  await expect(note).toContainText('weighs your vehicle at the factory');
});

test('a variant with an ordinary kerb mass shows no such note', async ({ page }) => {
  await openCalculatorWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  await expect(page.getByTestId('vehicle-optimistic-kerb')).toHaveCount(0);
});
