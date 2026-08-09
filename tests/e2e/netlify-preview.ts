import type { Page } from '@playwright/test';

export async function prepareNetlifyPreview(page: Page) {
  if (process.env.NETLIFY_PREVIEW_TEST !== '1') return;

  await page.goto('/?ntl-drawer-state=hidden', { waitUntil: 'domcontentloaded' });
}
