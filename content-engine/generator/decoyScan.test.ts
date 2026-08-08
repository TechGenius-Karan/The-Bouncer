import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { makeWord } from './testUtils'
import { scanDecoys } from './decoyScan'
import type { ClueEntry } from './types'

const doubledLetter = RULES.find((r) => r.id === 'doubled-letter')!
const sameStartEnd = RULES.find((r) => r.id === 'same-start-end')!
const startsWithVowel = RULES.find((r) => r.id === 'starts-with-vowel')!
const miniTaxonomy = [doubledLetter, sameStartEnd, startsWithVowel]

describe('scanDecoys', () => {
  it('flags a rule that fits the clue set as well as the true rule, and excludes one that does not', () => {
    // IN clues: doubled letter AND same start/end, none start with a vowel.
    const wordBank = [
      makeWord('toot'), // doubled 'oo', t...t
      makeWord('noon'), // doubled 'oo', n...n
      makeWord('deed'), // doubled 'ee', d...d
      // OUT clues: neither doubled letter nor same start/end. "acid" starts
      // with a vowel while still being a true OUT, which is what kills
      // starts-with-vowel as a decoy.
      makeWord('acid'),
      makeWord('bring'),
      makeWord('dance'),
    ]

    const clues: ClueEntry[] = [
      { wordId: 'toot', label: 'IN', displayOrder: 0 },
      { wordId: 'noon', label: 'IN', displayOrder: 1 },
      { wordId: 'deed', label: 'IN', displayOrder: 2 },
      { wordId: 'acid', label: 'OUT', displayOrder: 3 },
      { wordId: 'bring', label: 'OUT', displayOrder: 4 },
      { wordId: 'dance', label: 'OUT', displayOrder: 5 },
    ]

    const decoys = scanDecoys(doubledLetter, clues, wordBank, miniTaxonomy)

    expect(decoys).toEqual([{ ruleId: 'same-start-end', subtlety: sameStartEnd.subtlety }])
  })

  it('never includes the true rule itself', () => {
    const wordBank = [makeWord('toot'), makeWord('acid')]
    const clues: ClueEntry[] = [
      { wordId: 'toot', label: 'IN', displayOrder: 0 },
      { wordId: 'acid', label: 'OUT', displayOrder: 1 },
    ]
    const decoys = scanDecoys(doubledLetter, clues, wordBank, miniTaxonomy)
    expect(decoys.some((d) => d.ruleId === doubledLetter.id)).toBe(false)
  })
})
