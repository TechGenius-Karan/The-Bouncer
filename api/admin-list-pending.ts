// Phase 6: the pending_approval queue, full detail — everything a player
// must never see (true labels, trap flags, the rule, live decoys, knob
// values), per planning.md §9.1's reviewer checklist.

import { requireAdmin } from '../lib/adminAuth'
import type { AdminListPendingResponse } from '../lib/adminApi'
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
    // Pending puzzles have no `number` yet (only assigned at schedule time),
    // so sort by generation order instead.
    const pending = await puzzles
      .find({ status: 'pending_approval' })
      .sort({ createdAt: 1 })
      .toArray()
    const detail = await Promise.all(pending.map((p) => resolveFullPuzzleDetail(p)))

    const response: AdminListPendingResponse = { puzzles: detail }
    return jsonResponse(response)
  },
}
