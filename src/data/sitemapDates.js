// Change these dates only when the page's primary content, structured data,
// or important internal links materially change. Unknown dates are omitted.
export const SITEMAP_LASTMOD = Object.freeze({
  '/': '2026-07-29',
  '/about-us/': '2026-07-29',
  '/custom/': '2026-07-29',
  '/warranty/': '2026-07-29',
  '/guides/': '2026-07-29',
  '/guides/best-utes-for-slide-on-campers/': '2026-07-29',
  '/guides/gvm-gcm-atm-gtm-explained/': '2026-07-29',
  '/expedition/': '2026-07-29',
  '/our-caravans/': '2026-07-29',
  '/our-slide-on-campers/': '2026-07-29',
  '/vehicle-suitability-checker/': '2026-07-29',
  '/slide-on-camper-weight-calculator/': '2026-07-29',
  '/caravan-towing-calculator/': '2026-07-29',
  '/3-5m-poptop-truck-camper/': '2026-07-29',
  '/advent-2150-hardtop-slide-on/': '2026-07-29',
  '/advent-2300-hardtop-slide-on/': '2026-07-29',
  '/advent-2450-hardtop-slide-on/': '2026-07-29',
  '/expedition/3-5m-electric-poptop-cabover-family-camper/': '2026-07-29',
  '/expedition/4-7m-hardtop-truck-camper/': '2026-07-29',
  '/mercedes-sprinter-motorhome/': '2026-07-29',
});

export function sitemapLastmodFor(url) {
  const pathname = new URL(url).pathname;
  return SITEMAP_LASTMOD[pathname];
}
