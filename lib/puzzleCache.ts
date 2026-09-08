import { ObjectId } from 'mongodb'
import { getCollections } from './db'
import type { PuzzleDoc } from './types'

// A puzzle document never changes after content-engine writes it (before
// scheduling) — safe to hold in memory for the life of a warm function
// container, keyed by id, rather than paying a Mongo round-trip for the same
// immutable document on every single swipe of every player on that puzzle.
// Same idea as db.ts's cachedClient, one level up the stack.
const cache = new Map<string, PuzzleDoc>()

export async function getPuzzleCached(puzzleId: string): Promise<PuzzleDoc | null> {
  const cached = cache.get(puzzleId)
  if (cached) return cached
  if (!ObjectId.isValid(puzzleId)) return null
  const { puzzles } = await getCollections()
  const puzzle = await puzzles.findOne({ _id: new ObjectId(puzzleId) })
  if (puzzle) cache.set(puzzleId, puzzle)
  return puzzle
}
