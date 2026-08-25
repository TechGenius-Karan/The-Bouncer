// Lets the home screen show today's real puzzle number/date before the
// player has chosen to play. Deliberately separate from get-round.ts: that
// endpoint creates a ResultDoc as a side effect whenever it's called without
// a resultId (see its header comment), which would mean a round record gets
// created the instant Home loads rather than when Play is tapped. This
// endpoint is read-only — no auth, same no-gating footing as
// get-round.ts/get-crack-rate.ts (planning.md §8.4).

import type { GetPuzzleMetaResponse } from './_shared/api'
import { getCollections } from './_shared/db'
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
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)
  const today = resolveToday(url)

  const { puzzles } = await getCollections()
  const puzzle = await puzzles.findOne({ date: today, status: { $in: ['scheduled', 'live'] } })
  if (!puzzle) {
    return jsonResponse({ error: `No puzzle is scheduled for ${today} yet.` }, 404)
  }

  const response: GetPuzzleMetaResponse = { number: puzzle.number, date: today }
  return jsonResponse(response)
}
