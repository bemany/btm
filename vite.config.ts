import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'app-icon.svg',
        'apple-touch-icon.png',
        'favicon-16.png',
        'favicon-32.png',
        'logo-mark.svg',
        'logo-wordmark.svg',
      ],
      manifest: {
        id: '/',
        name: 'BTM — Bethesna Task Management',
        short_name: 'BTM',
        description:
          'Internes Task-, Zeit- und Kapazitäts-Management für Bethesna. Wochenplanung, Live-Timer, Pomodoro, KI-Task-Extraktion.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1C1A17',
        background_color: '#FAF7F2',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'app-icon.svg',                sizes: 'any',     type: 'image/svg+xml', purpose: 'any' },
          { src: 'app-icon-192.png',            sizes: '192x192', type: 'image/png',     purpose: 'any' },
          { src: 'app-icon-512.png',            sizes: '512x512', type: 'image/png',     purpose: 'any' },
          { src: 'app-icon-maskable-512.png',   sizes: '512x512', type: 'image/png',     purpose: 'maskable' },
        ],
      },
      workbox: {
        // Vite-emittiertes Build-Output cachen.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        // /api/* darf NIE gecacht werden — Auth-State ist sensibel.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // PWA nur im production build aktiv, sonst stört's HMR
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    open: false,
  },
});
