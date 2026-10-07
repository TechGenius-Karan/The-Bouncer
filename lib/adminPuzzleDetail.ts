import type { AdminPuzzleDetail } from './adminApi.js'
import { getCollections } from './db.js'
import { resolveNames } from './names.js'
import type { PuzzleDoc } from './types.js'

/**
 * Resolves everything a reviewer needs and a player must never see: true
 * labels, trap flags, the rule in plain text, and which other rules the
 * validator found as live decoys — per planning.md §9.1's reviewer
 * checklist. Deliberately separate from roundView.ts's player-facing
 * resolvers, which are gated the opposite way on purpose.
 */
export async function resolveFullPuzzleDetail(puzzle: PuzzleDoc): Promise<AdminPuzzleDetail> {
  const { rules } = await getCollections()

  const wordIds = [...puzzle.clues.map((c) => c.wordId), ...puzzle.guests.map((g) => g.wordId)]
  const ruleIds = [puzzle.ruleId, ...puzzle.liveDecoys.map((d) => d.ruleId)]
  if (puzzle.revealRuleId) ruleIds.push(puzzle.revealRuleId)

  const [nameOf, ruleDocs] = await Promise.all([
    resolveNames(puzzle, wordIds),
    rules.find({ _id: { $in: ruleIds } }).toArray(),
  ])

  const ruleById = new Map(ruleDocs.map((r) => [r._id, r]))
  // The reviewer must be shown the text the PLAYER will get, which is the
  // reveal rule where the validator accepted a collision and swapped it —
  // otherwise a reviewer approves one description and the game ships another.
  const rule = ruleById.get(puzzle.revealRuleId ?? puzzle.ruleId)
  const generatingRule = ruleById.get(puzzle.ruleId)

  return {
    puzzleId: puzzle._id!.toString(),
    ...(puzzle.kind === 'visual' ? { kind: 'visual' as const } : {}),
    number: puzzle.number,
    difficultyTier: puzzle.difficultyTier,
    status: puzzle.status,
    ruleId: puzzle.ruleId,
    ruleName: generatingRule?.name ?? puzzle.ruleId,
    ...(puzzle.revealRuleId ? { revealRuleName: rule?.name ?? puzzle.revealRuleId } : {}),
    // An empty string here used to render as a silent blank box in the
    // review UI whenever the `rules` collection was missing an entry for
    // this ruleId (stale seed data — most commonly after adding a rule to
    // the taxonomy without re-running `npm run content:seed-db`). Naming
    // the actual problem here makes that misconfiguration obvious in the
    // UI instead of looking like a generic bug.
    // A hand-edited puzzle shows its own reveal text, so the reviewer reads
    // exactly what the player will be told.
    ruleDescription:
      puzzle.manualRuleText ??
      rule?.descriptionTemplate ??
      `(No description found for rule "${puzzle.ruleId}" — run "npm run content:seed-db" to sync the rules collection.)`,
    clues: puzzle.clues.map((c) => ({
      wordId: c.wordId,
      word: nameOf(c.wordId),
      label: c.label,
    })),
    guests: puzzle.guests.map((g) => ({
      wordId: g.wordId,
      word: nameOf(g.wordId),
      trueLabel: g.trueLabel,
      isTrap: g.isTrap,
      trapType: g.trapType,
    })),
    liveDecoys: puzzle.liveDecoys.map((d) => ({
      ruleId: d.ruleId,
      ruleName: ruleById.get(d.ruleId)?.name ?? d.ruleId,
      subtlety: d.subtlety,
      ...(d.negated ? { negated: true as const } : {}),
    })),
    knobValues: puzzle.knobValues,
    createdAt: puzzle.createdAt.toISOString(),
  }
}
