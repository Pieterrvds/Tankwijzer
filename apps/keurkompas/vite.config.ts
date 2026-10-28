/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

/** Shared VLAREM knowledge (rules, standard sentences, brand list, VLAREM text), also used by Tankwijzer. */
const VLAREM_KNOWLEDGE = fileURLToPath(
  new URL('../../packages/vlarem-core/knowledge', import.meta.url),
);

/**
 * Mode "preview-artifact" (npm run build:preview) builds one self-contained page for sharing a
 * preview link: relative paths, a single JS bundle, no service worker, in-memory routing.
 */
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview-artifact';
  return {
    base: preview ? './' : '/',
    resolve: { alias: { '@vlarem-knowledge': VLAREM_KNOWLEDGE } },
    define: preview ? { 'import.meta.env.VITE_PREVIEW': JSON.stringify('true') } : {},
    plugins: [
      react(),
      tailwindcss(),
      // Service worker (Workbox) + web app manifest: makes the app installable and fully offline.
      VitePWA({
        disable: preview,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'KeurKompas',
          short_name: 'KeurKompas',
          description: 'Je kompas op het terrein — keuringen van opslagtanks volgens VLAREM II.',
          lang: 'nl-BE',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#0b3d2e',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: '/index.html',
        },
      }),
    ],
    build: preview
      ? { outDir: 'dist-preview', rollupOptions: { output: { inlineDynamicImports: true } } }
      : {
          rollupOptions: {
            output: {
              // Separate vendor chunks: they change rarely, so app updates download less.
              manualChunks: {
                react: ['react', 'react-dom', 'react-router-dom'],
                data: ['dexie', 'dexie-react-hooks', 'zod'],
              },
            },
          },
        },
    test: {
      environment: 'node',
      include: [
        'src/**/*.test.ts',
        'knowledge/**/*.test.ts',
        'server/**/*.test.ts',
        'evals/**/*.test.ts',
      ],
    },
  };
});
