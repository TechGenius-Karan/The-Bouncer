// Phase 6 (build-plan.md): generates candidate puzzles and inserts them
// into MongoDB as "pending_approval" — real content for a reviewer to look
// at through the /admin screen, replacing the old shortcut that inserted
// straight to "approved" with no review step at all.
//
// `number` is deliberately left null here — it's only assigned once a
// puzzle is actually scheduled (schedulePuzzles.ts), so a rejected or
// still-pending candidate never burns a number that would otherwise leave
// a gap in what players/admins actually see.
// Run with: npm run content:queue-puzzles -- [count]

import 'dotenv/config'
import { getCollections } from '../../netlify/functions/_shared/db'
import type { PuzzleDoc } from '../../netlify/functions/_shared/types'
import { generateBatchCore } from '../generator/batch'

const PUZZLE_COUNT = Number(process.argv[2]) || 5

async function main() {
  const { puzzles } = await getCollections()

  console.log(`Generating ${PUZZLE_COUNT} candidate puzzles...`)
  const batch = generateBatchCore(PUZZLE_COUNT, ['medium', 'spicy'])
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
