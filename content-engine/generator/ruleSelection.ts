import type { Rule } from '../rules/types'

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
