import type { DifficultyTier, KnobValues } from './types'

// Defaults straight from planning.md §7.4's knob table.
// planning.md §7.1's suggested launch mix: skew toward lexical/structural
// since it's cheaper to generate/validate with high confidence, expanding
// semantic coverage over time as the tagged word bank matures. Medium's
// weight is set higher than spicy's because medium's [2,3] subtlety window
// already has full semantic coverage (all 7 semantic rules are rated 2-3),
// while spicy only picks up the 3 rated exactly 3 (category-bird,
// category-tool, category-body-part) via subtletyRangeFor's [3,5] window —
// it'll pick up the rest automatically once any semantic rule is rated 4+.
const MEDIUM_SEMANTIC_WEIGHT = 0.5
const SPICY_SEMANTIC_WEIGHT = 0.3

export const MEDIUM_KNOBS: KnobValues = {
  tier: 'medium',
  clueCountIn: 3,
  clueCountOut: 3,
  poolSize: 6,
  trapGuestCount: 2,
  targetSurvivingDecoyRange: [2, 3],
  semanticRuleWeight: MEDIUM_SEMANTIC_WEIGHT,
}

export const SPICY_KNOBS: KnobValues = {
  tier: 'spicy',
  clueCountIn: 3,
  clueCountOut: 3,
  poolSize: 6,
  trapGuestCount: 3,
  targetSurvivingDecoyRange: [4, Infinity],
  semanticRuleWeight: SPICY_SEMANTIC_WEIGHT,
}

export function resolveKnobs(
  tier: DifficultyTier,
  overrides: Partial<KnobValues> = {}
): KnobValues {
  const base = tier === 'medium' ? MEDIUM_KNOBS : SPICY_KNOBS
  return { ...base, ...overrides }
}

/**
 * Medium subtlety 2-3 (planning.md §7.4). Spicy widened from the spec's
 * literal 4-5 down to 3-5: with all 7 semantic rules rated 2-3 today, a
 * strict [4,5] floor meant spicy could never draw a semantic rule at all,
 * permanently nulling semanticRuleWeight to 0 for half of every mixed-tier
 * batch. Including subtlety-3 lets spicy pick up the 3 semantic rules
 * already rated that high (category-bird/tool/body-part) without
 * fabricating new ratings — see the approved plan doc.
 */
export function subtletyRangeFor(tier: DifficultyTier): [number, number] {
  return tier === 'medium' ? [2, 3] : [3, 5]
}

/**
 * How the total trap budget (knobs.trapGuestCount) splits between the two
 * trap types, prioritizing decoy-traps first — planning.md §7.2 calls a
 * decoy-trap "the single most valuable kind of trick word." See the
 * approved plan's judgment call reconciling §7.2's narrative default with
 * §7.4's tunable total.
 */
export function trapAllocation(knobs: KnobValues): { decoyTraps: number; tButLooksWrong: number } {
  const budget = knobs.trapGuestCount
  if (budget <= 1) return { decoyTraps: budget, tButLooksWrong: 0 }
  if (budget === 2) return { decoyTraps: 1, tButLooksWrong: 1 }
  return { decoyTraps: budget - 1, tButLooksWrong: 1 }
}
