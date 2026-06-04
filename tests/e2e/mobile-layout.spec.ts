import { expect, test } from '@playwright/test';

const mobilePages = [
  '/',
  '/our-slide-on-campers/',
  '/our-caravans/',
  '/on-sale/',
  '/advent-2300-hardtop-slide-on/',
  '/sunpatch-15xc-couples-offroad-van/',
  '/expedition/4-7m-hardtop-truck-camper/',
  '/vehicle-suitability-checker/',
  '/slide-on-camper-weight-calculator/',
  '/caravan-towing-calculator/',
  '/inquiry-form/',
  '/about-us/',
  '/custom/',
  '/guides/gvm-gcm-atm-gtm-explained/',
];

test.describe('mobile layout stability', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  for (const path of mobilePages) {
    test(`${path} has no page-level horizontal overflow at 320px`, async ({ page }) => {
      await page.goto(path);

      const overflow = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        return Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - viewportWidth;
      });

      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('product extras fit within the 320px viewport', async ({ page }) => {
    await page.goto('/advent-2300-hardtop-slide-on/');
    await page.locator('.extras-total-bar').scrollIntoViewIfNeeded();

    const layout = await page.locator('.extras-total-bar').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        right: rect.right,
        width: rect.width,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  });

  test('chat panel fills the mobile viewport and hides the launcher while open', async ({ page }) => {
    await page.goto('/');
    const accept = page.getByRole('button', { name: 'Accept' });
    if (await accept.isVisible()) await accept.click();

    await page.locator('.chat-widget-btn').click();
    await expect(page.locator('.chat-panel')).toBeVisible();

    const layout = await page.locator('.chat-panel').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        launcherDisplay: getComputedStyle(document.querySelector('.chat-widget-btn')!).display,
      };
    });

    expect(layout.top).toBeLessThanOrEqual(24);
    expect(layout.height).toBeGreaterThanOrEqual(layout.viewportHeight - 24);
    expect(layout.bottom).toBeGreaterThanOrEqual(layout.viewportHeight - 1);
    expect(layout.launcherDisplay).toBe('none');
  });

  test('authority tables are contained in an intentional scroll area', async ({ page }) => {
    await page.goto('/vehicle-suitability-checker/');

    const table = await page.locator('.authority-table-wrap').evaluate((el) => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      pageOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - document.documentElement.clientWidth,
    }));

    expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
    expect(table.pageOverflow).toBeLessThanOrEqual(1);
  });

  test('enquiry form does not show the floating chat launcher on mobile', async ({ page }) => {
    await page.goto('/inquiry-form/');
    await expect(page.locator('.chat-widget')).toHaveCSS('display', 'none');
  });
});
