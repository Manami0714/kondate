import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, BASE_PATH } from './src/config/app.ts';

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    // index.html の %APP_NAME% %APP_SHORT_NAME% に、src/config/app.ts のアプリ名を入れる(名前を1か所で決めるため)
    {
      name: 'app-name',
      transformIndexHtml: (html: string) =>
        html.replaceAll('%APP_SHORT_NAME%', APP_SHORT_NAME).replaceAll('%APP_NAME%', APP_NAME),
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
        description: APP_DESCRIPTION,
        lang: 'ja',
        theme_color: '#f7f3ea',
        background_color: '#f7f3ea',
        display: 'standalone',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
