import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { trapAllocation } from './difficulty'
import { mustFind } from './lookup'
import { shuffle } from './random'
import type { DecoyResult, GuestEntry, KnobValues } from './types'

/**
 * Step 3 of planning.md §7.6 / §7.2's mechanism: choose the guest pool.
 * Every candidate word falls into one of 4 quadrants of the (T, D) truth
 * table for a given decoy D — this picks specifically from the two trap
 * quadrants first (decoy-trap: satisfies D, violates T; T-but-looks-wrong:
 * satisfies T, violates D), then pads the rest with words both agree on.
 */
export function selectGuestPool(
  trueRule: Rule,
  liveDecoys: DecoyResult[],
  wordBank: Word[],
  knobs: KnobValues,
  ruleIndex: Map<string, Rule>,
  excludeIds: Set<string> = new Set(),
): GuestEntry[] {
  const { decoyTraps: decoyTrapTarget, tButLooksWrong: tBadTarget } = trapAllocation(knobs)
  const rankedDecoys = liveDecoys.slice().sort((a, b) => b.subtlety - a.subtlety)

  const used = new Set(excludeIds)
  const guests: GuestEntry[] = []
  let order = 0

  function bestCandidate(predicate: (word: Word) => boolean): Word | null {
    const candidates = wordBank.filter((w) => !used.has(w.id) && !w.safety.blocked && predicate(w))
    if (candidates.length === 0) return null
    // Shuffle before sorting so frequency ties (common with a hand-set 3-tier
    // scale) break randomly instead of always favoring the same word in the
    // same position in the seed list — otherwise every candidate for a given
    // rule ends up padded with identical filler words.
    return shuffle(candidates).sort((a, b) => b.frequencyScore - a.frequencyScore)[0]
  }

  // Pass 1: decoy traps — satisfy a live decoy but violate the true rule (quadrant C).
  for (let i = 0; i < decoyTrapTarget && rankedDecoys.length > 0; i++) {
    const decoy = mustFind(ruleIndex, rankedDecoys[i % rankedDecoys.length].ruleId, 'rule')
    const pick = bestCandidate((w) => !trueRule.evaluate(w) && decoy.evaluate(w))
    if (!pick) continue
    guests.push({ wordId: pick.id, trueLabel: 'OUT', displayOrder: order++, isTrap: true, trapType: 'decoy' })
    used.add(pick.id)
  }

  // Pass 2: T-but-looks-wrong — satisfy the true rule but violate a live decoy (quadrant B).
  for (let i = 0; i < tBadTarget && rankedDecoys.length > 0; i++) {
    const decoy = mustFind(ruleIndex, rankedDecoys[i % rankedDecoys.length].ruleId, 'rule')
    const pick = bestCandidate((w) => trueRule.evaluate(w) && !decoy.evaluate(w))
    if (!pick) continue
    guests.push({
      wordId: pick.id,
      trueLabel: 'IN',
      displayOrder: order++,
      isTrap: true,
      trapType: 't-but-looks-wrong',
    })
    used.add(pick.id)
  }

  // Pass 3: clean padding, biased toward whichever side is currently under-represented
  // (a soft heuristic only — see the approved plan's note on pool balance).
  while (guests.length < knobs.poolSize) {
    const inCount = guests.filter((g) => g.trueLabel === 'IN').length
    const wantIn = inCount <= knobs.poolSize / 2

    let pick = bestCandidate((w) => trueRule.evaluate(w) === wantIn)
    let label: 'IN' | 'OUT' = wantIn ? 'IN' : 'OUT'
    if (!pick) {
      pick = bestCandidate((w) => trueRule.evaluate(w) === !wantIn)
      label = wantIn ? 'OUT' : 'IN'
    }
    if (!pick) break // word bank exhausted — orchestrator will detect the short pool and retry

    guests.push({ wordId: pick.id, trueLabel: label, displayOrder: order++, isTrap: false, trapType: null })
    used.add(pick.id)
  }

  return guests
}
