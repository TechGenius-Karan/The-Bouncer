import type { AiReviewActionType, KnobValues, Label, PuzzleStatus } from './types'

// Wire contract for the admin-only endpoints. Kept separate from api.ts,
// which is explicitly scoped to "the two player-facing endpoints" — these
// types reveal everything a player must never see (true labels, traps),
// so mixing them into that file would blur a distinction that matters.

export interface AdminClueDetail {
  wordId: string
  word: string
  label: Label
}

export interface AdminGuestDetail {
  wordId: string
  word: string
  trueLabel: Label
  isTrap: boolean
  trapType: 'decoy' | 't-but-looks-wrong' | null
}

export interface AdminLiveDecoyDetail {
  ruleId: string
  ruleName: string
  subtlety: number
}

export interface AdminPuzzleDetail {
  puzzleId: string
  /** Null for a still-pending/rejected/approved-but-unscheduled puzzle — only assigned once actually scheduled. */
  number: number | null
  difficultyTier: 'medium' | 'spicy'
  status: PuzzleStatus
  ruleId: string
  ruleName: string
  /** Present only when the validator accepted a collision and the reveal names a different rule than the one that generated the puzzle. `ruleDescription` is already that rule's text. */
  revealRuleName?: string
  ruleDescription: string
  clues: AdminClueDetail[]
  guests: AdminGuestDetail[]
  liveDecoys: AdminLiveDecoyDetail[]
  knobValues: KnobValues
  createdAt: string
}

export interface AdminListPendingResponse {
  puzzles: AdminPuzzleDetail[]
}

export interface AdminApproveRequest {
  puzzleId: string
}

export interface AdminScheduledPuzzle extends AdminPuzzleDetail {
  date: string
  // Scheduled puzzles always have a real number — narrowed back from AdminPuzzleDetail's nullable one.
  number: number
}

export interface AdminListScheduledResponse {
  today: string
  puzzles: AdminScheduledPuzzle[]
}

export interface AdminUnscheduleRequest {
  puzzleId: string
}

export interface AdminListApprovedResponse {
  puzzles: AdminPuzzleDetail[]
}

export interface AdminSchedulePuzzleRequest {
  puzzleId: string
  date: string
}

export interface AdminUnapproveRequest {
  puzzleId: string
}

export interface AdminRejectRequest {
  puzzleId: string
  reason: string
}

/** ai-feedback-plan.md §7.5 — the reviewer's free-text reasoning goes to the AI, which decides and executes one bounded remediation. */
export interface AdminAiReviewRequest {
  puzzleId: string
  reason: string
}

export interface AdminAiReviewResponse {
  ok: true
  action: AiReviewActionType
  rationale: string
  /** True when the puzzle's words were actually changed. False means refinement couldn't be applied and the puzzle is unchanged — it stays in the queue either way. */
  changed: boolean
}

export interface AdminBufferHealthResponse {
  mediumBufferDays: number
  spicyBufferWeeks: number
  gapDates: string[]
}

export interface AdminGuestMissRate {
  wordId: string
  word: string
  trueLabel: Label
  isTrap: boolean
  trapType: 'decoy' | 't-but-looks-wrong' | null
  attempts: number
  misses: number
  missRate: number
}

export interface AdminPuzzleStatsResponse {
  puzzleId: string
  number: number
  difficultyTier: 'medium' | 'spicy'
  status: PuzzleStatus
  completedCount: number
  avgScore: number | null
  guestMissRates: AdminGuestMissRate[]
}

export interface AdminBatchPuzzleSummary {
  number: number
  difficultyTier: 'medium' | 'spicy'
  avgScore: number | null
  completedCount: number
  /** null until the puzzle has at least one completed attempt to judge. */
  inTargetBand: boolean | null
}

export interface AdminBatchStatsResponse {
  from: number
  to: number
  /** A true pooled per-attempt mean across every puzzle in range — not an average of each puzzle's own average. */
  pooledAvgScore: number | null
  pooledCompletedCount: number
  /** Requested numbers with no matching puzzle document at all. */
  missingNumbers: number[]
  puzzles: AdminBatchPuzzleSummary[]
}

export interface AdminGenerateBatchRequest {
  count: number
  tiers?: ('medium' | 'spicy')[]
}

export interface AdminGenerateBatchResponse {
  ok: true
  requested: number
  generated: number
}

export interface ApiErrorResponse {
  error: string
}
