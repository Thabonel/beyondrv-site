import { expect, test } from '@playwright/test';

test('deep-linking a query renders matching results without typing', async ({ page }) => {
  await page.goto('/search/?q=advent');

  const results = page.getByTestId('search-result');
  await expect(results.first()).toBeVisible();
  await expect(results.filter({ hasText: 'Advent 2450' })).toHaveCount(1);
});

test('a question about weights finds the guide, not a product', async ({ page }) => {
  await page.goto('/search/?q=gvm');

  const guides = page.getByTestId('search-group-guide');
  await expect(guides).toBeVisible();
  await expect(guides.getByTestId('search-result').filter({ hasText: 'GVM, GCM, ATM and GTM Explained' })).toHaveCount(1);
});

test('weight calculator search finds the slide-on calculator directly', async ({ page }) => {
  await page.goto('/search/?q=weight%20calculator');

  const result = page.getByTestId('search-result').filter({ hasText: 'Slide-On Camper Weight Calculator' });
  await expect(result).toHaveCount(1);
  await expect(result.getByRole('link')).toHaveAttribute('href', '/slide-on-camper-weight-calculator/');
});

test('an archived product is not reachable through search', async ({ page }) => {
  await page.goto('/search/?q=sunpatch%2012c');

  // The other Sunpatch vans are a good answer to this query; the archived
  // 12C must not be among them.
  await expect(page.getByTestId('search-result').first()).toBeVisible();
  await expect(page.getByTestId('search-result').filter({ hasText: 'Sunpatch 12C' })).toHaveCount(0);
});

test('a query that matches nothing offers the enquiry form', async ({ page }) => {
  await page.goto('/search/?q=submarine');

  const empty = page.getByTestId('search-empty');
  await expect(empty).toBeVisible();
  await expect(empty.getByRole('link', { name: /enquir/i })).toHaveAttribute('href', '/inquiry-form/');
});

test('visiting the search page with no query prompts rather than listing everything', async ({ page }) => {
  await page.goto('/search/');

  await expect(page.getByTestId('search-no-query')).toBeVisible();
  await expect(page.getByTestId('search-result')).toHaveCount(0);
});

test('typing on the results page updates both the results and the url', async ({ page }) => {
  await page.goto('/search/?q=advent');

  await page.getByTestId('search-page-input').fill('unimog');

  await expect(page.getByTestId('search-result').filter({ hasText: 'Unimog' }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/search\/\?q=unimog$/);
});

test('the header search submits to the results page', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('unimog');
  await page.getByTestId('header-search-input').press('Enter');

  await expect(page).toHaveURL(/\/search\/\?q=unimog/);
  await expect(page.getByTestId('search-result').first()).toBeVisible();
});

test('the header search form works as a plain GET form', async ({ page }) => {
  await page.goto('/');

  const form = page.getByTestId('header-search-form');
  await expect(form).toHaveAttribute('action', '/search/');
  await expect(form).toHaveAttribute('method', 'get');
  await expect(page.getByTestId('header-search-input')).toHaveAttribute('name', 'q');
});

test('typing in the header opens a dropdown of matches', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('adv');

  const options = page.getByTestId('header-search-option');
  await expect(options.first()).toBeVisible();
  await expect(options.filter({ hasText: 'Advent' }).first()).toBeVisible();
});

test('a single character is too little to open the dropdown', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('a');

  await expect(page.getByTestId('header-search-listbox')).toBeHidden();
});

test('arrow down then enter opens the highlighted result', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  const input = page.getByTestId('header-search-input');
  await input.fill('unimog');
  await expect(page.getByTestId('header-search-option').first()).toBeVisible();

  await input.press('ArrowDown');
  await input.press('Enter');

  await expect(page).toHaveURL(/unimog/);
});

test('escape closes the dropdown and leaves focus in the input', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  const input = page.getByTestId('header-search-input');
  await input.fill('advent');
  await expect(page.getByTestId('header-search-option').first()).toBeVisible();

  await input.press('Escape');

  await expect(page.getByTestId('header-search-listbox')).toBeHidden();
  await expect(input).toBeFocused();
});

test('the dropdown offers a route to the full results page', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('advent');
  await expect(page.getByTestId('header-search-option').first()).toBeVisible();

  await page.getByTestId('header-search-see-all').click();

  await expect(page).toHaveURL(/\/search\/\?q=advent/);
});

test('the dropdown announces how many results it found', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('unimog');

  await expect(page.getByTestId('header-search-status')).toContainText(/result/i);
});

test('the homepage advertises a search endpoint that exists', async ({ page }) => {
  await page.goto('/');

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  // A block may hold a single schema object or an array of them.
  const website = blocks
    .flatMap((raw) => {
      const parsed = JSON.parse(raw) as Record<string, any> | Record<string, any>[];
      return Array.isArray(parsed) ? parsed : [parsed];
    })
    .find((schema) => schema['@type'] === 'WebSite');

  expect(website).toBeTruthy();
  expect(website.potentialAction.target.urlTemplate).toBe('https://beyondrv.com.au/search/?q={search_term_string}');
});

test('a natural-language question with an unknown vehicle still returns slide-ons', async ({ page }) => {
  await page.goto('/search/?q=slide%20on%20for%20for%20ford%20ranger');

  await expect(page.getByTestId('search-empty')).toHaveCount(0);
  const results = page.getByTestId('search-result');
  await expect(results.first()).toBeVisible();
  await expect(results.filter({ hasText: 'Slide-On' }).first()).toBeVisible();
});

test('a vehicle the site knows nothing about is called out, not silently ignored', async ({ page }) => {
  await page.goto('/search/?q=slide%20on%20for%20my%20ford%20ranger');

  const notice = page.getByTestId('search-unmatched');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('ford ranger');
  await expect(notice.getByRole('link', { name: /suitability/i })).toHaveAttribute('href', '/vehicle-suitability-checker/');
});

test('a query of only unknown vehicle words says so plainly', async ({ page }) => {
  await page.goto('/search/?q=toyota%20super%20duty');

  await expect(page.getByTestId('search-empty')).toBeVisible();
  await expect(page.getByTestId('search-result')).toHaveCount(0);
});

test('an expedition vehicle is not dragged into a search for on', async ({ page }) => {
  await page.goto('/search/?q=slide%20on');

  await expect(page.getByTestId('search-result').filter({ hasText: 'Mercedes Sprinter' })).toHaveCount(0);
  await expect(page.getByTestId('search-result').filter({ hasText: 'Sunpatch' })).toHaveCount(0);
});

test('the mobile dropdown sits in flow and is bounded, so the keyboard cannot cover it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/');
  await page.getByTestId('header-search-toggle').click();
  await page.getByTestId('header-search-input').fill('adv');
  await expect(page.getByTestId('header-search-option').first()).toBeVisible();

  const style = await page.evaluate(() => {
    const listbox = document.querySelector('.nav-search-listbox') as HTMLElement;
    const toggle = document.querySelector('.nav-search-toggle') as HTMLElement;
    return {
      position: getComputedStyle(listbox).position,
      maxHeight: getComputedStyle(listbox).maxHeight,
      togglePaddingLeft: getComputedStyle(toggle).paddingLeft,
      fortyVh: `${window.innerHeight * 0.4}px`,
    };
  });

  // Inside the fixed search panel the list must sit in normal flow; floating it
  // puts it behind the on-screen keyboard.
  expect(style.position).toBe('static');
  expect(style.maxHeight).toBe(style.fortyVh);
  // The toggle shrinks to its icon on mobile so the nav row keeps its budget.
  expect(style.togglePaddingLeft).toBe('8px');
});

test.describe('with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('the search page says it needs JavaScript instead of rendering blank', async ({ page }) => {
    await page.goto('/search/?q=advent');

    const notice = page.getByTestId('search-noscript');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/javascript/i);
    // A dead end is worse than no search, so offer somewhere to go.
    await expect(notice.getByRole('link', { name: /slide-on campers/i })).toBeVisible();
    await expect(notice.getByRole('link', { name: /enquiry/i })).toBeVisible();
    // The compiler strips spaces around an inline <a>, so the links are a list.
    await expect(notice.getByRole('listitem')).toHaveCount(5);
  });
});
