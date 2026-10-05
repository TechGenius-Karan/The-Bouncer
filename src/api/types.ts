// Wire contract for the two player-facing endpoints — deliberately duplicated
// from netlify/functions/_shared/api.ts rather than imported. The frontend
// and the functions are separate deployable units with separate tsconfigs,
// so the API boundary is the right place to accept a little duplication
// instead of reaching across it.

export type ApiLabel = 'IN' | 'OUT'

export interface PoolItem {
  wordId: string
  word: string
  trueLabel?: ApiLabel
  attempted?: { label: ApiLabel; correct: boolean }
}

export interface GetRoundResponse {
  resultId: string
  puzzleId: string
  number: number
  date: string
  clues: { in: string[]; out: string[] }
  pool: PoolItem[]
  livesRemaining: number
  roundComplete: boolean
  ruleText: string | null
  /** Absent for word puzzles. Old clients ignore it and render `clues`, which hold item names (planning-visual-pivot.md §5.3). */
  kind?: 'visual'
  /** Visual only: item ids in the same order as `clues.in` / `clues.out`. */
  clueIds?: { in: string[]; out: string[] }
}

export interface CheckSwipeResponse {
  correct: boolean
  trueLabel: ApiLabel
  livesRemaining: number
  roundComplete: boolean
  ruleText: string | null
  poolReveal?: PoolItem[]
}

export interface GetCrackRateResponse {
  crackedPercent: number | null
  totalFinishers: number
}

export interface GetPuzzleMetaResponse {
  number: number
  date: string
}
