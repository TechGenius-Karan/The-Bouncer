import type { Filter, ObjectId } from 'mongodb'
import type { GetRoundResponse } from './api'
import type { PuzzleDoc, PuzzleStatus } from './types'

// Server-side rules for visual puzzles (planning-visual-pivot.md). Nothing
// here touches the database, so all of it is unit-tested; handlers run the
// queries.

export type PuzzleKind = 'word' | 'visual'

/** `PUZZLE_KIND` (§3.3). Unset means word, so deploying changes nothing. Same reading as content-engine/scheduling/placement.ts. */
export function puzzleKindFrom(value: string | undefined): PuzzleKind {
  return value === 'visual' ? 'visual' : 'word'
}

/**
 * §3.5: a visual rule is spent while any visual puzzle using it is in one of
 * these. Rejecting frees it, and unscheduling returns a puzzle to pending.
 */
export const RULE_HOLDING_STATUSES: PuzzleStatus[] = ['approved', 'scheduled', 'live']

/** Every visual puzzle that holds a rule or is queued for review with one. */
export const VISUAL_RULE_USAGE_FILTER: Filter<PuzzleDoc> = {
  kind: 'visual',
  status: { $in: [...RULE_HOLDING_STATUSES, 'pending_approval'] },
}

/** Splits VISUAL_RULE_USAGE_FILTER's results into the generator's two exclusion sets. */
export function splitVisualRuleUsage(docs: Pick<PuzzleDoc, 'ruleId' | 'status'>[]): {
  usedRuleIds: Set<string>
  pendingRuleIds: Set<string>
} {
  const usedRuleIds = new Set<string>()
  const pendingRuleIds = new Set<string>()
  for (const doc of docs) {
    if (RULE_HOLDING_STATUSES.includes(doc.status)) usedRuleIds.add(doc.ruleId)
    else if (doc.status === 'pending_approval') pendingRuleIds.add(doc.ruleId)
  }
  return { usedRuleIds, pendingRuleIds }
}

/** Another visual puzzle already holding this rule. Approval refuses while one exists. */
export function ruleHolderFilter(ruleId: string, exceptId: ObjectId): Filter<PuzzleDoc> {
  return { kind: 'visual', ruleId, status: { $in: RULE_HOLDING_STATUSES }, _id: { $ne: exceptId } }
}

/** get-round's additive fields (§5.3). None for a word puzzle, so word rounds are unchanged. */
export function visualRoundFields(
  puzzle: Pick<PuzzleDoc, 'kind' | 'clues'>
): Pick<GetRoundResponse, 'kind' | 'clueIds'> {
  if (puzzle.kind !== 'visual') return {}
  const idsOf = (label: 'IN' | 'OUT') =>
    puzzle.clues.filter((c) => c.label === label).map((c) => c.wordId)
  return { kind: 'visual', clueIds: { in: idsOf('IN'), out: idsOf('OUT') } }
}
