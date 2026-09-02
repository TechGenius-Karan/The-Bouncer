import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildRuleIndex } from './lookup'
import { makeWord } from './testUtils'
import { MEDIUM_KNOBS } from './difficulty'
import { drawTargetIn, selectGuestPool } from './trapSelection'
import type { DecoyResult } from './types'

const doubledLetter = RULES.find((r) => r.id === 'doubled-letter')!
const sameStartEnd = RULES.find((r) => r.id === 'same-start-end')!
const ruleIndex = buildRuleIndex([doubledLetter, sameStartEnd])

// Quadrant A: T=true, D=true. Quadrant B: T=true, D=false (t-but-looks-wrong
// material). Quadrant C: T=false, D=true (decoy-trap material). Quadrant D: both false.
const wordBank = [
  makeWord('noon', 0.9), // A
  makeWord('deed', 0.5), // A
  makeWord('toot', 0.4), // A
  makeWord('puppy', 0.9), // B
  makeWord('letter', 0.8), // B
  makeWord('missing', 0.7), // B
  makeWord('level', 0.9), // C
  makeWord('radar', 0.6), // C
  makeWord('chair', 0.9), // D
  makeWord('table', 0.8), // D
  makeWord('plant', 0.7), // D
  makeWord('dance', 0.6), // D
]

const liveDecoys: DecoyResult[] = [{ ruleId: 'same-start-end', subtlety: sameStartEnd.subtlety }]

describe('selectGuestPool', () => {
  it('fills the pool to the requested size with no duplicates', () => {
    const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex)
    expect(pool).toHaveLength(MEDIUM_KNOBS.poolSize)
    expect(new Set(pool.map((g) => g.wordId)).size).toBe(pool.length)
  })

  it('picks exactly one decoy-trap (satisfies the decoy, violates the true rule)', () => {
    // Selection is frequency-weighted random now, not a deterministic
    // top-tier sort — assert the structural property (any quadrant-C word:
    // 'level' or 'radar'), not one fixed word, across several draws so a
    // regression to always-the-same-word would still get caught.
    const quadrantC = new Set(['level', 'radar'])
    for (let i = 0; i < 10; i++) {
      const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex)
      const decoyTraps = pool.filter((g) => g.trapType === 'decoy')
      expect(decoyTraps).toHaveLength(1)
      expect(quadrantC.has(decoyTraps[0].wordId)).toBe(true)
      expect(decoyTraps[0].trueLabel).toBe('OUT')
    }
  })

  it('picks exactly one T-but-looks-wrong trap (satisfies the true rule, violates the decoy)', () => {
    const quadrantB = new Set(['puppy', 'letter', 'missing'])
    for (let i = 0; i < 10; i++) {
      const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex)
      const tBadTraps = pool.filter((g) => g.trapType === 't-but-looks-wrong')
      expect(tBadTraps).toHaveLength(1)
      expect(quadrantB.has(tBadTraps[0].wordId)).toBe(true)
      expect(tBadTraps[0].trueLabel).toBe('IN')
    }
  })

  it('every guest’s trueLabel matches what the true rule actually says about that word', () => {
    const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex)
    const byId = new Map(wordBank.map((w) => [w.id, w]))
    for (const guest of pool) {
      const word = byId.get(guest.wordId)!
      expect(doubledLetter.evaluate(word)).toBe(guest.trueLabel === 'IN')
    }
  })

  it('respects excludeIds', () => {
    const excluded = new Set(['level', 'puppy'])
    for (let i = 0; i < 10; i++) {
      const pool = selectGuestPool(
        doubledLetter,
        liveDecoys,
        wordBank,
        MEDIUM_KNOBS,
        ruleIndex,
        excluded
      )
      expect(pool.some((g) => excluded.has(g.wordId))).toBe(false)
      // 'level' is the only other quadrant-C word — excluding it leaves 'radar' as the sole decoy-trap candidate
      expect(pool.some((g) => g.trapType === 'decoy' && g.wordId === 'radar')).toBe(true)
      // 'puppy' excluded leaves 'letter' or 'missing' as the t-but-looks-wrong candidate
      expect(
        pool.some(
          (g) =>
            g.trapType === 't-but-looks-wrong' && (g.wordId === 'letter' || g.wordId === 'missing')
        )
      ).toBe(true)
    }
  })

  it('falls back gracefully when no live decoys are supplied (no traps, just clean padding)', () => {
    const pool = selectGuestPool(doubledLetter, [], wordBank, MEDIUM_KNOBS, ruleIndex)
    expect(pool.every((g) => !g.isTrap)).toBe(true)
    expect(pool).toHaveLength(MEDIUM_KNOBS.poolSize)
  })
})

describe('drawTargetIn', () => {
  // Asserted on the draw itself rather than through selectGuestPool: the trap
  // passes set their own labels first and clamp extreme targets, so the
  // realized pool split is deliberately not the same distribution.
  it('follows the weighted table and never draws a single-label pool', () => {
    const counts = new Map<number, number>()
    const draws = 20_000
    for (let i = 0; i < draws; i++) {
      const n = drawTargetIn(6)
      counts.set(n, (counts.get(n) ?? 0) + 1)
    }
    expect(counts.get(0) ?? 0).toBe(0)
    expect(counts.get(6) ?? 0).toBe(0)

    const share = (n: number) => (counts.get(n) ?? 0) / draws
    expect(share(3)).toBeGreaterThan(0.47)
    expect(share(3)).toBeLessThan(0.53)
    expect(share(4)).toBeGreaterThan(0.17)
    expect(share(4)).toBeLessThan(0.23)
    expect(share(2)).toBeGreaterThan(0.17)
    expect(share(2)).toBeLessThan(0.23)
    expect(share(5)).toBeGreaterThan(0.03)
    expect(share(5)).toBeLessThan(0.07)
    expect(share(1)).toBeGreaterThan(0.03)
    expect(share(1)).toBeLessThan(0.07)
  })

  // The bug this phase exists to fix: the old coin flip drew from {3, 4} only,
  // so the pool was never IN-minority and "lean IN when unsure" paid off
  // regardless of the rule.
  it('draws IN-minority targets a meaningful share of the time', () => {
    let minority = 0
    for (let i = 0; i < 2_000; i++) if (drawTargetIn(6) < 3) minority++
    expect(minority / 2_000).toBeGreaterThan(0.15)
  })

  it('falls back to a balanced draw for pool sizes the table does not describe', () => {
    for (let i = 0; i < 200; i++) {
      const n = drawTargetIn(4)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(3)
    }
  })
})

describe('guest pool composition', () => {
  it('never produces a single-label pool', () => {
    for (let i = 0; i < 300; i++) {
      const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex)
      const inCount = pool.filter((g) => g.trueLabel === 'IN').length
      expect(inCount).toBeGreaterThanOrEqual(1)
      expect(inCount).toBeLessThanOrEqual(pool.length - 1)
    }
  })

  it('actually produces IN-minority pools, not just 3:3 and 4:2', () => {
    const splits = new Set<number>()
    for (let i = 0; i < 300; i++) {
      const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex)
      splits.add(pool.filter((g) => g.trueLabel === 'IN').length)
    }
    expect([...splits].some((n) => n < 3)).toBe(true)
  })
})

describe('trap word quality', () => {
  // Quadrant C ('level' 0.9, 'radar' 0.6) and quadrant B ('puppy' 0.9,
  // 'letter' 0.8, 'missing' 0.7) all clear the 0.4 band in the shared fixture.
  it('keeps every trap inside the recognisable frequency band', () => {
    const byId = new Map(wordBank.map((w) => [w.id, w]))
    for (let i = 0; i < 100; i++) {
      const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex)
      for (const trap of pool.filter((g) => g.isTrap)) {
        expect(byId.get(trap.wordId)!.frequencyScore).toBeGreaterThanOrEqual(0.4)
      }
    }
  })

  it('picks flatly within the band rather than favouring the commoner trap', () => {
    // Two quadrant-C candidates only. Frequency-weighted selection would pick
    // 'level' ~68% of the time (0.95 vs 0.45); flat selection is ~50/50.
    const bank = [
      makeWord('noon', 0.9),
      makeWord('deed', 0.5),
      makeWord('puppy', 0.9),
      makeWord('letter', 0.8),
      makeWord('level', 0.95), // C
      makeWord('radar', 0.45), // C
      makeWord('chair', 0.9),
      makeWord('table', 0.8),
      makeWord('plant', 0.7),
      makeWord('dance', 0.6),
    ]
    let radar = 0
    const draws = 1_000
    for (let i = 0; i < draws; i++) {
      const pool = selectGuestPool(doubledLetter, liveDecoys, bank, MEDIUM_KNOBS, ruleIndex)
      const trap = pool.find((g) => g.trapType === 'decoy')
      if (trap?.wordId === 'radar') radar++
    }
    expect(radar / draws).toBeGreaterThan(0.42)
    expect(radar / draws).toBeLessThan(0.58)
  })

  it('still places a trap when nothing clears the band', () => {
    // Both quadrant-C words sit under the floor — falling back beats dropping
    // the trap, which would cost the whole candidate at the pool-size check.
    const bank = [
      makeWord('noon', 0.9),
      makeWord('deed', 0.5),
      makeWord('puppy', 0.9),
      makeWord('letter', 0.8),
      makeWord('level', 0.2), // C, below the band
      makeWord('radar', 0.15), // C, below the band
      makeWord('chair', 0.9),
      makeWord('table', 0.8),
      makeWord('plant', 0.7),
      makeWord('dance', 0.6),
    ]
    const pool = selectGuestPool(doubledLetter, liveDecoys, bank, MEDIUM_KNOBS, ruleIndex)
    const trap = pool.find((g) => g.trapType === 'decoy')
    expect(trap).toBeDefined()
    expect(['level', 'radar']).toContain(trap!.wordId)
  })
})
