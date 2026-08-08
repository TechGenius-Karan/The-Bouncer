import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { MEDIUM_KNOBS } from './difficulty'
import { draftClueSet } from './draftClueSet'

const wordBank = buildWordBank()
const wordsById = new Map(wordBank.map((w) => [w.id, w]))
const doubledLetterRule = RULES.find((r) => r.id === 'doubled-letter')!

describe('draftClueSet', () => {
  it('drafts the requested number of IN and OUT clues', () => {
    const clues = draftClueSet(doubledLetterRule, wordBank, MEDIUM_KNOBS)
    expect(clues.filter((c) => c.label === 'IN')).toHaveLength(MEDIUM_KNOBS.clueCountIn)
    expect(clues.filter((c) => c.label === 'OUT')).toHaveLength(MEDIUM_KNOBS.clueCountOut)
  })

  it('every IN clue actually satisfies the rule and every OUT clue does not', () => {
    const clues = draftClueSet(doubledLetterRule, wordBank, MEDIUM_KNOBS)
    for (const clue of clues) {
      const word = wordsById.get(clue.wordId)!
      expect(doubledLetterRule.evaluate(word)).toBe(clue.label === 'IN')
    }
  })

  it('never returns duplicate words', () => {
    const clues = draftClueSet(doubledLetterRule, wordBank, MEDIUM_KNOBS)
    const ids = new Set(clues.map((c) => c.wordId))
    expect(ids.size).toBe(clues.length)
  })

  it('respects excludeIds', () => {
    const excluded = new Set(['bubble', 'letter', 'spoon', 'apple', 'follow', 'dinner'])
    const clues = draftClueSet(doubledLetterRule, wordBank, MEDIUM_KNOBS, excluded)
    for (const clue of clues) {
      expect(excluded.has(clue.wordId)).toBe(false)
    }
  })

  it('throws if the word bank cannot supply enough words', () => {
    const tinyBank = wordBank.filter((w) => w.spelling === 'bubble')
    expect(() => draftClueSet(doubledLetterRule, tinyBank, MEDIUM_KNOBS)).toThrow()
  })
})
