import { describe, expect, it } from 'vitest'
import { NAVIGATE_FALLBACK_DENYLIST } from './vite.config'

// Workbox's NavigationRoute tests its denylist against pathname + search.
const denied = (path: string) => NAVIGATE_FALLBACK_DENYLIST.some((re) => re.test(path))

describe('NAVIGATE_FALLBACK_DENYLIST', () => {
  // Every path netlify.toml redirects to a Netlify Function. A miss here means
  // the service worker serves the SPA shell for a server-rendered page.
  it.each([
    '/archive',
    '/archive/',
    '/archive/2026-09-11',
    '/archive?utm_source=reddit',
    '/sitemap.xml',
    '/robots.txt',
  ])('keeps %s out of the SPA fallback', (path) => {
    expect(denied(path)).toBe(true)
  })

  // The SPA must still be served for its own routes, or the app 404s offline.
  it.each(['/', '/admin', '/how-to-play', '/archived'])(
    'still falls back to the SPA for %s',
    (path) => {
      expect(denied(path)).toBe(false)
    }
  )
})
