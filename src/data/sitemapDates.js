import modelPages from './vehicle-selector/model-pages.json' with { type: 'json' };

// Change these dates only when the page's primary content, structured data,
// or important internal links materially change. Unknown dates are omitted.
export const SITEMAP_LASTMOD = Object.freeze({
  '/': '2026-09-03',
  '/about-us/': '2026-07-29',
  '/custom/': '2026-07-29',
  '/careers/': '2026-08-19',
  '/careers/caravan-builder/': '2026-08-19',
  '/warranty/': '2026-07-29',
  '/guides/': '2026-07-29',
  '/guides/best-utes-for-slide-on-campers/': '2026-09-03',
  '/guides/gvm-gcm-atm-gtm-explained/': '2026-09-03',
  '/expedition/': '2026-09-01',
  '/our-caravans/': '2026-08-09',
  '/our-slide-on-campers/': '2026-09-02',
  '/vehicle-suitability-checker/': '2026-09-05',
  '/slide-on-camper-weight-calculator/': '2026-09-05',
  '/caravan-towing-calculator/': '2026-09-03',
  '/3-5m-diy-camper-box-with-cabover-and-underfloor-storage/': '2026-08-31',
  '/3-5m-poptop-truck-camper/': '2026-08-09',
  '/7ft-electric-poptop-slide-on/': '2026-09-02',
  '/advent-2150-hardtop-slide-on/': '2026-09-02',
  '/advent-2300-hardtop-slide-on/': '2026-09-02',
  '/advent-2450-hardtop-slide-on/': '2026-09-03',
  '/expedition/3-5m-electric-poptop-cabover-family-camper/': '2026-08-31',
  '/expedition/4-7m-hardtop-truck-camper/': '2026-09-01',
  '/mercedes-sprinter-motorhome/': '2026-07-29',
});

export function sitemapLastmodFor(url) {
  const pathname = new URL(url).pathname;
  if (modelPages.models.some(model => pathname === `/slide-on-campers/${model.slug}/`)) return '2026-09-05';
  return SITEMAP_LASTMOD[pathname];
}
