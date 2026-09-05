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

test('the header offers Calendar, Dashboard, Enquiries and Analytics one tap away', async ({ page }) => {
  await mockCalendar(page);
  await page.goto('/admin/');

  const nav = page.getByRole('navigation', { name: 'Quick navigation' });
  await expect(nav.getByRole('button', { name: 'Go to Calendar' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Open analytics dashboard' })).toHaveAttribute('href', '/admin/analytics/');

  await nav.getByRole('button', { name: 'Go to Enquiries' }).click();
  await expect(nav.getByRole('button', { name: 'Go to Enquiries' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('admin-calendar')).toHaveCount(0);

  await nav.getByRole('button', { name: 'Go to Calendar' }).click();
  await expect(page.getByTestId('admin-calendar')).toBeVisible();
});

test('the crew phone links section is visible without scrolling the sidebar', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'the sidebar is behind the menu on a phone');
  await mockCalendar(page);
  await page.route('**/.netlify/functions/admin-crew', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ crew: [] }),
  }));
  await page.goto('/admin/');

  // It sat below ten calendar rows and nobody found it, so it now has to be
  // in view when the sidebar opens.
  const crew = page.getByRole('button', { name: /Crew phone links/ });
  await expect(crew).toBeInViewport();

  // Above the ten calendar rows, which is where it was hidden before.
  const crewBox = await crew.boundingBox();
  const calendarsBox = await page.getByText('My calendars').boundingBox();
  expect(crewBox!.y).toBeLessThan(calendarsBox!.y);
});

test('any item can be given to several people', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  const { writes } = await mockCalendar(page);
  await page.goto('/admin/');

  await page.getByTestId('calendar-create').click();
  const form = page.getByTestId('event-form');
  // The picker is there for every kind, not just tasks: two people may be on
  // a handover, and both need it on their phone.
  await expect(page.getByTestId('event-assignees')).toBeVisible();
  await form.getByRole('radio', { name: 'Task' }).click();
  await expect(page.getByTestId('event-assignees')).toBeVisible();

  // Someone whose link was revoked is not offered work.
  await expect(page.getByTestId('event-assignee-crew-gone')).toHaveCount(0);

  await page.getByTestId('event-title').fill('Fit the Advent tray');
  await page.getByTestId('event-assignee-crew-li').click();
  await page.getByTestId('event-assignee-crew-oscar').click();
  await expect(page.getByTestId('event-assignee-crew-li')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('event-save').click();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({ action: 'create_task', title: 'Fit the Advent tray', assigneeIds: ['crew-li', 'crew-oscar'] });
});

test('a person can be taken off an item again', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  await mockCalendar(page);
  await page.goto('/admin/');
  await page.getByTestId('calendar-create').click();

  const li = page.getByTestId('event-assignee-crew-li');
  await li.click();
  await expect(li).toHaveAttribute('aria-pressed', 'true');
  await li.click();
  await expect(li).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Nobody picked: it stays yours.')).toBeVisible();
});

test('a customer visit can be handed to someone even though its date lives on the order', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  const { writes } = await mockCalendar(page);
  await page.goto('/admin/');

  await page.locator('.fc-event.gcal-kind-customer_visit').click();
  await page.getByTestId('event-detail').getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('event-assignee-crew-oscar').click();
  await page.getByTestId('event-save').click();

  await expect.poll(() => writes.map((w) => (w.body as Record<string, unknown>).action ?? 'move')).toContain('assign');
  const assign = writes.find((write) => (write.body as Record<string, unknown>).action === 'assign');
  expect(assign?.body).toMatchObject({ action: 'assign', kind: 'customer_visit', recordId: 'o1', assigneeIds: ['crew-oscar'] });
});

test('Save stays reachable when the popup grows past the bottom of the window', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'the phone sheet is anchored to the bottom already');
  await mockCalendar(page);
  // A short window, as a laptop with the browser chrome and the admin header
  // above the calendar gives you.
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto('/admin/');

  await page.getByTestId('calendar-create').click();
  const save = page.getByTestId('event-save');
  await expect(save).toBeInViewport();

  // Picking Task adds "Whose job", and a failed save adds an error line. The
  // card measured itself once on open, so it used to grow off the bottom and
  // Save became unclickable.
  await page.getByTestId('event-form').getByRole('radio', { name: 'Task' }).click();
  await expect(page.getByTestId('event-assignees')).toBeVisible();
  await expect(save).toBeInViewport();

  await save.click();
  await expect(page.getByText('Give it a title.')).toBeVisible();
  await expect(save).toBeInViewport();
  // And it is genuinely clickable, not merely within the viewport rectangle.
  await page.getByTestId('event-title').fill('Fit the Advent tray');
  await save.click();
  await expect(page.getByTestId('event-form')).toHaveCount(0);
});

test('a container ETA can be given to someone even though its date cannot move here', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  const { writes } = await mockCalendar(page);
  await page.goto('/admin/');
  // The ETA is a few days out, so show the month to reach it.
  await page.getByTestId('calendar-view').selectOption('month');

  await page.locator('.fc-event.gcal-kind-container_eta').first().click();
  await page.getByTestId('event-detail').getByRole('button', { name: 'Edit' }).click();
  // Its date lives on the product file and ships through Pending review, so
  // the date controls are not offered.
  await expect(page.getByTestId('event-date')).toBeHidden();
  await expect(page.getByText('Its date is set where the record is.')).toBeVisible();

  await page.getByTestId('event-assignee-crew-li').click();
  await page.getByTestId('event-save').click();

  await expect.poll(() => writes.map((w) => (w.body as Record<string, unknown>).action ?? 'move')).toEqual(['assign']);
  expect(writes[0].body).toMatchObject({ kind: 'container_eta', recordId: 'advent-2450', assigneeIds: ['crew-li'] });
});

test('a created event appears even when the listing has not caught up yet', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  // Netlify Blobs guarantees a read of a key you just wrote, but a listing is
  // eventually consistent. The GM created something, it did not appear, they
  // created it again, and then both appeared. This reproduces that listing lag.
  const created: Array<Record<string, unknown>> = [];
  let listingIsStale = true;

  await page.route('**/.netlify/functions/admin-dashboard?range=90', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ calendar: { events: [], clashes: [] } }),
  }));
  await page.route('**/.netlify/functions/admin-crew', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ crew: [] }),
  }));
  await page.route('**/.netlify/functions/admin-calendar-events**', async (route) => {
    if (route.request().method() === 'GET') {
      // The lag: the first listing after a write does not include it.
      const events = listingIsStale ? [] : created;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events }) });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const event = {
      id: `cal-${created.length + 1}`, notes: '', location: '', links: {}, assigneeIds: [],
      source: 'gm', createdBy: 'owner', createdAt: today, updatedAt: today, ...body,
    };
    created.push(event);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, event, message: 'Saved.' }) });
  });

  await page.goto('/admin/');
  await page.getByTestId('calendar-create').click();
  await page.getByTestId('event-title').fill('Yard walk');
  await page.getByTestId('event-save').click();

  // Visible immediately, from what the write returned, not from the listing.
  await expect(page.locator('.fc-event', { hasText: 'Yard walk' })).toHaveCount(1);

  // And still exactly one once the listing catches up: no duplicate.
  listingIsStale = false;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.locator('.fc-event', { hasText: 'Yard walk' })).toHaveCount(1);
});

test('assigning a meeting sticks, because it is filed where the calendar looks', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile));
  const { writes } = await mockCalendar(page);
  await page.goto('/admin/');

  await page.locator('.fc-event.gcal-ai').click();
  await page.getByTestId('event-detail').getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('event-assignee-crew-li').click();
  await page.getByTestId('event-save').click();

  await expect.poll(() => writes.map((w) => (w.body as Record<string, unknown>).action ?? 'other')).toContain('assign');
  const assign = writes.find((w) => (w.body as Record<string, unknown>).action === 'assign')!;
  // The event id has to travel, so the server files the owners under the same
  // id the grid reads them back by.
  expect(assign.body).toMatchObject({ kind: 'meeting', recordId: 'cal-ai-1', eventId: 'calendar:cal-ai-1', assigneeIds: ['crew-li'] });
});
