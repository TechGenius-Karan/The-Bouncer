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
