// Phase 10 (build-plan.md): a playtesting batch's score picture at a
// glance — GET ?from=&to= over a contiguous puzzle-number range (playtest
// batches are always sequential, since queuePuzzles.ts assigns numbers as
// existingCount + i + 1), instead of looking up one puzzle at a time.

import { requireAdmin } from './_shared/adminAuth'
import type { AdminBatchStatsResponse } from './_shared/adminApi'
import { resolveBatchStats } from './_shared/puzzleStats'
import { jsonResponse } from './_shared/respond'

const MAX_RANGE = 200

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from'))
  const to = Number(url.searchParams.get('to'))

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return jsonResponse({ error: 'Missing or invalid from/to' }, 400)
  }
  if (to - from + 1 > MAX_RANGE) {
    return jsonResponse({ error: `Range too large (max ${MAX_RANGE} puzzles)` }, 400)
  }

  const response: AdminBatchStatsResponse = await resolveBatchStats(from, to)
  return jsonResponse(response)
}
