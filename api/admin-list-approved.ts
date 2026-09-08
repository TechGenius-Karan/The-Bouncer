// Approved-but-unscheduled queue, full detail — same reviewer depth as
// admin-list-pending.ts/admin-list-scheduled.ts, so a mistake can be spotted
// before a date is picked. Sorted FIFO by generation time, matching the
// order content-engine/scripts/schedulePuzzles.ts already consumes this
// same queue in.

import { requireAdmin } from '../lib/adminAuth'
import type { AdminListApprovedResponse } from '../lib/adminApi'
import { resolveFullPuzzleDetail } from '../lib/adminPuzzleDetail'
import { getCollections } from '../lib/db'
import { jsonResponse } from '../lib/respond'

export default {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }
    if (!requireAdmin(req)) {
      return jsonResponse({ error: 'Invalid access code' }, 401)
    }

    const { puzzles } = await getCollections()
    const approved = await puzzles
      .find({ status: 'approved', date: null })
      .sort({ createdAt: 1 })
      .toArray()
    const detail = await Promise.all(approved.map((p) => resolveFullPuzzleDetail(p)))

    const response: AdminListApprovedResponse = { puzzles: detail }
    return jsonResponse(response)
  },
}
