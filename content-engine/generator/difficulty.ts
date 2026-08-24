import type { DifficultyTier, KnobValues } from './types'

// Defaults straight from planning.md §7.4's knob table.
// planning.md §7.1's suggested launch mix: skew toward lexical/structural
// (~70%) since it's cheaper to generate/validate with high confidence,
// expanding semantic coverage over time as the tagged word bank matures.
// Applied at both tiers today — spicy's [4,5] subtlety window happens to
// have zero eligible semantic rules right now (all rated 2-3, see
// semanticRules.ts), so this knob is currently a no-op for spicy and only
// takes effect for medium; it's still set here so spicy picks up semantic
// rules automatically once any are ever rated 4+.
const DEFAULT_SEMANTIC_WEIGHT = 0.3

export const MEDIUM_KNOBS: KnobValues = {
  tier: 'medium',
  clueCountIn: 3,
  clueCountOut: 3,
  poolSize: 6,
  trapGuestCount: 2,
  targetSurvivingDecoyRange: [2, 3],
  semanticRuleWeight: DEFAULT_SEMANTIC_WEIGHT,
}

export const SPICY_KNOBS: KnobValues = {
  tier: 'spicy',
  clueCountIn: 3,
  clueCountOut: 3,
  poolSize: 6,
  trapGuestCount: 3,
  targetSurvivingDecoyRange: [4, Infinity],
  semanticRuleWeight: DEFAULT_SEMANTIC_WEIGHT,
}

export function resolveKnobs(
  tier: DifficultyTier,
  overrides: Partial<KnobValues> = {}
): KnobValues {
  const base = tier === 'medium' ? MEDIUM_KNOBS : SPICY_KNOBS
  return { ...base, ...overrides }
}

/** Medium subtlety 2-3, Spicy subtlety 4-5 (planning.md §7.4). */
export function subtletyRangeFor(tier: DifficultyTier): [number, number] {
  return tier === 'medium' ? [2, 3] : [4, 5]
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
