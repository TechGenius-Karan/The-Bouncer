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
}

export interface KnobValues {
  tier: 'medium' | 'spicy'
  clueCountIn: number
  clueCountOut: number
  poolSize: number
  trapGuestCount: number
  targetSurvivingDecoyRange: [number, number]
}

export interface AdminPuzzleDetail {
  puzzleId: string
  number: number
  difficultyTier: 'medium' | 'spicy'
  status: string
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
  status: string
  completedCount: number
  avgScore: number | null
  guestMissRates: AdminGuestMissRate[]
}
