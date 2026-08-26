// Phase 10.5: the upcoming schedule, full detail — same reviewer-only depth
// as admin-list-pending.ts, so a mistake can be spotted without switching
// screens. Includes today's puzzle (read-only) alongside future ones so the
// admin sees the whole picture; only future rows are ever unschedulable
// (see admin-unschedule.ts) since nothing in this codebase ever flips a
// puzzle's status to 'live' — today's puzzle is just a 'scheduled' puzzle
// whose date happens to match.

import { requireAdmin } from './_shared/adminAuth'
import type { AdminListScheduledResponse, AdminScheduledPuzzle } from './_shared/adminApi'
import { resolveFullPuzzleDetail } from './_shared/adminPuzzleDetail'
import { getCollections } from './_shared/db'
import { resolvePuzzleDateString } from './_shared/puzzleDate'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  const today = resolvePuzzleDateString()
  const { puzzles } = await getCollections()
  const scheduled = await puzzles
    .find({ status: { $in: ['scheduled', 'live'] }, date: { $gte: today } })
    .sort({ date: 1 })
    .toArray()

  const detail: AdminScheduledPuzzle[] = await Promise.all(
    scheduled.map(async (p) => ({
      ...(await resolveFullPuzzleDetail(p)),
      date: p.date!,
      // Safe: this query is scoped to scheduled/live puzzles, which always have a real number.
      number: p.number!,
    })),
  )

  const response: AdminListScheduledResponse = { today, puzzles: detail }
  return jsonResponse(response)
}
