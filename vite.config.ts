import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Paths netlify.toml routes to server-rendered Netlify Functions rather than
 * to the SPA. They must be kept out of the service worker's navigation
 * fallback: workbox answers *every* same-origin navigation from the precached
 * index.html unless told otherwise, so a returning visitor — anyone who has
 * the service worker installed — opening /archive got the landing page, and a
 * shared /archive/<date> permalink opened on today's puzzle instead of that
 * day's. Crawlers never saw it (they don't run service workers), so it looked
 * healthy in Search Console while being broken for every repeat human.
 *
 * Matched against pathname + search, so these are deliberately unanchored at
 * the end — /archive?x=1 has to be denied too.
 */
export const NAVIGATE_FALLBACK_DENYLIST = [/^\/archive(?:[/?]|$)/, /^\/sitemap\.xml/, /^\/robots\.txt/]

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate' — autoUpdate silently reloads any open tab
      // the moment a new deploy is detected, which would yank a player out
      // of an in-progress round. 'prompt' instead surfaces a `needRefresh`
      // flag the app only turns into a banner between rounds (see App.tsx).
      registerType: 'prompt',
      // Registration is done manually via useRegisterSW (App.tsx), which is
      // what exposes the needRefresh/updateServiceWorker control needed for
      // a between-rounds-only update banner rather than the plugin's bare
      // auto-injected script (which offers no hook into that state).
      injectRegister: false,
      manifest: {
        name: 'The Bouncer',
        short_name: 'Bouncer',
        description: 'The Bouncer — daily word puzzle',
        theme_color: '#F1E7D5',
        background_color: '#F1E7D5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: NAVIGATE_FALLBACK_DENYLIST,
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
          {
            // Read-only offline view of the last-fetched puzzle state — never
            // a substitute for a live swipe check (see check-swipe below).
            urlPattern: /^https?:\/\/[^/]+\/api\/get-round(\?.*)?$/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'get-round-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 1 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Never cache — the 3-life count must stay server-authoritative
            // (planning.md §8.4). Workbox only intercepts GET by default, so
            // this entry is redundant in practice; kept explicit so "never
            // cache this" is a visible decision, not an implicit default a
            // future broad urlPattern could accidentally start matching.
            urlPattern: /^https?:\/\/[^/]+\/api\/check-swipe$/,
            handler: 'NetworkOnly',
            method: 'POST',
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/get-crack-rate(\?.*)?$/,
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
      },
    }),
  ],
})
