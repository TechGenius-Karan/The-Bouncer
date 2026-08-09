// Phase 5 (build-plan.md): manually assigns real UTC calendar dates to a
// batch of already-approved puzzles and flips their status to "scheduled".
// No admin UI exists yet for this (that's Phase 6) — a direct script/DB
// write is exactly what build-plan's Phase 5 goal calls for.
// Run with: npm run content:schedule -- [count] [startDate]

import 'dotenv/config'
import { getCollections } from '../../netlify/functions/_shared/db'
import { addDaysToDateString, resolvePuzzleDateString } from '../../netlify/functions/_shared/puzzleDate'

const COUNT = Number(process.argv[2]) || 5
const START_DATE = process.argv[3] || resolvePuzzleDateString()

async function main() {
  const { puzzles } = await getCollections()

  // Idempotent to (re-)create — fails loudly on a scheduling bug instead of
  // two puzzles silently colliding on the same date.
  await puzzles.createIndex(
    { date: 1 },
    { unique: true, partialFilterExpression: { date: { $type: 'string' } } },
  )

  const candidates = await puzzles
    .find({ status: 'approved', date: null })
    .sort({ number: 1 })
    .limit(COUNT)
    .toArray()

  if (candidates.length < COUNT) {
    console.warn(`Only ${candidates.length}/${COUNT} approved-and-unscheduled puzzles available.`)
  }
  if (candidates.length === 0) {
    console.log('Nothing to schedule.')
    process.exit(0)
  }

  const takenDocs = await puzzles
    .find(
      { status: { $in: ['scheduled', 'live'] }, date: { $ne: null } },
      { projection: { date: 1 } },
    )
    .toArray()
  const taken = new Set(takenDocs.map((doc) => doc.date as string))

  let cursor = START_DATE
  for (const candidate of candidates) {
    while (taken.has(cursor)) {
      cursor = addDaysToDateString(cursor, 1)
    }
    const date = cursor
    taken.add(date)
    cursor = addDaysToDateString(cursor, 1)

    const update = await puzzles.updateOne(
      { _id: candidate._id, status: 'approved', date: null },
      { $set: { date, status: 'scheduled' } },
    )

    if (update.matchedCount === 0) {
      console.warn(`Skipped puzzle #${candidate.number} — it changed before this could apply.`)
      continue
    }
    console.log(`Puzzle #${candidate.number} (${candidate.difficultyTier}) -> ${date}`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
