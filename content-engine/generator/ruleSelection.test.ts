import { describe, expect, it } from 'vitest'
import type { Rule } from '../rules/types'
import { eligibleRulesByFamily, pickFamily } from './ruleSelection'

function rule(id: string, family: Rule['family'], subtlety: Rule['subtlety']): Rule {
  return {
    id,
    name: id,
    descriptionTemplate: id,
    family,
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
