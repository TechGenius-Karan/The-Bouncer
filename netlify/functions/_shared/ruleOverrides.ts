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

export interface RuleOverrideChanges {
  disabled?: boolean
  /** A number sets an override; null clears it, reverting to the rule's code-defined subtlety. */
  subtletyOverride?: number | null
}

/**
 * Writes disabled/subtletyOverride onto a rule doc (ai-feedback-plan.md §7.6).
 * Shared by the manual admin-rule-override.ts endpoint and the AI-driven
 * admin-ai-review.ts retire-rule/adjust-difficulty branches so the Mongo
 * write lives in exactly one place. Returns false if no rule matched the id.
 */
export async function writeRuleOverride(ruleId: string, changes: RuleOverrideChanges): Promise<boolean> {
  const set: Record<string, unknown> = {}
  const unset: Record<string, ''> = {}
  if (changes.disabled !== undefined) set.disabled = changes.disabled
  if (changes.subtletyOverride !== undefined) {
    if (changes.subtletyOverride === null) unset.subtletyOverride = ''
    else set.subtletyOverride = changes.subtletyOverride
  }
  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) return true // nothing to change — no-op

  const update: Record<string, unknown> = {}
  if (Object.keys(set).length > 0) update.$set = set
  if (Object.keys(unset).length > 0) update.$unset = unset

  const { rules } = await getCollections()
  const result = await rules.updateOne({ _id: ruleId }, update)
  return result.matchedCount > 0
}
