export type Label = 'IN' | 'OUT'

export interface Clue {
  id: string
  word: string
  label: Label
}

export interface Guest {
  id: string
  word: string
  trueLabel: Label
}

export interface Puzzle {
  id: string
  ruleText: string        // shown only at reveal
  clues: Clue[]          // pre-sorted evidence, 3 IN + 3 OUT
  guests: Guest[]        // pool to sort, all visible at once
}

// Per-guest result after the player has swiped
export type GuestOutcome =
  | 'correct'            // swiped right on first attempt
  | 'wrong-corrected'    // swiped wrong, auto-corrected into correct bin
  | 'not-reached'        // round ended early via lives-out before player got here

export interface GuestResult {
  guestId: string
  outcome: GuestOutcome
  trueLabel: Label
}

export type GamePhase = 'evidence' | 'sorting' | 'reveal'

export interface GameState {
  phase: GamePhase
  livesRemaining: number
  // guestId -> outcome (only present for resolved guests)
  results: Record<string, GuestResult>
}
