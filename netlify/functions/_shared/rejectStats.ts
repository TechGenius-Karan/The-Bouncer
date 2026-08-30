import { getCollections } from './db'

// Phase 10.6 item 2 (build-plan.md): a reviewer's reject reason used to be
// stored and forgotten (PuzzleDoc.rejectionReason, admin-reject.ts). The
// decision was a taxonomy-level signal instead of per-puzzle repair — a
// rule that keeps getting rejected should be drawn less often, and
// eventually flagged for a human to look at the template itself.
//
// Derived by aggregating the existing `puzzles` collection directly rather
// than a new collection or counter field — every rejected PuzzleDoc already
// carries both `ruleId` and `createdAt`, so there's nothing to add.

const LOOKBACK_DAYS = 30
export const REJECT_FLAG_THRESHOLD = 3

/** Recent (last LOOKBACK_DAYS) reject count per rule id — feeds generator soft-avoidance. */
export async function resolveRejectCounts(now: Date = new Date()): Promise<Map<string, number>> {
  const { puzzles } = await getCollections()
  const cutoff = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const rows = await puzzles
    .aggregate<{ _id: string; count: number }>([
      { $match: { status: 'rejected', createdAt: { $gte: cutoff } } },
      { $group: { _id: '$ruleId', count: { $sum: 1 } } },
    ])
    .toArray()
  return new Map(rows.map((r) => [r._id, r.count]))
}

export interface RuleRejectStat {
  ruleId: string
  ruleName: string
  rejectCount: number
  /** rejectCount has crossed REJECT_FLAG_THRESHOLD — surfaced for a human to review the template itself. */
  flagged: boolean
}

/** Same counts as resolveRejectCounts, joined with rule names and threshold-flagged, for the admin dashboard. */
export async function resolveRuleRejectStats(now: Date = new Date()): Promise<RuleRejectStat[]> {
  const [counts, { rules }] = await Promise.all([resolveRejectCounts(now), getCollections()])
  const ruleDocs = await rules.find({ _id: { $in: [...counts.keys()] } }).toArray()
  const nameById = new Map(ruleDocs.map((r) => [r._id, r.name]))

  return [...counts.entries()]
    .map(([ruleId, rejectCount]) => ({
      ruleId,
      ruleName: nameById.get(ruleId) ?? ruleId,
      rejectCount,
      flagged: rejectCount >= REJECT_FLAG_THRESHOLD,
    }))
    .sort((a, b) => b.rejectCount - a.rejectCount)
}
