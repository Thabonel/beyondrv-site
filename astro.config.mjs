import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://beyondrv.com.au',
  output: 'static',
  outDir: './dist',
  integrations: [sitemap(), react()],
  image: {
    remotePatterns: [],
  },
});
