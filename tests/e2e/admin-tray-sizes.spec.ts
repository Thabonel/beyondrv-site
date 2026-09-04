import { expect, test } from '@playwright/test';
import { mockOwnerAdminSession } from './helpers/admin-session';

test.beforeEach(async ({ page }) => {
  await mockOwnerAdminSession(page);
});

// The dashboard renders its panels behind `data &&` and they dereference
// data.inventory.byCategory and friends, so an empty payload crashes the page.
const dashboard = {
  generatedAt: '2026-08-21T00:00:00.000Z',
  range: '30',
  decisions: [],
  lifecycle: [],
  orders: {
    total: 0, paid: 0, enquiryLinked: 0, shippingBlocked: 0,
    byStatus: [], byShippingStatus: [], recent: [],
  },
  inventory: {
    totalProducts: 0, available: 0, onSale: 0, comingSoon: 0, featured: 0, estimatedListedValue: 0,
    byCategory: [], byStatus: [], planning: [], weakListings: [],
  },
  leads: { last7Days: 0, last30Days: 0, open: 0, dueToday: 0, overdue: 0, byStatus: [], priorityQueue: [], followUpQueue: [], recent: [] },
  tasks: { open: 0, dueToday: 0, overdue: 0, recent: [] },
  productPerformance: [],
  productInterest: { unknownProductEnquiries: 0, topProducts: [], staleProducts: [] },
  traffic: [], funnel: [],
  // This panel is unrelated to marketing insights, so the list stays empty.
  marketingInsights: { status: 'ready', message: '', items: [] },
  chat: { topTopics: [], recent: [] },
  analytics: { status: 'unavailable', message: 'Not configured' },
  contact: { ready: true, toEmail: 'test@example.com', fromEmail: 'test@example.com' },
  readiness: [],
};

const RANGER = 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo';

const record = {
  variantId: RANGER,
  label: 'Ford Ranger XL double cab cab chassis 4x4 part-time (2022) 2.0L single-turbo diesel',
  sizes: [
    { lengthMm: 2100, widthMm: 1800, reports: 7, firstReportedAt: '2026-08-01T00:00:00.000Z', lastReportedAt: '2026-08-20T00:00:00.000Z' },
    { lengthMm: 3900, widthMm: 2400, reports: 1, firstReportedAt: '2026-08-19T00:00:00.000Z', lastReportedAt: '2026-08-19T00:00:00.000Z' },
  ],
  totalReports: 8,
  updatedAt: '2026-08-20T00:00:00.000Z',
};

test('reported tray sizes are listed with their counts and can be deleted', async ({ page }) => {
  const deletes: Array<Record<string, unknown>> = [];

  await page.route('**/.netlify/functions/admin-dashboard?range=30', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) }));
  await page.route('**/.netlify/functions/admin-marketing-ideas', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ideas: [] }) }));

  await page.route('**/.netlify/functions/admin-tray-sizes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [record] }) });
      return;
    }
    deletes.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/admin/');

  // The owner sees the vehicle, not a database id.
  await expect(page.getByText('Ford Ranger XL double cab cab chassis', { exact: false })).toBeVisible();

  const rows = page.getByTestId('tray-size-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('2100');
  await expect(rows.first()).toContainText('7');

  // The lone outlier is the one worth removing; the seven-report size stays.
  await rows.nth(1).getByRole('button', { name: /delete/i }).click();

  await expect.poll(() => deletes.length).toBe(1);
  expect(deletes[0]).toEqual({ variantId: RANGER, lengthMm: 3900, widthMm: 2400 });
});

test('a vehicle with no reports says so rather than showing an empty panel', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-dashboard?range=30', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) }));
  await page.route('**/.netlify/functions/admin-marketing-ideas', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ideas: [] }) }));
  await page.route('**/.netlify/functions/admin-tray-sizes', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [] }) }));

  await page.goto('/admin/');

  await expect(page.getByText('No tray sizes reported yet', { exact: false })).toBeVisible();
});
