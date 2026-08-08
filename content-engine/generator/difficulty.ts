import type { DifficultyTier, KnobValues } from './types'

// Defaults straight from planning.md §7.4's knob table.
export const MEDIUM_KNOBS: KnobValues = {
  tier: 'medium',
  clueCountIn: 3,
  clueCountOut: 3,
  poolSize: 6,
  trapGuestCount: 2,
  targetSurvivingDecoyRange: [2, 3],
}

export const SPICY_KNOBS: KnobValues = {
  tier: 'spicy',
  clueCountIn: 3,
  clueCountOut: 3,
  poolSize: 6,
  trapGuestCount: 3,
  targetSurvivingDecoyRange: [4, Infinity],
}

export function resolveKnobs(tier: DifficultyTier, overrides: Partial<KnobValues> = {}): KnobValues {
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
