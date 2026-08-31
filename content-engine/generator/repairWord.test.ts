import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { MEDIUM_KNOBS } from './difficulty'
import { repairWord, type RepairWordInput } from './repairWord'
import { makeWord } from './testUtils'

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
      { wordId: 'ocean', trueLabel: 'OUT', displayOrder: 1, isTrap: false, trapType: null },
    ],
  }
}

describe('repairWord', () => {
  it('swaps a flagged guest word for a different word satisfying the same rule/label', () => {
    const result = repairWord(containsQInput(), 'mosque', RULES, wordBank)

    expect(result.repaired).toBe(true)
    if (!result.repaired) return
    const newGuest = result.candidate.guests.find((g) => g.displayOrder === 0)!
    expect(newGuest.wordId).not.toBe('mosque')
    expect(newGuest.trueLabel).toBe('IN')
    expect(newGuest.wordId.includes('q')).toBe(true)
    // The untouched guest is unchanged.
    expect(result.candidate.guests.find((g) => g.displayOrder === 1)!.wordId).toBe('ocean')
  })

  it('swaps a flagged clue word, preserving its label and displayOrder', () => {
    const result = repairWord(containsQInput(), 'cat', RULES, wordBank)

    expect(result.repaired).toBe(true)
    if (!result.repaired) return
    const newClue = result.candidate.clues.find((c) => c.displayOrder === 2)!
    expect(newClue.wordId).not.toBe('cat')
    expect(newClue.label).toBe('OUT')
    expect(newClue.wordId.includes('q')).toBe(false)
  })

  it('resets isTrap/trapType on the replaced guest rather than guessing a matching trap role', () => {
    const input: RepairWordInput = {
      ...containsQInput(),
      guests: [
        { wordId: 'mosque', trueLabel: 'IN', displayOrder: 0, isTrap: true, trapType: 'decoy' },
        { wordId: 'ocean', trueLabel: 'OUT', displayOrder: 1, isTrap: false, trapType: null },
      ],
    }
    // Deliberately a narrow rule set: this asserts repairWord's own handling of
    // the trap role, and the full taxonomy would let validateAndRepair
    // legitimately re-flag the replacement as a trap for an unrelated
    // collision, which is a different behaviour from the one under test.
    const isolated = RULES.filter((r) => ['contains-q', 'palindrome'].includes(r.id))
    const result = repairWord(input, 'mosque', isolated, wordBank)

    expect(result.repaired).toBe(true)
    if (!result.repaired) return
    const newGuest = result.candidate.guests.find((g) => g.displayOrder === 0)!
    expect(newGuest.isTrap).toBe(false)
    expect(newGuest.trapType).toBe(null)
  })

  it('reports unrepaired when no replacement word exists in the given word bank', () => {
    const input = containsQInput()
    const tinyBank = [
      makeWord('quiet'),
      makeWord('unique'),
      makeWord('cat'),
      makeWord('plan'),
      makeWord('mosque'),
      makeWord('ocean'),
      // no spare IN (contains-q) word available as a replacement for "mosque"
    ]

    const result = repairWord(input, 'mosque', RULES, tinyBank)

    expect(result.repaired).toBe(false)
  })

  it('reports unrepaired when badWordId is not part of the puzzle at all', () => {
    const result = repairWord(containsQInput(), 'nonexistent', RULES, wordBank)
    expect(result.repaired).toBe(false)
  })
})
