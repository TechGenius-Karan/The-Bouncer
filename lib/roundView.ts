import type { PoolItem } from './api'
import { getCollections } from './db'
import type { PuzzleDoc, ResultDoc } from './types'

export async function buildPool(puzzle: PuzzleDoc, result: ResultDoc): Promise<PoolItem[]> {
  const { words } = await getCollections()
  const wordDocs = await words.find({ _id: { $in: puzzle.guests.map((g) => g.wordId) } }).toArray()
  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
  const placementsByWordId = new Map(result.placements.map((p) => [p.wordId, p]))

  return puzzle.guests.map((g) => {
    const item: PoolItem = { wordId: g.wordId, word: spellingOf.get(g.wordId) ?? g.wordId }
    if (result.roundComplete) item.trueLabel = g.trueLabel
    const placement = placementsByWordId.get(g.wordId)
    if (placement) item.attempted = { label: placement.attemptedLabel, correct: placement.correct }
    return item
  })
}

/**
 * The rule text shown at reveal (planning.md §3.5).
 *
 * Resolves through `revealRuleId` when the validator accepted a collision and
 * another rule describes the board better — see
 * content-engine/rules/ruleSimilarity.ts. Shared rather than inlined because
 * there are two reveal paths (check-swipe.ts when the round ends, get-round.ts
 * when a finished round is resumed) and they must never disagree about which
 * rule the player was told.
 */
export async function resolveRuleText(puzzle: PuzzleDoc): Promise<string | null> {
  const { rules } = await getCollections()
  const rule = await rules.findOne({ _id: puzzle.revealRuleId ?? puzzle.ruleId })
  return rule?.descriptionTemplate ?? null
}

export async function resolveClueWords(
  puzzle: PuzzleDoc
): Promise<{ in: string[]; out: string[] }> {
  const { words } = await getCollections()
  const wordDocs = await words.find({ _id: { $in: puzzle.clues.map((c) => c.wordId) } }).toArray()
  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))

  return {
    in: puzzle.clues
      .filter((c) => c.label === 'IN')
      .map((c) => spellingOf.get(c.wordId) ?? c.wordId),
    out: puzzle.clues
      .filter((c) => c.label === 'OUT')
      .map((c) => spellingOf.get(c.wordId) ?? c.wordId),
  }
}
