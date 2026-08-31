import type { ObjectId } from 'mongodb'

// Mongo document shapes per planning.md §8.2. Field names/casing match the
// content-engine generator's CandidatePuzzle output (content-engine/generator/types.ts)
// so seeding is a near-direct copy, not a reshape.

export type Label = 'IN' | 'OUT'
export type PuzzleStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'live'

export interface WordDoc {
  _id: string // spelling
  spelling: string
  length: number
  frequencyScore: number
  partOfSpeech: string
  tags: string[]
  safety: { blocked: boolean; needsReview: boolean }
}

export interface RuleDoc {
  _id: string // rule id, e.g. "doubled-letter"
  name: string
  descriptionTemplate: string
  family: string
  subtlety: number
  /** Live override — replaces `subtlety` for generation-eligibility purposes only; the rule's code-defined evaluate() logic never changes. */
  subtletyOverride?: number
}

export interface PuzzleClueDoc {
  wordId: string
  label: Label
  displayOrder: number
}

export interface PuzzleGuestDoc {
  wordId: string
  trueLabel: Label
  displayOrder: number
  isTrap: boolean
  trapType: 'decoy' | 't-but-looks-wrong' | null
}

/** A rule the validator found still fit the clue set alone, but the pool broke — informational, not a defect (planning.md §7.2). */
export interface DecoyResult {
  ruleId: string
  subtlety: number
}

export interface KnobValues {
  tier: 'medium' | 'spicy'
  clueCountIn: number
  clueCountOut: number
  poolSize: number
  trapGuestCount: number
  targetSurvivingDecoyRange: [number, number]
  /** Was already stored on every PuzzleDoc (copied verbatim from content-engine's CandidatePuzzle) but missing from this duplicated type until now. */
  semanticRuleWeight: number
}

export interface PuzzleDoc {
  _id?: ObjectId
  /** Assigned only once the puzzle is actually scheduled (content-engine/scripts/schedulePuzzles.ts) — null before that, so a rejected/pending candidate never burns a number that would otherwise leave a gap in what's shown. */
  number: number | null
  difficultyTier: 'medium' | 'spicy'
  ruleId: string
  status: PuzzleStatus
  /** UTC calendar date ("YYYY-MM-DD") this puzzle is scheduled for, or null if not yet scheduled. */
  date: string | null
  clues: PuzzleClueDoc[]
  guests: PuzzleGuestDoc[]
  liveDecoys: DecoyResult[]
  knobValues: KnobValues
  /** Set only when status is 'rejected' — a reviewer's reason, kept for future generator tuning (planning.md §9.3). */
  rejectionReason?: string
  createdAt: Date
}

export interface ResultPlacementDoc {
  wordId: string
  attemptedLabel: Label
  correct: boolean
}

export interface ResultDoc {
  _id?: ObjectId
  puzzleId: string
  /** Copied from the puzzle's date at creation time — lets a resumed round be checked for staleness with no join. */
  date: string
  userId: string | null
  placements: ResultPlacementDoc[]
  livesRemaining: number
  roundComplete: boolean
  score: number
  createdAt: Date
  completedAt: Date | null
}

export type AiReviewActionType = 'swap-word' | 'rewrite-puzzle' | 'adjust-difficulty' | 'agree-reject'

/** ai-feedback-plan.md §7.1 — audit trail for every AI-assisted reject review, and the source material for §5's few-shot library growth. */
export interface AiReviewDoc {
  _id?: ObjectId
  puzzleId: string
  ruleId: string
  reviewerReason: string
  aiAction: AiReviewActionType
  aiRationale: string
  /** Full raw model response — debugging/audit only, never shown to the reviewer. */
  aiRawResponse: string
  /** Set for swap-word/rewrite-puzzle (the puzzle survives under the same _id); null for the other three actions. */
  resultingPuzzleId: string | null
  createdAt: Date
  /** Filled in later once a human acts on the re-surfaced puzzle — the feedback signal §5's few-shot growth reads from. */
  humanOutcome: 'approved' | 'rejected-again' | 'repaired-again' | null
}
