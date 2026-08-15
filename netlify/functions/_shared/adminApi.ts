import type { KnobValues, Label, PuzzleStatus } from './types'

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
  number: number
  difficultyTier: 'medium' | 'spicy'
  status: PuzzleStatus
  ruleId: string
  ruleName: string
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
}

export interface AdminListScheduledResponse {
  today: string
  puzzles: AdminScheduledPuzzle[]
}

export interface AdminUnscheduleRequest {
  puzzleId: string
}

export interface AdminRejectRequest {
  puzzleId: string
  reason: string
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

export interface ApiErrorResponse {
  error: string
}
