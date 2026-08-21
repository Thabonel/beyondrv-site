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

test('an archived product is not reachable through search', async ({ page }) => {
  await page.goto('/search/?q=sunpatch%2012c');

  await expect(page.getByTestId('search-empty')).toBeVisible();
  await expect(page.getByTestId('search-result')).toHaveCount(0);
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
