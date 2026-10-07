// Phase 6 (build-plan.md): generates candidate puzzles and inserts them
// into MongoDB as "pending_approval" — real content for a reviewer to look
// at through the /admin screen, replacing the old shortcut that inserted
// straight to "approved" with no review step at all.
//
// `number` is deliberately left null here — it's only assigned once a
// puzzle is actually scheduled (schedulePuzzles.ts), so a rejected or
// still-pending candidate never burns a number that would otherwise leave
// a gap in what players/admins actually see.
// Run with: npm run content:queue-puzzles -- [count] [--visual]
// --visual (or PUZZLE_KIND=visual in .env) queues visual puzzles instead
// (planning-visual-pivot.md §5.3).

import 'dotenv/config'
import { getCollections } from '../../netlify/functions/_shared/db.js'
import { resolvePuzzleDateString } from '../../netlify/functions/_shared/puzzleDate.js'
import { resolveRejectCounts } from '../../netlify/functions/_shared/rejectStats.js'
import { resolveRuleOverrides } from '../../netlify/functions/_shared/ruleOverrides.js'
import { resolveRecentRuleUsage } from '../../netlify/functions/_shared/ruleUsage.js'
import type { PuzzleDoc } from '../../netlify/functions/_shared/types.js'
import {
  puzzleKindFrom,
  splitVisualRuleUsage,
  VISUAL_RULE_USAGE_FILTER,
} from '../../netlify/functions/_shared/visual.js'
import { RULES } from '../rules/index.js'
import { applyRuleOverrides } from '../rules/ruleOverrides.js'
import { generateBatchCore } from '../generator/batch.js'
import { generateVisualDocs } from '../visual/batch.js'

const PUZZLE_COUNT = Number(process.argv.slice(2).find((arg) => /^\d+$/.test(arg))) || 5
const VISUAL =
  process.argv.includes('--visual') || puzzleKindFrom(process.env.PUZZLE_KIND) === 'visual'

async function main() {
  const { puzzles } = await getCollections()
  if (VISUAL) {
    const [usage, rejectCounts] = await Promise.all([
      puzzles.find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } }).toArray(),
      resolveRejectCounts(),
    ])
    const docs = generateVisualDocs(
      PUZZLE_COUNT,
      { ...splitVisualRuleUsage(usage), rejectCounts },
      resolvePuzzleDateString()
    )
    console.log(`Generated ${docs.length}/${PUZZLE_COUNT} visual candidates.`)
    if (docs.length > 0) await puzzles.insertMany(docs)
    process.exit(0)
  }

  const [rejectCounts, ruleOverrides, recentUsage] = await Promise.all([
    resolveRejectCounts(),
    resolveRuleOverrides(),
    resolveRecentRuleUsage(),
  ])
  const effectiveRules = applyRuleOverrides(RULES, ruleOverrides)

  console.log(`Generating ${PUZZLE_COUNT} candidate puzzles...`)
  const batch = generateBatchCore(
    PUZZLE_COUNT,
    ['medium', 'spicy'],
    rejectCounts,
    effectiveRules,
    recentUsage.ruleIds
  )
  if (batch.length < PUZZLE_COUNT) {
    console.warn(`Only generated ${batch.length}/${PUZZLE_COUNT} candidates.`)
  }
  if (batch.length === 0) {
    console.log('Nothing to queue.')
    process.exit(0)
  }

  const puzzleDocs: PuzzleDoc[] = batch.map((candidate) => ({
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
  }))

  console.log(`Inserting ${puzzleDocs.length} puzzles as "pending_approval"...`)
  await puzzles.insertMany(puzzleDocs)

  const totalPending = await puzzles.countDocuments({ status: 'pending_approval' })
  console.log(`Done. ${totalPending} puzzles now waiting for review.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
