import type { Word } from '../words/types'

export type RuleFamily = 'lexical-structural' | 'semantic-knowledge'

export type Subtlety = 1 | 2 | 3 | 4 | 5

export interface Rule {
  id: string
  name: string
  /** Plain-text reveal shown to the player once a round ends (planning.md §3.5). */
  descriptionTemplate: string
  family: RuleFamily
  subtlety: Subtlety
  /** true = IN */
  evaluate: (word: Word) => boolean
}
