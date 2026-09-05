import { expect, test, type Page } from '@playwright/test';

/**
 * The phone flow, at the width of a folded phone. No admin session is mocked
 * anywhere in this file on purpose: the whole point is that Li and Oscar never
 * log in, so if any of this needed a session it would fail here.
 */

const KEY = 'a'.repeat(43);

function isoToday(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const today = isoToday();

async function mockCrew(page: Page) {
  const writes: Array<{ body: Record<string, unknown>; key: string }> = [];
  const jobs = [
    { id: 't1', title: 'Fit the Advent tray', date: today, time: '09:00', done: false, overdue: false },
    { id: 't2', title: 'Chase the shipping agent', date: isoToday(-3), time: '', done: false, overdue: true },
    { id: 't3', title: 'Check the gas cert', date: today, time: '', done: true, overdue: false },
  ];

  await page.route('**/.netlify/functions/crew-day**', async (route) => {
    const key = route.request().headers()['x-crew-key'] ?? '';
    if (key !== KEY) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'This link is not working. Ask Alex to send you a new one.' }) });
      return;
    }
    const date = new URL(route.request().url()).searchParams.get('date') ?? today;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        scope: 'crew', name: 'Li', today, date,
        jobs: date === today ? jobs : [],
        yard: date === today
          ? [
            { kind: 'customer_visit', title: 'Tasmanian customer visiting · Advent 2450', time: '10:00' },
            { kind: 'container_eta', title: 'Container ETA: Sunpatch 21', time: '' },
          ]
          : [],
        note: date === today ? 'waiting on parts' : '',
        containers: [
          { slug: 'advent-2450', title: 'Advent 2450', publishedEta: '2026-09-20' },
          { slug: 'sunpatch-21', title: 'Sunpatch 21', publishedEta: '' },
        ],
      }),
    });
  });

  await page.route('**/.netlify/functions/crew-write', async (route) => {
    writes.push({ body: route.request().postDataJSON() as Record<string, unknown>, key: route.request().headers()['x-crew-key'] ?? '' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, message: 'Done.' }) });
  });

  return { writes };
}

test.use({ viewport: { width: 340, height: 720 } });

test('with no key the page says to ask Alex, and shows nothing else', async ({ page }) => {
  await mockCrew(page);
  await page.goto('/my-day/');

  await expect(page.getByText('Ask Alex to send you a new one')).toBeVisible();
  await expect(page.getByTestId('my-day')).toHaveCount(0);
  await expect(page.getByTestId('myday-job')).toHaveCount(0);
});

test('the key travels in the fragment and is cleared from the address bar', async ({ page }) => {
  await mockCrew(page);
  await page.goto(`/my-day/#k=${KEY}`);

  await expect(page.getByTestId('my-day')).toBeVisible();
  // The fragment is gone once it has been read, so the key is not sitting in
  // the address bar or in a screenshot of it.
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('beyondrv.crew.key'))).toBe(KEY);

  // A reload with no fragment still works, from the cached key.
  await page.goto('/my-day/');
  await expect(page.getByTestId('my-day')).toBeVisible();
});

test('their day shows their jobs, overdue ones, and the yard read-only', async ({ page }) => {
  await mockCrew(page);
  await page.goto(`/my-day/#k=${KEY}`);

  await expect(page.getByTestId('myday-date')).toContainText(new Date().toLocaleDateString('en-AU', { weekday: 'long' }));
  await expect(page.getByTestId('myday-job')).toHaveCount(3);
  await expect(page.getByText('Fit the Advent tray', { exact: true })).toBeVisible();
  await expect(page.getByTestId('myday-job').filter({ hasText: 'Chase the shipping agent' })).toContainText('from');

  const yard = page.getByTestId('myday-yard-item');
  await expect(yard).toHaveCount(2);
  await expect(yard.first()).toContainText('Tasmanian customer visiting');
  await expect(yard.first()).toContainText('10am');
  // Nothing in the yard is a control: they can see it, not move it.
  await expect(yard.locator('button, input, select, a')).toHaveCount(0);
});

test('ticking off, adding and moving a job each post with the key in a header', async ({ page }) => {
  const { writes } = await mockCrew(page);
  await page.goto(`/my-day/#k=${KEY}`);
  await expect(page.getByTestId('my-day')).toBeVisible();

  await page.getByRole('button', { name: 'Tick off "Fit the Advent tray"' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({ action: 'complete_task', taskId: 't1' });
  expect(writes[0].key).toBe(KEY);

  await page.getByTestId('myday-add').click();
  await page.getByTestId('myday-new-job').fill('Sweep the bay');
  await page.getByTestId('myday-add-save').click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].body).toEqual({ action: 'add_task', title: 'Sweep the bay', date: today });

  // Wait for the refresh that follows the add, so the note field has settled
  // before it is edited.
  await expect(page.getByTestId('myday-note')).toHaveValue('waiting on parts');
  await page.getByTestId('myday-note').fill('parts arrived');
  await page.getByTestId('myday-note').blur();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].body).toEqual({ action: 'set_note', date: today, note: 'parts arrived' });
});

test('the day can be moved back and forward, and Today returns', async ({ page }) => {
  await mockCrew(page);
  await page.goto(`/my-day/#k=${KEY}`);
  await expect(page.getByTestId('myday-job')).toHaveCount(3);

  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByText('Nothing on for this day.')).toBeVisible();
  await expect(page.getByTestId('myday-job')).toHaveCount(0);

  await page.getByRole('button', { name: 'Back to today' }).click();
  await expect(page.getByTestId('myday-job')).toHaveCount(3);
});

test('the manifest has no start_url, so an installed icon keeps its key', async ({ page }) => {
  const response = await page.request.get('/my-day.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json() as Record<string, unknown>;
  // Without start_url the launch URL defaults to the document URL, fragment
  // included. On iPhone the installed app has its own storage and cannot read
  // what Safari cached, so the key has to arrive in the URL or the icon opens
  // to nothing.
  expect(manifest.start_url).toBeUndefined();
  expect(manifest.display).toBe('standalone');
});

test('the day fits every normal phone width without sideways scrolling', async ({ page }) => {
  await mockCrew(page);
  // The widths of the phones people actually carry, plus the folded width of
  // Alex's. Nothing here may push the page sideways: a workshop phone held in
  // one hand should never need panning to read a job.
  for (const width of [320, 340, 375, 390, 393, 414, 430]) {
    await page.setViewportSize({ width, height: 760 });
    await page.goto(`/my-day/#k=${KEY}`);
    await expect(page.getByTestId('myday-job').first()).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth, `${width}px pans sideways`).toBeLessThanOrEqual(overflow.clientWidth + 1);

    // The tick is what they came to press, so it stays a comfortable target.
    const tick = await page.getByRole('button', { name: /^Tick off/ }).first().boundingBox();
    expect(tick!.height, `${width}px tick target`).toBeGreaterThanOrEqual(44);
    expect(tick!.width, `${width}px tick target`).toBeGreaterThanOrEqual(40);
  }
});

test('the page asks not to be indexed', async ({ page }) => {
  await page.goto('/my-day/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('Li can tell Alex when a container is landing, without changing the website', async ({ page }) => {
  const { writes } = await mockCrew(page);
  await page.goto(`/my-day/#k=${KEY}`);
  await expect(page.getByTestId('my-day')).toBeVisible();

  await expect(page.getByText('It does not change the website.')).toBeVisible();
  await page.getByTestId('container-report').click();

  // The date the website currently shows is on the option, so he can see
  // whether what he was told is actually news.
  await expect(page.getByTestId('container-vehicle').locator('option').nth(1)).toHaveText('Advent 2450 — currently 2026-09-20');

  await page.getByTestId('container-vehicle').selectOption('advent-2450');
  await page.getByTestId('container-date').fill('2026-09-27');
  await page.getByTestId('container-note').fill('shipping line called');
  await page.getByTestId('container-save').click();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({
    action: 'report_container', productSlug: 'advent-2450', date: '2026-09-27', note: 'shipping line called',
  });
  expect(writes[0].key).toBe(KEY);
});

test('a whole-calendar link shows the day rather than an empty page', async ({ page }) => {
  // The gm payload has no jobs list. The page used to fall through to the crew
  // layout, read a jobs array that was not there, and show "nothing on".
  await page.route('**/.netlify/functions/crew-day**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      scope: 'gm', name: 'Alex', today, date: today,
      calendar: {
        events: [
          { id: 'customer_visit:o1', kind: 'customer_visit', date: today, start: `${today}T10:00`, end: `${today}T11:00`, allDay: false, title: 'Tasmanian customer visiting', detail: '', isCommitment: true, source: 'record' },
          { id: 'calendar:c1', kind: 'meeting', date: today, start: `${today}T14:00`, end: `${today}T14:30`, allDay: false, title: 'Call with Li', detail: '', isCommitment: false, source: 'ai' },
        ],
        clashes: ['Tasmanian customer visiting on ' + today + ', but the container is not due until later.'],
      },
    }),
  }));
  await page.goto(`/my-day/#k=${KEY}`);

  await expect(page.getByTestId('my-day')).toBeVisible();
  await expect(page.getByText('whole calendar')).toBeVisible();
  await expect(page.getByTestId('myday-gm-item')).toHaveCount(2);
  await expect(page.getByTestId('myday-clashes')).toContainText('not due until');
  await expect(page.getByText('Nothing on for this day.')).toHaveCount(0);
});
