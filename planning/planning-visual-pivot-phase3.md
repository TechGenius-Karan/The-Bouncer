# Visual Pivot — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the seeded visual puzzle generator, which turns one rule plus the tagging matrix into a board no other rule fits (three-valued, both polarities), measure its yield on the tagged pilot, and teach scheduling about visual puzzles.

**Architecture:**
- **A separate generator** in `content-engine/visual/generator.ts`, built on true/false/null from the start (spec §3.2, Approach A). It follows the word engine's shape (rule → clues → decoy scan → trap pool → validate/repair) and reuses its `MEDIUM_KNOBS` and `trapAllocation`, but no word-engine logic is edited.
- **Deterministic.** Every random choice comes from a seeded PRNG, so a stored `generatorSeed` plus the rule id rebuilds the board exactly.
- **Scheduling.** `scheduling/placement.ts` spaces visual rules by family, and a `PUZZLE_KIND` switch makes `schedulePuzzles.ts` fill every date from one visual queue.

**Tech Stack:** TypeScript (strict, ESM, `.js` import extensions), Vitest 4, tsx.

**Spec:** [`planning-visual-pivot.md`](planning-visual-pivot.md). Phase 3 is §6, implementing §3.2 (separate engine), §3.4 (one knob set), §3.5 (rule uniqueness in generation), §4.4 (the three-valued check), §4.5 (the algorithm), §4.6 (determinism) and §5.4's scheduling part. Requires Phase 2 ([`planning-visual-pivot-phase2.md`](planning-visual-pivot-phase2.md)) to be complete.

## Global Constraints

- **Nothing existing is deleted, overwritten or renamed.**
  - The word engine (`content-engine/words/`, `rules/`, `generator/`) is not edited. Its types and `MEDIUM_KNOBS` / `trapAllocation` are *imported*.
  - The one shared ops file changed is `scheduling/placement.ts`, plus its script `scripts/schedulePuzzles.ts` (spec §3.1). The word path through both behaves exactly as before.
- **Branch:** keep working on the pivot branch, `visual-pivot-phase1` (draft PR #1). The whole pivot reaches `main` as one squash-merge: each Netlify production deploy costs 15 credits. Never commit to `main` directly.
- **Code style** (`.prettierrc`): no semicolons, single quotes, 2-space indent, trailing commas `es5`, 100-character lines. Run `npx prettier --write <files you changed>` before committing. The code below has already been through it.
- **Windows line endings:** Prettier rewrites CRLF to LF in the working copy, and git normalizes on commit. Use `git diff --ignore-cr-at-eol` to see real changes, and `git add` only the files a task names.
- **Node ESM:** every relative import in `content-engine/` ends in `.js`. The Vercel cron imports `content-engine/`, and an extensionless import fails there at runtime (CLAUDE.md).
- **TypeScript:** target/lib ES2020. Unused locals and parameters are errors. ESLint runs with `--max-warnings 0`.
- **Comments:** few, and only to record *why*.
- **Commits:** a short one-line message with **no** `Co-Authored-By` or `Claude-Session` trailer. Commit at the end of each task only if the user has okayed committing for this run.
- **No `Math.random` anywhere in `content-engine/visual/`.** Every random choice goes through the seeded `Rng`, or determinism (§4.6) silently breaks.
- **Knobs** (spec §3.4, §4.5):
  - 3 + 3 clues, 6 guests, 2 traps (1 decoy trap + 1 "fits but looks wrong"), a 2–3 live-decoy target.
  - IN-count weights 3:50, 4:20, 2:20, 5:5, 1:5.
  - ≤8 clue drafts, ≤5 repairs, ≤10 rules per candidate.
  - Stored as `difficultyTier: 'medium'`.

## File structure

| File | Responsibility |
|---|---|
| `content-engine/visual/random.ts` | `mulberry32`, and `shuffle` / `pick` / `pickWeighted` over it; `batchSeed` |
| `content-engine/visual/types.ts` (modify) | Adds `VisualDecoy`, `VisualCandidate` |
| `content-engine/visual/generator.ts` | Eligibility, rival readings, `collides` (§4.4), `liveDecoys`, `buildBoard`, `generateVisualCandidate` |
| `content-engine/visual/scripts/generateVisualBatch.ts` | Offline yield gate: one board per eligible rule, written to `content-engine/output/` |
| `content-engine/scheduling/placement.ts` (modify) | Family spacing for visual rules; `puzzleKindFrom`; `approvedQueueFilter` |
| `content-engine/scripts/schedulePuzzles.ts` (modify) | The visual single-queue path |
| `content-engine/visual/testWorld.ts` | A 60-item synthetic world for generator (and Phase 4 batch) tests |
| Tests: `random.test.ts`, `generator.test.ts`; additions to `scheduling/placement.test.ts` | |

`package.json` gains `content:generate-visual`.

---

### Task 1: Seeded randomness

**Files:**
- Create: `content-engine/visual/random.ts`
- Test: `content-engine/visual/random.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Rng = () => number`
  - `mulberry32(seed: number): Rng`
  - `shuffle<T>(items: readonly T[], rng: Rng): T[]`
  - `pick<T>(items: readonly T[], rng: Rng): T | undefined`
  - `pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T`
  - `batchSeed(date: string, index: number): number`

- [ ] **Step 1: Write the failing test**

`content-engine/visual/random.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { batchSeed, mulberry32, pick, pickWeighted, shuffle } from './random.js'

describe('mulberry32', () => {
  it('repeats exactly for the same seed and differs for another', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const c = mulberry32(43)
    const seqA = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(seqA)
    expect([c(), c(), c()]).not.toEqual(seqA)
  })

  it('stays in [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('helpers', () => {
  it('shuffle keeps every item and does not touch its input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, mulberry32(1))
    expect(input).toEqual([1, 2, 3, 4, 5])
    expect(out.slice().sort()).toEqual(input)
  })

  it('pick returns undefined for an empty list', () => {
    expect(pick([], mulberry32(1))).toBeUndefined()
  })

  it('pickWeighted follows the weights', () => {
    const rng = mulberry32(3)
    let heavy = 0
    for (let i = 0; i < 2000; i++)
      if (pickWeighted(['a', 'b'], (x) => (x === 'a' ? 9 : 1), rng) === 'a') heavy++
    expect(heavy).toBeGreaterThan(1700)
    expect(heavy).toBeLessThan(1900)
  })

  it('batchSeed is stable per date and index', () => {
    expect(batchSeed('2026-10-02', 3)).toBe(20261002003)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/random.test.ts`
Expected: FAIL, because `./random.js` doesn't exist.

- [ ] **Step 3: Write the module**

`content-engine/visual/random.ts`:
```ts
// Seeded randomness for the visual generator, so a stored `generatorSeed`
// reproduces its board (planning-visual-pivot.md §4.6). The word engine's
// random.ts uses Math.random and stays as it is.

export type Rng = () => number

/** mulberry32: small, fast, and good enough for shuffling a puzzle. Returns values in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Undefined for an empty list, so callers have to handle running out. */
export function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  return items.length === 0 ? undefined : items[Math.floor(rng() * items.length)]
}

/** Picks with probability proportional to weight. Every weight must be > 0. */
export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= weightOf(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

/** §4.6: the run date plus an index, so re-running a day's batch reproduces it. */
export function batchSeed(date: string, index: number): number {
  return Number(date.replace(/-/g, '')) * 1000 + index
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/random.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add content-engine/visual/random.ts content-engine/visual/random.test.ts
git commit -m "Add seeded randomness for the visual generator"
```

---

### Task 2: The visual generator

**Files:**
- Modify: `content-engine/visual/types.ts` (add an import line at the top, append two interfaces)
- Create: `content-engine/visual/generator.ts`
- Create: `content-engine/visual/testWorld.ts` (a test fixture, shared with Phase 4's batch tests)
- Test: `content-engine/visual/generator.test.ts`

**Interfaces:**
- Consumes:
  - `Matrix`, `buildMatrix`, `TagTable` (Phase 2 `matrix.ts`)
  - `countRule` (Phase 2 `report.ts`)
  - `Item`, `ItemGroup`, `Tri`, `VisualRule`
  - everything from Task 1
  - `MEDIUM_KNOBS`, `trapAllocation` (`generator/difficulty.ts`)
  - `ClueEntry`, `GuestEntry`, `KnobValues`, `Label`, `TrapType` (`generator/types.ts`)
- Produces (Phase 4 relies on these):
  - `interface VisualDecoy { ruleId: string; subtlety: 0; negated?: true }`
  - `interface VisualCandidate { kind: 'visual'; ruleId; difficultyTier: 'medium'; knobValues; status: 'pending_approval'; clues; guests; liveDecoys: VisualDecoy[]; generatorSeed: number }`
  - `interface GeneratorInput { items; rules; matrix; usedRuleIds: Set<string>; pendingRuleIds: Set<string>; rejectCounts: Map<string, number> }`
  - `interface Reading { rule: VisualRule; negated: boolean }` and `interface BoardItem { itemId: string; label: Label }`
  - `eligibleRules(input): VisualRule[]`
  - `rivalReadings(trueRule, input): Reading[]`
  - `collides(board: BoardItem[], reading: Reading, matrix): boolean`
  - `liveDecoys(clues: BoardItem[], rivals: Reading[], matrix): Reading[]`
  - `buildBoard(trueRule, input, seed): VisualCandidate | null`
  - `generateVisualCandidate(input, seed): VisualCandidate | null`

How the pieces map to spec §4.5:

| Step | Where | Rule |
|---|---|---|
| 1 Eligible rules | `eligibleRules` | Not used, not pending, not retired, ≥20 definite yes and no (`countRule`). Picked weighted by `1 / (1 + rejectCount)`. |
| 2 Candidate items | top of `buildBoard` | Only items exactly `true` or `false` on T. Null and untagged items are gone before anything else runs. |
| 3 Clues | `draftClues` | 3 IN + 3 OUT. If all 3 IN clues share a group and T's yes-set has another group, the third is swapped for one from that group. |
| 4 Decoy scan | `liveDecoys`, `rivalReadings` | Every other rule, **both polarities**. A reading is a decoy only if it's *definite and agreeing* on all 6 clues. Up to 8 drafts, keeping the closest to 2–3. Zero decoys → no board. |
| 5 Pool | `buildPool` | Decoy trap = T says OUT and the decoy says IN; the "fits but looks wrong" guest = T says IN and the decoy says OUT. Both must be **definite on the decoy**. If one decoy can't supply both traps, the next decoy is tried. Padding goes toward an IN count drawn from the weights. |
| 6 Validate / repair | `collides` + the repair loop | A reading collides unless some board item definitely contradicts it (**null counts as could-agree**). On a collision, one padding guest is swapped for an unused item with the same T label that definitely contradicts the rival. Up to 5 swaps. |
| 7 Emit | end of `buildBoard` | `kind: 'visual'`, `difficultyTier: 'medium'`, `MEDIUM_KNOBS`, `generatorSeed`. A negated decoy is stored with `negated: true`, so the reviewer sees "NOT …". |

**One decision the spec leaves open:** a rule with **no definite answer on any item** (written but never tagged) is left out of the rivals. Under §4.4's conservative rule, such a rule collides with every board, so writing one new rule would stop all generation until it was tagged. Every rule with at least one definite answer is a rival, retired and too-thin rules included, because a player can still think of them.

- [ ] **Step 1: Write the fixture and the failing test**

`content-engine/visual/testWorld.ts` (no `.test` suffix, so Vitest doesn't run it as a suite; same idea as `generator/testUtils.ts`):
```ts
import type { GeneratorInput } from './generator.js'
import { buildMatrix, type TagTable } from './matrix.js'
import type { Item, ItemGroup, VisualRule } from './types.js'

// A synthetic world for the generator and batch tests: 60 items, i0 … i59,
// with rules defined by index so the expected answers are easy to reason about.
const GROUPS: ItemGroup[] = ['thing', 'food', 'vehicle', 'animal', 'plant']
export const ITEMS: Item[] = Array.from({ length: 60 }, (_, n) => ({
  id: `i${n}`,
  name: `item ${n}`,
  group: GROUPS[n % 5],
  icon: { set: 'openmoji', hex: '2693' },
}))

export const rule = (id: string): VisualRule => ({
  id,
  family: 'physical',
  reveal: 'It is a thing.',
})

/** Tags every item by `test`, except the listed ones: unsure, or left untagged. */
export function tags(
  test: (n: number) => boolean,
  { unsure = [] as number[], untagged = [] as number[] } = {}
) {
  const row = { yes: [] as string[], no: [] as string[], unsure: [] as string[] }
  ITEMS.forEach((_, n) => {
    if (untagged.includes(n)) return
    if (unsure.includes(n)) row.unsure.push(`i${n}`)
    else (test(n) ? row.yes : row.no).push(`i${n}`)
  })
  return { yes: row.yes.join(' '), no: row.no.join(' '), unsure: row.unsure.join(' ') }
}

export const even = (n: number) => n % 2 === 0
// T: even numbers. i0, i1 are unsure and i2, i3 untagged, so none of them may ever appear.
export const NULL_ON_T = new Set(['i0', 'i1', 'i2', 'i3'])
export const TABLE: TagTable = {
  'visual-t': tags(even, { unsure: [0, 1], untagged: [2, 3] }),
  // Near-copies of T and of its inverse: these are what fit the clues as decoys.
  'visual-near-7': tags((n) => even(n) !== (n % 7 === 0)),
  'visual-near-11': tags((n) => even(n) !== (n % 11 === 0)),
  'visual-inverse-13': tags((n) => !even(n) !== (n % 13 === 0)),
  // Unrelated rivals the board still has to rule out.
  'visual-thirds': tags((n) => n % 3 === 0),
  'visual-low': tags((n) => n < 30),
  // Same split as T, used only by the rule-exclusion tests.
  'visual-t2': tags((n) => n % 4 < 2),
}
export const RULES = [...Object.keys(TABLE), 'visual-untagged'].map(rule)
export const T = RULES[0]

export const worldInput = (extra: Partial<GeneratorInput> = {}): GeneratorInput => ({
  items: ITEMS,
  rules: RULES,
  matrix: buildMatrix(TABLE, {}),
  usedRuleIds: new Set(),
  pendingRuleIds: new Set(),
  rejectCounts: new Map(),
  ...extra,
})
```

`content-engine/visual/generator.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  buildBoard,
  collides,
  eligibleRules,
  generateVisualCandidate,
  liveDecoys,
  rivalReadings,
} from './generator.js'
import { buildMatrix } from './matrix.js'
import { even, ITEMS, NULL_ON_T, RULES, rule, T, TABLE, tags, worldInput } from './testWorld.js'
import type { VisualCandidate } from './types.js'

const boardOf = (c: VisualCandidate) => [
  ...c.clues.map((x) => ({ itemId: x.wordId, label: x.label })),
  ...c.guests.map((g) => ({ itemId: g.wordId, label: g.trueLabel })),
]

const SEEDS = Array.from({ length: 200 }, (_, n) => n + 1)
const boards = SEEDS.map((seed) => buildBoard(T, worldInput(), seed)).filter(
  (c): c is VisualCandidate => c !== null
)

describe('collides (§4.4)', () => {
  const matrix = buildMatrix(
    { 'visual-r': { yes: 'a b', no: 'c', unsure: 'd' }, 'visual-blank': { unsure: 'a b c d' } },
    {}
  )
  const r = { rule: rule('visual-r'), negated: false }
  const board = [
    { itemId: 'a', label: 'IN' as const },
    { itemId: 'b', label: 'IN' as const },
    { itemId: 'c', label: 'OUT' as const },
  ]

  it('is a collision when the rival agrees everywhere it is definite, even with a null item', () => {
    expect(collides([...board, { itemId: 'd', label: 'OUT' }], r, matrix)).toBe(true)
  })

  it('is not a collision once one item definitely contradicts the rival', () => {
    expect(collides([...board, { itemId: 'b', label: 'OUT' }], r, matrix)).toBe(false)
  })

  it('catches a rival that matches the board inverted', () => {
    const inverted = board.map((b) => ({ ...b, label: b.label === 'IN' ? 'OUT' : 'IN' }) as const)
    expect(collides(inverted, r, matrix)).toBe(false)
    expect(collides(inverted, { ...r, negated: true }, matrix)).toBe(true)
  })

  it('counts a rival that is null on every item as a collision', () => {
    expect(collides(board, { rule: rule('visual-blank'), negated: false }, matrix)).toBe(true)
  })
})

describe('liveDecoys (§4.5 step 4)', () => {
  it('needs a definite agreeing answer on every clue, unlike collides', () => {
    const matrix = buildMatrix({ 'visual-r': { yes: 'a', no: 'c', unsure: 'b' } }, {})
    const r = { rule: rule('visual-r'), negated: false }
    const clues = [
      { itemId: 'a', label: 'IN' as const },
      { itemId: 'b', label: 'IN' as const },
      { itemId: 'c', label: 'OUT' as const },
    ]
    expect(liveDecoys(clues, [r], matrix)).toEqual([])
    expect(collides(clues, r, matrix)).toBe(true)
  })
})

describe('rivalReadings', () => {
  it('leaves out T itself and any rule nobody has tagged, and reads the rest both ways', () => {
    const ids = rivalReadings(T, worldInput()).map((r) => `${r.negated ? '!' : ''}${r.rule.id}`)
    expect(ids).not.toContain('visual-t')
    expect(ids).not.toContain('visual-untagged')
    expect(ids).toContain('visual-low')
    expect(ids).toContain('!visual-low')
  })
})

describe('buildBoard', () => {
  it('builds boards for most seeds', () => {
    expect(boards.length).toBeGreaterThan(SEEDS.length / 2)
  })

  it('never puts an item that is null or untagged on T on the board', () => {
    for (const c of boards) for (const b of boardOf(c)) expect(NULL_ON_T.has(b.itemId)).toBe(false)
  })

  it('labels every item by T and repeats none', () => {
    for (const c of boards) {
      const board = boardOf(c)
      expect(new Set(board.map((b) => b.itemId)).size).toBe(12)
      for (const b of board) expect(even(Number(b.itemId.slice(1)))).toBe(b.label === 'IN')
    }
  })

  it('leaves no rival reading that fits the whole board', () => {
    const rivals = rivalReadings(T, worldInput())
    const matrix = worldInput().matrix
    for (const c of boards) {
      expect(rivals.filter((r) => collides(boardOf(c), r, matrix))).toEqual([])
    }
  })

  it('has 2-3 live decoys, and traps that are definite on one of them', () => {
    const matrix = worldInput().matrix
    const placeOn = (itemId: string, d: VisualCandidate['liveDecoys'][number]) => {
      const v = matrix.valueOf(itemId, d.ruleId)
      return v === null ? null : v !== (d.negated === true)
    }
    for (const c of boards) {
      expect(c.liveDecoys.length).toBeGreaterThanOrEqual(1)
      const decoyTrap = c.guests.find((g) => g.trapType === 'decoy')!
      const looksWrong = c.guests.find((g) => g.trapType === 't-but-looks-wrong')!
      expect(decoyTrap.trueLabel).toBe('OUT')
      expect(looksWrong.trueLabel).toBe('IN')
      expect(
        c.liveDecoys.some(
          (d) => placeOn(decoyTrap.wordId, d) === true && placeOn(looksWrong.wordId, d) === false
        )
      ).toBe(true)
    }
    const onTarget = boards.filter((c) => c.liveDecoys.length >= 2 && c.liveDecoys.length <= 3)
    expect(onTarget.length).toBeGreaterThan(boards.length / 2)
  })

  it('spreads the IN clues over at least two groups', () => {
    for (const c of boards) {
      const groups = c.clues
        .filter((x) => x.label === 'IN')
        .map((x) => ITEMS.find((i) => i.id === x.wordId)!.group)
      expect(new Set(groups).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('emits the stored shape: 3 + 3 clues, 6 guests, kind, tier and seed', () => {
    const c = boards[0]
    expect(c.kind).toBe('visual')
    expect(c.difficultyTier).toBe('medium')
    expect(c.status).toBe('pending_approval')
    expect(c.clues.map((x) => x.label)).toEqual(['IN', 'IN', 'IN', 'OUT', 'OUT', 'OUT'])
    expect(c.guests.map((g) => g.displayOrder)).toEqual([0, 1, 2, 3, 4, 5])
    expect(c.guests.filter((g) => g.isTrap)).toHaveLength(2)
    expect(buildBoard(T, worldInput(), c.generatorSeed)).toEqual(c)
  })

  it('returns null when no rival fits the clues', () => {
    // Yes on everything: it can never agree with an OUT clue, nor inverted with an IN one.
    const lonely = worldInput({
      rules: [T, rule('visual-all')],
      matrix: buildMatrix({ ...TABLE, 'visual-all': tags(() => true) }, {}),
    })
    expect(SEEDS.slice(0, 20).map((s) => buildBoard(T, lonely, s))).toEqual(Array(20).fill(null))
  })
})

describe('generateVisualCandidate', () => {
  it('is deterministic per seed', () => {
    expect(generateVisualCandidate(worldInput(), 7)).toEqual(
      generateVisualCandidate(worldInput(), 7)
    )
    expect(generateVisualCandidate(worldInput(), 7)).not.toEqual(
      generateVisualCandidate(worldInput(), 8)
    )
  })

  it('never drafts a used or pending rule', () => {
    const blocked = worldInput({
      usedRuleIds: new Set(['visual-t']),
      pendingRuleIds: new Set(['visual-t2']),
    })
    expect(eligibleRules(blocked).map((r) => r.id)).not.toContain('visual-t')
    expect(eligibleRules(blocked).map((r) => r.id)).not.toContain('visual-t2')
    for (const seed of SEEDS.slice(0, 50)) {
      const c = generateVisualCandidate(blocked, seed)
      if (c) expect(['visual-t', 'visual-t2']).not.toContain(c.ruleId)
    }
  })

  it('returns null when every rule is spent', () => {
    const spent = worldInput({ usedRuleIds: new Set(RULES.map((r) => r.id)) })
    expect(generateVisualCandidate(spent, 1)).toBeNull()
  })
})
```

Why this fixture: the "near" rivals agree with T except on every 7th / 11th / 13th item, so they fit most clue sets as decoys, and the items where they differ are exactly the traps. That makes "the generator found a trap" and "the board rules the decoy out" testable on every seed.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/generator.test.ts`
Expected: FAIL, because `./generator.js` doesn't exist.

- [ ] **Step 3: Add the candidate types**

At the top of `content-engine/visual/types.ts`, add:
```ts
import type { ClueEntry, GuestEntry, KnobValues } from '../generator/types.js'

```
and append:
```ts
/** A rival rule that still fits the clues on their own (§4.5 step 4). */
export interface VisualDecoy {
  ruleId: string
  /** Visual rules have no subtlety (D7); 0 keeps the stored DecoyResult shape. */
  subtlety: 0
  /** It fits read the other way round: IN = the rule is false. */
  negated?: true
}

/** What the visual generator emits (§4.5 step 7). Item ids sit in the `wordId` fields (§3.3). */
export interface VisualCandidate {
  kind: 'visual'
  ruleId: string
  /** Stored as medium so the shared typed fields keep working; visual paths ignore it (§3.4). */
  difficultyTier: 'medium'
  knobValues: KnobValues
  status: 'pending_approval'
  clues: ClueEntry[]
  guests: GuestEntry[]
  liveDecoys: VisualDecoy[]
  generatorSeed: number
}
```

`VisualDecoy` deliberately doesn't extend the word engine's `DecoyResult`, whose `subtlety` is typed 1–5. It is still assignable to the backend's `DecoyResult` (`subtlety: number`), so it stores in `PuzzleDoc.liveDecoys` unchanged.

- [ ] **Step 4: Write the generator**

`content-engine/visual/generator.ts`:
```ts
import { MEDIUM_KNOBS, trapAllocation } from '../generator/difficulty.js'
import type { Label, TrapType } from '../generator/types.js'
import type { Matrix } from './matrix.js'
import { mulberry32, pick, pickWeighted, shuffle, type Rng } from './random.js'
import { countRule } from './report.js'
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

/**
 * Every rule other than T, both ways round, that someone has tagged. Retired
 * and too-thin rules stay in: a player can still think of them. A rule with no
 * definite answer at all is left out until it is tagged — otherwise one newly
 * written rule would collide with every board (§4.4) and stop generation.
 */
export function rivalReadings(trueRule: VisualRule, input: GeneratorInput): Reading[] {
  const usable = input.items.filter((i) => !i.blocked)
  return input.rules
    .filter(
      (r) => r.id !== trueRule.id && usable.some((i) => input.matrix.valueOf(i.id, r.id) !== null)
    )
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

/** §4.5 step 5: one decoy trap, one "fits but looks wrong" guest, then padding toward a drawn IN count. */
function buildPool(
  decoy: Reading,
  yes: Item[],
  no: Item[],
  used: Set<string>,
  matrix: Matrix,
  rng: Rng
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
    if (!item) return null
    guests.push({ item, label: 'IN', trapType: 't-but-looks-wrong' })
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
  for (const decoy of shuffle(decoys, rng)) {
    used = new Set(clues.map((c) => c.itemId))
    guests = buildPool(decoy, yes, no, used, matrix, rng)
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/generator.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 6: Check that the tests guard the two core rules**

These two edits must each make tests fail. Make each one, run the file, then undo it (`git checkout -- content-engine/visual/generator.ts` once the file is committed, or reverse the edit by hand):
1. In `collides`, change `return place !== null && place !== (b.label === 'IN')` to `return place !== (b.label === 'IN')`.
   Expected: 3 failures, including "is a collision when the rival agrees everywhere it is definite, even with a null item".
2. In `buildBoard`, change `matrix.valueOf(i.id, trueRule.id) === false)` to `matrix.valueOf(i.id, trueRule.id) !== true)`.
   Expected: 2 failures, including "never puts an item that is null or untagged on T on the board".

Both were run while writing this plan.

- [ ] **Step 7: Commit**

```bash
git add content-engine/visual/types.ts content-engine/visual/generator.ts content-engine/visual/generator.test.ts content-engine/visual/testWorld.ts
git commit -m "Add the seeded three-valued visual puzzle generator"
```

---

### Task 3: The offline yield script

**Files:**
- Create: `content-engine/visual/scripts/generateVisualBatch.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `buildBoard`, `eligibleRules`, `GeneratorInput` (Task 2); `batchSeed` (Task 1); `ITEMS`, `VISUAL_RULES`, `MATRIX`.
- Produces: `npm run content:generate-visual`. It writes `content-engine/output/visual-candidates.{json,md}` (gitignored), prints the yield, and exits 1 below 75%.

Yield is measured **per rule**, one `buildBoard` call each (spec §6 Phase 3 exit), because each rule can be drafted only once. The script reads no database, so every rule counts as unused.

- [ ] **Step 1: Write the script**

`content-engine/visual/scripts/generateVisualBatch.ts`:
```ts
// Phase 3's yield gate (planning-visual-pivot.md §6): one board attempt per
// eligible rule, written to content-engine/output/ for reading through.
// Offline: nothing is queued and no database is read, so every rule counts as
// unused. Yield = rules that produced a board / eligible rules.
// Run with: npm run content:generate-visual

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildBoard, eligibleRules, type GeneratorInput } from '../generator.js'
import { ITEMS } from '../items.js'
import { batchSeed } from '../random.js'
import { VISUAL_RULES } from '../rules.js'
import { MATRIX } from '../tags/index.js'
import type { VisualCandidate } from '../types.js'

const YIELD_GATE = 0.75
const OUTPUT_DIR = join(process.cwd(), 'content-engine', 'output')
const today = new Date().toISOString().slice(0, 10)

const input: GeneratorInput = {
  items: ITEMS,
  rules: VISUAL_RULES,
  matrix: MATRIX,
  usedRuleIds: new Set(),
  pendingRuleIds: new Set(),
  rejectCounts: new Map(),
}
const nameOf = new Map(ITEMS.map((i) => [i.id, i.name]))
const revealOf = new Map(VISUAL_RULES.map((r) => [r.id, r.reveal]))

const rules = eligibleRules(input)
const boards: VisualCandidate[] = []
const failed: string[] = []
rules.forEach((rule, index) => {
  const board = buildBoard(rule, input, batchSeed(today, index))
  if (board) boards.push(board)
  else failed.push(rule.id)
})

function describe(c: VisualCandidate, index: number): string {
  const clues = (label: 'IN' | 'OUT') =>
    c.clues
      .filter((x) => x.label === label)
      .map((x) => nameOf.get(x.wordId))
      .join(', ')
  const decoys = c.liveDecoys.map((d) => `${d.negated ? 'NOT ' : ''}${revealOf.get(d.ruleId)}`)
  return [
    `### ${index + 1}. ${revealOf.get(c.ruleId)} (${c.ruleId}, seed ${c.generatorSeed})`,
    `Clues — IN: ${clues('IN')} | OUT: ${clues('OUT')}`,
    `Live decoys after clues: ${decoys.join('; ')}`,
    'Pool:',
    ...c.guests.map(
      (g) =>
        `  - ${nameOf.get(g.wordId)} — ${g.trueLabel}${g.trapType ? ` [${g.trapType} trap]` : ''}`
    ),
  ].join('\n')
}

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(join(OUTPUT_DIR, 'visual-candidates.json'), JSON.stringify(boards, null, 2))
writeFileSync(
  join(OUTPUT_DIR, 'visual-candidates.md'),
  [
    `# Visual boards — ${boards.length} of ${rules.length} eligible rules`,
    '',
    ...boards.map(describe),
  ].join('\n\n')
)

const share = rules.length === 0 ? 0 : boards.length / rules.length
console.log(
  `Yield: ${boards.length}/${rules.length} eligible rules produced a board ` +
    `(${Math.round(share * 100)}%; the gate is ${YIELD_GATE * 100}%).`
)
if (failed.length > 0) console.log(`No board: ${failed.join(', ')}`)
console.log(`Written to ${join(OUTPUT_DIR, 'visual-candidates.md')} (and .json)`)
if (share < YIELD_GATE) process.exit(1)
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after the `"content:seed-visual"` line, add:
```json
    "content:generate-visual": "tsx content-engine/visual/scripts/generateVisualBatch.ts",
```

- [ ] **Step 3: Typecheck, lint and run**

Run: `npm run typecheck:content-engine && npx eslint content-engine/visual --ext ts --max-warnings 0 && npm run content:generate-visual`
Expected: clean checks. The yield line depends on the Phase 2 tags. With an untagged matrix it reads `Yield: 0/0 …` and exits 1, which is correct.

- [ ] **Step 4: Commit**

```bash
git add content-engine/visual/scripts/generateVisualBatch.ts package.json
git commit -m "Add the offline visual yield script"
```

---

### Task 4: Visual scheduling

**Files:**
- Modify: `content-engine/scheduling/placement.ts`
- Modify: `content-engine/scripts/schedulePuzzles.ts`
- Test: `content-engine/scheduling/placement.test.ts` (add one `describe` block)

**Interfaces:**
- Consumes: `VISUAL_RULES` (Phase 2).
- Produces (Phase 4 uses both, for buffer health and the cron):
  - `type PuzzleKind = 'word' | 'visual'`
  - `puzzleKindFrom(value: string | undefined): PuzzleKind`
  - `approvedQueueFilter(kind: PuzzleKind, tier: 'medium' | 'spicy')`, the Mongo filter for one approved, unscheduled queue

**Why the queue filter matters:** visual puzzles are stored with `difficultyTier: 'medium'` (§3.4). Today's word queue is `{ status: 'approved', date: null, difficultyTier: 'medium' }`, so without a `kind` condition the word scheduler would place an approved visual puzzle on a word day. The word filter therefore gains `kind: { $ne: 'visual' }`. It matches every existing document, because none of them has `kind`.

- [ ] **Step 1: Write the failing tests**

In `content-engine/scheduling/placement.test.ts`:
- add `approvedQueueFilter,` as the first name in the import from `'./placement.js'`
- add `puzzleKindFrom,` after `MAX_FILLER_PER_WEEK,`
- append:
```ts
// planning-visual-pivot.md §5.4
describe('visual scheduling', () => {
  const at = (date: string, ruleId: string): Placement => ({ date, ruleId, isFiller: false })

  it('keeps two rules from one visual family at least 3 days apart', () => {
    const placed = [at('2026-11-01', 'visual-has-a-handle')]
    expect(isFreshFor('2026-11-03', { ruleId: 'visual-has-legs' }, placed)).toBe(false)
    expect(isFreshFor('2026-11-04', { ruleId: 'visual-has-legs' }, placed)).toBe(true)
  })

  it('does not space rules from different visual families', () => {
    const placed = [at('2026-11-01', 'visual-has-a-handle')]
    expect(isFreshFor('2026-11-02', { ruleId: 'visual-floats' }, placed)).toBe(true)
  })

  it('never treats a visual rule as filler', () => {
    expect(isFillerRule('visual-has-a-handle')).toBe(false)
  })

  it('reads PUZZLE_KIND, defaulting to word', () => {
    expect(puzzleKindFrom('visual')).toBe('visual')
    expect(puzzleKindFrom(undefined)).toBe('word')
    expect(puzzleKindFrom('Visual')).toBe('word')
  })

  it('fills every visual date from one queue, and keeps visual puzzles out of the word queues', () => {
    expect(approvedQueueFilter('visual', 'spicy')).toEqual(approvedQueueFilter('visual', 'medium'))
    expect(approvedQueueFilter('visual', 'medium')).toMatchObject({ kind: 'visual' })
    expect(approvedQueueFilter('word', 'medium')).toMatchObject({
      difficultyTier: 'medium',
      kind: { $ne: 'visual' },
    })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run content-engine/scheduling/placement.test.ts`
Expected: FAIL. `approvedQueueFilter` and `puzzleKindFrom` aren't exported, and the 3-day family test fails because visual rules aren't spaced yet.

- [ ] **Step 3: Space visual rules by family**

In `content-engine/scheduling/placement.ts`, add after the `RULES` import:
```ts
import { VISUAL_RULES } from '../visual/rules.js'
```
Replace:
```ts
 * spaced, the same fail-open `isFillerRule` already takes.
 */
const MECHANIC_BY_RULE_ID = new Map(RULES.map((rule) => [rule.id, rule.mechanic]))
```
with:
```ts
 * spaced, the same fail-open `isFillerRule` already takes.
 *
 * A visual rule's family plays the same part: "has a handle" and "has wheels"
 * are one trick to a player (planning-visual-pivot.md §5.4). Visual rules never
 * trip rule spacing, since each one runs once ever.
 */
const MECHANIC_BY_RULE_ID = new Map<string, string>([
  ...RULES.map((rule): [string, string] => [rule.id, rule.mechanic]),
  ...VISUAL_RULES.map((rule): [string, string] => [rule.id, `visual:${rule.family}`]),
])
```
`MECHANIC_SPACING_DAYS` is already 3, which is the spacing spec §5.4 asks for. Visual rules aren't in `AHA_BY_RULE_ID`, so `isFillerRule` is false for them and the filler cap never applies.

- [ ] **Step 4: Add the kind switch and the queue filter**

Append to `content-engine/scheduling/placement.ts`:
```ts
export type PuzzleKind = 'word' | 'visual'

/** `PUZZLE_KIND` (planning-visual-pivot.md §3.3). Unset means word, so deploying changes nothing. */
export function puzzleKindFrom(value: string | undefined): PuzzleKind {
  return value === 'visual' ? 'visual' : 'word'
}

/**
 * The approved, unscheduled queue a date draws from. Word days keep the
 * medium / Spicy Saturday calendar. Visual has one difficulty (D7), so every
 * date takes from the single visual queue. Visual puzzles are stored as medium
 * (§3.4), so the word queues must exclude them, or an approved visual puzzle
 * would be scheduled onto a word day.
 */
export function approvedQueueFilter(kind: PuzzleKind, tier: 'medium' | 'spicy') {
  return kind === 'visual'
    ? ({ status: 'approved', date: null, kind: 'visual' } as const)
    : ({ status: 'approved', date: null, difficultyTier: tier, kind: { $ne: 'visual' } } as const)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run content-engine/scheduling/placement.test.ts`
Expected: PASS (24 tests: 19 existing + 5 new).

- [ ] **Step 6: Use them in the schedule script**

In `content-engine/scripts/schedulePuzzles.ts`:

(a) Add `approvedQueueFilter,` and `puzzleKindFrom,` to the import from `'../scheduling/placement.js'`, which becomes:
```ts
import {
  approvedQueueFilter,
  isFillerRule,
  MAX_FILLER_PER_WEEK,
  puzzleKindFrom,
  selectForDate,
  type Placement,
} from '../scheduling/placement.js'
```

(b) After `const START_DATE = …`, add:
```ts
// Under PUZZLE_KIND=visual every date fills from one visual queue (planning-visual-pivot.md §5.4).
const KIND = puzzleKindFrom(process.env.PUZZLE_KIND)
```

(c) Replace the two queue queries:
```ts
  const mediumQueue = await puzzles
    .find({ status: 'approved', date: null, difficultyTier: 'medium' })
    .sort({ createdAt: 1 })
    .toArray()
  const spicyQueue = await puzzles
    .find({ status: 'approved', date: null, difficultyTier: 'spicy' })
    .sort({ createdAt: 1 })
    .toArray()
```
with:
```ts
  const mediumQueue = await puzzles
    .find(approvedQueueFilter(KIND, 'medium'))
    .sort({ createdAt: 1 })
    .toArray()
  const spicyQueue =
    KIND === 'visual'
      ? []
      : await puzzles.find(approvedQueueFilter(KIND, 'spicy')).sort({ createdAt: 1 }).toArray()
```

(d) Replace:
```ts
    const tier: PuzzleDoc['difficultyTier'] = isSaturday(cursor) ? 'spicy' : 'medium'
```
with:
```ts
    const tier: PuzzleDoc['difficultyTier'] =
      KIND === 'word' && isSaturday(cursor) ? 'spicy' : 'medium'
```

(e) In the "No approved … puzzle available" warning, replace `No approved ${tier} puzzle` with `No approved ${KIND === 'visual' ? 'visual' : tier} puzzle`.

(f) Replace:
```ts
    console.log(`Puzzle #${number} (${candidate.difficultyTier}) -> ${date}`)
```
with:
```ts
    console.log(`Puzzle #${number} (${candidate.kind ?? candidate.difficultyTier}) -> ${date}`)
```

- [ ] **Step 7: Run every check**

Run: `npm run typecheck:content-engine && npm run lint && npm test`
Expected: all clean. The suite is 661 tests (633 after Phase 2, plus 6 + 17 + 5).

- [ ] **Step 8: Commit**

```bash
git add content-engine/scheduling/placement.ts content-engine/scheduling/placement.test.ts content-engine/scripts/schedulePuzzles.ts
git commit -m "Space visual rules by family and schedule visual puzzles from one queue"
```

---

### Task 5: Measure the yield on the tagged pilot (go/no-go gate)

This is the Phase 3 exit (spec §6): **yield ≥75%**, the signal for scaling content to ~600 items × ~500 rules.

- [ ] **Step 1: Run the gate**

Run: `npm run content:generate-visual`
Expected: `Yield: <boards>/<eligible> …` at or above 75%, with exit code 0.

- [ ] **Step 2: Read the boards**

Open `content-engine/output/visual-candidates.md`. For at least 10 boards, check four things:
- Every caption's label is right under the reveal sentence.
- The decoy trap really does fit the decoy.
- The board doesn't read as some *other* obvious idea that isn't in the taxonomy (spec §7, first risk).
- The IN clues aren't all one kind of thing.

Each bad tag found becomes an override line (Phase 2, Task 7, Step 4). Re-run Step 1 after changing tags.

- [ ] **Step 3: If the yield is below 75%**

Read the `No board:` list. Typical causes, and what to do about each:
- **A rule with no live decoys.** Its yes-set is too unlike every other rule. Add a nearby rule, or accept a lower yield for that family.
- **Repairs exhausted.** Correlated rules (spec §7: metal ⇒ conducts ⇒ sinks), or too many `unsure` cells on the rivals. Tighten tags with overrides.
- **The pilot is simply too small.** Measure again after the first content build-out batch, and don't scale past it until the gate passes.

Don't relax the null-as-agree rule or the knobs to pass the gate. Those are the correctness guarantee.

- [ ] **Step 4: Mark Phase 3 done in the spec**

In `planning-visual-pivot.md` §6, under Phase 3, add: `**Status:** done YYYY-MM-DD (yield <boards>/<eligible> = <pct>%).`

- [ ] **Step 5: Commit**

```bash
git add planning-visual-pivot.md planning-visual-pivot-phase3.md content-engine/visual/tags
git commit -m "Record the Phase 3 visual yield"
```

---

## Self-review against the spec

| Spec requirement (planning-visual-pivot.md) | Task |
|---|---|
| §3.1 `random.ts` (mulberry32 + shuffle/pickWeighted), `generator.ts`, `generateVisualBatch` | 1, 2, 3 |
| §3.2 a separate engine, reusing `MEDIUM_KNOBS`, `trapAllocation` and the copied IN-count table | 2 |
| §3.4 one knob set, stored as `difficultyTier: 'medium'` | 2 |
| §3.5 generation never drafts a used or pending rule | 2 (`eligibleRules`; test "never drafts a used or pending rule") |
| §4.4 null = could-agree, both polarities, all-null rival collides | 2 (`collides`, 4 unit tests, mutation check) |
| §4.5 steps 1–7, including null removal before clues, ≥2 groups, definite traps, zero-decoy gate, ≤5 repairs | 2 |
| §4.6 same seed → same candidate; `generatorSeed` stored; batch seeds from date + index | 1 (`batchSeed`), 2 (determinism tests) |
| §5.4 family spacing (3 days); rule spacing never triggers; single visual queue | 4 |
| §6 Phase 3 tests: null exclusion, collision cases, pool shape, rule exclusion, determinism, placement | 2, 4 |
| §6 Phase 3 exit: yield ≥75%, per rule | 3, 5 |
| Global: word engine untouched; nothing deleted | all tasks |

**Left for Phase 4a, by design:** filling `usedRuleIds`, `pendingRuleIds` and `rejectCounts` from Mongo, the cron and admin entry points, and approval's uniqueness refusal. Phase 3 defines the contract (`GeneratorInput`); Phase 4a supplies it from the database.

## Changes made during execution

- **F1 (final review):** the yield gate is reproducible: 20 attempts per eligible rule on fixed seeds 1..20 (no `new Date()`/`batchSeed`); yield = boards / (rules × 20), coverage = rules with a board / rules; one board per rule written out; exit 1 below 75%.
- **F2 (final review):** `VisualRule.mergedInto` on the three retired duplicates; one shared `isRivalOf` in `report.ts` (used by `rivalReadings`) skips a retired rule as a rival of what it merged into; `unavoidableRivals` marks unshippable rules, which `buildMatrixReport` lists and leaves out of the runway; `visual:report` prints them and warns about partly tagged rules.
- **F3 (final review):** when no decoy yields a "fits but looks wrong" guest, the pool takes a second decoy trap instead (owner decision 2026-10-04); a first pass still prefers a looks-wrong guest from any decoy, so earlier boards are unchanged.
- **Minor:** the decoy/trap test is renamed to what it asserts (at least one live decoy; traps definite on a decoy).
- **Minor:** a new test checks the IN-guest count varies (≥3 values) with 3 the most common.
