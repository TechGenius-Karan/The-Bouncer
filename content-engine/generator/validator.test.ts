import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { MEDIUM_KNOBS } from './difficulty'
import { buildRuleIndex } from './lookup'
import { makeWord } from './testUtils'
import { validateAndRepair } from './validator'
import type { CandidatePuzzle } from './types'

const ruleIndex = buildRuleIndex(RULES)

// Words that make doubled-letter and same-start-end genuinely different rules
// rather than the same one. The classifier is bank-relative by design (see
// rules/ruleSimilarity.ts), and across the six board words alone these two
// rules have *identical* IN-sets — in that universe they really are one rule,
// and the validator is right to accept the collision. Divergence needs both
// disagreement quadrants populated: a doubled-letter word that isn't
// same-start-end, and same-start-end words that aren't doubled.
const DIVERGENCE_WITNESSES = ['puppy', 'area', 'kayak', 'radar', 'level']

function sabotagedCandidate(): CandidatePuzzle {
  // "same-start-end" matches "doubled-letter" across every single item here
  // (both clues and pool) — a real collision, not a decoy.
  return {
    ruleId: 'doubled-letter',
    difficultyTier: 'medium',
    knobValues: MEDIUM_KNOBS,
    status: 'pending_approval',
    clues: [
      { wordId: 'noon', label: 'IN', displayOrder: 0 },
      { wordId: 'deed', label: 'IN', displayOrder: 1 },
      { wordId: 'chair', label: 'OUT', displayOrder: 2 },
      { wordId: 'table', label: 'OUT', displayOrder: 3 },
    ],
    guests: [
      { wordId: 'toot', trueLabel: 'IN', displayOrder: 0, isTrap: false, trapType: null },
      { wordId: 'plant', trueLabel: 'OUT', displayOrder: 1, isTrap: false, trapType: null },
    ],
    liveDecoys: [],
  }
}

describe('validateAndRepair', () => {
  it('repairs a divergent collision by swapping the guest propping it up', () => {
    const candidate = sabotagedCandidate()
    const wordBank = [
      makeWord('noon'),
      makeWord('deed'),
      makeWord('chair'),
      makeWord('table'),
      makeWord('toot'),
      makeWord('plant'),
      ...DIVERGENCE_WITNESSES.map((w) => makeWord(w)),
    ]

    const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)

    expect(result.status).toBe('valid')
    // 'puppy' is the only doubled-letter word that isn't same-start-end.
    expect(candidate.guests[0].wordId).toBe('puppy')
    expect(candidate.guests[0].isTrap).toBe(true)
    expect(candidate.guests[0].trapType).toBe('t-but-looks-wrong')
    // the other guest didn't need to change
    expect(candidate.guests[1].wordId).toBe('plant')
    // Repaired, not tolerated — the board no longer reads as a second rule.
    expect(candidate.revealRuleId).toBeUndefined()
  })

  it('accepts an equivalent collision instead of repairing it, and reveals the better rule', () => {
    // Same board, but a bank in which the colliding rules are
    // indistinguishable — every doubled-letter word here is also
    // same-start-end, and noon/deed/toot are all palindromes besides.
    // planning.md §7.3 would discard this board. Nothing about it is unfair:
    // it ships, and the reveal upgrades to the most satisfying rule that
    // describes it (palindrome aha 5 > same-start-end 4 > doubled-letter 3).
    // "noon, deed, toot" really is a palindrome puzzle.
    const candidate = sabotagedCandidate()
    const wordBank = ['noon', 'deed', 'chair', 'table', 'toot', 'plant'].map((w) => makeWord(w))

    const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)

    expect(result.status).toBe('valid')
    expect(candidate.guests.map((g) => g.wordId)).toEqual(['toot', 'plant'])
    expect(candidate.revealRuleId).toBe('palindrome')
    // The generating rule is untouched — cooldown, scheduling and reject stats
    // all still key off it.
    expect(candidate.ruleId).toBe('doubled-letter')
  })

  it('accepts an already-clean candidate unchanged', () => {
    const wordBank = buildWordBank()
    const candidate: CandidatePuzzle = {
      ruleId: 'contains-q',
      difficultyTier: 'medium',
      knobValues: MEDIUM_KNOBS,
      status: 'pending_approval',
      clues: [
        { wordId: 'quiet', label: 'IN', displayOrder: 0 },
        { wordId: 'unique', label: 'IN', displayOrder: 1 },
        { wordId: 'cat', label: 'OUT', displayOrder: 2 },
        { wordId: 'plan', label: 'OUT', displayOrder: 3 },
      ],
      guests: [
        { wordId: 'mosque', trueLabel: 'IN', displayOrder: 0, isTrap: false, trapType: null },
        { wordId: 'ocean', trueLabel: 'OUT', displayOrder: 1, isTrap: false, trapType: null },
      ],
      liveDecoys: [],
    }

    const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)

    expect(result.status).toBe('valid')
    expect(candidate.guests.map((g) => g.wordId)).toEqual(['mosque', 'ocean'])
    expect(candidate.revealRuleId).toBeUndefined()
  })

  // Guards the AI-rewrite path: a puzzle re-validated after its board changed
  // must not keep an override naming a rule that no longer fits.
  it('clears a stale reveal override when the board no longer collides', () => {
    const candidate = sabotagedCandidate()
    candidate.revealRuleId = 'same-start-end'
    const wordBank = [
      makeWord('noon'),
      makeWord('deed'),
      makeWord('chair'),
      makeWord('table'),
      makeWord('toot'),
      makeWord('plant'),
      ...DIVERGENCE_WITNESSES.map((w) => makeWord(w)),
    ]

    const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)

    expect(result.status).toBe('valid')
    expect(candidate.revealRuleId).toBeUndefined()
  })
})
