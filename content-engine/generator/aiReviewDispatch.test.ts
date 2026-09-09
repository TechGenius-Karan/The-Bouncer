import { describe, expect, it } from 'vitest'
import { RULES } from '../rules/index.js'
import { buildWordBank } from '../words/wordBank.js'
import { MEDIUM_KNOBS } from './difficulty.js'
import { planAiReviewDispatch } from './aiReviewDispatch.js'
import type { RepairWordInput } from './repairWord.js'

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

  const validRewrite = {
    action: 'rewrite-puzzle' as const,
    rationale: 'more variety',
    clues: [
      { word: 'quiet', label: 'IN' as const },
      { word: 'unique', label: 'IN' as const },
      { word: 'square', label: 'IN' as const },
      { word: 'cat', label: 'OUT' as const },
      { word: 'plan', label: 'OUT' as const },
      { word: 'dog', label: 'OUT' as const },
    ],
    guests: [
      { word: 'quick', label: 'IN' as const },
      { word: 'quarter', label: 'IN' as const },
      { word: 'equal', label: 'IN' as const },
      { word: 'table', label: 'OUT' as const },
      { word: 'chair', label: 'OUT' as const },
      { word: 'apple', label: 'OUT' as const },
    ],
  }

  it('rewrite-puzzle: accepts AI-authored content that validates and stays pending', () => {
    const plan = planAiReviewDispatch(validRewrite, containsQInput(), RULES, wordBank)
    expect(plan.stillPending).toBe(true)
    expect(plan.puzzleMutation.kind).toBe('update-content')
    if (plan.puzzleMutation.kind === 'update-content') {
      expect(plan.puzzleMutation.clues.map((c) => c.wordId)).toContain('quiet')
      // guest true-labels are recomputed from the rule, not trusted from the AI
      const quick = plan.puzzleMutation.guests.find((g) => g.wordId === 'quick')!
      expect(quick.trueLabel).toBe('IN')
    }
  })

  it('rewrite-puzzle: rejects when a word is not in the bank', () => {
    const bad = {
      ...validRewrite,
      clues: [{ word: 'zzqqxx', label: 'IN' as const }, ...validRewrite.clues.slice(1)],
    }
    expect(planAiReviewDispatch(bad, containsQInput(), RULES, wordBank).puzzleMutation.kind).toBe(
      'reject'
    )
  })

  it('rewrite-puzzle: rejects when a clue is mislabeled against the real rule', () => {
    // "cat" has no q, so labeling it IN for contains-q is a lie the server catches.
    const bad = {
      ...validRewrite,
      clues: [{ word: 'cat', label: 'IN' as const }, ...validRewrite.clues.slice(1)],
    }
    expect(planAiReviewDispatch(bad, containsQInput(), RULES, wordBank).puzzleMutation.kind).toBe(
      'reject'
    )
  })

  it('rewrite-puzzle: rejects when the counts do not match the tier knobs', () => {
    const bad = { ...validRewrite, clues: validRewrite.clues.slice(0, 4) }
    expect(planAiReviewDispatch(bad, containsQInput(), RULES, wordBank).puzzleMutation.kind).toBe(
      'reject'
    )
  })

  it('rewrite-puzzle: rejects an all-one-side giveaway guest pool', () => {
    const bad = {
      ...validRewrite,
      guests: [
        { word: 'quick', label: 'IN' as const },
        { word: 'quarter', label: 'IN' as const },
        { word: 'equal', label: 'IN' as const },
        { word: 'quiz', label: 'IN' as const },
        { word: 'quote', label: 'IN' as const },
        { word: 'queen', label: 'IN' as const },
      ],
    }
    expect(planAiReviewDispatch(bad, containsQInput(), RULES, wordBank).puzzleMutation.kind).toBe(
      'reject'
    )
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

// The whole point of this block: a refused edit must say WHY. 40% of real
// refines were leaving the puzzle untouched while the reviewer was shown the
// model's rationale describing what it meant to do — a good sentence beside an
// unchanged board, with no way to tell what went wrong.
describe('rejection reasons', () => {
  const rewrite = (
    clues: { word: string; label: 'IN' | 'OUT' }[],
    guests: { word: string; label: 'IN' | 'OUT' }[]
  ) =>
    planAiReviewDispatch(
      { action: 'rewrite-puzzle', rationale: 'x', clues, guests },
      containsQInput(),
      RULES,
      wordBank
    )

  const sixGuests: { word: string; label: 'IN' | 'OUT' }[] = [
    { word: 'quiet', label: 'IN' },
    { word: 'unique', label: 'IN' },
    { word: 'mosque', label: 'IN' },
    { word: 'cat', label: 'OUT' },
    { word: 'dog', label: 'OUT' },
    { word: 'plan', label: 'OUT' },
  ]
  const validClues: { word: string; label: 'IN' | 'OUT' }[] = [
    { word: 'quarter', label: 'IN' },
    { word: 'square', label: 'IN' },
    { word: 'equal', label: 'IN' },
    { word: 'table', label: 'OUT' },
    { word: 'chair', label: 'OUT' },
    { word: 'ocean', label: 'OUT' },
  ]

  it('names a word that is not in the bank', () => {
    const plan = rewrite([{ word: 'zzzznotaword', label: 'IN' }, ...validClues.slice(1)], sixGuests)
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.failureReason).toContain('zzzznotaword')
    expect(plan.failureReason).toContain('not in the word bank')
  })

  it('names the word that was duplicated', () => {
    const plan = rewrite(validClues, [...sixGuests.slice(0, 5), { word: 'quiet', label: 'IN' }])
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.failureReason).toContain('quiet')
  })

  it('reports wrong clue counts with the numbers', () => {
    const plan = rewrite(validClues.slice(0, 4), sixGuests)
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.failureReason).toMatch(/clue counts/)
  })

  it('reports a clue labelled against the rule, and which way round', () => {
    // "bread" has no q, so labelling it IN contradicts contains-q. It must not
    // already appear elsewhere on the board, or the duplicate check fires first.
    const plan = rewrite([{ word: 'bread', label: 'IN' }, ...validClues.slice(1)], sixGuests)
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.failureReason).toContain('bread')
    expect(plan.failureReason).toContain('OUT')
  })

  it('says nothing about failure when the edit actually applies', () => {
    const plan = rewrite(validClues, sixGuests)
    if (plan.puzzleMutation.kind === 'update-content') {
      expect(plan.failureReason).toBeUndefined()
    }
  })

  it('explains a swap-word that has no viable replacement', () => {
    const plan = planAiReviewDispatch(
      { action: 'swap-word', badWordId: 'not-a-real-word-id', rationale: 'x' },
      containsQInput(),
      RULES,
      wordBank
    )
    expect(plan.puzzleMutation.kind).toBe('reject')
    expect(plan.failureReason).toBeTruthy()
  })
})
