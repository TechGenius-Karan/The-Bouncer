// Phase 7 (build-plan.md / planning.md §6.3): the single aggregate stat —
// "X% of players cracked today's puzzle" (a perfect, zero-mistake run).
// No auth: a low-sensitivity aggregate on the same no-gating footing as
// get-round.ts/check-swipe.ts. The "only shown after finishing" requirement
// is a client-side UX gate (only ever called from RevealScreen, which only
// renders post-completion), not a server-enforced secret — consistent with
// this project's existing risk posture (planning.md §8.4).

import { ObjectId } from 'mongodb'
import type { GetCrackRateResponse } from './_shared/api'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)
  const puzzleId = url.searchParams.get('puzzleId')
  if (!puzzleId || !ObjectId.isValid(puzzleId)) {
    return jsonResponse({ error: 'Missing or invalid puzzleId' }, 400)
  }

  const { results } = await getCollections()

  const [totalFinishers, crackedCount] = await Promise.all([
    results.countDocuments({ puzzleId, roundComplete: true }),
    results.countDocuments({ puzzleId, roundComplete: true, livesRemaining: 3 }),
  ])

  const response: GetCrackRateResponse = {
    // null (not 0) when nobody's finished yet — lets the client tell "no
    // data" apart from a genuine 0%.
    crackedPercent: totalFinishers > 0 ? Math.round((crackedCount / totalFinishers) * 100) : null,
    totalFinishers,
  }

  return jsonResponse(response)
}
