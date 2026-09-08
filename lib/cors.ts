// The player-facing page stays on the netlify.app domain, but its fetch()
// calls for get-round/check-swipe/get-crack-rate/get-puzzle-meta go
// straight to this Vercel deployment (pinned to Mumbai, matching the Atlas
// cluster) instead of round-tripping through Netlify — see check-swipe.ts's
// history for why. A cross-origin browser request only succeeds with the
// right CORS headers on every response, including a same-shaped OPTIONS
// preflight for the POST endpoints. Scoped to a known origin allowlist, not
// a wildcard, since check-swipe mutates per-player state.
const ALLOWED_ORIGINS = new Set([
  'https://the-bouncer.netlify.app',
  'http://localhost:4173', // `vite preview` — testing a production build locally
])

/** Wraps a player-facing handler so the browser will actually accept its
 * response cross-origin. Leaves same-origin callers (admin panel, direct
 * navigation) unaffected — those never send an Origin header this
 * allowlist would reject, and browsers only enforce CORS to begin with on
 * cross-origin requests. */
export function withCors(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin')
    const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : null

    if (req.method === 'OPTIONS') {
      const res = new Response(null, { status: 204 })
      if (allowOrigin) res.headers.set('Access-Control-Allow-Origin', allowOrigin)
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.headers.set('Access-Control-Allow-Headers', 'content-type')
      return res
    }

    const res = await handler(req)
    if (allowOrigin) res.headers.set('Access-Control-Allow-Origin', allowOrigin)
    return res
  }
}
