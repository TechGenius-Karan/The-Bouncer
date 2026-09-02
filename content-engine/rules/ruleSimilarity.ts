import type { Word } from '../words/types'
import type { Rule } from './types'

/**
 * Why two rules that both separate a board can still be different things.
 *
 * planning.md §7.3 rejects a candidate whenever a second rule perfectly
 * matches the board's IN/OUT partition. The stated reason is the reveal: a
 * player who inferred rule D scores 6/6, then gets told the rule was T, and
 * "would rightly feel cheated by which rule got named."
 *
 * That reasoning holds for a coincidence and not for a near-synonym. Told
 * "ends with NG" after inferring "ends with G", nobody feels cheated — the
 * two rules are the same idea. Told "starts with Q" after inferring "third
 * letter is a vowel", they absolutely do.
 *
 * The board itself cannot tell those apart. A collision is *defined* as a rule
 * agreeing with the board's labels everywhere, and the board's labels are
 * derived from the true rule — so every colliding rule matches the true rule's
 * pattern across all 12 words, by construction, always. (Measured: 32 of 32.)
 * Comparing board patterns is a tautology.
 *
 * The word bank can tell them apart, and that's what this module measures.
 */
export type CollisionKind =
  /** Near-identical IN-sets — the same idea twice. Safe to ship; reveal the higher-aha rule. */
  | 'equivalent'
  /** One rule's IN-set sits inside the other's — a special case, not a coincidence. Reveal the specific one. */
  | 'subsumption'
  /** Agree on this board and nowhere else. Still unfair; repair or reject. */
  | 'divergent'

/**
 * Jaccard at or above this means the two rules are the same idea.
 *
 * Sits in a real measured gap — genuine near-equivalents clustered at 0.66+
 * (ends-with-ed ~ ends-with-d 0.659, ends-with-ion ~ ends-with-tion 0.775,
 * ends-with-ng ~ ends-with-g 0.933) while the next collision down was 0.416.
 * Derived from n=32 though, so treat it as a starting point and re-derive it
 * on a larger sample before trusting the exact figure.
 */
export const EQUIVALENCE_JACCARD = 0.6

/**
 * Containment at or above this means one rule is a special case of the other.
 *
 * Needed separately because Jaccard misclassifies nested sets of very
 * different sizes: every palindrome has a matching first and last letter, but
 * palindrome ~ same-start-end scores only 0.06 (43 words against 712). By
 * overlap that reads as coincidence; it plainly isn't.
 *
 * Not 1.0 — a handful of bank exceptions shouldn't demote a real subset.
 *
 * Safe at this level only because rule breadth is capped: buildRuleParams
 * refuses any parameter covering more than MAX_COVERAGE_SHARE (35%) of the
 * bank, so an unrelated small rule sits around 35% contained, nowhere near
 * 0.95. Raise that cap and this threshold stops discriminating.
 */
export const SUBSUMPTION_CONTAINMENT = 0.95

// Bank-wide IN-sets, memoized. Computing one is a full 15,000-word scan, and
// the validator runs inside a repair loop inside a rule-retry loop inside a
// batch. Keyed on the bank array's identity: generateBatchCore calls
// buildWordBank() once and threads the same array through the whole batch, so
// this stays warm exactly as long as it's valid and drops the moment a
// different bank (a test fixture, a later batch) comes through.
let cachedBank: Word[] | null = null
const inSetCache = new Map<string, Set<string>>()

function inSetFor(rule: Rule, bank: Word[]): Set<string> {
  if (bank !== cachedBank) {
    cachedBank = bank
    inSetCache.clear()
  }
  const cached = inSetCache.get(rule.id)
  if (cached) return cached
  const set = new Set(bank.filter((w) => !w.safety.blocked && rule.evaluate(w)).map((w) => w.id))
  inSetCache.set(rule.id, set)
  return set
}

/**
 * How two board-colliding rules relate across the whole word bank.
 *
 * Only meaningful for rules that already collide — it says nothing about
 * whether they collide, only what to do about it.
 */
export function classifyCollision(a: Rule, b: Rule, bank: Word[]): CollisionKind {
  const setA = inSetFor(a, bank)
  const setB = inSetFor(b, bank)
  // A rule matching nothing in the bank can't be shown to be equivalent to
  // anything — treat it as divergent rather than dividing by zero.
  if (setA.size === 0 || setB.size === 0) return 'divergent'

  let intersection = 0
  for (const id of setA) if (setB.has(id)) intersection++

  const union = setA.size + setB.size - intersection
  if (intersection / union >= EQUIVALENCE_JACCARD) return 'equivalent'
  if (intersection / Math.min(setA.size, setB.size) >= SUBSUMPTION_CONTAINMENT) return 'subsumption'
  return 'divergent'
}

/**
 * Which of two acceptably-colliding rules should be named at reveal.
 *
 * For `equivalent`, the higher `aha` — both describe the board equally well,
 * so pick the one that's more satisfying to be told. Ties break on subtlety
 * then rule id, so a regenerated puzzle can't flip its reveal text.
 *
 * For `subsumption`, the *more specific* rule (smaller IN-set), overriding
 * aha. Revealing "same first and last letter" on a board of five palindromes
 * describes it less accurately than "palindrome" does, whatever the ratings
 * say — accuracy of description beats satisfaction here.
 */
export function pickRevealRule(a: Rule, b: Rule, kind: CollisionKind, bank: Word[]): Rule {
  if (kind === 'subsumption') {
    return inSetFor(a, bank).size <= inSetFor(b, bank).size ? a : b
  }
  // aha is optional on Rule and defaults to neutral where unrated.
  const ahaA = a.aha ?? 3
  const ahaB = b.aha ?? 3
  if (ahaA !== ahaB) return ahaA > ahaB ? a : b
  if (a.subtlety !== b.subtlety) return a.subtlety > b.subtlety ? a : b
  return a.id <= b.id ? a : b
}
