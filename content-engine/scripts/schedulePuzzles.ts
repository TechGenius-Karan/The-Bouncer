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
import { getCollections } from '../../netlify/functions/_shared/db'
import { addDaysToDateString, isSaturday, resolvePuzzleDateString } from '../../netlify/functions/_shared/puzzleDate'
import type { PuzzleDoc } from '../../netlify/functions/_shared/types'

const COUNT = Number(process.argv[2]) || 5
const START_DATE = process.argv[3] || resolvePuzzleDateString()

// Safety valve: with either tier's pool exhausted, walking forward to find
// enough correctly-tiered days for the other tier is still bounded (at most
// ~7 days per remaining spicy slot), but this caps runaway iteration if
// something is misconfigured rather than looping indefinitely.
const MAX_DAYS_WALKED = 3650

// Don't put the same rule within this many days of itself, or the same
// template family (all the "ends with X" rules, say) within this many —
// families are spaced more tightly since they're a softer kind of sameness.
const RULE_SPACING_DAYS = 60
const TEMPLATE_SPACING_DAYS = 6

interface Placement {
  date: string
  ruleId: string
  templateId?: string
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
}

/** True when this puzzle's rule and template family are far enough from every date already placed. */
function isFreshFor(date: string, puzzle: PuzzleDoc, placements: Placement[]): boolean {
  return !placements.some((p) => {
    const gap = daysBetween(date, p.date)
    if (p.ruleId === puzzle.ruleId && gap < RULE_SPACING_DAYS) return true
    return (
      puzzle.templateId !== undefined &&
      p.templateId === puzzle.templateId &&
      gap < TEMPLATE_SPACING_DAYS
    )
  })
}

async function main() {
  const { puzzles } = await getCollections()

  await puzzles.createIndex(
    { date: 1 },
    { unique: true, partialFilterExpression: { date: { $type: 'string' } } },
  )
  await puzzles.createIndex(
    { number: 1 },
    { unique: true, partialFilterExpression: { number: { $type: 'number' } } },
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
      `Only ${totalAvailable} approved-and-unscheduled puzzles available (${mediumQueue.length} medium, ${spicyQueue.length} spicy) — requested ${COUNT}.`,
    )
  }

  const takenDocs = await puzzles
    .find(
      { status: { $in: ['scheduled', 'live'] }, date: { $ne: null } },
      { projection: { date: 1, ruleId: 1, templateId: 1 } },
    )
    .toArray()
  const taken = new Set(takenDocs.map((doc) => doc.date as string))
  // What's already on the calendar, so the spacing check below sees existing
  // schedule entries as well as ones made during this run.
  const placements: Placement[] = takenDocs.map((doc) => ({
    date: doc.date as string,
    ruleId: doc.ruleId,
    templateId: doc.templateId,
  }))

  let nextNumber = (await puzzles.countDocuments({ status: { $in: ['scheduled', 'live'] } })) + 1

  let cursor = START_DATE
  let scheduled = 0
  let daysWalked = 0

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
    // those on nearby dates. Prefer the earliest queued puzzle whose rule (and
    // template family) hasn't been used near this date; fall back to plain FIFO
    // if the whole queue is in cooldown, since shipping a repeat still beats
    // leaving the day empty.
    const freshIndex = queue.findIndex((p) => isFreshFor(cursor, p, placements))
    const candidate = freshIndex === -1 ? queue.shift() : queue.splice(freshIndex, 1)[0]

    if (!candidate) {
      console.warn(
        `No approved ${tier} puzzle available for ${cursor}${tier === 'spicy' ? ' (Spicy Saturday)' : ''} — skipping, left unscheduled.`,
      )
      cursor = addDaysToDateString(cursor, 1)
      continue
    }

    const date = cursor
    taken.add(date)
    placements.push({ date, ruleId: candidate.ruleId, templateId: candidate.templateId })
    cursor = addDaysToDateString(cursor, 1)

    const number = nextNumber
    const update = await puzzles.updateOne(
      { _id: candidate._id, status: 'approved', date: null },
      { $set: { date, status: 'scheduled', number } },
    )

    if (update.matchedCount === 0) {
      console.warn(`Skipped a ${candidate.difficultyTier} puzzle (${candidate._id}) — it changed before this could apply.`)
      continue
    }

    nextNumber += 1
    scheduled += 1
    console.log(`Puzzle #${number} (${candidate.difficultyTier}) -> ${date}`)
  }

  if (daysWalked >= MAX_DAYS_WALKED) {
    console.warn(`Stopped after walking ${MAX_DAYS_WALKED} days without reaching the requested count.`)
  }

  console.log(`Done. Scheduled ${scheduled}/${COUNT}.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
