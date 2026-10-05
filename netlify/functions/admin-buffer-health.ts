// Phase 8: surfaces resolveBufferHealth() to the admin tool — the numbers
// behind planning.md §9.2's "never let the buffer run to zero" requirement,
// previously only checkable by hand-counting documents in Mongo.

import { visualRunway } from '../../content-engine/visual/batch'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminBufferHealthResponse } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { resolveBufferHealth } from './_shared/puzzleStats'
import { jsonResponse } from './_shared/respond'
import { puzzleKindFrom, splitVisualRuleUsage, VISUAL_RULE_USAGE_FILTER } from './_shared/visual'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const kind = puzzleKindFrom(process.env.PUZZLE_KIND)
  const response: AdminBufferHealthResponse = await resolveBufferHealth(new Date(), kind)
  if (kind === 'visual') {
    const { puzzles } = await getCollections()
    const usage = await puzzles
      .find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } })
      .toArray()
    response.runway = visualRunway(splitVisualRuleUsage(usage).usedRuleIds)
  }
  return jsonResponse(response)
}
