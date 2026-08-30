import type { Rule, Subtlety } from './types'

// ai-feedback-plan.md §7.2/§11 phase 1: live, no-deploy overrides on top of
// the static RULES array — a rule can be disabled or have its subtlety
// recalibrated by writing to the `rules` Mongo collection (see
// netlify/functions/_shared/ruleOverrides.ts for how those get fetched),
// with generation reading the merged result instead of RULES directly.

export interface RuleOverride {
  ruleId: string
  disabled?: boolean
  subtletyOverride?: number
}

/**
 * Merges live overrides onto the static rule set before a generation run.
 * A disabled rule is dropped entirely (never drafted). A subtletyOverride
 * replaces the rule's static subtlety for eligibility-window purposes only
 * — evaluate() and every other property are untouched.
 */
export function applyRuleOverrides(baseRules: Rule[], overrides: RuleOverride[]): Rule[] {
  const overrideById = new Map(overrides.map((o) => [o.ruleId, o]))
  return baseRules
    .filter((r) => !overrideById.get(r.id)?.disabled)
    .map((r) => {
      const override = overrideById.get(r.id)
      return override?.subtletyOverride !== undefined
        ? { ...r, subtlety: override.subtletyOverride as Subtlety }
        : r
    })
}
