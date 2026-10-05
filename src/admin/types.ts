// Wire types for the admin-only endpoints — duplicated from
// netlify/functions/_shared/adminApi.ts rather than imported, matching the
// same cross-boundary convention already used by src/api/types.ts.

export type Label = 'IN' | 'OUT'

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
  /** Visual only: the decoy is this rule read the other way round, "NOT …". */
  negated?: true
}

export interface KnobValues {
  tier: 'medium' | 'spicy'
  clueCountIn: number
  clueCountOut: number
  poolSize: number
  trapGuestCount: number
  targetSurvivingDecoyRange: [number, number]
  semanticRuleWeight: number
}

export interface AdminPuzzleDetail {
  puzzleId: string
  /** Absent for word puzzles (planning-visual-pivot.md §3.3). */
  kind?: 'visual'
  /** Null for a still-pending/rejected/approved-but-unscheduled puzzle — only assigned once actually scheduled. */
  number: number | null
  difficultyTier: 'medium' | 'spicy'
  status: string
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

export interface AdminScheduledPuzzle extends AdminPuzzleDetail {
  date: string
  // Scheduled puzzles always have a real number — narrowed back from AdminPuzzleDetail's nullable one.
  number: number
}

export interface AdminListScheduledResponse {
  today: string
  puzzles: AdminScheduledPuzzle[]
}

export interface AdminListApprovedResponse {
  puzzles: AdminPuzzleDetail[]
}

export interface AdminBufferHealthResponse {
  /** What PUZZLE_KIND says generation and scheduling are on (planning-visual-pivot.md §3.3). */
  kind: 'word' | 'visual'
  mediumBufferDays: number
  spicyBufferWeeks: number
  /** Approved or scheduled-ahead visual puzzles. Word puzzles never count toward it (§5.4). */
  visualBufferDays: number
  /** Visual only: usable rules not used yet, i.e. days of puzzles left (§4.7). */
  runway?: number
  gapDates: string[]
}

export type AiReviewActionType =
  'swap-word' | 'rewrite-puzzle' | 'adjust-difficulty' | 'agree-reject'

export interface AdminAiReviewResponse {
  ok: true
  action: AiReviewActionType
  rationale: string
  changed: boolean
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
  status: string
  completedCount: number
  avgScore: number | null
  guestMissRates: AdminGuestMissRate[]
}

export interface AdminBatchPuzzleSummary {
  number: number
  difficultyTier: 'medium' | 'spicy'
  avgScore: number | null
  completedCount: number
  inTargetBand: boolean | null
}

export interface AdminBatchStatsResponse {
  from: number
  to: number
  pooledAvgScore: number | null
  pooledCompletedCount: number
  missingNumbers: number[]
  puzzles: AdminBatchPuzzleSummary[]
}

export interface AdminGenerateBatchResponse {
  ok: true
  requested: number
  generated: number
}

/** Manual puzzle edit — the no-AI path. Labels are taken as given: the human's judgement outranks the rule evaluator. */
export interface AdminEditPuzzleRequest {
  puzzleId: string
  clues: { word: string; label: Label }[]
  guests: { word: string; label: Label }[]
  /** Replaces the reveal text. Empty restores the generated rule's own description. */
  ruleText?: string
}

export interface AdminEditPuzzleResponse {
  ok: true
  puzzleId: string
}
