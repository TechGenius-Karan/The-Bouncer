import { describe, expect, it } from 'vitest'
import { BULK_SEED_WORDS } from './bulkSeedWords'
import { SEED_WORDS } from './seedWords'
import { buildWordBank } from './wordBank'

describe('buildWordBank', () => {
  const bank = buildWordBank()

  it('produces one Word per seed entry (hand-curated + corpus-sourced)', () => {
    expect(bank).toHaveLength(SEED_WORDS.length + BULK_SEED_WORDS.length)
  })

  it('has no duplicate ids', () => {
    const ids = new Set(bank.map((word) => word.id))
    expect(ids.size).toBe(bank.length)
  })

  it('fully populates features for every word', () => {
    for (const word of bank) {
      expect(word.features.firstLetter).toBeTruthy()
      expect(word.features.lastLetter).toBeTruthy()
      expect(word.features.vcPattern).toHaveLength(word.length)
      expect(word.features.anagramSignature).toHaveLength(word.length)
    }
  })

  it('is rich enough to exercise every rule (sanity thresholds from the plan)', () => {
    const count = (predicate: (word: (typeof bank)[number]) => boolean) =>
      bank.filter(predicate).length

    expect(count((w) => w.features.hasDoubledLetter)).toBeGreaterThanOrEqual(25)
    expect(count((w) => w.features.sameStartEnd)).toBeGreaterThanOrEqual(15)
    expect(count((w) => w.spelling.includes('q'))).toBeGreaterThanOrEqual(10)
    expect(count((w) => w.features.startsWithVowel)).toBeGreaterThanOrEqual(20)
    expect(count((w) => w.features.vowelCount === 2)).toBeGreaterThanOrEqual(25)
    expect(count((w) => w.features.noAdjacentVowels)).toBeGreaterThanOrEqual(25)
    expect(count((w) => w.features.hiddenWordHits.length > 0)).toBeGreaterThanOrEqual(12)
    expect(count((w) => w.length >= 3 && 'aeiou'.includes(w.spelling[2]))).toBeGreaterThanOrEqual(
      20
    )
    expect(count((w) => w.features.subsequenceHits.length > 0)).toBeGreaterThanOrEqual(15)
  })
})
