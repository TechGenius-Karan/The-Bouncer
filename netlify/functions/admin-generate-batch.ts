// Phase 10.5-adjacent: lets an admin trigger on-demand generation from the
// review screen itself, rather than only via the manual `content:queue-puzzles`
// CLI script or waiting on the nightly `scheduled-generate-puzzles.ts` cron.
// Generation logic mirrors that cron function exactly (same
// generateBatchCore call, same PuzzleDoc shape, same `number = existingCount
// + i + 1` numbering) — the only real difference is this endpoint is
// requireAdmin-gated and invocable on demand, since (unlike the cron
// function) it has a real HTTP path a browser can call.

import { requireAdmin } from './_shared/adminAuth'
import type { AdminGenerateBatchRequest } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { generateBatchCore } from '../../content-engine/generator/batch'
import { RULES } from '../../content-engine/rules'
import { applyRuleOverrides } from '../../content-engine/rules/ruleOverrides'
import { resolveRejectCounts } from './_shared/rejectStats'
import { resolveRuleOverrides } from './_shared/ruleOverrides'
import type { PuzzleDoc } from './_shared/types'
import { jsonResponse } from './_shared/respond'

const MAX_COUNT = 20

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminGenerateBatchRequest>
  try {
    body = (await req.json()) as Partial<AdminGenerateBatchRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const count = Number(body.count)
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return jsonResponse({ error: `count must be an integer between 1 and ${MAX_COUNT}` }, 400)
  }
  const tiers: ('medium' | 'spicy')[] = body.tiers && body.tiers.length > 0 ? body.tiers : ['medium', 'spicy']

  const { puzzles } = await getCollections()
  const [rejectCounts, ruleOverrides] = await Promise.all([resolveRejectCounts(), resolveRuleOverrides()])
  const effectiveRules = applyRuleOverrides(RULES, ruleOverrides)
  const batch = generateBatchCore(count, tiers, rejectCounts, effectiveRules)

  const newDocs: PuzzleDoc[] = batch.map((candidate) => ({
    // Left null — only assigned once actually scheduled, see schedulePuzzles.ts.
    number: null,
    difficultyTier: candidate.difficultyTier,
    ruleId: candidate.ruleId,
    status: 'pending_approval',
    date: null,
    clues: candidate.clues,
    guests: candidate.guests,
    liveDecoys: candidate.liveDecoys,
    knobValues: candidate.knobValues,
    createdAt: new Date(),
  }))

  if (newDocs.length > 0) {
    await puzzles.insertMany(newDocs)
  }

  return jsonResponse({ ok: true, requested: count, generated: newDocs.length })
}
