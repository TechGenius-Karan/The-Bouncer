export type Label = 'in' | 'out'

export interface Puzzle {
  id: string
  number: number
  dateLabel: string
  ruleText: string
  clues: {
    in: string[]
    out: string[]
  }
  pool: Array<{ word: string; isIn: boolean }>
}

/** A guest's per-round outcome, once its one swipe attempt has resolved. */
export type CardResult = 'correct' | 'wrong' | 'missed' | null

export interface CardState {
  id: number
  word: string
  isIn: boolean
  /** Where the card currently renders: still in the pool, or settled into a bin. */
  place: 'pool' | 'in' | 'out'
  result: CardResult
}

export type Phase = 'play' | 'done'

export interface GameState {
  cards: CardState[]
  lives: number
  selected: number | null
  phase: Phase
}
