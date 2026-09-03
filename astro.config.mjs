import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { sitemapLastmodFor } from './src/data/sitemapDates.js';

export default defineConfig({
  site: 'https://beyondrv.com.au',
  output: 'static',
  outDir: './dist',
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        const excludedPaths = [
          '/configuration-review/',
          '/inquiry-form/success/',
          '/cart/',
          '/checkout/success/',
          '/search/',
          '/404.html',
        ];
        return !pathname.startsWith('/admin/') && !excludedPaths.includes(pathname);
      },
      serialize(item) {
        const lastmod = sitemapLastmodFor(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
    react(),
  ],
  image: {
    remotePatterns: [],
  },
});
