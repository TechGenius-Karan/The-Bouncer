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
  disabled: boolean
  subtletyOverride: number | null
  baseSubtlety: number
}

/**
 * Lists every rule in the taxonomy (ai-feedback-plan.md §11 phase 1 widened
 * this from "only rules with a recent reject" — a reviewer needs to be able
 * to retire/recalibrate any rule directly, not just ones that already hit
 * the reject threshold), joined with reject counts and current override
 * state, for the admin dashboard.
 */
export async function resolveRuleRejectStats(now: Date = new Date()): Promise<RuleRejectStat[]> {
  const [counts, { rules }] = await Promise.all([resolveRejectCounts(now), getCollections()])
  const ruleDocs = await rules.find({}).toArray()

  return ruleDocs
    .map((doc) => {
      const rejectCount = counts.get(doc._id) ?? 0
      return {
        ruleId: doc._id,
        ruleName: doc.name,
        rejectCount,
        flagged: rejectCount >= REJECT_FLAG_THRESHOLD,
        disabled: doc.disabled ?? false,
        subtletyOverride: doc.subtletyOverride ?? null,
        baseSubtlety: doc.subtlety,
      }
    })
    .sort((a, b) => b.rejectCount - a.rejectCount || a.ruleId.localeCompare(b.ruleId))
}
