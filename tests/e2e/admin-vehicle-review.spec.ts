import { expect, test, type Page } from '@playwright/test';
import { mockOwnerAdminSession } from './helpers/admin-session';
import { emptyDashboard } from './helpers/dashboard-fixture';

const CANDIDATES = {
  make: 'Ford',
  makes: ['Ford', 'Toyota'],
  candidates: [
    {
      id: 'ford-a', make: 'Ford', model: 'Ranger', modelYear: 2023, grade: 'XLT',
      cabType: 'dual', bodyType: 'cab_chassis', gvmKg: 3350, kerbKg: 2300,
      trayLengthMm: null, trayWidthMm: null, verificationStatus: 'source_verified',
      source: { manufacturer: 'Ford', title: 'Spec sheet', url: 'https://example.com/a' },
      included: true, corrections: {},
    },
    {
      id: 'ford-b', make: 'Ford', model: 'Ranger', modelYear: 2023, grade: 'Wildtrak',
      cabType: 'dual', bodyType: 'pickup_tub', gvmKg: 3280, kerbKg: 2350,
      trayLengthMm: 1550, trayWidthMm: 1520, verificationStatus: 'needs_secondary_review',
      source: { manufacturer: 'Ford', title: 'Spec sheet', url: 'https://example.com/b' },
      included: false, corrections: {},
    },
  ],
};

async function openDashboard(page: Page, body: typeof CANDIDATES = CANDIDATES) {
  await mockOwnerAdminSession(page);
  await page.route('**/.netlify/functions/admin-dashboard?range=30', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(emptyDashboard),
  }));
  await page.route('**/.netlify/functions/admin-marketing-ideas', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ideas: [] }),
  }));
  await page.route('**/.netlify/functions/admin-vehicle-review**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body),
  }));
  await page.goto('/admin/');
}

test('the panel lists candidates and ticks only the source-verified ones', async ({ page }) => {
  await openDashboard(page);

  await expect(page.getByTestId('vehicle-review-row')).toHaveCount(2);
  await expect(page.getByTestId('vehicle-review-tick-ford-a')).toBeChecked();
  // A row nobody has verified must not publish by simply being in the list.
  await expect(page.getByTestId('vehicle-review-tick-ford-b')).not.toBeChecked();
  await expect(page.getByTestId('vehicle-review-needs-check')).toHaveCount(1);
});

test('the publish button counts only ticked rows', async ({ page }) => {
  await openDashboard(page);

  await expect(page.getByTestId('vehicle-review-publish')).toHaveText('Publish 1 Ford vehicle');

  await page.getByTestId('vehicle-review-tick-ford-b').check();
  await expect(page.getByTestId('vehicle-review-publish')).toHaveText('Publish 2 Ford vehicles');
});

test('publishing nothing is not offered', async ({ page }) => {
  const none = { ...CANDIDATES, candidates: CANDIDATES.candidates.map((c) => ({ ...c, included: false })) };
  await openDashboard(page, none);

  await expect(page.getByTestId('vehicle-review-publish')).toBeDisabled();
});

test('a corrected figure is marked as corrected', async ({ page }) => {
  await openDashboard(page);

  await page.getByTestId('vehicle-review-gvmKg-ford-a').fill('3399');

  await expect(page.getByTestId('vehicle-review-row').first()).toContainText('corrected');
});
