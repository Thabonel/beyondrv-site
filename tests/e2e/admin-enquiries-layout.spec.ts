import { expect, test } from '@playwright/test';

function enquiry(index: number) {
  return {
    id: `enquiry-${index}`,
    name: `Test Customer ${index}`,
    email: `customer${index}@example.com`,
    phone: `04000000${String(index).padStart(2, '0')}`,
    message: `Enquiry message ${index}`,
    product_interest: 'Advent 2300',
    received_at: `2026-06-${String(Math.max(1, 15 - index)).padStart(2, '0')}T09:00:00+10:00`,
    source_type: 'website_form',
    leadStatus: {
      status: 'new',
      priority: 'warm',
      nextFollowUpDate: '2026-06-15',
    },
  };
}

test('enquiries and reminders share one scroll container', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-enquiries', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ enquiries: Array.from({ length: 12 }, (_, index) => enquiry(index + 1)) }),
  }));
  await page.route('**/.netlify/functions/admin-contact-config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ready: true, toEmail: 'test@example.com', missing: [] }),
  }));

  await page.goto('/admin/');
  await page.getByRole('button', { name: 'enquiries' }).click();

  const scrollContainer = page.getByTestId('enquiries-scroll-container');
  const records = page.getByTestId('enquiries-records');
  await expect(page.getByText('Test Customer 12')).toBeAttached();

  const layout = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="enquiries-scroll-container"]') as HTMLElement;
    const recordsList = document.querySelector('[data-testid="enquiries-records"]') as HTMLElement;
    return {
      containerOverflow: getComputedStyle(container).overflowY,
      recordsOverflow: getComputedStyle(recordsList).overflowY,
      isScrollable: container.scrollHeight > container.clientHeight,
    };
  });

  expect(layout).toEqual({
    containerOverflow: 'auto',
    recordsOverflow: 'visible',
    isScrollable: true,
  });

  await page.getByRole('button', { name: 'Show Reminders (24)' }).click();
  await expect(page.getByRole('button', { name: 'Hide Reminders' })).toBeVisible();

  await scrollContainer.evaluate(element => element.scrollTo(0, element.scrollHeight));
  await expect(page.getByText('Test Customer 12')).toBeVisible();
  await expect(records).toBeVisible();
});
