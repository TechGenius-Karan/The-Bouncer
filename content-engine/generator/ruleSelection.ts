import type { Rule } from '../rules/types.js'
import { pickWeighted } from './random.js'

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

/**
 * How much of the calendar each mechanic should get, before damping.
 *
 * Hand-set, not derived. A derived weight would just re-encode the ratings, and
 * the ratings are exactly what failed to control the mix: with a flat pick,
 * `rhyme`'s 73 rules at aha 3 outweighed `palindrome`'s single rule at aha 5 by
 * 44x, and 86% of spicy lexical puzzles came out as either a rhyme or a hidden
 * word. Rule count, not rule quality, was setting the menu.
 *
 * `sound` is deliberately below what its ratings would earn it: it is there to
 * make the game feel distinctive, not to be the game. `word-surgery` is above,
 * because it is the thinnest mechanic today and the one with the most headroom.
 * `letter-pattern` is lowest because it is where the filler lives — starts-with
 * and ends-with are 73 of its rules and were rejected 80-88% of the time.
 *
 * Measured over 20,000 draws against the real taxonomy, lexical pool:
 *
 *   spicy   word-inside 35%  sound 31%  word-surgery 18%  letter-pattern 16%
 *   medium  word-inside 32%  sound 29%  letter-pattern 27%  word-surgery 12%
 *
 * Nothing above ~35%, against 45% for `rhyme` alone before this existed. The
 * ceiling is set by there being only four lexical mechanics with real content
 * in them — adding rules to the thin ones dilutes the top one further, which is
 * what planning-lexical-depth.md's later phases are for. Retune here after any
 * phase that adds a family.
 */
export const MECHANIC_WEIGHTS: Record<Rule['mechanic'], number> = {
  'word-inside': 0.6,
  sound: 0.4,
  'letter-pattern': 0.35,
  'word-surgery': 1.5,
  meaning: 1,
}

/**
 * Picks a rule in two steps — mechanic first, then a rule within it.
 *
 * The mechanic step is what stops a large family crowding out a small one. Its
 * weight is `MECHANIC_WEIGHTS x sqrt(rule count)`: some credit for a mechanic
 * that can actually sustain variety, but square-rooted, because the alternative
 * of ignoring count entirely would draw `palindrome` (one rule, 60-day cooldown)
 * as often as all 73 rhymes and starve the calendar.
 *
 * The rule step keeps the two signals it always had, both soft — no rule is
 * ever excluded outright:
 *
 * - **aha** (how satisfying the rule is to get) — a rule rated 1 is drawn
 *   ~5x less often than one rated 5, so arithmetic rules like prime-length
 *   become occasional filler rather than regular content. Defaults to 3.
 * - **recent reviewer rejections** — build-plan.md Phase 10.6 item 2's
 *   "next-batch soft-avoidance". Each rejection roughly halves the share
 *   (1/(1+count)) rather than zeroing it, so a heavily-rejected rule can
 *   still be drawn if the batch has nothing else fresh to offer.
 */
export function pickTrueRule(pool: Rule[], rejectCounts: Map<string, number> = new Map()): Rule {
  // Template size is damped the same way mechanic size is, and for the same
  // reason one level down. Grouping by mechanic alone left `rhyme`'s 73 rules
  // taking 26% of all lexical draws while the three sharpest sound rules
  // (initial-sound, silent-first-letter, one-syllable-long) shared 2.8% between
  // them — about one puzzle every six weeks, which is not worth building.
  // An untemplated rule is its own template of one: `palindrome` and
  // `contains-q` are each a distinct idea, not members of an "everything else"
  // family that deserves to be throttled as a group.
  const templateSize = new Map<string, number>()
  for (const r of pool) {
    const key = r.templateId ?? r.id
    templateSize.set(key, (templateSize.get(key) ?? 0) + 1)
  }
  const ruleWeight = (r: Rule) =>
    (r.aha ?? 3) /
    (1 + (rejectCounts.get(r.id) ?? 0)) /
    Math.sqrt(templateSize.get(r.templateId ?? r.id)!)

  const byMechanic = new Map<Rule['mechanic'], Rule[]>()
  for (const rule of pool) {
    const bucket = byMechanic.get(rule.mechanic)
    if (bucket) bucket.push(rule)
    else byMechanic.set(rule.mechanic, [rule])
  }

  const buckets = [...byMechanic.entries()]
  const [mechanic] = pickWeighted(
    buckets,
    ([m, rules]) => MECHANIC_WEIGHTS[m] * Math.sqrt(rules.length)
  )
  return pickWeighted(byMechanic.get(mechanic)!, ruleWeight)
}
