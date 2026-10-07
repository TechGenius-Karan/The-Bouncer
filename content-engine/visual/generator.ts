import { MEDIUM_KNOBS, trapAllocation } from '../generator/difficulty.js'
import type { Label, TrapType } from '../generator/types.js'
import type { Matrix } from './matrix.js'
import { mulberry32, pick, pickWeighted, shuffle, type Rng } from './random.js'
import { countRule, isRivalOf } from './report.js'
import type { Item, Tri, VisualCandidate, VisualRule } from './types.js'

// The visual generator (planning-visual-pivot.md §4.5): rule -> clues -> decoy
// scan -> trap pool -> three-valued validation with repair. Pure and seeded:
// the same input and seed always give the same board (§4.6).

/** Copied from generator/trapSelection.ts, which doesn't export it (§3.2). */
const IN_COUNT_WEIGHTS: readonly (readonly [inCount: number, weight: number])[] = [
  [3, 50],
  [4, 20],
  [2, 20],
  [5, 5],
  [1, 5],
]

const MAX_RULE_ATTEMPTS = 10
const MAX_CLUE_ATTEMPTS = 8
const MAX_REPAIR_ATTEMPTS = 5

export interface GeneratorInput {
  items: Item[]
  rules: VisualRule[]
  matrix: Matrix
  /** Rules held by an approved, scheduled or live visual puzzle (§3.5). */
  usedRuleIds: Set<string>
  /** Rules waiting in the pending_approval queue, plus any drafted earlier in this batch. */
  pendingRuleIds: Set<string>
  /** Recent reviewer rejections per rule; each one makes the rule less likely to be drafted. */
  rejectCounts: Map<string, number>
}

/** A rule read one way round. `negated` reads it inverted: IN = the rule is false. */
export interface Reading {
  rule: VisualRule
  negated: boolean
}

export interface BoardItem {
  itemId: string
  label: Label
}

interface Guest {
  item: Item
  label: Label
  trapType: TrapType
}

/** Where a reading puts an item: true = IN, false = OUT, null = can't say. */
const placeOf = (value: Tri, negated: boolean): Tri => (value === null ? null : value !== negated)

/** §4.5 step 1: not used, not pending, not retired, and enough definite answers on both sides. */
export function eligibleRules(input: GeneratorInput): VisualRule[] {
  return input.rules.filter(
    (r) =>
      !input.usedRuleIds.has(r.id) &&
      !input.pendingRuleIds.has(r.id) &&
      countRule(r, input.items, input.matrix).eligible
  )
}

/** Every rival of T (`isRivalOf`), both ways round. */
export function rivalReadings(trueRule: VisualRule, input: GeneratorInput): Reading[] {
  return input.rules
    .filter((r) => isRivalOf(r, trueRule, input.items, input.matrix))
    .flatMap((rule) => [
      { rule, negated: false },
      { rule, negated: true },
    ])
}

/**
 * §4.4: a reading collides with a board unless at least one item definitely
 * contradicts it. Null counts as "could agree": a player can read a debatable
 * item whichever way keeps their theory alive.
 */
export function collides(board: BoardItem[], reading: Reading, matrix: Matrix): boolean {
  return !board.some((b) => {
    const place = placeOf(matrix.valueOf(b.itemId, reading.rule.id), reading.negated)
    return place !== null && place !== (b.label === 'IN')
  })
}

/**
 * §4.5 step 4: a reading is a live decoy if it is definite on every clue and
 * agrees with every label — the opposite treatment of null to `collides`.
 */
export function liveDecoys(clues: BoardItem[], rivals: Reading[], matrix: Matrix): Reading[] {
  return rivals.filter((r) =>
    clues.every(
      (c) => placeOf(matrix.valueOf(c.itemId, r.rule.id), r.negated) === (c.label === 'IN')
    )
  )
}

function draftClues(yes: Item[], no: Item[], rng: Rng): BoardItem[] {
  const inItems = shuffle(yes, rng).slice(0, MEDIUM_KNOBS.clueCountIn)
  // §4.5 step 3: three IN clues from one group read as "they're all animals".
  if (new Set(inItems.map((i) => i.group)).size === 1) {
    const other = pick(
      yes.filter((i) => i.group !== inItems[0].group),
      rng
    )
    if (other) inItems[inItems.length - 1] = other
  }
  const outItems = shuffle(no, rng).slice(0, MEDIUM_KNOBS.clueCountOut)
  return [
    ...inItems.map((i) => ({ itemId: i.id, label: 'IN' as const })),
    ...outItems.map((i) => ({ itemId: i.id, label: 'OUT' as const })),
  ]
}

/**
 * §4.5 step 5: one decoy trap, one "fits but looks wrong" guest (or a second
 * decoy trap when none exists), then padding toward a drawn IN count.
 */
function buildPool(
  decoy: Reading,
  yes: Item[],
  no: Item[],
  used: Set<string>,
  matrix: Matrix,
  rng: Rng,
  allowSecondDecoyTrap: boolean
): Guest[] | null {
  const guests: Guest[] = []
  const take = (from: Item[], ok: (item: Item) => boolean) => {
    const item = pick(
      from.filter((i) => !used.has(i.id) && ok(i)),
      rng
    )
    if (item) used.add(item.id)
    return item
  }
  // Definite on the decoy, or it isn't really a trap.
  const decoyPlaces = (item: Item) => placeOf(matrix.valueOf(item.id, decoy.rule.id), decoy.negated)

  const { decoyTraps, tButLooksWrong } = trapAllocation(MEDIUM_KNOBS)
  for (let n = 0; n < decoyTraps; n++) {
    const item = take(no, (i) => decoyPlaces(i) === true)
    if (!item) return null
    guests.push({ item, label: 'OUT', trapType: 'decoy' })
  }
  for (let n = 0; n < tButLooksWrong; n++) {
    const item = take(yes, (i) => decoyPlaces(i) === false)
    if (item) {
      guests.push({ item, label: 'IN', trapType: 't-but-looks-wrong' })
      continue
    }
    if (!allowSecondDecoyTrap) return null
    const second = take(no, (i) => decoyPlaces(i) === true)
    if (!second) return null
    guests.push({ item: second, label: 'OUT', trapType: 'decoy' })
  }

  const targetIn = pickWeighted(IN_COUNT_WEIGHTS, ([, weight]) => weight, rng)[0]
  while (guests.length < MEDIUM_KNOBS.poolSize) {
    const wantIn = guests.filter((g) => g.label === 'IN').length < targetIn
    let item = take(wantIn ? yes : no, () => true)
    let label: Label = wantIn ? 'IN' : 'OUT'
    if (!item) {
      item = take(wantIn ? no : yes, () => true)
      label = wantIn ? 'OUT' : 'IN'
    }
    if (!item) return null
    guests.push({ item, label, trapType: null })
  }
  return guests
}

/**
 * One full attempt at a board for this rule, or null. Phase 3's yield gate
 * counts exactly these: one call per eligible rule.
 */
export function buildBoard(
  trueRule: VisualRule,
  input: GeneratorInput,
  seed: number
): VisualCandidate | null {
  const rng = mulberry32(seed)
  const { matrix } = input
  // §4.5 step 2: null and untagged items on T are dropped here, before anything
  // else, so they can never reach the clues, the pool or a repair swap.
  const usable = input.items.filter((i) => !i.blocked)
  const yes = usable.filter((i) => matrix.valueOf(i.id, trueRule.id) === true)
  const no = usable.filter((i) => matrix.valueOf(i.id, trueRule.id) === false)
  const rivals = rivalReadings(trueRule, input)

  const [minDecoys, maxDecoys] = MEDIUM_KNOBS.targetSurvivingDecoyRange
  const distance = (n: number) =>
    n < minDecoys ? minDecoys - n : n > maxDecoys ? n - maxDecoys : 0
  let best: { clues: BoardItem[]; decoys: Reading[] } | null = null
  for (let attempt = 0; attempt < MAX_CLUE_ATTEMPTS; attempt++) {
    const clues = draftClues(yes, no, rng)
    const decoys = liveDecoys(clues, rivals, matrix)
    if (best === null || distance(decoys.length) < distance(best.decoys.length)) {
      best = { clues, decoys }
    }
    if (distance(decoys.length) === 0) break
  }
  // Zero decoys means zero traps: "apply the obvious rule to six things". Same hard gate as the word engine.
  if (best === null || best.decoys.length === 0) return null
  const { clues, decoys } = best

  let guests: Guest[] | null = null
  let used = new Set<string>()
  const order = shuffle(decoys, rng)
  // When every decoy is a superset of T, a looks-wrong guest can't exist, and the
  // decoy trap is what catches the broader theory: so if no decoy yields one, the
  // second pass takes a second decoy trap instead (product-owner decision 2026-10-04).
  for (const allowSecondDecoyTrap of [false, true]) {
    for (const decoy of order) {
      used = new Set(clues.map((c) => c.itemId))
      guests = buildPool(decoy, yes, no, used, matrix, rng, allowSecondDecoyTrap)
      if (guests) break
    }
    if (guests) break
  }
  if (!guests) return null

  // §4.5 step 6: validate, swapping one padding guest per collision.
  for (let attempt = 0; ; attempt++) {
    const board = [...clues, ...guests.map((g) => ({ itemId: g.item.id, label: g.label }))]
    const collision = rivals.find((r) => collides(board, r, matrix))
    if (!collision) break
    if (attempt === MAX_REPAIR_ATTEMPTS) return null

    const contradicts = (item: Item, label: Label) => {
      const place = placeOf(matrix.valueOf(item.id, collision.rule.id), collision.negated)
      return place !== null && place !== (label === 'IN')
    }
    let swapped = false
    for (const guest of shuffle(
      guests.filter((g) => g.trapType === null),
      rng
    )) {
      const replacement = pick(
        (guest.label === 'IN' ? yes : no).filter(
          (i) => !used.has(i.id) && contradicts(i, guest.label)
        ),
        rng
      )
      if (!replacement) continue
      used.add(replacement.id)
      guests = guests.map((g) => (g === guest ? { ...g, item: replacement } : g))
      swapped = true
      break
    }
    if (!swapped) return null
  }

  return {
    kind: 'visual',
    ruleId: trueRule.id,
    difficultyTier: 'medium',
    knobValues: MEDIUM_KNOBS,
    status: 'pending_approval',
    clues: clues.map((c, i) => ({ wordId: c.itemId, label: c.label, displayOrder: i })),
    guests: shuffle(guests, rng).map((g, i) => ({
      wordId: g.item.id,
      trueLabel: g.label,
      displayOrder: i,
      isTrap: g.trapType !== null,
      trapType: g.trapType,
    })),
    liveDecoys: decoys.map((d) => ({
      ruleId: d.rule.id,
      subtlety: 0,
      ...(d.negated ? { negated: true } : {}),
    })),
    generatorSeed: seed,
  }
}

/**
 * Picks rules (recently rejected ones less often, as pickTrueRule does) and
 * tries each once, up to MAX_RULE_ATTEMPTS different rules.
 */
export function generateVisualCandidate(
  input: GeneratorInput,
  seed: number
): VisualCandidate | null {
  const rng = mulberry32(seed)
  let pool = eligibleRules(input)
  for (let attempt = 0; attempt < MAX_RULE_ATTEMPTS && pool.length > 0; attempt++) {
    const rule = pickWeighted(pool, (r) => 1 / (1 + (input.rejectCounts.get(r.id) ?? 0)), rng)
    const candidate = buildBoard(rule, input, seed + attempt)
    if (candidate) return candidate
    pool = pool.filter((r) => r !== rule)
  }
  return null
}
