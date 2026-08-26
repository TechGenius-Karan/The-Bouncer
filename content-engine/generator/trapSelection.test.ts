import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildRuleIndex } from './lookup'
import { makeWord } from './testUtils'
import { MEDIUM_KNOBS } from './difficulty'
import { selectGuestPool } from './trapSelection'
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
      const pool = selectGuestPool(doubledLetter, liveDecoys, wordBank, MEDIUM_KNOBS, ruleIndex, excluded)
      expect(pool.some((g) => excluded.has(g.wordId))).toBe(false)
      // 'level' is the only other quadrant-C word — excluding it leaves 'radar' as the sole decoy-trap candidate
      expect(pool.some((g) => g.trapType === 'decoy' && g.wordId === 'radar')).toBe(true)
      // 'puppy' excluded leaves 'letter' or 'missing' as the t-but-looks-wrong candidate
      expect(pool.some((g) => g.trapType === 't-but-looks-wrong' && (g.wordId === 'letter' || g.wordId === 'missing'))).toBe(true)
    }
  })

  it('falls back gracefully when no live decoys are supplied (no traps, just clean padding)', () => {
    const pool = selectGuestPool(doubledLetter, [], wordBank, MEDIUM_KNOBS, ruleIndex)
    expect(pool.every((g) => !g.isTrap)).toBe(true)
    expect(pool).toHaveLength(MEDIUM_KNOBS.poolSize)
  })
})
