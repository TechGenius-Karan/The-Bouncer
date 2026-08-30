import { describe, expect, it } from 'vitest'
import { generateBatchCore } from './batch'

describe('generateBatchCore', () => {
  it('produces the requested number of structurally valid candidates across both tiers', () => {
    const batch = generateBatchCore(20, ['medium', 'spicy'])
    expect(batch).toHaveLength(20)
    expect(batch.some((c) => c.difficultyTier === 'medium')).toBe(true)
    expect(batch.some((c) => c.difficultyTier === 'spicy')).toBe(true)
    for (const candidate of batch) {
      expect(candidate.status).toBe('pending_approval')
    }
  })

  it('still produces a full batch when a rejectCounts map is passed', () => {
    const rejectCounts = new Map([
      ['doubled-letter', 5],
      ['category-animal', 5],
    ])
    const batch = generateBatchCore(10, ['medium', 'spicy'], rejectCounts)
    expect(batch).toHaveLength(10)
  })
})
