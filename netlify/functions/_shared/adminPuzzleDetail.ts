import type { AdminPuzzleDetail } from './adminApi'
import { getCollections } from './db'
import type { PuzzleDoc } from './types'

/**
 * Resolves everything a reviewer needs and a player must never see: true
 * labels, trap flags, the rule in plain text, and which other rules the
 * validator found as live decoys — per planning.md §9.1's reviewer
 * checklist. Deliberately separate from roundView.ts's player-facing
 * resolvers, which are gated the opposite way on purpose.
 */
export async function resolveFullPuzzleDetail(puzzle: PuzzleDoc): Promise<AdminPuzzleDetail> {
  const { words, rules } = await getCollections()

  const wordIds = [...puzzle.clues.map((c) => c.wordId), ...puzzle.guests.map((g) => g.wordId)]
  const ruleIds = [puzzle.ruleId, ...puzzle.liveDecoys.map((d) => d.ruleId)]

  const [wordDocs, ruleDocs] = await Promise.all([
    words.find({ _id: { $in: wordIds } }).toArray(),
    rules.find({ _id: { $in: ruleIds } }).toArray(),
  ])

  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
  const ruleById = new Map(ruleDocs.map((r) => [r._id, r]))
  const rule = ruleById.get(puzzle.ruleId)

  return {
    puzzleId: puzzle._id!.toString(),
    number: puzzle.number,
    difficultyTier: puzzle.difficultyTier,
    status: puzzle.status,
    ruleId: puzzle.ruleId,
    ruleName: rule?.name ?? puzzle.ruleId,
    // An empty string here used to render as a silent blank box in the
    // review UI whenever the `rules` collection was missing an entry for
    // this ruleId (stale seed data — most commonly after adding a rule to
    // the taxonomy without re-running `npm run content:seed-db`). Naming
    // the actual problem here makes that misconfiguration obvious in the
    // UI instead of looking like a generic bug.
    ruleDescription: rule?.descriptionTemplate ?? `(No description found for rule "${puzzle.ruleId}" — run "npm run content:seed-db" to sync the rules collection.)`,
    clues: puzzle.clues.map((c) => ({
      wordId: c.wordId,
      word: spellingOf.get(c.wordId) ?? c.wordId,
      label: c.label,
    })),
    guests: puzzle.guests.map((g) => ({
      wordId: g.wordId,
      word: spellingOf.get(g.wordId) ?? g.wordId,
      trueLabel: g.trueLabel,
      isTrap: g.isTrap,
      trapType: g.trapType,
    })),
    liveDecoys: puzzle.liveDecoys.map((d) => ({
      ruleId: d.ruleId,
      ruleName: ruleById.get(d.ruleId)?.name ?? d.ruleId,
      subtlety: d.subtlety,
    })),
    knobValues: puzzle.knobValues,
    createdAt: puzzle.createdAt.toISOString(),
  }
}
