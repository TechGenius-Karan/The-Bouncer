import type { Matrix } from './matrix.js'
import type { Family, Item, VisualRule } from './types.js'

// The numbers behind the matrix review (planning-visual-pivot.md §4.3): which
// rules are usable, which pairs are one idea twice, which families are too big
// to space out, and the runway. Pure, so the thresholds are tested.

/** §4.5 step 1: a rule needs this many definite yes AND definite no items to be drafted. */
export const MIN_DEFINITE_PER_SIDE = 20

/**
 * §4.1: two rules this alike are the same idea twice. 0.8 on both sides is
 * stricter than it looks: two 20-yes rules sharing 18 of them score 0.82.
 */
export const NEAR_DUPLICATE_SIMILARITY = 0.8

/** Below this many items with definite answers on both rules, a similarity figure means nothing. */
export const MIN_SHARED_DEFINITE = 20

/** §5.4: with 3-day family spacing, no family can hold more than this share of usable rules. */
export const MAX_FAMILY_SHARE = 1 / 3

export interface RuleCounts {
  ruleId: string
  family: Family
  yes: number
  no: number
  unsure: number
  untagged: number
  eligible: boolean
}

export interface NearDuplicate {
  a: string
  b: string
  /** True when one rule is close to the opposite of the other ("alive" vs "made by people"). */
  inverted: boolean
  similarity: number
  shared: number
}

export interface MatrixReport {
  counts: RuleCounts[]
  nearDuplicates: NearDuplicate[]
  oversizeFamilies: { family: Family; eligible: number; share: number }[]
  /** Eligible rules that can never get a board: some rival reading no item rules out. */
  unshippable: { ruleId: string; blockedBy: string[] }[]
  /**
   * Usable rules before any are spent, unshippable ones excluded. Each one is a
   * day of puzzles (§4.7).
   */
  eligibleCount: number
}

/** Blocked items never reach a board, so they don't count toward anything. */
const usable = (items: Item[]) => items.filter((i) => !i.blocked)

export function countRule(rule: VisualRule, items: Item[], matrix: Matrix): RuleCounts {
  const counts = { yes: 0, no: 0, unsure: 0, untagged: 0 }
  for (const item of usable(items)) counts[matrix.cellOf(item.id, rule.id) ?? 'untagged']++
  const eligible =
    !rule.retired && counts.yes >= MIN_DEFINITE_PER_SIDE && counts.no >= MIN_DEFINITE_PER_SIDE
  return { ruleId: rule.id, family: rule.family, ...counts, eligible }
}

/**
 * The one definition of a rival, shared with the generator. A rule nobody has
 * tagged yet is left out, or one newly written rule would collide with every
 * board (§4.4). Retired and too-thin rules stay in: a player can still think of
 * them, except that a retired duplicate is not a rival of the rules it merged into.
 */
export function isRivalOf(
  rival: VisualRule,
  trueRule: VisualRule,
  items: Item[],
  matrix: Matrix
): boolean {
  return (
    rival.id !== trueRule.id &&
    !(rival.mergedInto ?? []).includes(trueRule.id) &&
    usable(items).some((i) => matrix.valueOf(i.id, rival.id) !== null)
  )
}

/**
 * Rival readings (both polarities: `id` or `NOT id`) that no item definite on
 * `rule` definitely contradicts. Every board is drawn from those items, so each
 * of these collides (§4.4) with every board the rule could ever have.
 */
export function unavoidableRivals(
  rule: VisualRule,
  rules: VisualRule[],
  items: Item[],
  matrix: Matrix
): string[] {
  const definite = usable(items).filter((i) => matrix.valueOf(i.id, rule.id) !== null)
  const blockers: string[] = []
  for (const rival of rules) {
    if (!isRivalOf(rival, rule, items, matrix)) continue
    for (const negated of [false, true]) {
      const contradicted = definite.some((i) => {
        const r = matrix.valueOf(i.id, rival.id)
        return r !== null && (r !== negated) !== matrix.valueOf(i.id, rule.id)
      })
      if (!contradicted) blockers.push(negated ? `NOT ${rival.id}` : rival.id)
    }
  }
  return blockers
}

const overlap = (both: number, onlyOne: number) =>
  both + onlyOne === 0 ? 0 : both / (both + onlyOne)

/**
 * How alike two rules are, on the items both answer definitely. Not raw
 * agreement: two sparse rules agree on nearly every item just by both saying
 * no ("has feathers" and "makes music"), and two dense rules by both saying yes.
 * Instead both sides must overlap: the yes-sets AND the no-sets (Jaccard), and
 * the score is the weaker of the two. `opposite` scores one rule against the
 * other's inverse the same way.
 */
export function compareRules(
  a: VisualRule,
  b: VisualRule,
  items: Item[],
  matrix: Matrix
): { shared: number; same: number; opposite: number } {
  let yy = 0
  let nn = 0
  let yn = 0
  let ny = 0
  for (const item of usable(items)) {
    const va = matrix.valueOf(item.id, a.id)
    const vb = matrix.valueOf(item.id, b.id)
    if (va === null || vb === null) continue
    if (va && vb) yy++
    else if (!va && !vb) nn++
    else if (va) yn++
    else ny++
  }
  return {
    shared: yy + nn + yn + ny,
    same: Math.min(overlap(yy, yn + ny), overlap(nn, yn + ny)),
    opposite: Math.min(overlap(yn, yy + nn), overlap(ny, yy + nn)),
  }
}

export function buildMatrixReport(
  rules: VisualRule[],
  items: Item[],
  matrix: Matrix
): MatrixReport {
  const counts = rules.map((r) => countRule(r, items, matrix))
  const live = rules.filter((r) => !r.retired)

  const nearDuplicates: NearDuplicate[] = []
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const { shared, same, opposite } = compareRules(live[i], live[j], items, matrix)
      if (shared < MIN_SHARED_DEFINITE) continue
      const inverted = opposite > same
      const similarity = Math.max(same, opposite)
      if (similarity >= NEAR_DUPLICATE_SIMILARITY) {
        nearDuplicates.push({ a: live[i].id, b: live[j].id, inverted, similarity, shared })
      }
    }
  }

  const unshippable = rules
    .filter((_, n) => counts[n].eligible)
    .map((r) => ({ ruleId: r.id, blockedBy: unavoidableRivals(r, rules, items, matrix) }))
    .filter((u) => u.blockedBy.length > 0)
  const blocked = new Set(unshippable.map((u) => u.ruleId))
  const shippable = counts.filter((c) => c.eligible && !blocked.has(c.ruleId))

  const eligibleCount = shippable.length
  const byFamily = new Map<Family, number>()
  for (const c of shippable) byFamily.set(c.family, (byFamily.get(c.family) ?? 0) + 1)
  const oversizeFamilies = [...byFamily]
    .map(([family, eligible]) => ({ family, eligible, share: eligible / eligibleCount }))
    .filter((f) => f.share > MAX_FAMILY_SHARE)

  return { counts, nearDuplicates, oversizeFamilies, unshippable, eligibleCount }
}
