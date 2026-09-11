import type { DifficultyTier, KnobValues } from './types.js'

// Defaults straight from planning.md §7.4's knob table.
// planning.md §7.1's suggested launch mix: skew toward lexical/structural
// since it's cheaper to generate/validate with high confidence, expanding
// semantic coverage over time as the tagged word bank matures.
//
// Medium used to be 0.5, higher than spicy, on the reasoning that medium's
// [2,3] window had fuller semantic coverage than spicy's [3,5]. That was a
// supply argument, and it has been overtaken by a content one: `category` is
// now the whole semantic family (part-of-speech was deleted), so the weight is
// really "how often is today's puzzle 'The word names a ___'". At 0.5 a real
// 40-puzzle batch came out with 14 of them, and play-testing says that is the
// Connections-shaped material the game is trying not to be.
//
// Halved to 0.25: roughly 1.5 semantic puzzles in a medium week rather than 3.
// Supply is not the constraint either way — 33 category rules sustain ~3.9/week
// under the 60-day rule cooldown, and placement.test.ts asserts that headroom
// against this exact constant.
const MEDIUM_SEMANTIC_WEIGHT = 0.25
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
