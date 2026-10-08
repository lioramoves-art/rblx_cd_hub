import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://roblox-codes-hub.vercel.app',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [sitemap()],
  compressHTML: true,
});
