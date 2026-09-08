// Phase 8: surfaces resolveBufferHealth() to the admin tool — the numbers
// behind planning.md §9.2's "never let the buffer run to zero" requirement,
// previously only checkable by hand-counting documents in Mongo.

import { requireAdmin } from '../lib/adminAuth'
import type { AdminBufferHealthResponse } from '../lib/adminApi'
import { resolveBufferHealth } from '../lib/puzzleStats'
import { jsonResponse } from '../lib/respond'

export default {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
    if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

    const response: AdminBufferHealthResponse = await resolveBufferHealth()
    return jsonResponse(response)
  },
}
