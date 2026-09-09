import { describe, expect, it } from 'vitest'
import { generateBatchCore } from './batch.js'

// These run the real pipeline against the real 15,000-word bank and the full
// taxonomy, so they are legitimately slow — ~134ms per candidate, plus a cold
// word-bank build on the first call. That crept past vitest's 5s default as the
// taxonomy grew past 250 rules. Measured, not guessed: a 28-candidate batch (the
// largest the nightly cron ever asks for) takes ~3.7s end to end, so this is
// test-harness budgeting rather than a performance regression.
const SLOW = 30_000

describe('generateBatchCore', () => {
  it(
    'produces the requested number of structurally valid candidates across both tiers',
    () => {
      const batch = generateBatchCore(20, ['medium', 'spicy'])
      expect(batch).toHaveLength(20)
      expect(batch.some((c) => c.difficultyTier === 'medium')).toBe(true)
      expect(batch.some((c) => c.difficultyTier === 'spicy')).toBe(true)
      for (const candidate of batch) {
        expect(candidate.status).toBe('pending_approval')
      }
    },
    SLOW
  )

  it('still produces a full batch when a rejectCounts map is passed', () => {
    const rejectCounts = new Map([
      ['doubled-letter', 5],
      ['category-animal', 5],
    ])
    const batch = generateBatchCore(10, ['medium', 'spicy'], rejectCounts)
    expect(batch).toHaveLength(10)
  })
})
