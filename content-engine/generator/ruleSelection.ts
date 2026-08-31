import type { Rule } from '../rules/types'
import { pickWeighted } from './random'

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
 * Picks which family to draft a true rule from for one generation attempt,
 * applying knobs.semanticRuleWeight (planning.md §7.1's lexical/semantic
 * mix). `semanticRuleWeight` is the probability of choosing
 * 'semantic-knowledge' over 'lexical-structural' when both are non-empty;
 * falls back to whichever family is actually eligible if the roll picks an
 * empty one, and returns null (caller falls back to the full rule set,
 * ignoring subtlety entirely) only if neither family has anything in range.
 *
 * Deliberately returns just the *family*, not a specific rule — the caller
 * (orchestrator.ts) commits to this family across several rule-attempts
 * rather than re-rolling on every failure, so one scarce-pool rule failing
 * doesn't silently hand the whole attempt to the other family.
 */
export function pickFamily(
  eligibleLexical: Rule[],
  eligibleSemantic: Rule[],
  semanticRuleWeight: number
): Rule['family'] | null {
  if (eligibleLexical.length === 0 && eligibleSemantic.length === 0) return null
  const rollSemantic = eligibleSemantic.length > 0 && Math.random() < semanticRuleWeight
  if (rollSemantic) return 'semantic-knowledge'
  return eligibleLexical.length > 0 ? 'lexical-structural' : 'semantic-knowledge'
}

/**
 * Picks a specific rule from an already-family-selected pool, weighting by
 * two independent signals:
 *
 * - **aha** (how satisfying the rule is to get) — a rule rated 1 is drawn
 *   ~5x less often than one rated 5, so arithmetic rules like prime-length
 *   become occasional filler rather than regular content. Defaults to 3.
 * - **recent reviewer rejections** — build-plan.md Phase 10.6 item 2's
 *   "next-batch soft-avoidance". Each rejection roughly halves the share
 *   (1/(1+count)) rather than zeroing it, so a heavily-rejected rule can
 *   still be drawn if the batch has nothing else fresh to offer.
 *
 * Both are soft: no rule is ever excluded outright here.
 */
export function pickTrueRule(pool: Rule[], rejectCounts: Map<string, number> = new Map()): Rule {
  return pickWeighted(pool, (r) => (r.aha ?? 3) / (1 + (rejectCounts.get(r.id) ?? 0)))
}
