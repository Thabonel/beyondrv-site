import { expect, test } from '@playwright/test';

const pages = [
  { path: '/', title: /Beyond RV/ },
  { path: '/our-slide-on-campers/', title: /Slide-On/ },
  { path: '/advent-2300-hardtop-slide-on/', title: /Advent 2300/ },
  { path: '/advent-2450-hardtop-slide-on/', title: /Advent 2450/ },
  { path: '/7ft-electric-poptop-slide-on/', title: /7ft Electric/ },
  { path: '/shop/', title: /Parts & Accessories/ },
  { path: '/shop/twin-air-compressor-shield/', title: /Twin Air Compressor Shield/ },
  { path: '/inquiry-form/', title: /Enquire/ },
];

test.describe('public site cross-browser smoke', () => {
  for (const pageInfo of pages) {
    test(`${pageInfo.path} renders without obvious layout or image failures`, async ({ page, request }) => {
      await page.goto(pageInfo.path);
      await expect(page).toHaveTitle(pageInfo.title);

      const result = await page.evaluate(() => {
        const failedImages = Array.from(document.images)
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.currentSrc || img.src);

        return {
          failedImages,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          headings: document.querySelectorAll('h1').length,
        };
      });

      const localNetlifyImageFailures = result.failedImages.filter((src) => {
        const url = new URL(src);
        return url.hostname === '127.0.0.1' && url.pathname === '/.netlify/images';
      });
      // Blob-backed media is served by Netlify's /media/* function in deploy previews and
      // production. Astro preview has no function runtime, so those URLs cannot resolve here.
      const localNetlifyBlobFailures = result.failedImages.filter((src) => {
        const url = new URL(src);
        return url.hostname === '127.0.0.1' && url.pathname.startsWith('/media/');
      });
      const expectedLocalRuntimeFailures = [...localNetlifyImageFailures, ...localNetlifyBlobFailures];
      const unexpectedFailedImages = result.failedImages.filter((src) => !expectedLocalRuntimeFailures.includes(src));

      for (const src of localNetlifyImageFailures) {
        const transformedUrl = new URL(src);
        const sourcePath = transformedUrl.searchParams.get('url');
        expect(sourcePath, `Missing source image in ${src}`).toBeTruthy();
        const sourceResponse = await request.get(sourcePath!);
        expect(sourceResponse.ok(), `Missing source image for local Netlify transform: ${sourcePath}`).toBe(true);
      }

      expect(result.headings).toBeGreaterThan(0);
      expect(result.hasHorizontalOverflow).toBe(false);
      expect(unexpectedFailedImages).toEqual([]);
    });
  }
});

test.describe('restored product galleries', () => {
  const productGalleries = [
    { path: '/advent-2300-hardtop-slide-on/', minThumbs: 21 },
    { path: '/advent-2450-hardtop-slide-on/', minThumbs: 30 },
    { path: '/7ft-electric-poptop-slide-on/', minThumbs: 17 },
  ];

  for (const product of productGalleries) {
    test(`${product.path} has restored gallery thumbnails`, async ({ page }) => {
      await page.goto(product.path);
      expect(await page.locator('.thumb-btn').count()).toBeGreaterThanOrEqual(product.minThumbs);
      await expect(page.locator('.spec-panel').first()).toBeVisible();
    });
  }
});
