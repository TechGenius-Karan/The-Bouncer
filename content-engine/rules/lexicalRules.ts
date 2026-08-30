import type { Rule } from './types'

// Letters with enough word-bank coverage (>=15 matches as of the last
// check — build-plan.md Phase 10.6) to support real day-to-day puzzle
// variety. Rarer letters (j:2, x:8, z:6 matches) don't clear that bar yet —
// growing the word bank further is what unlocks them, not more code here.
export const CONTAINS_LETTER_TARGETS = ['q', 'v', 'f', 'w', 'y', 'k', 'g', 'b'] as const

function containsLetterRule(letter: string): Rule {
  return {
    id: `contains-${letter}`,
    name: `Contains ${letter.toUpperCase()}`,
    descriptionTemplate: `The word contains the letter ${letter.toUpperCase()}.`,
    family: 'lexical-structural',
    subtlety: 1,
    evaluate: (word) => word.spelling.includes(letter),
  }
}

export const LEXICAL_RULES: Rule[] = [
  {
    id: 'doubled-letter',
    name: 'Doubled Letter',
    descriptionTemplate: 'The word contains a repeated adjacent letter.',
    family: 'lexical-structural',
    subtlety: 1,
    evaluate: (word) => word.features.hasDoubledLetter,
  },
  {
    id: 'same-start-end',
    name: 'Same Start/End Letter',
    descriptionTemplate: "The word's first and last letters are the same.",
    family: 'lexical-structural',
    subtlety: 2,
    evaluate: (word) => word.features.sameStartEnd,
  },
  ...CONTAINS_LETTER_TARGETS.map(containsLetterRule),
  {
    id: 'prime-length',
    name: 'Prime Length',
    descriptionTemplate: "The word's length is a prime number.",
    family: 'lexical-structural',
    subtlety: 3,
    evaluate: (word) => word.features.isPrimeLength,
  },
  {
    id: 'starts-with-vowel',
    name: 'Starts With a Vowel',
    descriptionTemplate: 'The word starts with a vowel.',
    family: 'lexical-structural',
    subtlety: 1,
    evaluate: (word) => word.features.startsWithVowel,
  },
  {
    id: 'exactly-two-vowels',
    name: 'Exactly Two Vowels',
    descriptionTemplate: 'The word contains exactly two vowels.',
    family: 'lexical-structural',
    subtlety: 3,
    evaluate: (word) => word.features.vowelCount === 2,
  },
  {
    id: 'no-adjacent-vowels',
    name: 'No Adjacent Vowels',
    descriptionTemplate: 'No two vowels sit next to each other in the word.',
    family: 'lexical-structural',
    subtlety: 3,
    evaluate: (word) => word.features.noAdjacentVowels,
  },
  {
    id: 'hidden-number',
    name: 'Hidden Number',
    descriptionTemplate: 'The word hides a number word inside it.',
    family: 'lexical-structural',
    subtlety: 4,
    // hiddenWordHits only ever contains members of HIDDEN_WORD_TARGETS (currently
    // all numbers), so this is equivalent to `.length > 0` today — written this
    // way so a future hidden-color/hidden-body-part rule can share the same
    // precomputed field against a different target list without recomputing it.
    evaluate: (word) => word.features.hiddenWordHits.length > 0,
  },
  {
    id: 'hidden-one',
    name: 'Hidden "One"',
    descriptionTemplate: 'The word hides the number word "one" inside it.',
    family: 'lexical-structural',
    subtlety: 4,
    evaluate: (word) => word.features.hiddenWordHits.includes('one'),
  },
  {
    id: 'hidden-ten',
    name: 'Hidden "Ten"',
    descriptionTemplate: 'The word hides the number word "ten" inside it.',
    family: 'lexical-structural',
    subtlety: 4,
    evaluate: (word) => word.features.hiddenWordHits.includes('ten'),
  },
  {
    id: 'third-letter-vowel',
    name: 'Third Letter is a Vowel',
    descriptionTemplate: "The word's third letter is a vowel.",
    family: 'lexical-structural',
    subtlety: 2,
    evaluate: (word) => word.length >= 3 && 'aeiou'.includes(word.spelling[2]),
  },
  {
    id: 'subsequence-ace',
    name: 'Hides A-C-E in Order',
    descriptionTemplate: 'The letters A, C, E appear somewhere in the word, in that order.',
    family: 'lexical-structural',
    subtlety: 5,
    evaluate: (word) => word.features.subsequenceHits.includes('ace'),
  },
  {
    id: 'palindrome',
    name: 'Palindrome',
    descriptionTemplate: 'The word reads the same forwards and backwards.',
    family: 'lexical-structural',
    subtlety: 3,
    evaluate: (word) => word.features.isPalindrome,
  },
  {
    id: 'alphabetical-order-run',
    name: 'Letters in Alphabetical Order',
    descriptionTemplate: "The word's letters appear in alphabetical order, left to right.",
    family: 'lexical-structural',
    subtlety: 4,
    // A word's letters are already in alphabetical order exactly when sorting
    // them changes nothing — i.e. the spelling equals its own anagram signature.
    evaluate: (word) => word.spelling === word.features.anagramSignature,
  },
  {
    id: 'has-anagram',
    name: 'Has an Anagram',
    descriptionTemplate: "The word's letters can be rearranged into a different word in the bank.",
    family: 'lexical-structural',
    subtlety: 5,
    evaluate: (word) => word.tags.includes('lexical:has-anagram'),
  },
]
