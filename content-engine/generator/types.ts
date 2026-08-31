import type { Subtlety } from '../rules/types'

// Field names follow planning.md §8.2's Mongo schema (label/trueLabel/
// displayOrder/isTrap, uppercase IN/OUT) so Phase 4 can load this JSON
// straight into the database without reshaping it.
export type Label = 'IN' | 'OUT'
export type DifficultyTier = 'medium' | 'spicy'
export type TrapType = 'decoy' | 't-but-looks-wrong' | null

export interface ClueEntry {
  wordId: string
  label: Label
  displayOrder: number
}

export interface GuestEntry {
  wordId: string
  trueLabel: Label
  displayOrder: number
  isTrap: boolean
  trapType: TrapType
}

export interface KnobValues {
  tier: DifficultyTier
  clueCountIn: number
  clueCountOut: number
  poolSize: number
  trapGuestCount: number
  /** How many other rules should still fit after only the clues are shown (§7.4). */
  targetSurvivingDecoyRange: [number, number]
  /** Probability of drafting a semantic-family true rule over a lexical one, when both are eligible (§7.1's ~70/30 mix). */
  semanticRuleWeight: number
}

export interface DecoyResult {
  ruleId: string
  subtlety: Subtlety
}

export interface CandidatePuzzle {
  ruleId: string
  /** The rule's template family ("hidden-word", "ends-with"), when it came from one — lets scheduling space out a kind of puzzle, not just a specific rule. */
  templateId?: string
  difficultyTier: DifficultyTier
  knobValues: KnobValues
  status: 'pending_approval'
  clues: ClueEntry[]
  guests: GuestEntry[]
  /** Decoys that survived the clue stage but were broken by the pool — informational, not a defect. */
  liveDecoys: DecoyResult[]
}

export type ValidationResult =
  | { status: 'valid'; candidate: CandidatePuzzle }
  | {
      status: 'reject'
      reason: 'unrepairable-collision' | 'max-repair-attempts-exceeded'
      collidingRuleIds?: string[]
    }
