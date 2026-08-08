import type { Rule } from './types'

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
  {
    id: 'contains-q',
    name: 'Contains Q',
    descriptionTemplate: 'The word contains the letter Q.',
    family: 'lexical-structural',
    subtlety: 1,
    evaluate: (word) => word.spelling.includes('q'),
  },
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
]
