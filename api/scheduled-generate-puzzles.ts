// Phase 8 (build-plan.md / planning.md §9.2): the automated half of "an
// actual sustained operational habit" — tops the approved-and-unscheduled
// buffer back up when it runs low, so the operator isn't the only thing
// standing between "healthy" and "empty."
//
// This is a Vercel Cron Job (see the `crons` entry in vercel.json), invoked
// by a GET request Vercel makes on schedule — not a Netlify Scheduled
// Function anymore. Vercel crons carry `Authorization: Bearer $CRON_SECRET`
// when that env var is set, which is the only thing standing between this
// endpoint and a public GET triggering paid Gemini calls / DB writes (it
// has no requireAdmin gate, unlike every admin-*.ts function), so the check
// below is load-bearing, not optional.
//
// Only ever writes `pending_approval` docs — never auto-approves or
// auto-schedules, matching admin-approve.ts's own rationale for keeping
// human review a distinct, non-collapsible stage of the locked pipeline
// (generate -> validate -> human-approve -> schedule).

import { generateBatchCore } from '../content-engine/generator/batch.js'
import { RULES } from '../content-engine/rules/index.js'
import { applyRuleOverrides } from '../content-engine/rules/ruleOverrides.js'
import { getCollections } from '../lib/db.js'
import { resolveBufferHealth } from '../lib/puzzleStats.js'
import { resolveRejectCounts } from '../lib/rejectStats.js'
import { resolveRuleOverrides } from '../lib/ruleOverrides.js'
import { resolveRecentRuleUsage } from '../lib/ruleUsage.js'
import type { PuzzleDoc } from '../lib/types.js'
import { jsonResponse } from '../lib/respond.js'

const MEDIUM_MIN_DAYS = 14
const MEDIUM_TARGET_DAYS = 28
const SPICY_MIN_WEEKS = 4
const SPICY_TARGET_WEEKS = 6

export default {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const health = await resolveBufferHealth()

    const tiersToGenerate: { tier: PuzzleDoc['difficultyTier']; count: number }[] = []
    if (health.mediumBufferDays < MEDIUM_MIN_DAYS) {
      tiersToGenerate.push({ tier: 'medium', count: MEDIUM_TARGET_DAYS - health.mediumBufferDays })
    }
    if (health.spicyBufferWeeks < SPICY_MIN_WEEKS) {
      tiersToGenerate.push({ tier: 'spicy', count: SPICY_TARGET_WEEKS - health.spicyBufferWeeks })
    }

    if (tiersToGenerate.length === 0) {
      console.log('Buffer healthy, nothing to generate.', health)
      return jsonResponse({ ok: true, generated: 0 })
    }

    const { puzzles } = await getCollections()
    const [rejectCounts, ruleOverrides, recentUsage] = await Promise.all([
      resolveRejectCounts(),
      resolveRuleOverrides(),
      resolveRecentRuleUsage(),
    ])
    const effectiveRules = applyRuleOverrides(RULES, ruleOverrides)
    const newDocs: PuzzleDoc[] = []

    for (const { tier, count } of tiersToGenerate) {
      const batch = generateBatchCore(
        count,
        [tier],
        rejectCounts,
        effectiveRules,
        recentUsage.ruleIds
      )
      if (batch.length < count) {
        console.warn(`Only generated ${batch.length}/${count} ${tier} candidates.`)
      }
      for (const candidate of batch) {
        newDocs.push({
          // Left null — only assigned once actually scheduled, see schedulePuzzles.ts.
          number: null,
          difficultyTier: candidate.difficultyTier,
          ruleId: candidate.ruleId,
          ...(candidate.templateId ? { templateId: candidate.templateId } : {}),
          ...(candidate.revealRuleId ? { revealRuleId: candidate.revealRuleId } : {}),
          status: 'pending_approval',
          date: null,
          clues: candidate.clues,
          guests: candidate.guests,
          liveDecoys: candidate.liveDecoys,
          knobValues: candidate.knobValues,
          createdAt: new Date(),
        })
      }
    }

    if (newDocs.length > 0) {
      await puzzles.insertMany(newDocs)
    }

    console.log(`Generated ${newDocs.length} candidate puzzle(s) as pending_approval.`, health)
    return jsonResponse({ ok: true, generated: newDocs.length })
  },
}
