// Phase 8: surfaces resolveBufferHealth() to the admin tool — the numbers
// behind planning.md §9.2's "never let the buffer run to zero" requirement,
// previously only checkable by hand-counting documents in Mongo.

import { requireAdmin } from './_shared/adminAuth'
import type { AdminBufferHealthResponse } from './_shared/adminApi'
import { resolveBufferHealth } from './_shared/puzzleStats'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const response: AdminBufferHealthResponse = await resolveBufferHealth()
  return jsonResponse(response)
}
