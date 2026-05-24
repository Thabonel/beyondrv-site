# SEO and AI Discovery Launch Checklist

Use this checklist during DNS cutover and again one week after launch.

## Before DNS cutover

- Confirm `https://beyondrv.com.au/robots.txt` loads and includes the sitemap.
- Confirm `https://beyondrv.com.au/llms.txt` loads and contains only public business facts.
- Confirm `https://beyondrv.com.au/sitemap-index.xml` loads.
- Confirm the sitemap does not include `/admin/`, `/admin/analytics/`, `/inquiry-form/success/`, or `/404.html`.
- Confirm `/sunpatch-12c-couples-caravan/` loads as a product page and is not redirected to a category page.
- Confirm `/admin/` and `/admin/analytics/` are protected and include `noindex, nofollow`.
- Run Google Rich Results Test on one product page, one category page, and the homepage.
- Run PageSpeed Insights on the homepage, `/our-slide-on-campers/`, and a representative product page.

## Search console setup

- Create or verify the Google Search Console domain property for `beyondrv.com.au`.
- Submit `https://beyondrv.com.au/sitemap-index.xml` in Google Search Console.
- Create or verify the Bing Webmaster Tools property for `beyondrv.com.au`.
- Submit `https://beyondrv.com.au/sitemap-index.xml` in Bing Webmaster Tools.
- After launch, inspect the homepage and one product URL in Google Search Console and request indexing if needed.

## Owner handover notes

- Check Search Console weekly for the first month after launch, then monthly.
- Watch the Performance tab for queries, impressions, clicks, click-through rate, and average position.
- Watch the Pages indexing report for excluded URLs, redirects, and 404s.
- Do not rename product slugs or page URLs without adding redirects.
- Do not remove product titles, prices, hero images, or enquiry links without checking the public page after deployment.
- Treat AI answers as discovery support, not as a quote. Prices and availability should always be confirmed by phone or enquiry.

