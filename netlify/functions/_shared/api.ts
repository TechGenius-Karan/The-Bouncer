import type { Label } from './types'

// Wire contract for the two player-facing endpoints. Deliberately duplicated
// (not imported) in src/api/types.ts — the frontend and the functions are
// separate deployable units with separate tsconfigs, so the API boundary is
// the right place to accept a little duplication rather than reach across it.

export interface PoolItem {
  wordId: string
  word: string
  /** Only present once the round is complete — never sent for an unresolved guest mid-round. */
  trueLabel?: Label
  /** Only present if this particular guest was actually swiped. */
  attempted?: { label: Label; correct: boolean }
}

export interface GetRoundResponse {
  resultId: string
  puzzleId: string
  number: number
  /** The puzzle's UTC calendar date ("YYYY-MM-DD") — lets the client record local play history per day. */
  date: string
  clues: { in: string[]; out: string[] }
  pool: PoolItem[]
  livesRemaining: number
  roundComplete: boolean
  /** Only populated once roundComplete is true — never sent early. */
  ruleText: string | null
}

export interface CheckSwipeRequest {
  resultId: string
  wordId: string
  attemptedLabel: Label
}

export interface CheckSwipeResponse {
  correct: boolean
  trueLabel: Label
  livesRemaining: number
  roundComplete: boolean
  ruleText: string | null
  /**
   * Present only when this swipe just ended the round. Planning.md §3.5
   * requires showing every guest's true label on reveal, including ones
   * never reached — this is where the not-reached guests' labels finally
   * get sent, since up to this point they were never revealed to the client.
   */
  poolReveal?: PoolItem[]
}

export interface GetCrackRateResponse {
  /** null when totalFinishers is 0 — distinguishes "no data yet" from a genuine 0%. */
  crackedPercent: number | null
  totalFinishers: number
}

export interface GetPuzzleMetaResponse {
  number: number
  /** The puzzle's UTC calendar date ("YYYY-MM-DD"). */
  date: string
}

export interface ApiErrorResponse {
  error: string
}
