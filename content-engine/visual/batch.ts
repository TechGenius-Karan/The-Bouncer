import { eligibleRules, generateVisualCandidate, type GeneratorInput } from './generator.js'
import { ITEMS } from './items.js'
import { batchSeed } from './random.js'
import { VISUAL_RULES } from './rules.js'
import { MATRIX } from './tags/index.js'
import type { VisualCandidate } from './types.js'

// The one way visual puzzles get generated and stored. The cron, the admin
// "Generate batch" endpoints and queuePuzzles.ts all call generateVisualDocs,
// so none of them builds a puzzle document field by field — which is how a
// new field like `kind` would otherwise get silently dropped by one of them
// (planning-visual-pivot.md §2.7).

/** Up to `count` candidates, each for a different rule. Seeds come from the date plus an index (§4.6). */
export function generateVisualBatch(
  count: number,
  input: GeneratorInput,
  date: string
): VisualCandidate[] {
  const pending = new Set(input.pendingRuleIds)
  const batch: VisualCandidate[] = []
  for (let index = 0; batch.length < count && index < count * 3; index++) {
    const candidate = generateVisualCandidate(
      { ...input, pendingRuleIds: pending },
      batchSeed(date, index)
    )
    if (!candidate) continue
    pending.add(candidate.ruleId)
    batch.push(candidate)
  }
  return batch
}

/** A visual candidate as a `puzzles` document. Assignable to PuzzleDoc in both backends. */
export function toVisualPuzzleDoc(candidate: VisualCandidate, createdAt: Date) {
  return {
    // Left null: only assigned once actually scheduled, see schedulePuzzles.ts.
    number: null,
    kind: candidate.kind,
    generatorSeed: candidate.generatorSeed,
    difficultyTier: candidate.difficultyTier,
    ruleId: candidate.ruleId,
    status: candidate.status,
    date: null,
    clues: candidate.clues,
    guests: candidate.guests,
    liveDecoys: candidate.liveDecoys,
    knobValues: candidate.knobValues,
    createdAt,
  }
}

/** Generates from the committed item bank, rules and matrix, ready to insert. */
export function generateVisualDocs(
  count: number,
  state: Pick<GeneratorInput, 'usedRuleIds' | 'pendingRuleIds' | 'rejectCounts'>,
  date: string,
  createdAt: Date = new Date()
) {
  const input = { items: ITEMS, rules: VISUAL_RULES, matrix: MATRIX, ...state }
  return generateVisualBatch(count, input, date).map((c) => toVisualPuzzleDoc(c, createdAt))
}

/** §4.7: usable rules not used yet, i.e. days of puzzles left. Pending rules still count: they have not run. */
export function visualRunway(usedRuleIds: Set<string>): number {
  const input = { items: ITEMS, rules: VISUAL_RULES, matrix: MATRIX, usedRuleIds }
  return eligibleRules({ ...input, pendingRuleIds: new Set(), rejectCounts: new Map() }).length
}
