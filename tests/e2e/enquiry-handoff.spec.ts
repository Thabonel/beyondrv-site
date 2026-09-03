import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const calculatorPath = '/slide-on-camper-weight-calculator/';

/** The result link is rebuilt on every recalculation, so read it after filling. */
async function sendHref(page: Page) {
  const href = await page.getAttribute('#sendResult', 'href');
  return new URL(href ?? '', 'https://example.test');
}

test('the tray length the customer entered travels to the enquiry form', async ({ page }) => {
  await page.goto(calculatorPath);
  await page.fill('#gvm', '3500');
  await page.fill('#trayLength', '2300');

  const url = await sendHref(page);
  expect(url.searchParams.get('tray_length')).toBe('2300');
  // The prose summary still goes across; the structured field is an addition.
  expect(url.searchParams.get('fit_check_summary')).toContain('Vehicle Suitability Checker result');
});

test('the finder tray length is used when the detailed field is empty', async ({ page }) => {
  await page.goto(calculatorPath);
  await page.fill('#finderTrayLength', '2450');
  await page.fill('#gvm', '3500');

  const url = await sendHref(page);
  expect(url.searchParams.get('tray_length')).toBe('2450');
});

test('no tray length is sent when the customer has not given one', async ({ page }) => {
  await page.goto(calculatorPath);
  await page.fill('#gvm', '3500');

  const url = await sendHref(page);
  // A blank parameter would clear the field on the enquiry form, which is worse
  // than leaving it for the customer to fill in.
  expect(url.searchParams.has('tray_length')).toBe(false);
  expect(url.searchParams.get('fit_check_summary')).toContain('Vehicle Suitability Checker result');
});

test('the camper requirement is never sent as the customer tray length', async ({ page }) => {
  await page.goto(calculatorPath);
  await page.fill('#gvm', '3500');
  // requiredTrayLength is the length the camper needs, not the tray they own.
  await page.fill('#requiredTrayLength', '2100');

  const url = await sendHref(page);
  expect(url.searchParams.has('tray_length')).toBe(false);
});

test('the enquiry form fills its tray length from the parameter', async ({ page }) => {
  await page.goto(`/inquiry-form/?intent=vehicle-suitability&tray_length=2300`);
  await expect(page.locator('#trayLength')).toHaveValue('2300');
});
