// Phase 8 (build-plan.md / planning.md §9.2): the automated half of "an
// actual sustained operational habit" — tops the approved-and-unscheduled
// buffer back up when it runs low, so the operator isn't the only thing
// standing between "healthy" and "empty."
//
// This is a genuine Netlify Scheduled Function (the `config.schedule` cron
// export below), not an HTTP endpoint: it cannot declare a `path` alongside
// `schedule`, and has no invocable URL anywhere, locally or deployed — so
// it needs no requireAdmin gate (unlike every admin-*.ts function). A real
// cron invocation sends `{next_run: <ISO date>}` as its body, which this
// function has no use for, so it deliberately never calls req.json() — a
// manual `netlify functions:invoke` test call sends no body at all, and
// reading it defensively would just throw before the real logic ran.
//
// Only ever writes `pending_approval` docs — never auto-approves or
// auto-schedules, matching admin-approve.ts's own rationale for keeping
// human review a distinct, non-collapsible stage of the locked pipeline
// (generate -> validate -> human-approve -> schedule).

import type { Config } from '@netlify/functions'
import { generateBatchCore } from '../../content-engine/generator/batch'
import { getCollections } from './_shared/db'
import { resolveBufferHealth } from './_shared/puzzleStats'
import { resolveRejectCounts } from './_shared/rejectStats'
import type { PuzzleDoc } from './_shared/types'
import { jsonResponse } from './_shared/respond'

const MEDIUM_MIN_DAYS = 14
const MEDIUM_TARGET_DAYS = 28
const SPICY_MIN_WEEKS = 4
const SPICY_TARGET_WEEKS = 6

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
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
  const rejectCounts = await resolveRejectCounts()
  const newDocs: PuzzleDoc[] = []

  for (const { tier, count } of tiersToGenerate) {
    const batch = generateBatchCore(count, [tier], rejectCounts)
    if (batch.length < count) {
      console.warn(`Only generated ${batch.length}/${count} ${tier} candidates.`)
    }
    for (const candidate of batch) {
      newDocs.push({
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
      })
    }
  }

  if (newDocs.length > 0) {
    await puzzles.insertMany(newDocs)
  }

  console.log(`Generated ${newDocs.length} candidate puzzle(s) as pending_approval.`, health)
  return jsonResponse({ ok: true, generated: newDocs.length })
}

export const config: Config = {
  schedule: '0 6 * * *', // once daily, 06:00 UTC
}
