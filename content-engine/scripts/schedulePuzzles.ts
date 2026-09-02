// Phase 5 (build-plan.md): manually assigns real UTC calendar dates to a
// batch of already-approved puzzles and flips their status to "scheduled".
// Phase 8: rewritten to respect the locked weekly calendar (planning.md §4)
// — Saturdays pull from the spicy-approved pool, every other day pulls from
// the medium-approved pool. If the correct-tier pool is empty for a given
// day, that date is skipped (left unscheduled) with a loud warning rather
// than silently placed with the wrong tier or crashed on.
//
// This is also the one place `PuzzleDoc.number` ever gets assigned — not at
// generation time, deliberately: a candidate that gets rejected or sits
// pending never burns a number, so the numbers players/admins actually see
// are always a gapless 1, 2, 3... in real schedule order.
// Run with: npm run content:schedule -- [count] [startDate]

import 'dotenv/config'
import {
  isLexicalRule,
  MAX_LEXICAL_PER_WEEK,
  selectForDate,
  type Placement,
} from '../scheduling/placement'
import { getCollections } from '../../netlify/functions/_shared/db'
import {
  addDaysToDateString,
  isSaturday,
  resolvePuzzleDateString,
} from '../../netlify/functions/_shared/puzzleDate'
import type { PuzzleDoc } from '../../netlify/functions/_shared/types'

const COUNT = Number(process.argv[2]) || 5
const START_DATE = process.argv[3] || resolvePuzzleDateString()

// Safety valve: with either tier's pool exhausted, walking forward to find
// enough correctly-tiered days for the other tier is still bounded (at most
// ~7 days per remaining spicy slot), but this caps runaway iteration if
// something is misconfigured rather than looping indefinitely.
const MAX_DAYS_WALKED = 3650

async function main() {
  const { puzzles } = await getCollections()

  await puzzles.createIndex(
    { date: 1 },
    { unique: true, partialFilterExpression: { date: { $type: 'string' } } }
  )
  await puzzles.createIndex(
    { number: 1 },
    { unique: true, partialFilterExpression: { number: { $type: 'number' } } }
  )

  // FIFO by generation time — `number` doesn't exist pre-schedule anymore,
  // so it can't be the pull-order.
  const mediumQueue = await puzzles
    .find({ status: 'approved', date: null, difficultyTier: 'medium' })
    .sort({ createdAt: 1 })
    .toArray()
  const spicyQueue = await puzzles
    .find({ status: 'approved', date: null, difficultyTier: 'spicy' })
    .sort({ createdAt: 1 })
    .toArray()

  const totalAvailable = mediumQueue.length + spicyQueue.length
  if (totalAvailable === 0) {
    console.log('Nothing to schedule — no approved-and-unscheduled puzzles of either tier.')
    process.exit(0)
  }

  const target = Math.min(COUNT, totalAvailable)
  if (target < COUNT) {
    console.warn(
      `Only ${totalAvailable} approved-and-unscheduled puzzles available (${mediumQueue.length} medium, ${spicyQueue.length} spicy) — requested ${COUNT}.`
    )
  }

  const takenDocs = await puzzles
    .find(
      { status: { $in: ['scheduled', 'live'] }, date: { $ne: null } },
      { projection: { date: 1, ruleId: 1, templateId: 1 } }
    )
    .toArray()
  const taken = new Set(takenDocs.map((doc) => doc.date as string))
  // What's already on the calendar, so the spacing check below sees existing
  // schedule entries as well as ones made during this run.
  const placements: Placement[] = takenDocs.map((doc) => ({
    date: doc.date as string,
    ruleId: doc.ruleId,
    templateId: doc.templateId,
    isLexical: isLexicalRule(doc.ruleId),
  }))

  let nextNumber = (await puzzles.countDocuments({ status: { $in: ['scheduled', 'live'] } })) + 1

  let cursor = START_DATE
  let scheduled = 0
  let daysWalked = 0
  let capBreaches = 0
  let skippedDates = 0
  const placedByFamily = { lexical: 0, semantic: 0 }

  while (scheduled < target && daysWalked < MAX_DAYS_WALKED) {
    daysWalked += 1

    if (taken.has(cursor)) {
      cursor = addDaysToDateString(cursor, 1)
      continue
    }

    const tier: PuzzleDoc['difficultyTier'] = isSaturday(cursor) ? 'spicy' : 'medium'
    const queue = tier === 'spicy' ? spicyQueue : mediumQueue
    // Strict FIFO used to place whatever came next, never looking at ruleId —
    // so a batch that happened to produce the same rule several times landed
    // those on nearby dates. selectForDate prefers a puzzle that is both fresh
    // and inside the lexical cap, then a fresh one, then the queue head; every
    // fallback is reported rather than silently taken.
    const choice = selectForDate(cursor, queue, placements)
    const candidate = choice.index === -1 ? undefined : queue.splice(choice.index, 1)[0]
    // Counted, not warned per-date: with the taxonomy currently a little short
    // on semantic rules this fires often enough that a line each would bury
    // the rest of the output. The end-of-run summary carries it.
    if (candidate && choice.overCap) capBreaches += 1

    if (!candidate) {
      console.warn(
        `No approved ${tier} puzzle available for ${cursor}${tier === 'spicy' ? ' (Spicy Saturday)' : ''} — skipping, left unscheduled.`
      )
      skippedDates += 1
      cursor = addDaysToDateString(cursor, 1)
      continue
    }

    const date = cursor
    taken.add(date)
    placements.push({
      date,
      ruleId: candidate.ruleId,
      templateId: candidate.templateId,
      isLexical: isLexicalRule(candidate.ruleId),
    })
    cursor = addDaysToDateString(cursor, 1)

    const number = nextNumber
    const update = await puzzles.updateOne(
      { _id: candidate._id, status: 'approved', date: null },
      { $set: { date, status: 'scheduled', number } }
    )

    if (update.matchedCount === 0) {
      console.warn(
        `Skipped a ${candidate.difficultyTier} puzzle (${candidate._id}) — it changed before this could apply.`
      )
      continue
    }

    nextNumber += 1
    scheduled += 1
    if (isLexicalRule(candidate.ruleId)) placedByFamily.lexical += 1
    else placedByFamily.semantic += 1
    console.log(`Puzzle #${number} (${candidate.difficultyTier}) -> ${date}`)
  }

  if (daysWalked >= MAX_DAYS_WALKED) {
    console.warn(
      `Stopped after walking ${MAX_DAYS_WALKED} days without reaching the requested count.`
    )
  }

  const placedTotal = placedByFamily.lexical + placedByFamily.semantic
  const lexicalShare =
    placedTotal > 0 ? Math.round((100 * placedByFamily.lexical) / placedTotal) : 0
  console.log(`
Done. Scheduled ${scheduled}/${COUNT}.`)
  console.log(
    `  lexical ${placedByFamily.lexical} / semantic ${placedByFamily.semantic} (${lexicalShare}% lexical)`
  )
  // Surfaced every run: a starving scheduler otherwise looks identical to a
  // working one until someone notices the gaps weeks later.
  if (skippedDates > 0)
    console.warn(`  ${skippedDates} date(s) left empty — the approved pool ran dry for that tier.`)
  if (capBreaches > 0)
    console.warn(
      `  ${capBreaches} placement(s) exceeded the ${MAX_LEXICAL_PER_WEEK}/week lexical cap — approve more semantic puzzles.`
    )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
