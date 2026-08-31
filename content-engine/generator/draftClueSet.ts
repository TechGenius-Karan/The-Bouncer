import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { shuffle } from './random'
import type { ClueEntry, KnobValues } from './types'

// Clues are the evidence a player anchors on hardest — hold them to a
// higher commonness bar than trap guests (planning.md §7.5).
const CLUE_FREQUENCY_FLOOR = 0.6

function pickClueWords(pool: Word[], count: number): Word[] {
  // Proper nouns stay usable in the guest pool but are kept out of clues:
  // clues are the evidence the whole inference rests on, and a name like
  // "margaret" reads as an odd, arbitrary example rather than a fair one.
  const preferred = pool.filter((w) => w.frequencyScore >= CLUE_FREQUENCY_FLOOR && !w.properNoun)
  const fallback = pool.filter((w) => !w.properNoun)
  const source = preferred.length >= count ? preferred : fallback.length >= count ? fallback : pool
  return shuffle(source).slice(0, count)
}

/**
 * Picks IN clues that don't all match the rule for the same reason.
 *
 * Without this, a "hides a number" clue set could be `done, telephone, money`
 * — all three hiding "one" — which teaches the player the wrong, narrower
 * rule and makes the pool feel arbitrary when it turns out "ten" counts too.
 * (That exact puzzle shipped; it's what prompted this.) Round-robins across
 * the distinct `variantOf` values so the clue set demonstrates the rule's
 * actual breadth. Rules with no `variantOf` match for one uniform reason and
 * fall straight through to the plain random pick.
 */
function pickDiverseClueWords(rule: Rule, pool: Word[], count: number): Word[] {
  if (!rule.variantOf) return pickClueWords(pool, count)

  const byVariant = new Map<string, Word[]>()
  for (const word of pool) {
    const variant = rule.variantOf(word)
    if (variant === null) continue
    const bucket = byVariant.get(variant)
    if (bucket) bucket.push(word)
    else byVariant.set(variant, [word])
  }
  // One variant available (or none resolvable) — diversity isn't achievable.
  if (byVariant.size < 2) return pickClueWords(pool, count)

  const buckets = shuffle([...byVariant.values()].map((words) => shuffle(words)))
  const picked: Word[] = []
  for (let round = 0; picked.length < count; round++) {
    let progressed = false
    for (const bucket of buckets) {
      if (picked.length >= count) break
      if (round >= bucket.length) continue
      picked.push(bucket[round])
      progressed = true
    }
    if (!progressed) break // every bucket exhausted
  }
  return picked.length === count ? picked : pickClueWords(pool, count)
}

/**
 * Step 1 of planning.md §7.6: pick IN/OUT example words for a rule, with no
 * decoy-awareness yet. Randomized within a commonness floor so repeated
 * calls for the same rule produce varied clue sets across a batch.
 */
export function draftClueSet(
  rule: Rule,
  wordBank: Word[],
  knobs: KnobValues,
  excludeIds: Set<string> = new Set(),
): ClueEntry[] {
  const inCandidates = wordBank.filter((w) => !excludeIds.has(w.id) && !w.safety.blocked && rule.evaluate(w))
  const outCandidates = wordBank.filter((w) => !excludeIds.has(w.id) && !w.safety.blocked && !rule.evaluate(w))

  if (inCandidates.length < knobs.clueCountIn || outCandidates.length < knobs.clueCountOut) {
    throw new Error(`Not enough words in the bank to draft a clue set for rule "${rule.id}"`)
  }

  // Only the IN side gets variant-spread: OUT words fail the rule and have no
  // variant to be diverse across.
  const inWords = pickDiverseClueWords(rule, inCandidates, knobs.clueCountIn)
  const outWords = pickClueWords(outCandidates, knobs.clueCountOut)

  let order = 0
  const clues: ClueEntry[] = []
  for (const word of inWords) clues.push({ wordId: word.id, label: 'IN', displayOrder: order++ })
  for (const word of outWords) clues.push({ wordId: word.id, label: 'OUT', displayOrder: order++ })
  return clues
}
