import { getCollections } from './db'

// Cross-run rule cooldown. Before this, the only repetition guard was
// `usedRuleIdsByTier` — a function-local in generateBatchCore, discarded on
// return — so two generation runs shared no state at all, and scheduling
// (which assigns dates strict-FIFO by createdAt) never looked at ruleId
// either. A single nightly top-up could produce the same rule four times and
// schedule those four on four nearby dates.

/** A rule is off the table for this long after a puzzle using it was approved or scheduled. */
const RULE_COOLDOWN_DAYS = 60

export interface RecentRuleUsage {
  /** Rule ids used within the cooldown window — excluded from fresh generation. */
  ruleIds: Set<string>
  /** Template families used within the window, most-recent-first, for spacing out a *kind* of puzzle. */
  templateIds: Set<string>
}

/**
 * Rules already committed to within the cooldown window. Only counts puzzles
 * that actually made it past review (`approved`/`scheduled`/`live`) — a
 * rejected candidate never reached a player, so its rule shouldn't be burned.
 */
export async function resolveRecentRuleUsage(
  days: number = RULE_COOLDOWN_DAYS,
  now: Date = new Date()
): Promise<RecentRuleUsage> {
  const { puzzles } = await getCollections()
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const docs = await puzzles
    .find(
      { status: { $in: ['approved', 'scheduled', 'live'] }, createdAt: { $gte: cutoff } },
      { projection: { ruleId: 1, templateId: 1 } }
    )
    .toArray()

  return {
    ruleIds: new Set(docs.map((d) => d.ruleId)),
    templateIds: new Set(docs.map((d) => d.templateId).filter((t): t is string => Boolean(t))),
  }
}
