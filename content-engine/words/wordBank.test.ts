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

  // Collects failures in a plain loop and asserts once, rather than running
  // four expect() calls per word. At 15,000 words that was ~60,000 assertions
  // and the test intermittently blew the 5s default timeout — a flake that had
  // nothing to do with the code under test. Also reports which word is wrong
  // instead of just which assertion.
  it('fully populates features for every word', () => {
    const broken = bank
      .filter(
        (word) =>
          !word.features.firstLetter ||
          !word.features.lastLetter ||
          word.features.vcPattern.length !== word.length ||
          word.features.anagramSignature.length !== word.length
      )
      .map((word) => word.spelling)

    expect(broken).toEqual([])
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
