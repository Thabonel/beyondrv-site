import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { vehicleCatalogueFixture } from '../fixtures/vehicle-catalogue';

const calculatorPath = '/slide-on-camper-weight-calculator/';

/** Serve a known catalogue so the tray type assertions do not ride on live data. */
async function openWithFixture(page: Page) {
  await page.route(`**${calculatorPath}`, async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    delete headers['content-encoding'];
    delete headers['content-length'];
    const html = await response.text();
    await route.fulfill({
      status: response.status(),
      headers,
      body: html.replace(
        /(<script[^>]*id="vehicleCatalogueData"[^>]*>)[\s\S]*?(<\/script>)/,
        `$1${JSON.stringify(vehicleCatalogueFixture)}$2`,
      ),
    });
  });
  await page.goto(calculatorPath);
}

/**
 * GVM and the current weight sit inside a collapsed "vehicle details" section
 * since the calculator was simplified to lead with tray dimensions. A customer
 * usually never opens it, because picking a vehicle fills both.
 */
async function openVehicleDetails(page: Page) {
  await openSection(page, 'vehicleDetails');
}

/** Expand one of the calculator's collapsed groups so its fields are reachable. */
async function openSection(page: Page, id: string) {
  await page.locator(`#${id}`).evaluate((el) => { (el as HTMLDetailsElement).open = true; });
}

/** The result link is rebuilt on every recalculation, so read it after filling. */
async function sendHref(page: Page) {
  const href = await page.getAttribute('#sendResult', 'href');
  return new URL(href ?? '', 'https://example.test');
}

test('the tray length the customer entered travels to the enquiry form', async ({ page }) => {
  await page.goto(calculatorPath);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');
  await page.fill('#trayLength', '2300');

  const url = await sendHref(page);
  expect(url.searchParams.get('tray_length')).toBe('2300');
  // The prose summary still goes across; the structured field is an addition.
  expect(url.searchParams.get('fit_check_summary')).toContain('Vehicle Suitability Checker result');
});

test('the tray length travels without any weight being entered', async ({ page }) => {
  // The redesign leads with tray dimensions, so this is the common path: a
  // customer gives their tray size and nothing else.
  await page.goto(calculatorPath);
  await page.fill('#trayLength', '2450');

  const url = await sendHref(page);
  expect(url.searchParams.get('tray_length')).toBe('2450');
});

test('no tray length is sent when the customer has not given one', async ({ page }) => {
  await page.goto(calculatorPath);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');

  const url = await sendHref(page);
  // A blank parameter would clear the field on the enquiry form, which is worse
  // than leaving it for the customer to fill in.
  expect(url.searchParams.has('tray_length')).toBe(false);
  expect(url.searchParams.get('fit_check_summary')).toContain('Vehicle Suitability Checker result');
});

test('the camper requirement is never sent as the customer tray length', async ({ page }) => {
  await page.goto(calculatorPath);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');
  // requiredTrayLength is the length the camper needs, not the tray they own.
  await openSection(page, 'camperDetails');
  await page.fill('#requiredTrayLength', '2100');

  const url = await sendHref(page);
  expect(url.searchParams.has('tray_length')).toBe(false);
});

test('the enquiry form fills its tray length from the parameter', async ({ page }) => {
  await page.goto(`/inquiry-form/?intent=vehicle-suitability&tray_length=2300`);
  await expect(page.locator('#trayLength')).toHaveValue('2300');
});

test('the vehicle the customer named travels to the enquiry form', async ({ page }) => {
  await page.goto(calculatorPath);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');
  await page.fill('#vehicleName', '2022 Ford Ranger Wildtrak');

  const url = await sendHref(page);
  expect(url.searchParams.get('vehicle_make_model_year')).toBe('2022 Ford Ranger Wildtrak');
});

test('the placeholder the summary uses is never sent as the vehicle', async ({ page }) => {
  await page.goto(calculatorPath);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');

  const url = await sendHref(page);
  // The prose falls back to 'your vehicle'. That reads fine in a sentence and
  // would be nonsense in a field meant to name a vehicle.
  expect(url.searchParams.get('fit_check_summary')).toContain('your vehicle');
  expect(url.searchParams.has('vehicle_make_model_year')).toBe(false);
});

test('a tub vehicle sends its tray type, and the picker fills the vehicle name', async ({ page }) => {
  await openWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-pickup-singleturbo');

  const url = await sendHref(page);
  expect(url.searchParams.get('tray_type')).toBe('Tub');
  expect(url.searchParams.get('vehicle_make_model_year')).toContain('Ranger');
});

test('a cab chassis sends no tray type, because a tray is not a tub', async ({ page }) => {
  await openWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo');

  const url = await sendHref(page);
  // Steel, alloy or canopy is not something the catalogue knows. Guessing it
  // would put an answer the customer never gave in front of Beyond RV.
  expect(url.searchParams.has('tray_type')).toBe(false);
});

test('no vehicle chosen means no tray type, despite the default state', async ({ page }) => {
  await openWithFixture(page);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');

  const url = await sendHref(page);
  // trayState starts as 'not_applicable', which would claim a tub for someone
  // who has not picked a vehicle at all.
  expect(url.searchParams.has('tray_type')).toBe(false);
});

const towingPath = '/caravan-towing-calculator/';

test('the towing calculator sends the vehicle the customer named', async ({ page }) => {
  await page.goto(towingPath);
  await page.fill('#gvm', '3350');
  await page.fill('#vehicleName', '2023 Toyota LandCruiser 300 GXL');

  const href = await page.getAttribute('#sendResult', 'href');
  const url = new URL(href ?? '', 'https://example.test');
  expect(url.searchParams.get('vehicle_make_model_year')).toBe('2023 Toyota LandCruiser 300 GXL');
  expect(url.searchParams.get('fit_check_summary')).toContain('caravan towing');
});

test('the towing calculator sends no tray type, and no GVM answer until given', async ({ page }) => {
  await page.goto(towingPath);
  await page.fill('#gvm', '3350');
  await page.fill('#vehicleName', '2023 Toyota LandCruiser 300 GXL');

  const href = await page.getAttribute('#sendResult', 'href');
  const url = new URL(href ?? '', 'https://example.test');
  // A caravan is towed rather than carried on a tray, so this page never asks.
  expect(url.searchParams.has('tray_type')).toBe(false);
  // Unanswered means unsent, rather than an assumed answer.
  expect(url.searchParams.has('gvm_upgrade_status')).toBe(false);
});

test('the towing calculator sends the GVM upgrade answer once given', async ({ page }) => {
  await page.goto(towingPath);
  await page.fill('#gvm', '3350');
  await page.selectOption('#gvmUpgrade', 'Yes');

  const href = await page.getAttribute('#sendResult', 'href');
  const url = new URL(href ?? '', 'https://example.test');
  expect(url.searchParams.get('gvm_upgrade_status')).toBe('Yes');
});

test('the towing calculator never sends its prose placeholder as the vehicle', async ({ page }) => {
  await page.goto(towingPath);
  await page.fill('#gvm', '3350');

  const href = await page.getAttribute('#sendResult', 'href');
  const url = new URL(href ?? '', 'https://example.test');
  expect(url.searchParams.get('fit_check_summary')).toContain('your vehicle');
  expect(url.searchParams.has('vehicle_make_model_year')).toBe(false);
});

test('the answers to the two new questions travel from the slide-on calculator', async ({ page }) => {
  await page.goto(calculatorPath);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');
  await page.selectOption('#trayType', 'Alloy tray');
  await page.selectOption('#gvmUpgrade', 'Yes');

  const url = await sendHref(page);
  expect(url.searchParams.get('tray_type')).toBe('Alloy tray');
  expect(url.searchParams.get('gvm_upgrade_status')).toBe('Yes');
});

test('the customer answer beats the catalogue guess about the tray', async ({ page }) => {
  await openWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  // A tub by the manufacturer's body type, which alone would send 'Tub'.
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-pickup-singleturbo');
  await expect.poll(async () => (await sendHref(page)).searchParams.get('tray_type')).toBe('Tub');

  // The person who owns the vehicle outranks the specification sheet.
  await page.selectOption('#trayType', 'Tray with canopy');
  const url = await sendHref(page);
  expect(url.searchParams.get('tray_type')).toBe('Tray with canopy');
});

test('neither new answer is sent until the customer gives one', async ({ page }) => {
  await page.goto(calculatorPath);
  await openVehicleDetails(page);
  await page.fill('#gvm', '3500');

  const url = await sendHref(page);
  expect(url.searchParams.has('tray_type')).toBe(false);
  expect(url.searchParams.has('gvm_upgrade_status')).toBe(false);
});

test('picking a vehicle produces the first payload result', async ({ page }) => {
  await openWithFixture(page);
  await page.selectOption('#vehicleMake', 'Ford');
  await page.selectOption('#vehicleModel', 'Ranger');
  await page.selectOption('#vehicleVariant', 'ford-ranger-2022my-4x4-xl-double-pickup-singleturbo');

  // The picker fills GVM and current weight, which is what the page says it
  // needs for the first payload result. Showing "Not calculated" beside the
  // customer's own figures made the picker look broken.
  await expect(page.locator('#availablePayload')).not.toHaveText('Not calculated');
  await expect(page.locator('#statusLabel')).not.toHaveText('Enter your numbers to calculate a result.');
});
