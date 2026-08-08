export type Label = 'in' | 'out'

/** A guest's per-round outcome, once its one swipe attempt has resolved (or it was never reached). */
export type CardResult = 'correct' | 'wrong' | 'missed' | null

export interface CardState {
  /** The word's stable id (its spelling), used as the identifier in API calls. */
  id: string
  word: string
  /** Where the card currently renders: still in the pool, or settled into a bin. */
  place: 'pool' | 'in' | 'out'
  result: CardResult
  /** Unknown (null) until this card resolves or the round ends — the server never reveals it early. */
  trueLabel: Label | null
}

export type Phase = 'loading' | 'play' | 'done' | 'error'

export interface GameState {
  phase: Phase
  error: string | null
  resultId: string | null
  puzzleNumber: number
  /** Only known once the round is complete. */
  ruleText: string | null
  clues: { in: string[]; out: string[] }
  cards: CardState[]
  lives: number
  selected: string | null
  /** Guest ids with a swipe currently in flight to the server. */
  pendingIds: string[]
}

export interface RoundResult {
  puzzleNumber: number
  ruleText: string
  cards: CardState[]
  score: number
}
