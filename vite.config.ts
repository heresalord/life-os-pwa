import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Life OS',
        short_name: 'Life OS',
        description: 'Your calm personal operating system',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          // ── Supabase REST API ────────────────────────────────────────────────
          // Use NetworkOnly so the service worker NEVER caches API responses.
          // The app already uses Dexie (IndexedDB) for offline support, so we
          // don't need the service worker to cache these. Without this fix the
          // service worker's 3-second timeout caused it to serve stale cached
          // responses for refetches triggered right after mutations, making
          // changes appear to "disappear" until the user refreshed.
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pages' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
