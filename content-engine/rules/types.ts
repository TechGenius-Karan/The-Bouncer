import type { Word } from '../words/types'

export type RuleFamily = 'lexical-structural' | 'semantic-knowledge'

export type Subtlety = 1 | 2 | 3 | 4 | 5

export interface Rule {
  id: string
  name: string
  /** Plain-text reveal shown to the player once a round ends (planning.md §3.5). */
  descriptionTemplate: string
  family: RuleFamily
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
