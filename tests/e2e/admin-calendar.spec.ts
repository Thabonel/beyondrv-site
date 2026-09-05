import { expect, test } from '@playwright/test';
import { mockOwnerAdminSession } from './helpers/admin-session';
import { isoToday, mockCalendar } from './helpers/calendar-fixture';

const today = isoToday();

test.beforeEach(async ({ page }) => {
  await mockOwnerAdminSession(page);
});

test('the week grid opens scrolled to 8am inside its own scroller', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'phones open on Schedule; the week grid is covered below');
  await mockCalendar(page);
  await page.goto('/admin/');

  await expect(page.getByTestId('calendar-view')).toHaveValue('week');
  const grid = page.getByTestId('calendar-grid');
  await expect(grid.locator('.fc-timegrid-slot-label[data-time="08:00:00"]')).toBeAttached();

  // The 8am row is inside the visible grid and the 7am row is above it, so the
  // hours before opening exist but are scrolled away rather than filling the page.
  await expect.poll(async () => page.evaluate(() => {
    const scroller = document.querySelector('.fc-timegrid-slots')!.closest('.fc-scroller')!.getBoundingClientRect();
    const eight = document.querySelector('.fc-timegrid-slot-label[data-time="08:00:00"]')!.getBoundingClientRect();
    const seven = document.querySelector('.fc-timegrid-slot-label[data-time="07:00:00"]')!.getBoundingClientRect();
    return { eightVisible: eight.top >= scroller.top && eight.bottom < scroller.bottom, sevenAbove: seven.bottom <= scroller.top + 2 };
  })).toEqual({ eightVisible: true, sevenAbove: true });

  // The page itself does not grow to fit 24 hours.
  const pageScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(pageScroll).toBeLessThan(120);
});

test('a timed visit and an AI meeting render on the grid with their marks', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  await mockCalendar(page);
  await page.goto('/admin/');

  const visit = page.locator('.fc-event.gcal-kind-customer_visit');
  await expect(visit).toContainText('Tasmanian customer visiting');
  await expect(visit).toContainText('10am');
  await expect(visit.locator('.gcal-event__dot')).toBeVisible();

  const meeting = page.locator('.fc-event.gcal-ai');
  await expect(meeting).toContainText('Call with Li');
  await expect(meeting.locator('.gcal-event__ai')).toBeVisible();

  // A visit before the vehicle's container lands is called out.
  await expect(page.getByTestId('calendar-clashes')).toContainText('not due until');
});

test('clicking an AI event shows where it came from and offers Dismiss', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  const { writes } = await mockCalendar(page);
  await page.goto('/admin/');

  await page.locator('.fc-event.gcal-ai').click();
  const detail = page.getByTestId('event-detail');
  await expect(detail).toContainText('Added by AI');
  await expect(detail).toContainText('Shipping update');
  await expect(detail).toContainText('Can we talk at 2pm?');

  await detail.getByRole('button', { name: 'Dismiss' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].method).toBe('DELETE');
  expect(writes[0].body).toEqual({ id: 'cal-ai-1' });
});

test('clicking an empty slot opens quick-create, and saving posts a timed event', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  const { writes } = await mockCalendar(page);
  await page.goto('/admin/');

  // Click the 3pm slot on today's column, after scrolling the grid to it.
  const slot = page.locator('.fc-timegrid-slot-lane[data-time="15:00:00"]');
  await slot.scrollIntoViewIfNeeded();
  const column = page.locator('.fc-timegrid-col.fc-day-today');
  const columnBox = await column.boundingBox();
  const slotBox = await slot.boundingBox();
  await page.mouse.click(columnBox!.x + columnBox!.width / 2, slotBox!.y + 4);

  const form = page.getByTestId('event-form');
  await expect(form).toBeVisible();
  await expect(page.getByTestId('event-start')).toHaveValue('15:00');
  await expect(page.getByTestId('event-end')).toHaveValue('16:00');
  await page.getByTestId('event-title').fill('Yard walk with the fitters');
  await page.getByTestId('event-save').click();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].method).toBe('POST');
  expect(writes[0].body).toMatchObject({ title: 'Yard walk with the fitters', kind: 'meeting', start: `${today}T15:00`, end: `${today}T16:00`, allDay: false });
  await expect(page.locator('.fc-event', { hasText: 'Yard walk with the fitters' })).toBeVisible();
  await expect(page.getByTestId('calendar-status')).toContainText('Saved');
});

test('keyboard shortcuts switch views and return to today', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  await mockCalendar(page);
  await page.goto('/admin/');
  await expect(page.getByTestId('calendar-view')).toHaveValue('week');

  await page.keyboard.press('m');
  await expect(page.getByTestId('calendar-view')).toHaveValue('month');
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible();

  await page.keyboard.press('j');
  const movedTitle = await page.getByTestId('calendar-title').textContent();
  await page.keyboard.press('t');
  await expect(page.getByTestId('calendar-title')).not.toHaveText(movedTitle ?? '');
  await expect(page.locator('.fc-day-today')).toHaveCount(1);

  await page.keyboard.press('d');
  await expect(page.getByTestId('calendar-view')).toHaveValue('day');
  await page.keyboard.press('a');
  await expect(page.getByTestId('calendar-view')).toHaveValue('schedule');
  await expect(page.locator('.fc-list')).toBeVisible();

  // Typing in the search box must not trigger shortcuts.
  await page.getByTestId('calendar-search').fill('m');
  await expect(page.getByTestId('calendar-view')).toHaveValue('schedule');
});

test('hiding a calendar removes its events and the choice survives a reload', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  await mockCalendar(page);
  await page.goto('/admin/');
  await expect(page.locator('.fc-event.gcal-kind-customer_visit')).toBeVisible();

  await page.getByTestId('calendar-sidebar').getByLabel('Customer visit').uncheck();
  await expect(page.locator('.fc-event.gcal-kind-customer_visit')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.fc-event.gcal-ai')).toBeVisible();
  await expect(page.locator('.fc-event.gcal-kind-customer_visit')).toHaveCount(0);
});

test('a phone opens on Schedule with the sidebar hidden, and Week shows three days', async ({ page }) => {
  await page.setViewportSize({ width: 340, height: 720 });
  await mockCalendar(page);
  await page.goto('/admin/');

  await expect(page.getByTestId('calendar-view')).toHaveValue('schedule');
  await expect(page.getByTestId('calendar-sidebar')).toHaveCount(0);
  await expect(page.locator('.fc-list-event', { hasText: 'Tasmanian customer' })).toBeVisible();

  await page.getByTestId('calendar-view').selectOption('week');
  await expect(page.locator('.fc-col-header-cell')).toHaveCount(3);

  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.getByTestId('calendar-sidebar')).toBeVisible();
});

test('a handover created from the popup picks an order and writes the date onto it', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  const { writes } = await mockCalendar(page);
  await page.goto('/admin/');

  await page.getByTestId('calendar-create').click();
  const form = page.getByTestId('event-form');
  await expect(form).toBeVisible();
  await form.getByRole('radio', { name: 'Handover' }).click();
  // The order names the event, so there is no title to type.
  await expect(page.getByTestId('event-title-from-order')).toContainText('Handover');
  await expect(page.getByTestId('event-title')).toHaveCount(0);

  await page.getByTestId('event-title-from-order').waitFor();
  const order = page.getByTestId('event-order');
  await expect(order.locator('option', { hasText: 'Ben · Sunpatch 15' })).toHaveCount(1);
  await order.selectOption('o2');
  await page.getByTestId('event-date').fill(`${today}`);
  await page.getByTestId('event-start').fill('10:00');
  // Moving the start moves the end with it, so the form is never left in a
  // state it refuses to save. This failed on CI, where Create opens at 08:00.
  await expect(page.getByTestId('event-end')).toHaveValue('11:00');
  await page.getByTestId('event-save').click();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].url).toContain('admin-calendar-write');
  expect(writes[0].body).toEqual({ kind: 'expected_handover', recordId: 'o2', date: today, time: '10:00' });
  await expect(page.getByTestId('calendar-status')).toContainText('Moved');
});
