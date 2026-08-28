// Approved-but-unscheduled queue, full detail — same reviewer depth as
// admin-list-pending.ts/admin-list-scheduled.ts, so a mistake can be spotted
// before a date is picked. Sorted FIFO by generation time, matching the
// order content-engine/scripts/schedulePuzzles.ts already consumes this
// same queue in.

import { requireAdmin } from './_shared/adminAuth'
import type { AdminListApprovedResponse } from './_shared/adminApi'
import { resolveFullPuzzleDetail } from './_shared/adminPuzzleDetail'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  const { puzzles } = await getCollections()
  const approved = await puzzles.find({ status: 'approved', date: null }).sort({ createdAt: 1 }).toArray()
  const detail = await Promise.all(approved.map((p) => resolveFullPuzzleDetail(p)))

  const response: AdminListApprovedResponse = { puzzles: detail }
  return jsonResponse(response)
}
