import type { Filter } from 'mongodb'
import type { AdminBufferHealthResponse, AdminPuzzleStatsResponse } from './adminApi'
import { getCollections } from './db'
import { addDaysToDateString, isSaturday, resolvePuzzleDateString } from './puzzleDate'
import type { PuzzleDoc } from './types'

// Phase 8 (build-plan.md / planning.md §9.2, §9.3): the numbers behind the
// admin buffer-health panel and per-puzzle live stats. Kept separate from
// adminPuzzleDetail.ts, which resolves the reviewer-facing shape of a single
// pending puzzle — this file is about aggregate/operational signals instead.

const GAP_SCAN_DAYS = 28

/**
 * Supply counts alone can't see a calendar hole that schedulePuzzles.ts
 * already left behind (e.g. a Saturday with no spicy puzzle available at
 * the time). gapDates re-walks the same day-by-day, tier-aware logic the
 * scheduler itself uses to surface exactly which upcoming dates are still
 * missing their correctly-tiered puzzle, so a healthy-looking count can't
 * hide a real hole inside the window.
 */
export async function resolveBufferHealth(now: Date = new Date()): Promise<AdminBufferHealthResponse> {
  const { puzzles } = await getCollections()
  const today = resolvePuzzleDateString(now)

  const readyOrScheduledAhead = (tier: PuzzleDoc['difficultyTier']): Filter<PuzzleDoc> => ({
    difficultyTier: tier,
    $or: [
      { status: 'approved', date: null },
      { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
    ],
  })

  const [mediumBufferDays, spicyBufferWeeks, scheduledAheadDocs] = await Promise.all([
    puzzles.countDocuments(readyOrScheduledAhead('medium')),
    puzzles.countDocuments(readyOrScheduledAhead('spicy')),
    puzzles
      .find(
        { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
        { projection: { date: 1, difficultyTier: 1 } },
      )
      .toArray(),
  ])

  const tierByDate = new Map(scheduledAheadDocs.map((doc) => [doc.date as string, doc.difficultyTier]))

  const gapDates: string[] = []
  let cursor = today
  for (let i = 0; i < GAP_SCAN_DAYS; i++) {
    const expectedTier: PuzzleDoc['difficultyTier'] = isSaturday(cursor) ? 'spicy' : 'medium'
    if (tierByDate.get(cursor) !== expectedTier) {
      gapDates.push(cursor)
    }
    cursor = addDaysToDateString(cursor, 1)
  }

  return { mediumBufferDays, spicyBufferWeeks, gapDates }
}

/**
 * Per-guest miss rate (by word) — see planning.md §9.3. Deliberately scoped
 * to guest words only (the ones a player actually sorts); clues are shown,
 * never attempted, so they have no placements to aggregate. Rule-level
 * attribution (which decoy rule a miss clusters around) is a documented,
 * deliberate follow-up: PuzzleGuestDoc never persists which rule made a
 * given guest a decoy — see build-plan.md Phase 8 notes.
 */
export async function resolvePuzzleStats(puzzle: PuzzleDoc): Promise<AdminPuzzleStatsResponse> {
  const { results, words } = await getCollections()
  const puzzleId = puzzle._id!.toString() // ResultDoc.puzzleId is a plain string, not an ObjectId

  const [missRateDocs, scoreStatsDocs] = await Promise.all([
    results
      .aggregate<{ _id: string; attempts: number; misses: number }>([
        { $match: { puzzleId } },
        { $unwind: '$placements' },
        {
          $group: {
            _id: '$placements.wordId',
            attempts: { $sum: 1 },
            misses: { $sum: { $cond: ['$placements.correct', 0, 1] } },
          },
        },
      ])
      .toArray(),
    results
      .aggregate<{ _id: null; avgScore: number; completedCount: number }>([
        { $match: { puzzleId, roundComplete: true } },
        { $group: { _id: null, avgScore: { $avg: '$score' }, completedCount: { $sum: 1 } } },
      ])
      .toArray(),
  ])

  const missStatsByWordId = new Map(missRateDocs.map((d) => [d._id, d]))
  const wordDocs = await words.find({ _id: { $in: puzzle.guests.map((g) => g.wordId) } }).toArray()
  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))

  const guestMissRates = puzzle.guests
    .map((guest) => {
      const stats = missStatsByWordId.get(guest.wordId)
      const attempts = stats?.attempts ?? 0
      const misses = stats?.misses ?? 0
      return {
        wordId: guest.wordId,
        word: spellingOf.get(guest.wordId) ?? guest.wordId,
        trueLabel: guest.trueLabel,
        isTrap: guest.isTrap,
        trapType: guest.trapType,
        attempts,
        misses,
        missRate: attempts === 0 ? 0 : misses / attempts,
      }
    })
    .sort((a, b) => b.missRate - a.missRate)

  const scoreStats = scoreStatsDocs[0]

  return {
    puzzleId,
    number: puzzle.number,
    difficultyTier: puzzle.difficultyTier,
    status: puzzle.status,
    completedCount: scoreStats?.completedCount ?? 0,
    avgScore: scoreStats ? scoreStats.avgScore : null,
    guestMissRates,
  }
}
