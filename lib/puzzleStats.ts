import type { Filter } from 'mongodb'
import type {
  AdminBatchStatsResponse,
  AdminBufferHealthResponse,
  AdminPuzzleStatsResponse,
} from './adminApi.js'
import { getCollections } from './db.js'
import { resolveNames } from './names.js'
import { addDaysToDateString, isSaturday, resolvePuzzleDateString } from './puzzleDate.js'
import type { PuzzleDoc } from './types.js'
import type { PuzzleKind } from './visual.js'

// planning.md §4's target average (~4-5/6) — a puzzle only gets flagged
// once it has a real completed attempt to judge; see resolveBatchStats.
const TARGET_SCORE_MIN = 4
const TARGET_SCORE_MAX = 5

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
export async function resolveBufferHealth(
  now: Date = new Date(),
  kind: PuzzleKind = 'word'
): Promise<AdminBufferHealthResponse> {
  const { puzzles } = await getCollections()
  const today = resolvePuzzleDateString(now)

  const readyOrScheduledAhead = (filter: Filter<PuzzleDoc>): Filter<PuzzleDoc> => ({
    ...filter,
    $or: [
      { status: 'approved', date: null },
      { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
    ],
  })

  // Visual puzzles are stored as medium (planning-visual-pivot.md §3.4), so the
  // word counts exclude them explicitly.
  const word = (tier: PuzzleDoc['difficultyTier']) =>
    readyOrScheduledAhead({ difficultyTier: tier, kind: { $ne: 'visual' } })
  const [mediumBufferDays, spicyBufferWeeks, visualBufferDays, scheduledAheadDocs] =
    await Promise.all([
      puzzles.countDocuments(word('medium')),
      puzzles.countDocuments(word('spicy')),
      puzzles.countDocuments(readyOrScheduledAhead({ kind: 'visual' })),
      puzzles
        .find(
          { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
          { projection: { date: 1, difficultyTier: 1 } }
        )
        .toArray(),
    ])

  const tierByDate = new Map(
    scheduledAheadDocs.map((doc) => [doc.date as string, doc.difficultyTier])
  )

  const gapDates: string[] = []
  let cursor = today
  for (let i = 0; i < GAP_SCAN_DAYS; i++) {
    const expectedTier: PuzzleDoc['difficultyTier'] = isSaturday(cursor) ? 'spicy' : 'medium'
    // Under visual any puzzle fills a day: word puzzles scheduled before the
    // cutover still play out (planning-visual-pivot.md §5.6).
    const scheduled = tierByDate.get(cursor)
    if (kind === 'visual' ? scheduled === undefined : scheduled !== expectedTier) {
      gapDates.push(cursor)
    }
    cursor = addDaysToDateString(cursor, 1)
  }

  return { kind, mediumBufferDays, spicyBufferWeeks, visualBufferDays, gapDates }
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
  const { results } = await getCollections()
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
  const nameOf = await resolveNames(
    puzzle,
    puzzle.guests.map((g) => g.wordId)
  )

  const guestMissRates = puzzle.guests
    .map((guest) => {
      const stats = missStatsByWordId.get(guest.wordId)
      const attempts = stats?.attempts ?? 0
      const misses = stats?.misses ?? 0
      return {
        wordId: guest.wordId,
        word: nameOf(guest.wordId),
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
    // Safe: resolvePuzzleStats is only ever called on a puzzle already found by number (admin-puzzle-stats.ts), which can't match a null field.
    number: puzzle.number!,
    difficultyTier: puzzle.difficultyTier,
    status: puzzle.status,
    completedCount: scoreStats?.completedCount ?? 0,
    avgScore: scoreStats ? scoreStats.avgScore : null,
    guestMissRates,
  }
}

/**
 * Phase 10 (build-plan.md): a playtesting batch's overall score picture at
 * a glance — a pooled per-attempt mean across every puzzle in the range
 * (the direct reading of "is our playtesting average near the ~4-5/6
 * target"), plus a per-puzzle breakdown so a reviewer can spot outliers
 * rather than just the one aggregate number.
 */
export async function resolveBatchStats(
  from: number,
  to: number
): Promise<AdminBatchStatsResponse> {
  const { puzzles, results } = await getCollections()
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i)

  const puzzleDocs = await puzzles
    .find({ number: { $in: numbers } })
    .sort({ number: 1 })
    .toArray()
  const foundNumbers = new Set(puzzleDocs.map((p) => p.number))
  const missingNumbers = numbers.filter((n) => !foundNumbers.has(n))
  const puzzleIds = puzzleDocs.map((p) => p._id!.toString())

  const [perPuzzleStats, pooledStatsDocs] = await Promise.all([
    results
      .aggregate<{ _id: string; avgScore: number; completedCount: number }>([
        { $match: { puzzleId: { $in: puzzleIds }, roundComplete: true } },
        { $group: { _id: '$puzzleId', avgScore: { $avg: '$score' }, completedCount: { $sum: 1 } } },
      ])
      .toArray(),
    results
      .aggregate<{ _id: null; avgScore: number; completedCount: number }>([
        { $match: { puzzleId: { $in: puzzleIds }, roundComplete: true } },
        { $group: { _id: null, avgScore: { $avg: '$score' }, completedCount: { $sum: 1 } } },
      ])
      .toArray(),
  ])

  const statsByPuzzleId = new Map(perPuzzleStats.map((s) => [s._id, s]))

  const puzzleSummaries = puzzleDocs.map((puzzle) => {
    const stats = statsByPuzzleId.get(puzzle._id!.toString())
    const avgScore = stats?.avgScore ?? null
    return {
      // Safe: puzzleDocs was queried via `number: { $in: numbers } }`, which can't match a null field.
      number: puzzle.number!,
      difficultyTier: puzzle.difficultyTier,
      avgScore,
      completedCount: stats?.completedCount ?? 0,
      inTargetBand:
        avgScore === null ? null : avgScore >= TARGET_SCORE_MIN && avgScore <= TARGET_SCORE_MAX,
    }
  })

  const pooled = pooledStatsDocs[0]

  return {
    from,
    to,
    pooledAvgScore: pooled ? pooled.avgScore : null,
    pooledCompletedCount: pooled?.completedCount ?? 0,
    missingNumbers,
    puzzles: puzzleSummaries,
  }
}
