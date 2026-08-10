import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'noodle-voyage';
  const base = process.env.VITE_BASE_PATH ?? (command === 'serve' ? '/' : `/${repositoryName}/`);

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // The reader decides when to reload: an autoUpdate reload in the middle
        // of typing a shop would throw the form away (spec 13).
        registerType: 'prompt',
        includeAssets: ['icons/icon.svg', 'icons/maskable.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png'],
        manifest: {
          // `id` fixes the app's identity. Without it a browser derives the
          // identity from start_url with the fragment dropped, which is exactly
          // `base`; writing that same value keeps an already-installed copy the
          // same app instead of turning it into a second one.
          id: base,
          name: 'Noodle Voyage',
          short_name: 'Noodle Voyage',
          description: '日本と世界の麺料理を、味、麺、土地の特徴から探して記録できるアプリ。',
          lang: 'ja',
          dir: 'ltr',
          // Relative to the manifest, so the repository path is never repeated.
          start_url: './#/',
          scope: base,
          display: 'standalone',
          orientation: 'portrait-primary',
          background_color: '#F4F6F7',
          theme_color: '#FFFFFF',
          categories: ['food', 'travel', 'lifestyle'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              // Generated catalogue JSON: served from the cache first so the app
              // opens offline, refreshed in the background when it can.
              urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/data/'),
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'noodle-voyage-data-v3' }
            }
          ]
        }
      })
    ],
    build: {
      sourcemap: false,
      target: 'es2022',
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        output: {
          manualChunks: {
            plotly: ['plotly.js-dist-min', 'react-plotly.js'],
            vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'idb-keyval', 'zod']
          }
        }
      }
    },
    test: {
      // Data tests run in node; component tests opt into jsdom with a
      // `@vitest-environment jsdom` docblock.
      environment: 'node',
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']
    }
  };
});
