import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { MEDIUM_KNOBS } from './difficulty'
import { buildRuleIndex } from './lookup'
import { makeWord } from './testUtils'
import { validateAndRepair } from './validator'
import type { CandidatePuzzle } from './types'

const ruleIndex = buildRuleIndex(RULES)

function sabotagedCandidate(): CandidatePuzzle {
  // "same-start-end" happens to match "doubled-letter" across every single
  // item here (both clues and pool) — a genuine fatal collision, not a decoy.
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
  it('repairs a sabotaged candidate when the word bank has a suitable replacement', () => {
    const candidate = sabotagedCandidate()
    const wordBank = [
      makeWord('noon'),
      makeWord('deed'),
      makeWord('chair'),
      makeWord('table'),
      makeWord('toot'),
      makeWord('plant'),
      makeWord('puppy'), // doubled-letter=true, same-start-end=false — breaks the collision
    ]

    const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)

    expect(result.status).toBe('valid')
    expect(candidate.guests[0].wordId).toBe('puppy')
    expect(candidate.guests[0].isTrap).toBe(true)
    expect(candidate.guests[0].trapType).toBe('t-but-looks-wrong')
    // the other guest didn't need to change
    expect(candidate.guests[1].wordId).toBe('plant')
  })

  it('rejects a sabotaged candidate when no replacement word exists', () => {
    const candidate = sabotagedCandidate()
    const wordBank = [
      makeWord('noon'),
      makeWord('deed'),
      makeWord('chair'),
      makeWord('table'),
      makeWord('toot'),
      makeWord('plant'),
    ]

    const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)

    expect(result.status).toBe('reject')
    if (result.status === 'reject') {
      expect(result.reason).toBe('unrepairable-collision')
      expect(result.collidingRuleIds).toContain('same-start-end')
    }
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
        { wordId: 'dog', trueLabel: 'OUT', displayOrder: 1, isTrap: false, trapType: null },
      ],
      liveDecoys: [],
    }

    const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)

    expect(result.status).toBe('valid')
    expect(candidate.guests.map((g) => g.wordId)).toEqual(['mosque', 'dog'])
  })
})
