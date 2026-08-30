import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { MEDIUM_KNOBS } from './difficulty'
import { planAiReviewDispatch } from './aiReviewDispatch'
import type { RepairWordInput } from './repairWord'

const wordBank = buildWordBank()

function containsQInput(): RepairWordInput {
  return {
    ruleId: 'contains-q',
    difficultyTier: 'medium',
    knobValues: MEDIUM_KNOBS,
    clues: [
      { wordId: 'quiet', label: 'IN', displayOrder: 0 },
      { wordId: 'unique', label: 'IN', displayOrder: 1 },
      { wordId: 'cat', label: 'OUT', displayOrder: 2 },
      { wordId: 'plan', label: 'OUT', displayOrder: 3 },
    ],
    guests: [
      { wordId: 'mosque', trueLabel: 'IN', displayOrder: 0, isTrap: false, trapType: null },
      { wordId: 'dog', trueLabel: 'OUT', displayOrder: 1, isTrap: false, trapType: null },
    ],
  }
}

describe('planAiReviewDispatch', () => {
  it('swap-word: updates content and stays pending when the word can be replaced', () => {
    const plan = planAiReviewDispatch(
      { action: 'swap-word', badWordId: 'mosque', rationale: 'x' },
      containsQInput(),
      RULES,
      wordBank
    )
    expect(plan.stillPending).toBe(true)
    expect(plan.ruleOverride).toBeNull()
    expect(plan.puzzleMutation.kind).toBe('update-content')
    if (plan.puzzleMutation.kind === 'update-content') {
      const guest = plan.puzzleMutation.guests.find((g) => g.displayOrder === 0)!
      expect(guest.wordId).not.toBe('mosque')
      expect(guest.wordId.includes('q')).toBe(true)
    }
  })

  it('swap-word: falls back to reject when the word is not in the puzzle', () => {
    const plan = planAiReviewDispatch(
      { action: 'swap-word', badWordId: 'nonexistent', rationale: 'x' },
      containsQInput(),
      RULES,
      wordBank
    )
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.stillPending).toBe(false)
    expect(plan.ruleOverride).toBeNull()
  })

  it('redraft-puzzle: regenerates fresh content for the same rule and stays pending', () => {
    const input: RepairWordInput = { ...containsQInput(), ruleId: 'same-start-end' }
    const plan = planAiReviewDispatch({ action: 'redraft-puzzle', rationale: 'weak traps' }, input, RULES, wordBank)
    expect(plan.stillPending).toBe(true)
    expect(plan.puzzleMutation.kind).toBe('update-content')
    if (plan.puzzleMutation.kind === 'update-content') {
      expect(plan.puzzleMutation.clues.length).toBeGreaterThan(0)
      expect(plan.puzzleMutation.guests.length).toBeGreaterThan(0)
    }
  })

  it('redraft-puzzle: falls back to reject when the ruleId is unknown', () => {
    const input: RepairWordInput = { ...containsQInput(), ruleId: 'no-such-rule' }
    const plan = planAiReviewDispatch({ action: 'redraft-puzzle', rationale: 'x' }, input, RULES, wordBank)
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.stillPending).toBe(false)
  })

  it('adjust-difficulty: rejects this instance and carries a subtletyOverride', () => {
    const plan = planAiReviewDispatch(
      { action: 'adjust-difficulty', newSubtlety: 4, rationale: 'too easy' },
      containsQInput(),
      RULES,
      wordBank
    )
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.stillPending).toBe(false)
    expect(plan.ruleOverride).toEqual({ ruleId: 'contains-q', subtletyOverride: 4 })
  })

  it('retire-rule: rejects this instance and carries a disabled override', () => {
    const plan = planAiReviewDispatch(
      { action: 'retire-rule', rationale: 'ambiguous' },
      containsQInput(),
      RULES,
      wordBank
    )
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.stillPending).toBe(false)
    expect(plan.ruleOverride).toEqual({ ruleId: 'contains-q', disabled: true })
  })

  it('agree-reject: rejects this instance with no override', () => {
    const plan = planAiReviewDispatch(
      { action: 'agree-reject', rationale: 'nothing to fix' },
      containsQInput(),
      RULES,
      wordBank
    )
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.stillPending).toBe(false)
    expect(plan.ruleOverride).toBeNull()
  })
})
