import { describe, expect, it } from 'vitest'
import type { Rule } from './types'
import { applyRuleOverrides } from './ruleOverrides'

function rule(id: string, subtlety: Rule['subtlety'] = 2): Rule {
  return {
    id,
    name: id,
    descriptionTemplate: id,
    family: 'lexical-structural',
    subtlety,
    evaluate: () => true,
  }
}

describe('applyRuleOverrides', () => {
  it('passes rules through unchanged when there are no overrides', () => {
    const rules = [rule('a'), rule('b')]
    expect(applyRuleOverrides(rules, [])).toEqual(rules)
  })

  it('replaces subtlety for an overridden rule, leaving evaluate/name/etc. untouched', () => {
    const rules = [rule('a', 2)]
    const result = applyRuleOverrides(rules, [{ ruleId: 'a', subtletyOverride: 5 }])
    expect(result).toHaveLength(1)
    expect(result[0].subtlety).toBe(5)
    expect(result[0].id).toBe('a')
    expect(result[0].evaluate).toBe(rules[0].evaluate)
  })

  it('leaves an untouched rule alone when other rules have overrides', () => {
    const rules = [rule('a', 2), rule('b', 3)]
    const result = applyRuleOverrides(rules, [{ ruleId: 'a', subtletyOverride: 5 }])
    expect(result.find((r) => r.id === 'b')).toEqual(rules[1])
  })

})
