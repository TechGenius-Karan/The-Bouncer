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
