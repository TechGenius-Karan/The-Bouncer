// Lets the home screen show today's real puzzle number/date before the
// player has chosen to play. Deliberately separate from get-round.ts: that
// endpoint creates a ResultDoc as a side effect whenever it's called without
// a resultId (see its header comment), which would mean a round record gets
// created the instant Home loads rather than when Play is tapped. This
// endpoint is read-only — no auth, same no-gating footing as
// get-round.ts/get-crack-rate.ts (planning.md §8.4).

import type { GetPuzzleMetaResponse } from './_shared/api'
import { dbDiagnostics, getCollections } from './_shared/db'
import { isValidPuzzleDateString, resolvePuzzleDateString } from './_shared/puzzleDate'
import { jsonResponse } from './_shared/respond'

const OVERRIDE_ALLOWED_CONTEXTS = new Set(['branch-deploy', 'deploy-preview'])

function resolveToday(url: URL): string {
  const allowOverride =
    process.env.NETLIFY_DEV === 'true' || OVERRIDE_ALLOWED_CONTEXTS.has(process.env.CONTEXT ?? '')
  const asOf = allowOverride ? url.searchParams.get('asOf') : null
  if (asOf && isValidPuzzleDateString(asOf)) {
    return resolvePuzzleDateString(new Date(`${asOf}T00:00:00.000Z`))
  }
  return resolvePuzzleDateString()
}

export default async (req: Request): Promise<Response> => {
  const t0 = Date.now()
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)
  const today = resolveToday(url)

  const t1 = Date.now()
  const { puzzles } = await getCollections()
  const t2 = Date.now()
  const puzzle = await puzzles.findOne({ date: today, status: { $in: ['scheduled', 'live'] } })
  const t3 = Date.now()
  if (!puzzle) {
    return jsonResponse({ error: `No puzzle is scheduled for ${today} yet.` }, 404)
  }

  // Safe: puzzle was found via status: scheduled/live, which always has a real number.
  const response: GetPuzzleMetaResponse = { number: puzzle.number!, date: today }
  const res = jsonResponse(response)
  // TEMPORARY diagnostic — see how much time getCollections() (connection
  // setup) vs the actual query costs inside a real deployed invocation, read
  // via `curl -I`, without needing Netlify dashboard log access.
  res.headers.set(
    'Server-Timing',
    `parse;dur=${t1 - t0}, getCollections;dur=${t2 - t1}, findOne;dur=${t3 - t2}, total;dur=${t3 - t0}`,
  )
  res.headers.set('X-Debug-Warm', String(dbDiagnostics.wasWarm))
  res.headers.set('X-Debug-Connect-Ms', String(dbDiagnostics.connectMs))
  return res
}
