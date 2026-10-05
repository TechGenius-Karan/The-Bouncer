import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Filter } from 'mongodb'
import type { PuzzleDoc } from './types.js'

// db.ts throws at import without MONGODB_URI, so puzzles is faked:
// countDocuments records every filter it's called with (to check query
// shape), and find().toArray() returns a controllable set of scheduled-ahead
// docs (to drive the real gapDates walk in resolveBufferHealth itself).
const countDocumentsCalls: Filter<PuzzleDoc>[] = []
let scheduledAheadDocs: { date: string; difficultyTier: PuzzleDoc['difficultyTier'] }[] = []

vi.mock('./db.js', () => ({
  getCollections: async () => ({
    puzzles: {
      countDocuments: async (filter: Filter<PuzzleDoc>) => {
        countDocumentsCalls.push(filter)
        return 0
      },
      find: () => ({ toArray: async () => scheduledAheadDocs }),
    },
  }),
}))

import { resolveBufferHealth } from './puzzleStats.js'
import { addDaysToDateString, isSaturday, resolvePuzzleDateString } from './puzzleDate.js'

beforeEach(() => {
  countDocumentsCalls.length = 0
  scheduledAheadDocs = []
})

describe('resolveBufferHealth', () => {
  it('excludes visual puzzles from the word counts and scopes the visual count to kind visual', async () => {
    await resolveBufferHealth(new Date('2026-11-02T00:00:00.000Z'), 'word')
    const [mediumFilter, spicyFilter, visualFilter] = countDocumentsCalls
    expect(mediumFilter).toMatchObject({ difficultyTier: 'medium', kind: { $ne: 'visual' } })
    expect(spicyFilter).toMatchObject({ difficultyTier: 'spicy', kind: { $ne: 'visual' } })
    expect(visualFilter).toMatchObject({ kind: 'visual' })
  })

  it('under visual flags only true no-puzzle gaps; under word it still flags tier mismatches', async () => {
    const now = new Date('2026-11-02T00:00:00.000Z')
    const today = resolvePuzzleDateString(now)
    const noPuzzleDate = addDaysToDateString(today, 1)
    const mismatchedTierDate = addDaysToDateString(today, 2)
    const expectedTier = isSaturday(mismatchedTierDate) ? 'spicy' : 'medium'
    const mismatchedTier = expectedTier === 'medium' ? 'spicy' : 'medium'
    scheduledAheadDocs = [{ date: mismatchedTierDate, difficultyTier: mismatchedTier }]

    const wordHealth = await resolveBufferHealth(now, 'word')
    expect(wordHealth.gapDates).toContain(noPuzzleDate)
    expect(wordHealth.gapDates).toContain(mismatchedTierDate)

    const visualHealth = await resolveBufferHealth(now, 'visual')
    expect(visualHealth.gapDates).toContain(noPuzzleDate)
    expect(visualHealth.gapDates).not.toContain(mismatchedTierDate)
  })
})
