import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

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
          '/404.html',
        ];
        return !excludedPaths.some((path) => page.endsWith(path));
      },
      serialize(item) {
        if (!item.lastmod) {
          item.lastmod = new Date().toISOString();
        }
        return item;
      },
    }),
    react(),
  ],
  image: {
    remotePatterns: [],
  },
});
