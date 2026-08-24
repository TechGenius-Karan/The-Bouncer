import { describe, expect, it } from 'vitest'
import {
  MEDIUM_KNOBS,
  SPICY_KNOBS,
  resolveKnobs,
  subtletyRangeFor,
  trapAllocation,
} from './difficulty'

describe('resolveKnobs', () => {
  it('returns the medium defaults', () => {
    expect(resolveKnobs('medium')).toEqual(MEDIUM_KNOBS)
  })

  it('returns the spicy defaults', () => {
    expect(resolveKnobs('spicy')).toEqual(SPICY_KNOBS)
  })

  it('applies overrides on top of the tier defaults', () => {
    expect(resolveKnobs('medium', { poolSize: 7 })).toEqual({ ...MEDIUM_KNOBS, poolSize: 7 })
  })
})

describe('semanticRuleWeight', () => {
  it("defaults to 0.3 (§7.1's ~70/30 lexical/semantic mix) for both tiers", () => {
    expect(MEDIUM_KNOBS.semanticRuleWeight).toBe(0.3)
    expect(SPICY_KNOBS.semanticRuleWeight).toBe(0.3)
  })
})

describe('subtletyRangeFor', () => {
  it('medium is 2-3, spicy is 4-5', () => {
    expect(subtletyRangeFor('medium')).toEqual([2, 3])
    expect(subtletyRangeFor('spicy')).toEqual([4, 5])
  })
})

describe('trapAllocation', () => {
  it('splits a budget of 2 into 1 decoy-trap + 1 t-but-looks-wrong', () => {
    expect(trapAllocation(MEDIUM_KNOBS)).toEqual({ decoyTraps: 1, tButLooksWrong: 1 })
  })

  it('splits a budget of 3 into 2 decoy-traps + 1 t-but-looks-wrong', () => {
    expect(trapAllocation(SPICY_KNOBS)).toEqual({ decoyTraps: 2, tButLooksWrong: 1 })
  })

  it('a budget of 1 is a single decoy-trap and nothing else', () => {
    expect(trapAllocation({ ...MEDIUM_KNOBS, trapGuestCount: 1 })).toEqual({
      decoyTraps: 1,
      tButLooksWrong: 0,
    })
  })
})
