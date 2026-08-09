// Phase 8: the first admin view of anything beyond the pending-approval
// queue — live/scheduled puzzle numbers (average score, per-guest miss
// rate) per planning.md §9.3, scoped to word-level attribution only (see
// puzzleStats.ts for why rule-level attribution is a deliberate follow-up).
//
// Looked up by puzzle `number`, not `_id` — the admin tool only ever shows
// reviewers the human-readable number (e.g. "#42"), never the underlying
// ObjectId, so that's the only identifier a reviewer can actually type in.

import { requireAdmin } from './_shared/adminAuth'
import type { AdminPuzzleStatsResponse } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { resolvePuzzleStats } from './_shared/puzzleStats'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const url = new URL(req.url)
  const numberParam = url.searchParams.get('number')
  const number = numberParam ? Number(numberParam) : NaN
  if (!numberParam || !Number.isInteger(number) || number < 1) {
    return jsonResponse({ error: 'Missing or invalid number' }, 400)
  }

  const { puzzles } = await getCollections()
  const puzzle = await puzzles.findOne({ number })
  if (!puzzle) {
    return jsonResponse({ error: 'Puzzle not found' }, 404)
  }

  const response: AdminPuzzleStatsResponse = await resolvePuzzleStats(puzzle)
  return jsonResponse(response)
}
