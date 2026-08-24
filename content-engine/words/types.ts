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
  /** Sorted letters — unused by the current rule set, kept for future anagram-adjacent rules. */
  anagramSignature: string
}

export interface Word {
  id: string
  spelling: string
  length: number
  features: LetterFeatures
  frequencyScore: number
  partOfSpeech: PartOfSpeech
  tags: string[]
  safety: { blocked: boolean; needsReview: boolean }
}

export interface SeedWord {
  spelling: string
  frequencyScore: number
  partOfSpeech: PartOfSpeech
  /** Human-reviewed semantic tags (build-plan.md Phase 10.5 §2, Step 4) — e.g. "category:animal". */
  tags?: string[]
}
