import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import type { PuzzleClueDoc } from './types.js'
import {
  puzzleKindFrom,
  ruleHolderFilter,
  splitVisualRuleUsage,
  VISUAL_RULE_USAGE_FILTER,
  visualRoundFields,
} from './visual.js'

describe('puzzleKindFrom', () => {
  it('is visual only for exactly "visual"', () => {
    expect(puzzleKindFrom('visual')).toBe('visual')
    expect(puzzleKindFrom(undefined)).toBe('word')
    expect(puzzleKindFrom('')).toBe('word')
  })
})

describe('visual rule usage (§3.5)', () => {
  it('counts approved, scheduled and live as used, pending as pending, and frees rejected', () => {
    const { usedRuleIds, pendingRuleIds } = splitVisualRuleUsage([
      { ruleId: 'visual-a', status: 'approved' },
      { ruleId: 'visual-b', status: 'scheduled' },
      { ruleId: 'visual-c', status: 'live' },
      { ruleId: 'visual-d', status: 'pending_approval' },
      { ruleId: 'visual-e', status: 'rejected' },
    ])
    expect([...usedRuleIds]).toEqual(['visual-a', 'visual-b', 'visual-c'])
    expect([...pendingRuleIds]).toEqual(['visual-d'])
  })

  it('only reads visual puzzles', () => {
    expect(VISUAL_RULE_USAGE_FILTER).toMatchObject({ kind: 'visual' })
  })

  it('lets approval through when the only earlier use was rejected or unscheduled', () => {
    const self = new ObjectId()
    expect(ruleHolderFilter('visual-a', self)).toEqual({
      kind: 'visual',
      ruleId: 'visual-a',
      status: { $in: ['approved', 'scheduled', 'live'] },
      _id: { $ne: self },
    })
  })
})

describe('visualRoundFields', () => {
  const clues: PuzzleClueDoc[] = [
    { wordId: 'anchor', label: 'IN', displayOrder: 0 },
    { wordId: 'cork', label: 'OUT', displayOrder: 1 },
    { wordId: 'coin', label: 'IN', displayOrder: 2 },
  ]

  it('adds nothing to a word round', () => {
    expect(visualRoundFields({ clues })).toEqual({})
    expect(visualRoundFields({ kind: 'word', clues })).toEqual({})
  })

  it('adds kind and the clue ids, in clue order, to a visual round', () => {
    expect(visualRoundFields({ kind: 'visual', clues })).toEqual({
      kind: 'visual',
      clueIds: { in: ['anchor', 'coin'], out: ['cork'] },
    })
  })
})
