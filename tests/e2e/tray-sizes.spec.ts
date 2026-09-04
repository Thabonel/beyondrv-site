import { expect, test, type Page, type Route } from '@playwright/test';
import { vehicleCatalogueFixture } from '../fixtures/vehicle-catalogue';

const RANGER_CC = 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo';
const calculatorPath = '/slide-on-camper-weight-calculator/';
const catalogueTag = /(<script[^>]*id="vehicleCatalogueData"[^>]*>)[\s\S]*?(<\/script>)/;

/**
 * The published catalogue is gated on a review decision and is currently empty,
 * so these tests inject a known one rather than depending on what is published.
 */
async function openCalculator(page: Page) {
  await page.route(`**${calculatorPath}`, async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    delete headers['content-encoding'];
    delete headers['content-length'];
    const html = await response.text();
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace(catalogueTag, `$1${JSON.stringify(vehicleCatalogueFixture)}$2`),
    });
  });
  await page.goto(calculatorPath);
}

async function selectRanger(page: Page) {
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', RANGER_CC);
}

/** Routes the endpoint, recording every POST body. */
function stubTraySizes(page: Page, opts: { reported?: Record<string, unknown>; postStatus?: number; delayMs?: number } = {}) {
  const writes: Array<Record<string, unknown>> = [];
  void page.route('**/.netlify/functions/tray-sizes', async (route: Route) => {
    if (route.request().method() === 'GET') {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ sizes: opts.reported ?? {} }),
      });
      return;
    }
    writes.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: opts.postStatus ?? 200, contentType: 'application/json',
      body: JSON.stringify(opts.postStatus && opts.postStatus >= 400 ? { error: 'nope' } : { ok: true }),
    });
  });
  return writes;
}

const REPORTED = { [RANGER_CC]: { lengthMm: 2100, widthMm: 1800, reports: 7 } };

test('a vehicle nobody has reported offers no size, and nothing is posted', async ({ page }) => {
  const writes = stubTraySizes(page);
  await openCalculator(page);
  await selectRanger(page);

  await expect(page.getByTestId('tray-reported')).toBeHidden();
  await expect(page.getByTestId('tray-invite')).toBeVisible();
  await expect(page.locator('#trayLength')).toHaveValue('');
  // The invitation is there, but it cannot fire until both numbers exist.
  await expect(page.getByTestId('tray-report')).toBeVisible();
  await expect(page.getByTestId('tray-report')).toBeDisabled();
  expect(writes).toEqual([]);
});

test('a reported size is offered with its count and prefills the fields', async ({ page }) => {
  const writes = stubTraySizes(page, { reported: REPORTED });
  await openCalculator(page);
  await selectRanger(page);

  const reported = page.getByTestId('tray-reported');
  await expect(reported).toBeVisible();
  await expect(reported).toContainText('2100');
  await expect(reported).toContainText('1800');
  await expect(reported).toContainText('7');
  await expect(page.locator('#trayLength')).toHaveValue('2100');
  await expect(page.locator('#trayWidth')).toHaveValue('1800');

  // Selecting a vehicle is not a contribution.
  expect(writes).toEqual([]);
});

test('the result is recalculated once the reported size arrives', async ({ page }) => {
  stubTraySizes(page, { reported: REPORTED, delayMs: 600 });
  await openCalculator(page);

  // Every required field must be present or the calculator short-circuits to
  // its missing-field path and reports no fit at all.
  for (const [id, v] of [['gvm', '5000'], ['passengers', '1'], ['accessories', '1'], ['luggageGear', '1'],
    ['camperDry', '1'], ['camperWater', '1'], ['camperGear', '1'], ['camperOptions', '1'],
    ['requiredTrayLength', '1900'], ['requiredTrayWidth', '1700']] as const) {
    await page.fill(`#${id}`, v);
  }
  await selectRanger(page);

  // This variant's kerb mass excludes the tray, so its weight is required too.
  await page.fill('#trayMass', '120');

  // The prefill lands after applyVariant already calculated with empty fields,
  // so the displayed fit must be recomputed from the new values: 2100 - 1900.
  await expect(page.locator('#trayLengthFit')).toContainText('200');
});

test('confirming reports the shown size, once', async ({ page }) => {
  const writes = stubTraySizes(page, { reported: REPORTED });
  await openCalculator(page);
  await selectRanger(page);

  await page.getByTestId('tray-confirm').click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ variantId: RANGER_CC, lengthMm: 2100, widthMm: 1800 });

  await expect(page.getByTestId('tray-confirm')).toBeDisabled();
});

test('correcting the size clears the fields and reports only on an explicit press', async ({ page }) => {
  const writes = stubTraySizes(page, { reported: REPORTED });
  await openCalculator(page);
  await selectRanger(page);

  await page.getByTestId('tray-correct').click();
  await expect(page.locator('#trayLength')).toHaveValue('');
  await expect(page.locator('#trayWidth')).toHaveValue('');

  await page.fill('#trayLength', '2400');
  await page.fill('#trayWidth', '1850');
  await page.locator('#trayWidth').blur();

  // Blurring is not a contribution — only the button is.
  expect(writes).toEqual([]);

  await page.getByTestId('tray-report').click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ variantId: RANGER_CC, lengthMm: 2400, widthMm: 1850 });
});

test('filling the tray fields for an ordinary calculation reports nothing', async ({ page }) => {
  const writes = stubTraySizes(page);
  await openCalculator(page);
  await selectRanger(page);

  await page.fill('#trayLength', '2400');
  await page.fill('#trayWidth', '1850');
  await page.locator('#trayWidth').blur();
  await page.fill('#gvm', '3300');
  await page.locator('#gvm').blur();

  expect(writes).toEqual([]);
});

test('a submission that fails can be retried', async ({ page }) => {
  const writes = stubTraySizes(page, { reported: REPORTED, postStatus: 503 });
  await openCalculator(page);
  await selectRanger(page);

  await page.getByTestId('tray-confirm').click();
  await expect.poll(() => writes.length).toBe(1);

  // A transient outage must not lock the customer out of contributing.
  await expect(page.getByTestId('tray-confirm')).toBeEnabled();
  await page.getByTestId('tray-confirm').click();
  await expect.poll(() => writes.length).toBe(2);
});

test('a reporting outage leaves the calculator working', async ({ page }) => {
  await page.route('**/.netlify/functions/tray-sizes', route =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) }));

  await openCalculator(page);
  await selectRanger(page);

  await expect(page.getByTestId('tray-reported')).toBeHidden();
  await page.fill('#trayLength', '2400');
  await expect(page.locator('#trayLength')).toHaveValue('2400');
});
