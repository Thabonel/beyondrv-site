import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4321';
const widths = [320, 375, 390, 393, 414, 430];
const pages = [
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

const allowedScrollerSelector = '.authority-table-wrap';
const intentionallyClippedSelector = '.ticker, .ticker-track, .ticker-item';

function absoluteUrl(path) {
  return new URL(path, baseUrl).toString();
}

const browser = await chromium.launch();
const results = [];

for (const width of widths) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  for (const path of pages) {
    await page.goto(absoluteUrl(path), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const result = await page.evaluate(({ allowedScrollerSelector, intentionallyClippedSelector }) => {
      const viewportWidth = document.documentElement.clientWidth;
      window.scrollTo(9999, 0);
      const rootScrollAfterPan = window.scrollX;
      window.scrollTo(0, 0);

      const offenders = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width < 1 || rect.height < 1) continue;
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) continue;

        const allowedScroller = el.closest(allowedScrollerSelector);
        const intentionallyClipped = el.closest(intentionallyClippedSelector);
        const rightOverflow = rect.right - viewportWidth;
        const leftOverflow = -rect.left;
        const transformed = style.transform !== 'none';
        const escapedPositioned = (style.position === 'fixed' || style.position === 'absolute') && (rightOverflow > 1 || leftOverflow > 1);
        const rootOffender = !allowedScroller && !intentionallyClipped && (rightOverflow > 1 || leftOverflow > 1 || rect.width > viewportWidth + 1);

        if (rootOffender || escapedPositioned || transformed) {
          offenders.push({
            selector: [
              el.tagName.toLowerCase(),
              el.id ? `#${el.id}` : '',
              String(el.className || '')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 4)
                .map((name) => `.${name}`)
                .join(''),
            ].join(''),
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            rightOverflow: Math.round(rightOverflow),
            leftOverflow: Math.round(leftOverflow),
            position: style.position,
            transform: style.transform,
            allowedScroller: Boolean(allowedScroller),
            intentionallyClipped: Boolean(intentionallyClipped),
          });
        }
      }

      const viewportWidthRules = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          const text = rule.cssText;
          if (/\b(?:width|min-width|max-width)\s*:\s*[^;]*\b\d*\.?\d+vw\b/i.test(text)) {
            viewportWidthRules.push(text.slice(0, 240));
          }
        }
      }

      offenders.sort((a, b) => {
        const aScore = Math.max(a.rightOverflow, a.leftOverflow, a.width - viewportWidth);
        const bScore = Math.max(b.rightOverflow, b.leftOverflow, b.width - viewportWidth);
        return bScore - aScore;
      });

      return {
        path: location.pathname,
        viewportWidth,
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        rootOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - viewportWidth,
        rootScrollAfterPan,
        offenders: offenders.slice(0, 15),
        viewportWidthRules,
      };
    }, { allowedScrollerSelector, intentionallyClippedSelector });

    results.push({ width, ...result });
  }

  await page.close();
}

await browser.close();

const failures = results.filter((result) => result.rootOverflow > 1 || result.rootScrollAfterPan > 0);
console.log(JSON.stringify({ baseUrl, failures, results }, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
