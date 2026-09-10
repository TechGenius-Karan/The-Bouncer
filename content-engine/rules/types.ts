import type { Word } from '../words/types.js'

export type RuleFamily = 'lexical-structural' | 'semantic-knowledge'

export type Subtlety = 1 | 2 | 3 | 4 | 5

/**
 * What the player would say the trick was — coarser than `templateId`, and the
 * axis variety is actually judged on.
 *
 * `templateId` groups rules by how they are implemented, which turned out to be
 * the wrong unit. `hidden-word` and `hidden-group` are two templates and one
 * trick: hunt for a smaller word inside the word. Spacing and weighting by
 * template let both run in the same week and the player saw the same puzzle
 * twice. Measured before this existed, 86% of spicy lexical puzzles were either
 * a rhyme or a hidden word.
 *
 * Required, not optional: a rule that declared no mechanic would form its own
 * bucket of one and win draws out of all proportion (see MECHANIC_WEIGHTS).
 */
export type Mechanic =
  /** Hunt for a smaller word inside the word. */
  | 'word-inside'
  /** Say it out loud — rhyme, syllables, sounds versus letters. */
  | 'sound'
  /** Look at the letters — position, count, repetition. */
  | 'letter-pattern'
  /** Change the word and see what you get — reverse, behead, rearrange. */
  | 'word-surgery'
  /** Know what it means. */
  | 'meaning'

export interface Rule {
  id: string
  name: string
  /** Plain-text reveal shown to the player once a round ends (planning.md §3.5). */
  descriptionTemplate: string
  family: RuleFamily
  mechanic: Mechanic
  /**
   * Which template produced this rule ("hidden-word", "starts-with"), for
   * rules built from a parameter list. Lets scheduling space out a whole
   * family, not just an individual rule — three "hides an animal" puzzles in
   * a week feel repetitive even though the rule ids differ.
   */
  templateId?: string
  /** How hard the rule is to *spot*. Drives which difficulty tier may draw it. */
  subtlety: Subtlety
  /**
   * How satisfying the rule is to *get* — the second axis, independent of
   * subtlety. "Hides a body part" is a real insight; "length is a prime
   * number" is arithmetic a player grinds out rather than discovers. Used as
   * a selection weight so low-aha rules become rare filler instead of regular
   * content. Defaults to 3 (neutral) when a rule doesn't specify one.
   */
  aha?: Subtlety
  /** true = IN */
  evaluate: (word: Word) => boolean
  /**
   * Why this word matched — e.g. `hidden-number` returns which number is
   * hidden ('ten', 'one'). Only meaningful for words the rule marks IN.
   *
   * Rules that match for a single uniform reason (palindrome, doubled-letter)
   * leave this undefined. Where it IS defined, the generator requires a clue
   * set to span more than one variant, which is what stops every clue in a
   * "hidden number" puzzle from hiding the same number — and it's what lets
   * the AI-review prompt say *why* each menu word matches so it can act on
   * variety feedback.
   */
  variantOf?: (word: Word) => string | null
}
