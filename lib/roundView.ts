import type { PoolItem } from './api.js'
import { getCollections } from './db.js'
import { resolveNames } from './names.js'
import type { PuzzleDoc, ResultDoc } from './types.js'

export async function buildPool(puzzle: PuzzleDoc, result: ResultDoc): Promise<PoolItem[]> {
  const nameOf = await resolveNames(
    puzzle,
    puzzle.guests.map((g) => g.wordId)
  )
  const placementsByWordId = new Map(result.placements.map((p) => [p.wordId, p]))

  return puzzle.guests.map((g) => {
    const item: PoolItem = { wordId: g.wordId, word: nameOf(g.wordId) }
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
  // A hand-edited puzzle carries its own reveal text, because its labels may
  // deliberately disagree with the generated rule (see PuzzleDoc.manualRuleText).
  if (puzzle.manualRuleText) return puzzle.manualRuleText
  const rule = await rules.findOne({ _id: puzzle.revealRuleId ?? puzzle.ruleId })
  return rule?.descriptionTemplate ?? null
}

export async function resolveClueWords(
  puzzle: PuzzleDoc
): Promise<{ in: string[]; out: string[] }> {
  const nameOf = await resolveNames(
    puzzle,
    puzzle.clues.map((c) => c.wordId)
  )
  return {
    in: puzzle.clues.filter((c) => c.label === 'IN').map((c) => nameOf(c.wordId)),
    out: puzzle.clues.filter((c) => c.label === 'OUT').map((c) => nameOf(c.wordId)),
  }
}
