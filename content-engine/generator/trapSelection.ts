import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { trapAllocation } from './difficulty'
import { mustFind } from './lookup'
import { pickRandom, pickWeighted, shuffle } from './random'
import type { DecoyResult, GuestEntry, KnobValues } from './types'

/**
 * IN-count distribution for the 6-guest pool. 6:0 and 0:6 are excluded
 * outright — a single-label pool teaches nothing and reads as broken.
 *
 * Centred on 3:3, but the thin tails are the point. The previous coin flip
 * drew targetIn from {3, 4} only, so the pool was *never* IN-minority: across
 * every puzzle ever generated at least half the guests were IN, and "lean IN
 * when unsure" was a positive-expectation strategy with nothing to do with the
 * rule. Same class of exploit as the old fixed IN,IN,IN,IN,OUT,OUT ordering,
 * just harder to see. 2:4 and 1:5 are what remove it.
 */
const IN_COUNT_WEIGHTS: readonly (readonly [inCount: number, weight: number])[] = [
  [3, 50],
  [4, 20],
  [2, 20],
  [5, 5],
  [1, 5],
]

/**
 * Decoy-traps are the highest-value guests in the pool, so they're picked on
 * trap value rather than commonness — but only within a band. Below this a
 * word is obscure rather than tricky, and a trap the player has never seen
 * isn't difficulty, it's noise. There was previously no floor here at all
 * (only clues had one, in draftClueSet): 18% of selected decoy-traps were
 * landing under this line.
 */
const TRAP_FREQUENCY_FLOOR = 0.4

/**
 * How many of the pool should be IN, drawn fresh per puzzle.
 *
 * Exported for testing: asserting the distribution through selectGuestPool is
 * flaky, because the trap passes set their own labels first and can clamp an
 * extreme target (spicy forces 2 IN traps, so targetIn=1 is unreachable).
 */
export function drawTargetIn(poolSize: number): number {
  // The table is calibrated for the 6-guest pool both tiers use. Any other
  // size falls back to the old balanced draw rather than reading a nonsense
  // IN count off a table that doesn't describe it.
  if (poolSize !== 6) {
    const half = Math.floor(poolSize / 2)
    return half + (Math.random() < 0.5 ? 0 : 1)
  }
  return pickWeighted(IN_COUNT_WEIGHTS.slice(), ([, weight]) => weight)[0]
}

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
  excludeIds: Set<string> = new Set()
): GuestEntry[] {
  const { decoyTraps: decoyTrapTarget, tButLooksWrong: tBadTarget } = trapAllocation(knobs)
  const rankedDecoys = liveDecoys.slice().sort((a, b) => b.subtlety - a.subtlety)

  const targetIn = drawTargetIn(knobs.poolSize)

  const used = new Set(excludeIds)
  const guests: GuestEntry[] = []
  let order = 0

  /**
   * `mode` decides what wins a slot. Padding should be boringly common — it
   * isn't the puzzle — so it stays frequency-weighted. Traps are load-bearing,
   * so inside the recognisable band every word is equally eligible and trap
   * value decides instead of commonness; weighting them by frequency made a
   * 0.45 word lose to a 0.9 word on commonness alone, which is how good
   * mid-frequency trap words were being passed over.
   */
  function bestCandidate(
    predicate: (word: Word) => boolean,
    mode: 'trap' | 'padding'
  ): Word | null {
    const candidates = wordBank.filter((w) => !used.has(w.id) && !w.safety.blocked && predicate(w))
    if (candidates.length === 0) return null
    if (mode === 'trap') {
      const band = candidates.filter((w) => w.frequencyScore >= TRAP_FREQUENCY_FLOOR)
      // A thin rule shouldn't lose its trap entirely just because nothing
      // clears the band — fall back rather than dropping the trap, which
      // would cost the whole candidate at the orchestrator's pool check.
      if (band.length > 0) return pickRandom(band)
    }
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
    const pick = bestCandidate((w) => !trueRule.evaluate(w) && decoy.evaluate(w), 'trap')
    if (!pick) continue
    guests.push({
      wordId: pick.id,
      trueLabel: 'OUT',
      displayOrder: order++,
      isTrap: true,
      trapType: 'decoy',
    })
    used.add(pick.id)
  }

  // Pass 2: T-but-looks-wrong — satisfy the true rule but violate a live decoy (quadrant B).
  for (let i = 0; i < tBadTarget && rankedDecoys.length > 0; i++) {
    const decoy = mustFind(ruleIndex, rankedDecoys[i % rankedDecoys.length].ruleId, 'rule')
    const pick = bestCandidate((w) => trueRule.evaluate(w) && !decoy.evaluate(w), 'trap')
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

    let pick = bestCandidate((w) => trueRule.evaluate(w) === wantIn, 'padding')
    let label: 'IN' | 'OUT' = wantIn ? 'IN' : 'OUT'
    if (!pick) {
      pick = bestCandidate((w) => trueRule.evaluate(w) === !wantIn, 'padding')
      label = wantIn ? 'OUT' : 'IN'
    }
    if (!pick) break // word bank exhausted — orchestrator will detect the short pool and retry

    guests.push({
      wordId: pick.id,
      trueLabel: label,
      displayOrder: order++,
      isTrap: false,
      trapType: null,
    })
    used.add(pick.id)
  }

  // Shuffle before assigning final display order. Generation order is
  // structured (decoy traps -> t-but-looks-wrong -> padding), and the pool is
  // served to the player in stored order, so without this the trap positions
  // and the IN/OUT run are both predictable from position alone.
  return shuffle(guests).map((guest, index) => ({ ...guest, displayOrder: index }))
}
