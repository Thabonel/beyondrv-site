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
        const excludedPaths = [
          '/admin/',
          '/admin/analytics/',
          '/inquiry-form/success/',
          '/cart/',
          '/checkout/success/',
          '/404.html',
        ];
        return !excludedPaths.some((path) => page.endsWith(path));
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
