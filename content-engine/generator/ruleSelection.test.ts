import { describe, expect, it } from 'vitest'
import type { Rule } from '../rules/types.js'
import { eligibleRulesByFamily, pickFamily, pickTrueRule } from './ruleSelection.js'

function rule(
  id: string,
  family: Rule['family'],
  subtlety: Rule['subtlety'],
  mechanic: Rule['mechanic'] = 'letter-pattern'
): Rule {
  return {
    id,
    name: id,
    descriptionTemplate: id,
    family,
    mechanic,
    subtlety,
    evaluate: () => true,
  }
}

const lex2 = rule('lex-2', 'lexical-structural', 2)
const lex5 = rule('lex-5', 'lexical-structural', 5)
const sem2 = rule('sem-2', 'semantic-knowledge', 2)
const sem4 = rule('sem-4', 'semantic-knowledge', 4)
const allRules = [lex2, lex5, sem2, sem4]

describe('eligibleRulesByFamily', () => {
  it('filters by family and subtlety range together', () => {
    expect(eligibleRulesByFamily(allRules, 'lexical-structural', 2, 3)).toEqual([lex2])
    expect(eligibleRulesByFamily(allRules, 'semantic-knowledge', 2, 3)).toEqual([sem2])
  })

  it('returns an empty array when nothing in that family falls in range', () => {
    expect(eligibleRulesByFamily(allRules, 'semantic-knowledge', 4, 5)).toEqual([sem4])
    expect(eligibleRulesByFamily(allRules, 'lexical-structural', 4, 4)).toEqual([])
  })
})

// Math.random() is always in [0, 1), so weight 1 makes `Math.random() < weight`
// deterministically true and weight 0 deterministically false — no mocking needed.
describe('pickFamily', () => {
  it('always picks semantic when weight is 1 and both families are eligible', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickFamily([lex2], [sem2], 1)).toBe('semantic-knowledge')
    }
  })

  it('always picks lexical when weight is 0 and both families are eligible', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickFamily([lex2], [sem2], 0)).toBe('lexical-structural')
    }
  })

  it('falls back to lexical when weight is 1 but no semantic rule is eligible', () => {
    expect(pickFamily([lex2], [], 1)).toBe('lexical-structural')
  })

  it('falls back to semantic when weight is 0 but no lexical rule is eligible', () => {
    expect(pickFamily([], [sem2], 0)).toBe('semantic-knowledge')
  })

  it('returns null, deferring to the full rule set ignoring subtlety, when neither family is eligible', () => {
    expect(pickFamily([], [], 0.3)).toBe(null)
  })
})

describe('pickTrueRule', () => {
  it('returns the only rule in a single-item pool regardless of reject counts', () => {
    for (let i = 0; i < 10; i++) {
      expect(pickTrueRule([lex2], new Map([['lex-2', 50]]))).toBe(lex2)
    }
  })

  it('defaults to a plain pick when no reject counts are given', () => {
    const pool = [lex2, lex5]
    for (let i = 0; i < 10; i++) {
      expect(pool).toContain(pickTrueRule(pool))
    }
  })

  it('deprioritizes, but does not eliminate, a heavily-rejected rule', () => {
    const pool = [lex2, lex5]
    const rejectCounts = new Map([['lex-5', 20]]) // weight ~0.048 vs lex2's weight 1 — ~21x less likely
    const counts = { 'lex-2': 0, 'lex-5': 0 }
    const runs = 300
    for (let i = 0; i < runs; i++) {
      counts[pickTrueRule(pool, rejectCounts).id as 'lex-2' | 'lex-5']++
    }
    // Generous margin against flakiness: expected ~14/300 for the rejected
    // rule, asserting only that it's clearly the minority, not eliminated.
    expect(counts['lex-5']).toBeGreaterThan(0)
    expect(counts['lex-5']).toBeLessThan(runs * 0.3)
  })

  // The bug this two-step pick exists to fix. A flat weighted pick let a
  // mechanic with many rules crowd out one with few, regardless of rating —
  // measured at 86% of spicy lexical puzzles being either a rhyme or a hidden
  // word. Rule count was setting the menu, not rule quality.
  it('does not let a large mechanic crowd out a small one', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      rule(`sound-${i}`, 'lexical-structural', 3, 'sound')
    )
    const one = rule('surgery-1', 'lexical-structural', 3, 'word-surgery')
    const pool = [...many, one]

    let surgery = 0
    const runs = 600
    for (let i = 0; i < runs; i++) {
      if (pickTrueRule(pool).mechanic === 'word-surgery') surgery++
    }
    // A flat pick would give the lone rule 1/41 ≈ 2%. Weighted by mechanic it
    // is 1.5 / (1.5 + 0.4 * sqrt(40)) ≈ 37%. Wide bounds: this asserts the
    // shape of the fix, not the exact constants, which are meant to be tuned.
    expect(surgery).toBeGreaterThan(runs * 0.15)
    expect(surgery).toBeLessThan(runs * 0.5)
  })

  it('still returns the only rule available, whatever its mechanic', () => {
    const lone = rule('lonely', 'lexical-structural', 3, 'meaning')
    expect(pickTrueRule([lone])).toBe(lone)
  })
})
