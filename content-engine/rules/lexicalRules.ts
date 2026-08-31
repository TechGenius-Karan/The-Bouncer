import { VOWELS } from '../words/fixedLists'
import type { Rule } from './types'

// Letters with enough word-bank coverage (>=15 matches) to support real
// day-to-day puzzle variety. The old list excluded j/x/z citing "j:2, x:8,
// z:6" — counts from the original ~417-word bank that nobody re-ran after it
// grew to 5,000, where the real numbers are j:96, x:78, z:41. Phase 3's
// generated rule-params file exists so this kind of stale hand-maintained
// gate stops happening.
export const CONTAINS_LETTER_TARGETS = [
  'q',
  'v',
  'f',
  'w',
  'y',
  'k',
  'g',
  'b',
  'j',
  'x',
  'z',
] as const

function containsLetterRule(letter: string): Rule {
  return {
    id: `contains-${letter}`,
    name: `Contains ${letter.toUpperCase()}`,
    descriptionTemplate: `The word contains the letter ${letter.toUpperCase()}.`,
    family: 'lexical-structural',
    // Was 1, which put it outside BOTH tier windows ([2,3] and [3,5]) — all 8
    // of these rules were unreachable dead code. Against a 5,000-word bank
    // spotting "they all contain a K" is genuinely a beat's work, so 2 is the
    // honest rating as well as the one that makes the rule usable.
    subtlety: 2,
    aha: 3,
    evaluate: (word) => word.spelling.includes(letter),
  }
}

export const LEXICAL_RULES: Rule[] = [
  {
    id: 'doubled-letter',
    name: 'Doubled Letter',
    descriptionTemplate: 'The word contains a repeated adjacent letter.',
    family: 'lexical-structural',
    subtlety: 2, // was 1 — unreachable by either tier window
    aha: 3,
    evaluate: (word) => word.features.hasDoubledLetter,
  },
  {
    id: 'same-start-end',
    name: 'Same Start/End Letter',
    descriptionTemplate: "The word's first and last letters are the same.",
    family: 'lexical-structural',
    subtlety: 2,
    aha: 4,
    evaluate: (word) => word.features.sameStartEnd,
  },
  ...CONTAINS_LETTER_TARGETS.map(containsLetterRule),
  {
    id: 'prime-length',
    name: 'Prime Length',
    descriptionTemplate: "The word's length is a prime number.",
    family: 'lexical-structural',
    subtlety: 3,
    // Arithmetic, not insight — a player grinds this out rather than
    // discovering it. Kept as rare filler rather than removed.
    aha: 1,
    evaluate: (word) => word.features.isPrimeLength,
  },
  {
    id: 'starts-with-vowel',
    name: 'Starts With a Vowel',
    descriptionTemplate: 'The word starts with a vowel.',
    family: 'lexical-structural',
    subtlety: 2, // was 1 — unreachable by either tier window
    aha: 2,
    evaluate: (word) => word.features.startsWithVowel,
  },
  {
    id: 'exactly-two-vowels',
    name: 'Exactly Two Vowels',
    descriptionTemplate: 'The word contains exactly two vowels.',
    family: 'lexical-structural',
    subtlety: 3,
    aha: 1, // counting exercise
    evaluate: (word) => word.features.vowelCount === 2,
  },
  {
    id: 'adjacent-vowels',
    name: 'Adjacent Vowels',
    descriptionTemplate: 'Two vowels sit next to each other somewhere in the word.',
    family: 'lexical-structural',
    subtlety: 3,
    aha: 2,
    // Inverted from the old `no-adjacent-vowels`, which matched 73% of the
    // bank. At that breadth the OUT side carried all the signal, and the rule
    // survived the clue stage on nearly every puzzle — permanently occupying
    // a decoy slot. Stated positively it matches ~27% and reads as a real
    // property rather than an absence.
    evaluate: (word) => !word.features.noAdjacentVowels,
  },
  {
    id: 'third-letter-vowel',
    name: 'Third Letter is a Vowel',
    descriptionTemplate: "The word's third letter is a vowel.",
    family: 'lexical-structural',
    subtlety: 2,
    aha: 1, // positional bookkeeping, no insight
    evaluate: (word) => word.length >= 3 && VOWELS.has(word.spelling[2]),
  },
  {
    id: 'subsequence-ace',
    name: 'Hides A-C-E in Order',
    descriptionTemplate: 'The letters A, C, E appear somewhere in the word, in that order.',
    family: 'lexical-structural',
    subtlety: 5,
    aha: 4,
    evaluate: (word) => word.features.subsequenceHits.includes('ace'),
  },
  {
    id: 'palindrome',
    name: 'Palindrome',
    descriptionTemplate: 'The word reads the same forwards and backwards.',
    family: 'lexical-structural',
    subtlety: 3,
    aha: 5,
    evaluate: (word) => word.features.isPalindrome,
  },
  {
    id: 'alphabetical-order-run',
    name: 'Letters in Alphabetical Order',
    descriptionTemplate: "The word's letters appear in alphabetical order, left to right.",
    family: 'lexical-structural',
    subtlety: 4,
    aha: 4,
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
    aha: 5,
    evaluate: (word) => word.tags.includes('lexical:has-anagram'),
  },
]
