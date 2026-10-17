import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Indkøb',
        short_name: 'Indkøb',
        description: 'Delt indkøbsliste på din egen CalDAV-server',
        lang: 'da',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f2f7',
        theme_color: '#f2f2f7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // CalDAV traffic and runtime config always go to the network.
        navigateFallbackDenylist: [/^\/dav\//, /^\/config\.json$/],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
  server: {
    host: true,
    // server.ts answers /config.json and proxies /dav (in docker-compose.dev.yml it's the "api" service)
    proxy: {
      '/config.json': process.env.DEV_API ?? 'http://localhost:3000',
      '/dav': process.env.DEV_API ?? 'http://localhost:3000',
    },
  },
});
