import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { trapAllocation } from './difficulty'
import { mustFind } from './lookup'
import { pickWeighted, shuffle } from './random'
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

  // How many of the pool should be IN, drawn fresh per puzzle. The old
  // heuristic (`inCount <= poolSize / 2`) was fully deterministic and always
  // produced exactly 4 IN / 2 OUT — which, combined with an unshuffled pool,
  // let a player win by rote ("the last two are OUT") without reasoning about
  // the rule at all. See the approved plan's Phase 1.
  const half = Math.floor(knobs.poolSize / 2)
  const targetIn = half + (Math.random() < 0.5 ? 0 : 1)

  const used = new Set(excludeIds)
  const guests: GuestEntry[] = []
  let order = 0

  function bestCandidate(predicate: (word: Word) => boolean): Word | null {
    const candidates = wordBank.filter((w) => !used.has(w.id) && !w.safety.blocked && predicate(w))
    if (candidates.length === 0) return null
    // Weighted by frequencyScore so common words are still statistically
    // favored (planning.md §7.5's fairness intent), but a 0.6/0.3-tier word
    // can now actually win sometimes instead of only when zero 0.9-tier
    // candidates remain — a strict sort-by-frequency picked the same
    // highest-tier word (or one of a small tied set) every single time a
    // given rule was drawn, which is a real source of repeated puzzles.
    return pickWeighted(candidates, (w) => w.frequencyScore)
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

  // Pass 3: clean padding, filling toward this puzzle's targetIn.
  while (guests.length < knobs.poolSize) {
    const inCount = guests.filter((g) => g.trueLabel === 'IN').length
    const wantIn = inCount < targetIn

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

  // Shuffle before assigning final display order. Generation order is
  // structured (decoy traps -> t-but-looks-wrong -> padding), and the pool is
  // served to the player in stored order, so without this the trap positions
  // and the IN/OUT run are both predictable from position alone.
  return shuffle(guests).map((guest, index) => ({ ...guest, displayOrder: index }))
}
