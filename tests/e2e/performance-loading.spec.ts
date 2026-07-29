import { expect, test } from '@playwright/test';

test('critical fonts and lightweight controls load before optional applications', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => localStorage.removeItem('brv_cookie_consent'));

  await page.goto('/');
  await expect(page.locator('[data-cookie-consent]')).toBeVisible();

  expect(requests.some(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'))).toBe(false);
  expect(requests.some(url => url.includes('us.i.posthog.com') || url.includes('SiteChatWidget'))).toBe(false);

  const cardSources = await page.locator('.range-grid img').evaluateAll(images =>
    images.map(image => image.getAttribute('src') || '')
  );
  expect(cardSources).toHaveLength(4);
  expect(cardSources.every(source => new URL(source, 'http://localhost').searchParams.has('h'))).toBe(true);
  const productCardSource = await page.locator('.product-card-image img').first().getAttribute('src');
  expect(new URL(productCardSource || '', 'http://localhost').searchParams.get('h')).toBe('500');

  const fontsReady = await page.evaluate(() => ({
    heading: document.fonts.check('32px "Bebas Neue"'),
    body: document.fonts.check('16px Outfit'),
    accent: document.fonts.check('italic 32px "Playfair Display"'),
  }));
  expect(fontsReady).toEqual({ heading: true, body: true, accent: true });

  await page.locator('[data-cookie-accept]').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('brv_cookie_consent'))).toBe('accepted');

  await page.locator('[data-lazy-chat-button]').click();
  await expect(page.getByRole('dialog', { name: 'Beyond RV chat assistant' })).toBeVisible();
  expect(requests.some(url => url.includes('SiteChatWidget'))).toBe(true);
  await page.locator('.chat-close-btn').click();
});
