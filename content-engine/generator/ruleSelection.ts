import type { Rule } from '../rules/types'
import { pickRandom } from './random'

/**
 * Rules of a given family whose subtlety falls within [minSubtlety, maxSubtlety].
 */
export function eligibleRulesByFamily(
  rules: Rule[],
  family: Rule['family'],
  minSubtlety: number,
  maxSubtlety: number
): Rule[] {
  return rules.filter(
    (r) => r.family === family && r.subtlety >= minSubtlety && r.subtlety <= maxSubtlety
  )
}

/**
 * Picks a true rule for one generation attempt, applying knobs.semanticRuleWeight
 * (planning.md §7.1's ~70/30 lexical/semantic mix). `semanticRuleWeight` is the
 * probability of drafting from `eligibleSemantic` over `eligibleLexical` when both
 * are non-empty; falls back to whichever family is actually eligible if the roll
 * picks an empty one, and to `allRules` (ignoring subtlety entirely) only if
 * neither family has anything in range — the same last-resort behavior the plain
 * subtlety filter had before this knob existed.
 */
export function pickTrueRule(
  eligibleLexical: Rule[],
  eligibleSemantic: Rule[],
  semanticRuleWeight: number,
  allRules: Rule[]
): Rule {
  if (eligibleLexical.length === 0 && eligibleSemantic.length === 0) return pickRandom(allRules)
  const rollSemantic = eligibleSemantic.length > 0 && Math.random() < semanticRuleWeight
  if (rollSemantic) return pickRandom(eligibleSemantic)
  return eligibleLexical.length > 0 ? pickRandom(eligibleLexical) : pickRandom(eligibleSemantic)
}
