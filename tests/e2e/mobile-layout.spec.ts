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

const iphoneWidths = [320, 375, 390, 393, 414, 430];

async function expectNoRootHorizontalPan(page: import('@playwright/test').Page) {
  const state = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    window.scrollTo(9999, 0);
    const scrollXAfterPan = window.scrollX;
    window.scrollTo(0, 0);
    return {
      scrollXAfterPan,
      rootOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - viewportWidth,
    };
  });

  expect(state.rootOverflow).toBeLessThanOrEqual(1);
  expect(state.scrollXAfterPan).toBe(0);
}

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
      await expectNoRootHorizontalPan(page);
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

test.describe('iPhone width root pan protection', () => {
  for (const width of iphoneWidths) {
    test(`homepage cannot be horizontally panned at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await expectNoRootHorizontalPan(page);
    });

    test(`mobile header fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const header = await page.locator('nav').evaluate((nav) => {
        const viewportWidth = document.documentElement.clientWidth;
        const children = Array.from(nav.children).map((child) => {
          const rect = child.getBoundingClientRect();
          return {
            tag: child.tagName.toLowerCase(),
            className: String((child as HTMLElement).className || ''),
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        });
        return {
          viewportWidth,
          children,
        };
      });

      for (const child of header.children) {
        if (child.width === 0) continue;
        expect(child.left, child.className).toBeGreaterThanOrEqual(-1);
        expect(child.right, child.className).toBeLessThanOrEqual(header.viewportWidth + 1);
      }
    });

    test(`hamburger menu opens and closes at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const hamburger = page.locator('#navHamburger');
      const menu = page.locator('#navLinks');

      await expect(hamburger).toBeVisible();
      await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).not.toBeVisible();

      await hamburger.click();
      await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Our Caravans' })).toBeVisible();

      const layout = await menu.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top,
          right: rect.right,
          width: rect.width,
          viewportWidth: document.documentElement.clientWidth,
        };
      });

      expect(layout.top).toBeGreaterThanOrEqual(0);
      expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);

      await hamburger.click();
      await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).not.toBeVisible();
    });

    test(`closed chat launcher is visible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await expectNoRootHorizontalPan(page);

      const launcher = await page.locator('.chat-widget-btn').evaluate((button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          viewportWidth: document.documentElement.clientWidth,
        };
      });

      expect(launcher.width).toBeGreaterThan(0);
      expect(launcher.left).toBeGreaterThanOrEqual(0);
      expect(launcher.right).toBeLessThanOrEqual(launcher.viewportWidth);
    });
  }

  test('global CSS does not use unsafe layout-level 100vw widths', async ({ page }) => {
    await page.goto('/');

    const unsafeRules = await page.evaluate(() => {
      const matches: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          const text = rule.cssText;
          if (/\b(?:width|min-width|max-width)\s*:\s*[^;]*\b100vw\b/i.test(text)) {
            matches.push(text);
          }
        }
      }
      return matches;
    });

    expect(unsafeRules).toEqual([]);
  });
});
