import { chromium } from '@playwright/test';

const targetUrl = process.argv.find((arg) => arg.startsWith('--url='))?.slice(6) || 'https://beyondrv.com.au/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

await page.addInitScript(() => {
  window.__beyondRvLayoutShifts = [];
  const selectorFor = (node) => {
    if (!(node instanceof Element)) return String(node?.nodeName || 'unknown');
    if (node.id) return `#${node.id}`;
    const classes = [...node.classList].slice(0, 3).join('.');
    return `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput || entry.value === 0) continue;
      window.__beyondRvLayoutShifts.push({
        value: entry.value,
        startTime: entry.startTime,
        sources: (entry.sources || []).map((source) => ({
          selector: selectorFor(source.node),
          previousRect: source.previousRect,
          currentRect: source.currentRect,
        })),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
});

await page.goto(targetUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const shifts = await page.evaluate(() => window.__beyondRvLayoutShifts || []);
const total = shifts.reduce((sum, shift) => sum + shift.value, 0);

console.log(JSON.stringify({ targetUrl, total: Number(total.toFixed(4)), shifts }, null, 2));
await browser.close();
