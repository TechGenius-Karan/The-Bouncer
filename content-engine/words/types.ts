export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other'

/**
 * Spelling-derived facts computed once per word (planning.md §7.5) so every
 * rule evaluator can read a precomputed field instead of re-scanning the
 * spelling itself.
 */
export interface LetterFeatures {
  firstLetter: string
  lastLetter: string
  sameStartEnd: boolean
  hasDoubledLetter: boolean
  vowelCount: number
  consonantCount: number
  vowelPositions: number[]
  /** e.g. "CVCCV" */
  vcPattern: string
  noAdjacentVowels: boolean
  startsWithVowel: boolean
  isPrimeLength: boolean
  firstBeforeLastAlpha: boolean
  /** Which HIDDEN_WORD_TARGETS appear as a substring of the spelling. */
  hiddenWordHits: string[]
  /** Which SUBSEQUENCE_TARGETS appear as an in-order (non-adjacent) subsequence. */
  subsequenceHits: string[]
  /** Sorted letters. Also doubles as the alphabetical-order-run check: spelling === anagramSignature. */
  anagramSignature: string
  isPalindrome: boolean
}

/**
 * Pronunciation facts, from the CMU Pronouncing Dictionary.
 *
 * Precomputed into a generated data file rather than looked up at evaluate()
 * time, and the reason is architectural: `RULES` is imported by the Netlify
 * functions, so a rule that reached into a 135,000-entry dictionary would drag
 * that dictionary into every function bundle. Same treatment LetterFeatures
 * already gets for spelling.
 *
 * Null for the ~2% of the bank CMUdict has no entry for. Every sound rule must
 * read that as "does not match" — never as an accidental match, or those words
 * become silent wrong answers in a puzzle.
 */
export interface Phonetics {
  /** Spoken syllables — the count of stressed vowels in the pronunciation. */
  syllables: number
  /** Last vowel phoneme onward ("AET" for cat), or null if the word has no vowel sound. */
  rhyme: string | null
  /** Letters minus phonemes: how much of the spelling goes unpronounced. */
  silent: number
  /** Another bank word is pronounced identically ("great"/"grate"). */
  homophone: boolean
}

export interface Word {
  id: string
  spelling: string
  length: number
  features: LetterFeatures
  /** Null when CMUdict has no pronunciation for this word (~2% of the bank). */
  phonetics: Phonetics | null
  frequencyScore: number
  partOfSpeech: PartOfSpeech
  /** Exists in WordNet only as a name ("margaret", "paris"). Usable in pools, avoided for clues. */
  properNoun: boolean
  tags: string[]
  safety: { blocked: boolean; needsReview: boolean }
}

export interface SeedWord {
  spelling: string
  frequencyScore: number
  partOfSpeech: PartOfSpeech
  /** Set by expandWordBank for corpus-sourced words; hand-curated seed words are never names. */
  properNoun?: boolean
  /** Human-reviewed semantic tags (build-plan.md Phase 10.5 §2, Step 4) — e.g. "category:animal". */
  tags?: string[]
}
