import type { ObjectId } from 'mongodb'

// Mongo document shapes per planning.md §8.2. Field names/casing match the
// content-engine generator's CandidatePuzzle output (content-engine/generator/types.ts)
// so seeding is a near-direct copy, not a reshape.

export type Label = 'IN' | 'OUT'
export type PuzzleStatus = 'pending_approval' | 'approved' | 'scheduled' | 'live'

export interface WordDoc {
  _id: string // spelling
  spelling: string
  length: number
  frequencyScore: number
  partOfSpeech: string
  tags: string[]
  safety: { blocked: boolean; needsReview: boolean }
}

export interface RuleDoc {
  _id: string // rule id, e.g. "doubled-letter"
  name: string
  descriptionTemplate: string
  family: string
  subtlety: number
}

export interface PuzzleClueDoc {
  wordId: string
  label: Label
  displayOrder: number
}

export interface PuzzleGuestDoc {
  wordId: string
  trueLabel: Label
  displayOrder: number
  isTrap: boolean
  trapType: 'decoy' | 't-but-looks-wrong' | null
}

export interface PuzzleDoc {
  _id?: ObjectId
  number: number
  difficultyTier: 'medium' | 'spicy'
  ruleId: string
  status: PuzzleStatus
  clues: PuzzleClueDoc[]
  guests: PuzzleGuestDoc[]
  createdAt: Date
}

export interface ResultPlacementDoc {
  wordId: string
  attemptedLabel: Label
  correct: boolean
}

export interface ResultDoc {
  _id?: ObjectId
  puzzleId: string
  userId: string | null
  placements: ResultPlacementDoc[]
  livesRemaining: number
  roundComplete: boolean
  score: number
  createdAt: Date
  completedAt: Date | null
}
