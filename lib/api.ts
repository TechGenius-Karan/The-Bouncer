import type { Label } from './types.js'

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
  /** The client already has this from get-round — sent so check-swipe can
   * look up the puzzle without an extra round-trip through `results` first.
   * Not trusted on its own: the update below filters on it too, so a
   * stale/wrong value just fails to match resultId's real document rather
   * than resolving against the wrong puzzle's answer key. */
  puzzleId: string
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
