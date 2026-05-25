import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appFullName = env.VITE_APP_FULL_NAME ?? 'Bemany Task Management';
  return {
  plugins: [
    react(),
    VitePWA({
      // 'prompt': neue SW wartet auf User-Klick statt sofort zu übernehmen.
      // Permanenter Toast in der Sidebar nutzt das (siehe src/lib/swUpdate.ts).
      registerType: 'prompt',
      // Wir registrieren den SW selbst in main.tsx — der Auto-Inject vom
      // Plugin würde ohne User-Prompt direkt aktivieren wollen.
      injectRegister: false,
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
        name: `BTM — ${appFullName}`,
        short_name: 'BTM',
        description:
          'Team task, time and capacity management. Weekly planning, live timer, Pomodoro, AI task extraction.',
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
        // push-sw.js enthält Push+Click-Handler und wird zur Laufzeit per importScripts geladen.
        importScripts: ['/push-sw.js'],
        // Vite-emittiertes Build-Output cachen.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // reset.html darf NIE im Precache landen — wäre sonst nicht
        // erreichbar wenn der SW selbst kaputt ist (Henne/Ei).
        globIgnores: ['**/reset.html'],
        cleanupOutdatedCaches: true,
        // clientsClaim/skipWaiting deaktiviert — sonst übernimmt der neue
        // SW sofort und unsere „Relaunch to update"-UX greift nicht mehr.
        // Der User triggert die Übernahme manuell über applyPendingUpdate().
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: '/index.html',
        // /api/* darf NIE gecacht werden — Auth-State ist sensibel.
        // /reset.html muss IMMER frisch vom Server kommen (SW-Reset-Tool).
        navigateFallbackDenylist: [/^\/api\//, /^\/reset\.html$/],
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
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom')) return 'react-dom';
          if (id.includes('react')) return 'react';
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('zustand')) return 'zustand';
          if (id.includes('workbox') || id.includes('vite-plugin-pwa')) return 'pwa';
          // three.js + postprocessing nur fuer Hyperspeed-Background — eigener
          // Lazy-Chunk damit das initial Bundle leicht bleibt (~600 KB sparen).
          if (id.includes('node_modules/three') || id.includes('node_modules/postprocessing')) return 'three-bg';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    open: false,
    // /api/* proxy to backend. Set VITE_PROXY_TARGET to your running backend URL.
    // Example: VITE_PROXY_TARGET=https://your-instance.example npm run dev
    proxy: {
      '/api': {
        target: env.VITE_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
        secure: !!(env.VITE_PROXY_TARGET ?? '').startsWith('https'),
        cookieDomainRewrite: 'localhost',
      },
    },
  },
  };
});
