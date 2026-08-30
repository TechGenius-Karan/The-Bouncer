import type { RuleOverride } from '../../../content-engine/rules/ruleOverrides'
import { getCollections } from './db'

// ai-feedback-plan.md §7.2/§11 phase 1: fetches the live rule overrides
// (disabled / subtletyOverride) that a generation run should merge onto the
// static RULES array via content-engine/rules/ruleOverrides.ts's
// applyRuleOverrides — kept as Mongo-touching glue here rather than inside
// content-engine, which has no DB access by design.
export async function resolveRuleOverrides(): Promise<RuleOverride[]> {
  const { rules } = await getCollections()
  const docs = await rules
    .find({ $or: [{ disabled: true }, { subtletyOverride: { $exists: true } }] })
    .toArray()
  return docs.map((doc) => ({
    ruleId: doc._id,
    disabled: doc.disabled,
    subtletyOverride: doc.subtletyOverride,
  }))
}
