# Visual Pivot — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the pilot rule taxonomy (51 rules across all 11 families), store a three-valued tagging matrix for it, draft the matrix with Gemini (three passes, unanimity or `unsure`), report which rules are usable, and load items and rules into MongoDB.

**Architecture:**
- **New code:** all of it lives in `content-engine/visual/`, next to Phase 1's item bank. Pure modules hold the logic: the rule list, the matrix, the tagging prompt and consensus, and the report. Thin `tsx` scripts wrap them for the network and database parts, the same testable-core / thin-wrapper split as `words/aiTagging.ts` + `scripts/tagWordsAi.ts`.
- **Tags as data files:** one generated AI file and one human override file per family under `tags/`. A human answer always wins over the AI's, and the tagger never writes override files.
- **Backend:** additive types only. `PuzzleDoc` gains `kind?` and `generatorSeed?`. A new `VisualItemDoc` type and `visualItems` collection handle are added to both `lib/` and `netlify/functions/_shared/`. No endpoint changes in this phase.

**Tech Stack:** TypeScript (strict, ESM, `.js` import extensions), Vitest 4 (node environment), tsx for scripts, `@google/genai` (already a dependency), MongoDB driver 7.

**Spec:** [`planning-visual-pivot.md`](planning-visual-pivot.md). Phase 2 is §6, implementing §4.1 (rule families), §4.2 (matrix storage and semantics), §4.3 (tagging pipeline), §3.5's permanent-id rule and §5.3's Mongo additions. Decisions D3 (AI draft + human review), D6 (unique rules), D7 (no subtlety) and D8 (atomic rules in families) apply.

## Global Constraints

- **Nothing existing is deleted, overwritten or renamed.** The word engine (`content-engine/words/`, `rules/`, `generator/`) is not touched. `seedDatabase.ts` is not touched. Every Mongo write is an upsert.
- **Branch:** keep working on the pivot branch, `visual-pivot-phase1` (draft PR #1), so the whole pivot reaches `main` as one squash-merge and one Netlify production deploy (15 credits each; see `bouncer_netlify_credits` memory). Never commit to `main` directly, and don't merge this phase to `main` on its own.
- **Code style** (`.prettierrc`): no semicolons, single quotes, 2-space indent, trailing commas `es5`, 100-character lines. `npm run format` only covers `src/`. Run `npx prettier --write <files you changed>` before committing. The code below has already been through it.
- **Windows line endings:** with `core.autocrlf=true`, Prettier rewrites CRLF to LF in the working copy, and untouched files then show as modified. Git normalizes them on commit. Use `git diff --ignore-cr-at-eol` to see real changes, and only `git add` the files a task names.
- **Node ESM:** every relative import in `content-engine/`, `api/` and `lib/` ends in `.js`. `netlify/functions/` keeps its extensionless imports (CLAUDE.md).
- **TypeScript:** target/lib ES2020 (no `Array.prototype.at`, no `replaceAll`). Unused locals and parameters are errors.
- **ESLint** runs with `--max-warnings 0`.
- **Comments:** few, and only to record *why*. Match the surrounding code.
- **Commits:** a short one-line message, with **no** `Co-Authored-By` or `Claude-Session` trailer (CLAUDE.md). Commit at the end of each task only if the user has okayed committing for this execution run.
- **Ids are permanent.** Rule ids start with `visual-`, and like item ids they are never renamed or deleted. A rule that's dropped gets `retired: true` (spec §3.5). The tag-file test in Task 2 is what enforces this: a renamed id leaves a tag pointing at nothing.
- **Thresholds** (spec §4.5, §4.1, §5.4): a rule is usable with **≥20 definite yes and ≥20 definite no** items. A family may hold at most **⅓** of usable rules. AI tagging uses **3 passes**, and anything short of unanimous is `unsure`.

## File structure

| File | Responsibility |
|---|---|
| `content-engine/visual/types.ts` (modify) | Adds `Tri`, `FAMILIES`, `Family`, `VisualRule` |
| `content-engine/visual/rules.ts` | `FAMILY_BASIS` (tagging guidance per family) and `VISUAL_RULES` (the 51-rule pilot) |
| `content-engine/visual/matrix.ts` | Tag-file types, `buildMatrix` (overrides win per cell), `validateTagTable` |
| `content-engine/visual/tags/<family>.ai.ts` × 11 | Generated AI drafts. Start empty |
| `content-engine/visual/tags/<family>.overrides.ts` × 11 | Human decisions. Start empty |
| `content-engine/visual/tags/index.ts` | `TAG_FILES` (per family) and the merged `MATRIX` |
| `content-engine/visual/tagging.ts` | Prompt, response validation, 3-pass consensus, resume logic, AI-file rendering |
| `content-engine/visual/report.ts` | Usable-rule counts, near-duplicate pairs, oversize families, runway |
| `content-engine/visual/scripts/tagVisualAi.ts` | Calls Gemini; rewrites `tags/<family>.ai.ts` after each rule |
| `content-engine/visual/scripts/matrixReport.ts` | Prints the report |
| `content-engine/visual/scripts/seedVisual.ts` | Upserts `visualItems` and visual `rules` |
| `content-engine/visual/scripts/normalizeIcons.ts` (modify) | Lists shape tags to re-check when an icon changes (§4.1) |
| `lib/types.ts`, `netlify/functions/_shared/types.ts` (modify) | `VisualItemDoc`; `PuzzleDoc.kind?`, `generatorSeed?`; `wordId` comments |
| `lib/db.ts`, `netlify/functions/_shared/db.ts` (modify) | `visualItems` collection handle |
| Tests: `rules.test.ts`, `matrix.test.ts`, `tagging.test.ts`, `report.test.ts` | Next to their modules |

`package.json` gains three scripts: `visual:tag`, `visual:report` and `content:seed-visual`. Vitest already picks up `content-engine/**/*.test.ts`, so there are no config changes.

---

### Task 1: Rule types and the pilot taxonomy

**Files:**
- Modify: `content-engine/visual/types.ts` (append)
- Create: `content-engine/visual/rules.ts`
- Test: `content-engine/visual/rules.test.ts`

**Interfaces:**
- Consumes: nothing new (Phase 1's `types.ts`).
- Produces:
  - `type Tri = boolean | null`
  - `const FAMILIES` (11 family ids, `as const`) and `type Family`
  - `interface VisualRule { id: string; family: Family; reveal: string; basis?: string; retired?: boolean }`
  - `FAMILY_BASIS: Record<Family, string>`
  - `VISUAL_RULES: VisualRule[]`

- [ ] **Step 1: Write the failing test**

`content-engine/visual/rules.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { RULES } from '../rules/index.js'
import { VISUAL_RULES } from './rules.js'
import { FAMILIES } from './types.js'

describe('VISUAL_RULES', () => {
  it('ids are unique, visual-prefixed kebab slugs', () => {
    const ids = VISUAL_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^visual-[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  it('no word rule id could clash with a visual one in the shared rules collection', () => {
    expect(RULES.filter((r) => r.id.startsWith('visual-'))).toEqual([])
  })

  it('every family has at least one rule', () => {
    const used = new Set(VISUAL_RULES.map((r) => r.family))
    expect(FAMILIES.filter((f) => !used.has(f))).toEqual([])
  })

  it('every reveal is one plain sentence', () => {
    for (const rule of VISUAL_RULES) expect(rule.reveal).toMatch(/^[A-Z][^.!?]*\.$/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/rules.test.ts`
Expected: FAIL, because `./rules.js` doesn't exist.

- [ ] **Step 3: Add the types**

Append to `content-engine/visual/types.ts`:
```ts
/** A matrix cell as the generator reads it. `unsure` and untagged are both null. */
export type Tri = boolean | null

export const FAMILIES = [
  'has-part',
  'made-of',
  'where-found',
  'what-it-does',
  'physical',
  'how-used',
  'size-weight',
  'senses',
  'living',
  'shape',
  'context',
] as const

export type Family = (typeof FAMILIES)[number]

export interface VisualRule {
  /**
   * Permanent. Uniqueness (D6) is checked by id, so a renamed rule could run its
   * idea twice. The `visual-` prefix keeps it clear of word rule ids in the
   * shared `rules` collection. Retire a rule; never rename or delete it.
   */
  id: string
  family: Family
  /** The reveal sentence (planning.md §3.5), about the IN items: "It has a handle." */
  reveal: string
  /** Extra tagging guidance for this rule, added to its family's FAMILY_BASIS. */
  basis?: string
  /** Out of generation for good, but its id stays reserved and it is still a rival. */
  retired?: boolean
}
```

- [ ] **Step 4: Write the rule list**

`content-engine/visual/rules.ts`:
```ts
import type { Family, VisualRule } from './types.js'

// The visual rule taxonomy (planning-visual-pivot.md §4.1): one plain property
// per rule, in families. A rule runs once ever (D6), and that is checked by id,
// so ids are permanent: never rename or delete a rule — set `retired: true`.

/** How the tagger judges every rule in a family (§4.1). A rule's `basis` adds to this. */
export const FAMILY_BASIS: Record<Family, string> = {
  'has-part':
    'Judge a typical, intact, everyday example of the thing, as normally sold, found or used.',
  'made-of':
    'Judge a typical, everyday example of the thing. Answer yes only if that material is clearly most of it.',
  'where-found':
    'Answer yes only if the thing is commonly found there in everyday life, not merely possible there.',
  'what-it-does': 'Judge what the thing is mainly used for, or what it naturally does.',
  physical:
    'Judge a typical, intact, everyday example of the thing, in its normal state and at its normal size.',
  'how-used': 'Judge how a typical example of the thing is normally used in everyday life.',
  'size-weight':
    'Judge a typical, full-sized, real-world example of the thing, not a toy or model.',
  senses: 'Judge a typical example of the thing, as a person would normally experience it.',
  living: 'Judge what the thing is, in plain everyday terms rather than technical ones.',
  shape:
    'Judge the thing as it is usually drawn in a simple emoji-style icon, seen from the usual angle.',
  context: 'Answer yes only if the thing is commonly associated with that setting or occasion.',
}

export const VISUAL_RULES: VisualRule[] = [
  // has-part
  { id: 'visual-has-a-handle', family: 'has-part', reveal: 'It has a handle.' },
  { id: 'visual-has-legs', family: 'has-part', reveal: 'It has legs.' },
  { id: 'visual-has-a-tail', family: 'has-part', reveal: 'It has a tail.' },
  { id: 'visual-has-wheels', family: 'has-part', reveal: 'It has wheels.' },
  { id: 'visual-has-a-lid', family: 'has-part', reveal: 'It has a lid.' },

  // made-of
  { id: 'visual-made-of-metal', family: 'made-of', reveal: 'It is made mostly of metal.' },
  { id: 'visual-made-of-wood', family: 'made-of', reveal: 'It is made mostly of wood.' },
  { id: 'visual-made-of-fabric', family: 'made-of', reveal: 'It is made mostly of fabric.' },

  // where-found
  { id: 'visual-found-in-a-kitchen', family: 'where-found', reveal: 'It belongs in a kitchen.' },
  { id: 'visual-found-in-a-bathroom', family: 'where-found', reveal: 'It belongs in a bathroom.' },
  { id: 'visual-found-on-a-farm', family: 'where-found', reveal: 'You would find it on a farm.' },
  {
    id: 'visual-found-in-the-sea',
    family: 'where-found',
    reveal: 'You would find it in or on the sea.',
  },
  {
    id: 'visual-found-in-a-classroom',
    family: 'where-found',
    reveal: 'You would find it in a classroom.',
  },

  // what-it-does
  { id: 'visual-gives-light', family: 'what-it-does', reveal: 'It gives off light.' },
  { id: 'visual-cuts', family: 'what-it-does', reveal: 'It is used to cut things.' },
  { id: 'visual-makes-music', family: 'what-it-does', reveal: 'It is used to make music.' },
  { id: 'visual-holds-liquid', family: 'what-it-does', reveal: 'It is made to hold a liquid.' },
  {
    id: 'visual-builds-or-fixes',
    family: 'what-it-does',
    reveal: 'It is a tool for building or fixing things.',
  },

  // physical
  { id: 'visual-floats', family: 'physical', reveal: 'It floats in water.' },
  {
    id: 'visual-breaks-if-dropped',
    family: 'physical',
    reveal: 'It would break if dropped on a hard floor.',
  },
  {
    id: 'visual-conducts-electricity',
    family: 'physical',
    reveal: 'Electricity can flow through it.',
    basis: 'Living things count as no.',
  },
  { id: 'visual-sticks-to-a-magnet', family: 'physical', reveal: 'A magnet would stick to it.' },
  { id: 'visual-melts-on-a-hot-day', family: 'physical', reveal: 'It would melt on a hot day.' },
  { id: 'visual-burns-easily', family: 'physical', reveal: 'It catches fire easily.' },

  // how-used
  {
    id: 'visual-needs-power',
    family: 'how-used',
    reveal: 'It needs electricity or a battery to work.',
  },
  { id: 'visual-worn', family: 'how-used', reveal: 'You wear it.' },
  { id: 'visual-ridden', family: 'how-used', reveal: 'People ride on it or in it.' },
  {
    id: 'visual-used-in-one-hand',
    family: 'how-used',
    reveal: 'You use it holding it in one hand.',
    basis: 'Living things and food count as no.',
  },
  { id: 'visual-used-with-water', family: 'how-used', reveal: 'You use it with water.' },

  // size-weight
  { id: 'visual-fits-in-a-pocket', family: 'size-weight', reveal: 'It fits in a pocket.' },
  {
    id: 'visual-heavier-than-a-person',
    family: 'size-weight',
    reveal: 'It is heavier than an adult person.',
  },
  { id: 'visual-bigger-than-a-car', family: 'size-weight', reveal: 'It is bigger than a car.' },

  // senses
  { id: 'visual-shiny', family: 'senses', reveal: 'It is shiny.' },
  { id: 'visual-soft', family: 'senses', reveal: 'It is soft to the touch.' },
  { id: 'visual-smells-strong', family: 'senses', reveal: 'It has a strong smell.' },
  { id: 'visual-loud', family: 'senses', reveal: 'It can make a loud noise.' },

  // living
  { id: 'visual-alive', family: 'living', reveal: 'It is alive.' },
  { id: 'visual-is-an-animal', family: 'living', reveal: 'It is an animal.' },
  { id: 'visual-is-food', family: 'living', reveal: 'It is food.' },
  { id: 'visual-is-a-vehicle', family: 'living', reveal: 'It is a vehicle.' },
  { id: 'visual-is-a-plant', family: 'living', reveal: 'It is a plant.' },
  { id: 'visual-grows-on-a-plant', family: 'living', reveal: 'It grows on a plant.' },
  { id: 'visual-from-an-animal', family: 'living', reveal: 'It comes from an animal.' },
  { id: 'visual-has-feathers', family: 'living', reveal: 'It has feathers.' },

  // shape: judged on the icon as drawn (§4.1)
  { id: 'visual-round', family: 'shape', reveal: 'It is round.' },
  { id: 'visual-long-and-thin', family: 'shape', reveal: 'It is long and thin.' },
  { id: 'visual-has-a-hole', family: 'shape', reveal: 'It has a hole you could see through.' },
  { id: 'visual-has-a-sharp-point', family: 'shape', reveal: 'It has a sharp point.' },

  // context
  { id: 'visual-used-in-sport', family: 'context', reveal: 'It is used in a sport.' },
  { id: 'visual-at-a-party', family: 'context', reveal: 'You might see it at a party.' },
  { id: 'visual-winter', family: 'context', reveal: 'It is mostly used or seen in winter.' },
]
```

How the pilot list was chosen: every family is represented, the four "obvious group" rules are present (*is an animal / food / vehicle / plant*, spec §4.1), and most rules are broad enough to clear 20 yes and 20 no on a 165-item bank. Some can't at pilot size (*has wheels*, *has feathers*, *is a vehicle*); they stay, because they are still rivals the validator has to know about. More rules are written during the content build-out, not here.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add content-engine/visual/types.ts content-engine/visual/rules.ts content-engine/visual/rules.test.ts
git commit -m "Add the visual rule types and the 51-rule pilot taxonomy"
```

---

### Task 2: The tagging matrix and the tag files

**Files:**
- Create: `content-engine/visual/matrix.ts`
- Create: `content-engine/visual/tags/<family>.ai.ts` and `content-engine/visual/tags/<family>.overrides.ts` for each of the 11 families
- Create: `content-engine/visual/tags/index.ts`
- Test: `content-engine/visual/matrix.test.ts`

**Interfaces:**
- Consumes: `Tri`, `Family`, `VISUAL_RULES` (Task 1); `ITEMS` (Phase 1).
- Produces:
  - `type Cell = 'yes' | 'no' | 'unsure'` and `CELLS: readonly Cell[]`
  - `type TagRow = Partial<Record<Cell, string>>` (space-separated item ids) and `type TagTable = Record<string, TagRow>` (keyed by rule id)
  - `interface Matrix { valueOf(itemId, ruleId): Tri; cellOf(itemId, ruleId): Cell | undefined }`
  - `idsOf(list: string | undefined): string[]`
  - `buildMatrix(ai: TagTable, overrides: TagTable): Matrix`
  - `validateTagTable(table: TagTable, ruleIds: Set<string>, itemIds: Set<string>): string[]`
  - `TAG_FILES: Record<Family, { ai: TagTable; overrides: TagTable }>` and `MATRIX: Matrix` (from `tags/index.ts`)

- [ ] **Step 1: Write the failing test**

`content-engine/visual/matrix.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ITEMS } from './items.js'
import { buildMatrix, validateTagTable } from './matrix.js'
import { VISUAL_RULES } from './rules.js'
import { TAG_FILES } from './tags/index.js'

describe('buildMatrix', () => {
  const matrix = buildMatrix(
    { 'visual-floats': { yes: 'cork ice-cube', no: 'anchor', unsure: 'bottle' } },
    { 'visual-floats': { no: 'ice-cube', yes: 'anchor' }, 'visual-round': { yes: 'coin' } }
  )

  it('reads yes as true and no as false', () => {
    expect(matrix.valueOf('cork', 'visual-floats')).toBe(true)
    expect(matrix.valueOf('anchor', 'visual-round')).toBe(null)
  })

  it('lets an override win over the AI answer, in either direction', () => {
    expect(matrix.valueOf('ice-cube', 'visual-floats')).toBe(false)
    expect(matrix.valueOf('anchor', 'visual-floats')).toBe(true)
  })

  it('reads an override for a rule the AI never drafted', () => {
    expect(matrix.valueOf('coin', 'visual-round')).toBe(true)
  })

  it('reads unsure and untagged both as null, but keeps them apart for reports', () => {
    expect(matrix.valueOf('bottle', 'visual-floats')).toBe(null)
    expect(matrix.valueOf('kite', 'visual-floats')).toBe(null)
    expect(matrix.cellOf('bottle', 'visual-floats')).toBe('unsure')
    expect(matrix.cellOf('kite', 'visual-floats')).toBeUndefined()
  })
})

describe('validateTagTable', () => {
  const rules = new Set(['visual-floats'])
  const items = new Set(['cork', 'anchor'])

  it('accepts a sound table', () => {
    expect(
      validateTagTable({ 'visual-floats': { yes: 'cork', no: 'anchor' } }, rules, items)
    ).toEqual([])
  })

  it('reports an unknown rule, an unknown item and an item in two lists', () => {
    expect(
      validateTagTable(
        {
          'visual-sinks': {},
          'visual-floats': { yes: 'cork anchor', no: 'anchor cork-board' },
        },
        rules,
        items
      )
    ).toEqual([
      'visual-sinks: no such rule in this family',
      'visual-floats: "anchor" is listed more than once',
      'visual-floats: unknown item "cork-board"',
    ])
  })
})

// This is also what keeps rule and item ids permanent: renaming either one
// leaves a tag pointing at an id that no longer exists.
describe('committed tag files', () => {
  const itemIds = new Set(ITEMS.map((i) => i.id))

  it.each(Object.entries(TAG_FILES))(
    '%s: every rule and item exists, each listed once',
    (family, files) => {
      const ruleIds = new Set(VISUAL_RULES.filter((r) => r.family === family).map((r) => r.id))
      expect(validateTagTable(files.ai, ruleIds, itemIds)).toEqual([])
      expect(validateTagTable(files.overrides, ruleIds, itemIds)).toEqual([])
    }
  )
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/matrix.test.ts`
Expected: FAIL, because `./matrix.js` doesn't exist.

- [ ] **Step 3: Write the matrix module**

`content-engine/visual/matrix.ts`:
```ts
import type { Tri } from './types.js'

// The tagging matrix (planning-visual-pivot.md §4.2): for each rule, which
// items are yes / no / unsure. An item in none of the three is untagged.

export type Cell = 'yes' | 'no' | 'unsure'

export const CELLS: readonly Cell[] = ['yes', 'no', 'unsure']

/**
 * One rule's answers, as space-separated item ids. Strings rather than arrays
 * keep ~300k ids cheap for tsc and for the function bundles that import them.
 */
export type TagRow = Partial<Record<Cell, string>>

export type TagTable = Record<string, TagRow>

export interface Matrix {
  /** `unsure` and untagged both read as null: neither is a fact a board can rest on. */
  valueOf(itemId: string, ruleId: string): Tri
  /** Undefined means untagged, which reports keep apart from `unsure`. */
  cellOf(itemId: string, ruleId: string): Cell | undefined
}

export const idsOf = (list: string | undefined): string[] => (list ?? '').split(' ').filter(Boolean)

function cellsOf(row: TagRow): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  for (const cell of CELLS) for (const id of idsOf(row[cell])) cells.set(id, cell)
  return cells
}

/** Overrides win per cell: a human answer replaces the AI's, whatever list it was in. */
export function buildMatrix(ai: TagTable, overrides: TagTable): Matrix {
  const byRule = new Map<string, Map<string, Cell>>()
  for (const [ruleId, row] of Object.entries(ai)) byRule.set(ruleId, cellsOf(row))
  for (const [ruleId, row] of Object.entries(overrides)) {
    const cells = byRule.get(ruleId) ?? new Map<string, Cell>()
    for (const [itemId, cell] of cellsOf(row)) cells.set(itemId, cell)
    byRule.set(ruleId, cells)
  }

  const cellOf = (itemId: string, ruleId: string) => byRule.get(ruleId)?.get(itemId)
  return {
    cellOf,
    valueOf(itemId, ruleId) {
      const cell = cellOf(itemId, ruleId)
      return cell === 'yes' ? true : cell === 'no' ? false : null
    },
  }
}

/** Problems with one tag file. An empty array means it is sound. */
export function validateTagTable(
  table: TagTable,
  ruleIds: Set<string>,
  itemIds: Set<string>
): string[] {
  const problems: string[] = []
  for (const [ruleId, row] of Object.entries(table)) {
    if (!ruleIds.has(ruleId)) problems.push(`${ruleId}: no such rule in this family`)
    const seen = new Set<string>()
    for (const cell of CELLS) {
      for (const id of idsOf(row[cell])) {
        if (!itemIds.has(id)) problems.push(`${ruleId}: unknown item "${id}"`)
        if (seen.has(id)) problems.push(`${ruleId}: "${id}" is listed more than once`)
        seen.add(id)
      }
    }
  }
  return problems
}
```

- [ ] **Step 4: Create the 22 empty tag files**

Every family gets an AI file, which is byte-identical to what Task 3's `renderAiTagFile({})` produces (a test checks this), and an override file. From the repo root, in Git Bash:
```bash
cd content-engine/visual && mkdir -p tags && for f in has-part made-of where-found what-it-does physical how-used size-weight senses living shape context; do
printf '%s\n' "// AUTO-GENERATED by content-engine/visual/scripts/tagVisualAi.ts — do not hand-edit." "// The AI draft for this family (planning-visual-pivot.md §4.3). To correct a" "// cell, add it to the matching .overrides.ts file: overrides win per cell, and" "// re-running the tagger never touches them." "" "import type { TagTable } from '../matrix.js'" "" "export const TAGS: TagTable = {}" > "tags/$f.ai.ts"
printf '%s\n' "import type { TagTable } from '../matrix.js'" "" "// Human tagging decisions for this family (planning-visual-pivot.md §4.2)." "// Each listed item wins over the AI draft for that rule. Never generated." "// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }" "" "export const TAGS: TagTable = {}" > "tags/$f.overrides.ts"
done; cd ../..
```

Each `tags/<family>.ai.ts` then reads:
```ts
// AUTO-GENERATED by content-engine/visual/scripts/tagVisualAi.ts — do not hand-edit.
// The AI draft for this family (planning-visual-pivot.md §4.3). To correct a
// cell, add it to the matching .overrides.ts file: overrides win per cell, and
// re-running the tagger never touches them.

import type { TagTable } from '../matrix.js'

export const TAGS: TagTable = {}
```
and each `tags/<family>.overrides.ts`:
```ts
import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

export const TAGS: TagTable = {}
```

- [ ] **Step 5: Write the index**

`content-engine/visual/tags/index.ts`:
```ts
import { buildMatrix, type TagTable } from '../matrix.js'
import type { Family } from '../types.js'
import { TAGS as contextAi } from './context.ai.js'
import { TAGS as contextOverrides } from './context.overrides.js'
import { TAGS as hasPartAi } from './has-part.ai.js'
import { TAGS as hasPartOverrides } from './has-part.overrides.js'
import { TAGS as howUsedAi } from './how-used.ai.js'
import { TAGS as howUsedOverrides } from './how-used.overrides.js'
import { TAGS as livingAi } from './living.ai.js'
import { TAGS as livingOverrides } from './living.overrides.js'
import { TAGS as madeOfAi } from './made-of.ai.js'
import { TAGS as madeOfOverrides } from './made-of.overrides.js'
import { TAGS as physicalAi } from './physical.ai.js'
import { TAGS as physicalOverrides } from './physical.overrides.js'
import { TAGS as sensesAi } from './senses.ai.js'
import { TAGS as sensesOverrides } from './senses.overrides.js'
import { TAGS as shapeAi } from './shape.ai.js'
import { TAGS as shapeOverrides } from './shape.overrides.js'
import { TAGS as sizeWeightAi } from './size-weight.ai.js'
import { TAGS as sizeWeightOverrides } from './size-weight.overrides.js'
import { TAGS as whatItDoesAi } from './what-it-does.ai.js'
import { TAGS as whatItDoesOverrides } from './what-it-does.overrides.js'
import { TAGS as whereFoundAi } from './where-found.ai.js'
import { TAGS as whereFoundOverrides } from './where-found.overrides.js'

/** One AI file and one override file per family, so each stays a reviewable size (§4.2). */
export const TAG_FILES: Record<Family, { ai: TagTable; overrides: TagTable }> = {
  'has-part': { ai: hasPartAi, overrides: hasPartOverrides },
  'made-of': { ai: madeOfAi, overrides: madeOfOverrides },
  'where-found': { ai: whereFoundAi, overrides: whereFoundOverrides },
  'what-it-does': { ai: whatItDoesAi, overrides: whatItDoesOverrides },
  physical: { ai: physicalAi, overrides: physicalOverrides },
  'how-used': { ai: howUsedAi, overrides: howUsedOverrides },
  'size-weight': { ai: sizeWeightAi, overrides: sizeWeightOverrides },
  senses: { ai: sensesAi, overrides: sensesOverrides },
  living: { ai: livingAi, overrides: livingOverrides },
  shape: { ai: shapeAi, overrides: shapeOverrides },
  context: { ai: contextAi, overrides: contextOverrides },
}

const files = Object.values(TAG_FILES)

export const MATRIX = buildMatrix(
  Object.assign({}, ...files.map((f) => f.ai)),
  Object.assign({}, ...files.map((f) => f.overrides))
)
```
`Record<Family, …>` makes a missing family a type error.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/matrix.test.ts`
Expected: PASS (17 tests: 6 for the two functions, and one per family for the committed files).

- [ ] **Step 7: Commit**

```bash
git add content-engine/visual/matrix.ts content-engine/visual/matrix.test.ts content-engine/visual/tags
git commit -m "Add the three-valued tagging matrix and empty per-family tag files"
```

---

### Task 3: The tagging core (prompt, validation, consensus)

**Files:**
- Create: `content-engine/visual/tagging.ts`
- Test: `content-engine/visual/tagging.test.ts`

**Interfaces:**
- Consumes: `CELLS`, `idsOf`, `Cell`, `TagRow`, `TagTable` (Task 2); `FAMILY_BASIS` (Task 1); `Item`, `VisualRule`.
- Produces:
  - `buildRuleTaggingPrompt(rule: VisualRule, items: Item[]): string`
  - `parseRuleTaggingResponse(raw: unknown, requested: string[]): Map<string, Cell>`
  - `consensus(passes: Map<string, Cell>[], ids: string[]): Map<string, Cell>`
  - `itemsToTag(ruleId: string, items: Item[], ai: TagTable, overrides: TagTable): Item[]`
  - `mergeRow(row: TagRow | undefined, cells: Map<string, Cell>): TagRow`
  - `renderAiTagFile(table: TagTable): string`

- [ ] **Step 1: Write the failing test**

`content-engine/visual/tagging.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Cell } from './matrix.js'
import {
  buildRuleTaggingPrompt,
  consensus,
  itemsToTag,
  mergeRow,
  parseRuleTaggingResponse,
  renderAiTagFile,
} from './tagging.js'
import type { Item, VisualRule } from './types.js'

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  name: id.replace(/-/g, ' '),
  group: 'thing',
  icon: { set: 'openmoji', hex: '2693' },
  ...extra,
})

const floats: VisualRule = {
  id: 'visual-floats',
  family: 'physical',
  reveal: 'It floats in water.',
  basis: 'Hollow things count as their usual, closed state.',
}

describe('buildRuleTaggingPrompt', () => {
  it('carries the statement, both layers of guidance and every item by id', () => {
    const prompt = buildRuleTaggingPrompt(floats, [item('ice-cube'), item('anchor')])
    expect(prompt).toContain('"It floats in water."')
    expect(prompt).toContain('in its normal state and at its normal size.')
    expect(prompt).toContain('Hollow things count as their usual, closed state.')
    expect(prompt).toContain('ice-cube: ice cube (thing)')
    expect(prompt).toContain('anchor: anchor (thing)')
  })
})

describe('parseRuleTaggingResponse', () => {
  it('keeps valid answers and drops unknown ids, bad answers and junk', () => {
    const parsed = parseRuleTaggingResponse(
      [
        { id: 'ice-cube', answer: 'yes' },
        { id: 'anchor', answer: 'no' },
        { id: 'whale', answer: 'yes' },
        { id: 'cork', answer: 'maybe' },
        'cork',
        null,
      ],
      ['ice-cube', 'anchor', 'cork']
    )
    expect([...parsed]).toEqual([
      ['ice-cube', 'yes'],
      ['anchor', 'no'],
    ])
  })

  it('treats an id answered two different ways as unsure', () => {
    const parsed = parseRuleTaggingResponse(
      [
        { id: 'cork', answer: 'yes' },
        { id: 'cork', answer: 'no' },
      ],
      ['cork']
    )
    expect(parsed.get('cork')).toBe('unsure')
  })

  it('returns nothing for a response that is not an array', () => {
    expect(parseRuleTaggingResponse({ id: 'cork', answer: 'yes' }, ['cork']).size).toBe(0)
  })
})

describe('consensus', () => {
  const pass = (entries: [string, Cell][]) => new Map(entries)

  it('keeps unanimous answers and turns any disagreement or gap into unsure', () => {
    const cells = consensus(
      [
        pass([
          ['a', 'yes'],
          ['b', 'no'],
          ['c', 'yes'],
          ['d', 'no'],
        ]),
        pass([
          ['a', 'yes'],
          ['b', 'no'],
          ['c', 'no'],
          ['d', 'no'],
        ]),
        pass([
          ['a', 'yes'],
          ['b', 'no'],
          ['c', 'yes'],
        ]),
      ],
      ['a', 'b', 'c', 'd', 'e']
    )
    expect([...cells]).toEqual([
      ['a', 'yes'],
      ['b', 'no'],
      ['c', 'unsure'],
      ['d', 'unsure'],
    ])
  })
})

describe('itemsToTag', () => {
  it('skips blocked items and anything already answered by the AI or a human', () => {
    const todo = itemsToTag(
      'visual-floats',
      [
        item('cork'),
        item('anchor'),
        item('kite'),
        item('bottle', { blocked: true }),
        item('ice-cube'),
      ],
      { 'visual-floats': { yes: 'cork', unsure: 'kite' } },
      { 'visual-floats': { no: 'anchor' } }
    )
    expect(todo.map((i) => i.id)).toEqual(['ice-cube'])
  })
})

describe('mergeRow', () => {
  it('adds new answers to the existing row', () => {
    const row = mergeRow(
      { yes: 'cork' },
      new Map<string, Cell>([
        ['anchor', 'no'],
        ['kite', 'unsure'],
      ])
    )
    expect(row).toEqual({ yes: 'cork', no: 'anchor', unsure: 'kite' })
  })
})

describe('renderAiTagFile', () => {
  it('sorts rules and ids so a re-run only diffs what changed', () => {
    const source = renderAiTagFile({
      'visual-round': { yes: 'coin' },
      'visual-floats': { yes: 'ice-cube cork', no: 'anchor' },
    })
    expect(source).toContain(
      [
        "  'visual-floats': {",
        "    yes: 'cork ice-cube',",
        "    no: 'anchor',",
        "    unsure: '',",
        '  },',
        "  'visual-round': {",
      ].join('\n')
    )
  })

  it('renders an empty table exactly as the committed stub files are written', () => {
    const stub = readFileSync(
      join(process.cwd(), 'content-engine', 'visual', 'tags', 'shape.ai.ts'),
      'utf8'
    ).replace(/\r\n/g, '\n')
    expect(renderAiTagFile({})).toBe(stub)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/tagging.test.ts`
Expected: FAIL, because `./tagging.js` doesn't exist.

- [ ] **Step 3: Write the module**

`content-engine/visual/tagging.ts`:
```ts
import { CELLS, idsOf, type Cell, type TagRow, type TagTable } from './matrix.js'
import { FAMILY_BASIS } from './rules.js'
import type { Item, VisualRule } from './types.js'

// Pure prompt-building, response validation and consensus for the AI tagger
// (planning-visual-pivot.md §4.3). Kept apart from the script that calls the
// network so the part deciding what the model may assert is unit-tested — the
// same split as words/aiTagging.ts and scripts/tagWordsAi.ts.

export function buildRuleTaggingPrompt(rule: VisualRule, items: Item[]): string {
  const basis = [FAMILY_BASIS[rule.family], rule.basis].filter(Boolean).join(' ')
  return `You are labelling everyday things for a picture puzzle. For every item below,
decide whether this statement is true of it:

STATEMENT: "${rule.reveal}"

HOW TO JUDGE: ${basis}

ANSWERS:
- "yes": almost everyone would agree the statement is true of it.
- "no": almost everyone would agree the statement is false of it.
- "unsure": people could reasonably disagree, it depends on which version you
  picture, or you do not know.

When in doubt, answer "unsure". A wrong yes or no makes the puzzle mark a fair
answer wrong; "unsure" only means the item is left out of puzzles about this.

Answer every item exactly once, by its id.

ITEMS (id: name, group):
${items.map((i) => `${i.id}: ${i.name} (${i.group})`).join('\n')}`
}

/**
 * Validates one untrusted parsed-JSON response. Never throws. Ids we didn't ask
 * about and answers outside yes/no/unsure are dropped; an id answered twice in
 * different ways counts as unsure.
 */
export function parseRuleTaggingResponse(raw: unknown, requested: string[]): Map<string, Cell> {
  const asked = new Set(requested)
  const answers = new Map<string, Cell>()
  if (!Array.isArray(raw)) return answers
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, answer } = entry as Record<string, unknown>
    if (typeof id !== 'string' || !asked.has(id)) continue
    if (answer !== 'yes' && answer !== 'no' && answer !== 'unsure') continue
    const previous = answers.get(id)
    answers.set(id, previous === undefined || previous === answer ? answer : 'unsure')
  }
  return answers
}

/**
 * D3: a cell is yes or no only when every pass gave that answer. Disagreement,
 * or a pass that skipped the item, makes it unsure. An item no pass answered
 * stays untagged, so the next run asks again.
 */
export function consensus(passes: Map<string, Cell>[], ids: string[]): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  for (const id of ids) {
    const answers = passes.map((p) => p.get(id))
    if (answers.every((a) => a === undefined)) continue
    const first = answers[0]
    cells.set(id, first !== undefined && answers.every((a) => a === first) ? first : 'unsure')
  }
  return cells
}

/** The items a rule still needs an AI answer for: not blocked, not drafted yet, not decided by a human. */
export function itemsToTag(
  ruleId: string,
  items: Item[],
  ai: TagTable,
  overrides: TagTable
): Item[] {
  const answered = new Set<string>()
  for (const row of [ai[ruleId], overrides[ruleId]]) {
    if (row) for (const cell of CELLS) for (const id of idsOf(row[cell])) answered.add(id)
  }
  return items.filter((i) => !i.blocked && !answered.has(i.id))
}

/** Adds new answers to a rule's AI row. */
export function mergeRow(row: TagRow | undefined, cells: Map<string, Cell>): TagRow {
  const merged: Record<Cell, string[]> = { yes: [], no: [], unsure: [] }
  for (const cell of CELLS) merged[cell].push(...idsOf(row?.[cell]))
  for (const [id, cell] of cells) merged[cell].push(id)
  return { yes: merged.yes.join(' '), no: merged.no.join(' '), unsure: merged.unsure.join(' ') }
}

/** The source of a `tags/<family>.ai.ts` file. Sorted, so a re-run only diffs what changed. */
export function renderAiTagFile(table: TagTable): string {
  const body = Object.keys(table)
    .sort()
    .map((ruleId) => {
      const lines = CELLS.map(
        (cell) => `    ${cell}: '${idsOf(table[ruleId][cell]).sort().join(' ')}',`
      )
      return [`  '${ruleId}': {`, ...lines, '  },'].join('\n')
    })
  return [
    '// AUTO-GENERATED by content-engine/visual/scripts/tagVisualAi.ts — do not hand-edit.',
    '// The AI draft for this family (planning-visual-pivot.md §4.3). To correct a',
    '// cell, add it to the matching .overrides.ts file: overrides win per cell, and',
    '// re-running the tagger never touches them.',
    '',
    "import type { TagTable } from '../matrix.js'",
    '',
    body.length === 0
      ? 'export const TAGS: TagTable = {}'
      : `export const TAGS: TagTable = {\n${body.join('\n')}\n}`,
    '',
  ].join('\n')
}
```

Two decisions here go beyond the spec's text, and both are on the cautious side:
- **An id answered two different ways in one response is `unsure`**, not whichever answer came first.
- **An item no pass answered stays untagged**, rather than becoming `unsure`. That keeps "nobody looked" apart from "we disagreed" (§4.2), and the next run asks again.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/tagging.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add content-engine/visual/tagging.ts content-engine/visual/tagging.test.ts
git commit -m "Add the visual tagging prompt, response validation and 3-pass consensus"
```

---

### Task 4: The AI tagging script

**Files:**
- Create: `content-engine/visual/scripts/tagVisualAi.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: everything from Task 3; `TAG_FILES` (Task 2); `ITEMS`, `validateItems` (Phase 1); `VISUAL_RULES` (Task 1).
- Produces: `npm run visual:tag -- [--family F] [--rule ID] [--limit N] [--dry]`. It rewrites `tags/<family>.ai.ts`, and nothing else.

This is a thin wrapper around tested code, like `scripts/tagWordsAi.ts` (which it mirrors: same model default, retry and back-off). It has no unit test of its own.

- [ ] **Step 1: Write the script**

`content-engine/visual/scripts/tagVisualAi.ts`:
```ts
// Drafts the visual tagging matrix with Gemini, offline (planning-visual-pivot.md
// §4.3). Each batch is asked three times independently; a cell is yes or no
// only when all three agree, otherwise unsure (D3). Nothing under api/, lib/ or
// src/ imports this, and nothing here runs at game time.
//
// Resumable: a rule is only asked about items it has no AI or human answer for
// yet, and its family's tags/<family>.ai.ts is rewritten after every rule. A
// quota stop just pauses the run. Human overrides are never read for writing,
// so a re-run can't touch a reviewed decision.
//
// Run with: npm run visual:tag -- [--family F] [--rule ID] [--limit N] [--dry]

import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleGenAI, Type } from '@google/genai'
import { ITEMS } from '../items.js'
import type { Cell } from '../matrix.js'
import { VISUAL_RULES } from '../rules.js'
import {
  buildRuleTaggingPrompt,
  consensus,
  itemsToTag,
  mergeRow,
  parseRuleTaggingResponse,
  renderAiTagFile,
} from '../tagging.js'
import { TAG_FILES } from '../tags/index.js'
import { validateItems } from '../validateItems.js'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
const PASSES = 3
const BATCH_SIZE = 100
const MAX_RETRIES = 4
const TAGS_DIR = join(process.cwd(), 'content-engine', 'visual', 'tags')

const flag = (name: string) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const DRY_RUN = process.argv.includes('--dry')
const FAMILY = flag('--family')
const RULE = flag('--rule')
const LIMIT = Number(flag('--limit')) || Infinity

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      answer: { type: Type.STRING, enum: ['yes', 'no', 'unsure'] },
    },
    required: ['id', 'answer'],
  },
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One pass over one batch. Null if the call never succeeded: the batch stays untagged for the next run. */
async function askOnce(prompt: string, ids: string[]): Promise<Map<string, Cell> | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      })
      return parseRuleTaggingResponse(JSON.parse(response.text ?? '[]'), ids)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt === MAX_RETRIES) {
        console.warn(`  call failed after ${MAX_RETRIES} retries: ${message.slice(0, 120)}`)
        return null
      }
      const isRateLimit = message.includes('429') || message.toLowerCase().includes('quota')
      await sleep(isRateLimit ? 5000 * (attempt + 1) : 1000)
    }
  }
  return null
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set — add it to .env.')
    process.exit(1)
  }
  const problems = validateItems(ITEMS)
  if (problems.length > 0) {
    for (const p of problems) console.error(`INVALID  ${p}`)
    process.exit(1)
  }

  const rules = VISUAL_RULES.filter(
    (r) =>
      !r.retired &&
      (FAMILY === undefined || r.family === FAMILY) &&
      (RULE === undefined || r.id === RULE) &&
      itemsToTag(r.id, ITEMS, TAG_FILES[r.family].ai, TAG_FILES[r.family].overrides).length > 0
  ).slice(0, LIMIT)
  if (rules.length === 0) {
    console.log('Nothing to tag: every selected rule has an answer for every item.')
    process.exit(0)
  }
  console.log(`Tagging ${rules.length} rule(s) via ${MODEL}, ${PASSES} passes per batch.`)

  for (const rule of rules) {
    const files = TAG_FILES[rule.family]
    const todo = itemsToTag(rule.id, ITEMS, files.ai, files.overrides)
    const cells = new Map<string, Cell>()

    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      const batch = todo.slice(i, i + BATCH_SIZE)
      const ids = batch.map((item) => item.id)
      const prompt = buildRuleTaggingPrompt(rule, batch)
      const passes: Map<string, Cell>[] = []
      for (let p = 0; p < PASSES; p++) {
        const answers = await askOnce(prompt, ids)
        if (answers === null) break
        passes.push(answers)
      }
      // A batch with a failed pass is left untagged rather than judged on two passes.
      if (passes.length < PASSES) continue
      for (const [id, cell] of consensus(passes, ids)) cells.set(id, cell)
    }

    const tally = { yes: 0, no: 0, unsure: 0 }
    for (const cell of cells.values()) tally[cell]++
    console.log(
      `${rule.id}: ${tally.yes} yes, ${tally.no} no, ${tally.unsure} unsure, ` +
        `${todo.length - cells.size} left untagged`
    )

    if (DRY_RUN) {
      for (const cell of ['yes', 'no', 'unsure'] as const) {
        const sample = [...cells].filter(([, c]) => c === cell).map(([id]) => id)
        console.log(`  ${cell.padEnd(6)} ${sample.slice(0, 20).join(', ')}`)
      }
      continue
    }
    files.ai[rule.id] = mergeRow(files.ai[rule.id], cells)
    writeFileSync(join(TAGS_DIR, `${rule.family}.ai.ts`), renderAiTagFile(files.ai))
  }

  console.log(DRY_RUN ? '\n--dry: nothing written.' : '\nNext: npm run visual:report')
  process.exit(0)
}

main().catch((err) => {
  console.error('tagVisualAi failed:', err)
  process.exit(1)
})
```

Notes:
- **Passes run one after another**, not in parallel, to stay inside the free-tier per-minute quota. The pilot is about 51 rules × 2 batches × 3 passes ≈ 300 calls.
- **The script mutates the imported `TAG_FILES[family].ai` object in memory** and re-renders the whole family file after each rule. That way a later rule in the same family keeps the earlier rule's answers.

- [ ] **Step 2: Add the npm script**

In `package.json`, after the `"visual:icons"` line, add:
```json
    "visual:tag": "tsx content-engine/visual/scripts/tagVisualAi.ts",
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck:content-engine && npx eslint content-engine/visual --ext ts --max-warnings 0`
Expected: both clean.

- [ ] **Step 4: Smoke-run without a key**

Run (in Git Bash; it unsets the key for this one command only): `GEMINI_API_KEY= npm run visual:tag -- --dry`
Expected: `GEMINI_API_KEY is not set — add it to .env.` and exit code 1. No file changes (`git status --short content-engine/visual/tags` prints nothing).

- [ ] **Step 5: Commit**

```bash
git add content-engine/visual/scripts/tagVisualAi.ts package.json
git commit -m "Add the resumable Gemini tagging script for the visual matrix"
```

---

### Task 5: The matrix report

**Files:**
- Create: `content-engine/visual/report.ts`
- Test: `content-engine/visual/report.test.ts`
- Create: `content-engine/visual/scripts/matrixReport.ts`
- Modify: `content-engine/visual/scripts/normalizeIcons.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `Matrix`, `buildMatrix` (Task 2); `Family`, `Item`, `VisualRule`; `MATRIX` (Task 2).
- Produces (Phase 3 imports `countRule`):
  - `MIN_DEFINITE_PER_SIDE = 20`, `NEAR_DUPLICATE_SIMILARITY = 0.8`, `MIN_SHARED_DEFINITE = 20`, `MAX_FAMILY_SHARE = 1/3`
  - `interface RuleCounts { ruleId; family; yes; no; unsure; untagged; eligible: boolean }`
  - `countRule(rule: VisualRule, items: Item[], matrix: Matrix): RuleCounts`
  - `compareRules(a, b, items, matrix): { shared: number; same: number; opposite: number }`
  - `buildMatrixReport(rules, items, matrix): MatrixReport`
  - `npm run visual:report`

**Deviation from the spec, recorded:** §4.1 defines a near-duplicate as two rules that "agree on ≥90% of items both have definite tags for". Measured that way, raw agreement flags unrelated rules. Two sparse rules agree almost everywhere just by both saying no (*has feathers* and *makes music* on the 165-item pilot: about 93%), and two dense rules do the same by both saying yes. So this plan compares both sides instead: the yes-sets **and** the no-sets must overlap (Jaccard), and the score is the weaker of the two. The threshold is 0.8, not 0.9: two 20-yes rules that share 18 of them score 0.82. Inverted duplicates (*is alive* vs *is made by people*) are scored the same way against one rule's inverse. Update spec §4.1's sentence when this lands.

- [ ] **Step 1: Write the failing test**

`content-engine/visual/report.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildMatrix, type TagTable } from './matrix.js'
import { buildMatrixReport, compareRules, countRule } from './report.js'
import type { Family, Item, VisualRule } from './types.js'

// 100 numbered items: i0 … i99.
const ITEMS: Item[] = Array.from({ length: 100 }, (_, n) => ({
  id: `i${n}`,
  name: `item ${n}`,
  group: 'thing',
  icon: { set: 'openmoji', hex: '2693' },
}))
const ids = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, n) => `i${from + n}`).join(' ')

const rule = (id: string, family: Family = 'physical', extra: Partial<VisualRule> = {}) => ({
  id,
  family,
  reveal: 'It is a thing.',
  ...extra,
})

describe('countRule', () => {
  it('counts each answer, keeps unsure apart from untagged, and ignores blocked items', () => {
    const items = [...ITEMS.slice(0, 50), { ...ITEMS[50], blocked: true }]
    const matrix = buildMatrix(
      { 'visual-a': { yes: ids(0, 20), no: ids(20, 40), unsure: `${ids(40, 45)} i50` } },
      {}
    )
    expect(countRule(rule('visual-a'), items, matrix)).toEqual({
      ruleId: 'visual-a',
      family: 'physical',
      yes: 20,
      no: 20,
      unsure: 5,
      untagged: 5,
      eligible: true,
    })
  })

  it('needs 20 definite answers on each side, and is never eligible once retired', () => {
    const matrix = buildMatrix(
      {
        'visual-a': { yes: ids(0, 19), no: ids(19, 100) },
        'visual-b': { yes: ids(0, 50), no: ids(50, 100) },
      },
      {}
    )
    expect(countRule(rule('visual-a'), ITEMS, matrix).eligible).toBe(false)
    expect(countRule(rule('visual-b'), ITEMS, matrix).eligible).toBe(true)
    expect(countRule(rule('visual-b', 'physical', { retired: true }), ITEMS, matrix).eligible).toBe(
      false
    )
  })
})

describe('compareRules', () => {
  const compare = (a: TagTable[string], b: TagTable[string]) =>
    compareRules(
      rule('visual-a'),
      rule('visual-b'),
      ITEMS,
      buildMatrix({ 'visual-a': a, 'visual-b': b }, {})
    )

  it('does not call two unrelated sparse rules alike just because both are mostly no', () => {
    const result = compare(
      { yes: ids(0, 5), no: ids(5, 100) },
      { yes: ids(5, 10), no: `${ids(0, 5)} ${ids(10, 100)}` }
    )
    expect(result.same).toBe(0)
  })

  it('does not call two unrelated dense rules alike just because both are mostly yes', () => {
    const result = compare(
      { yes: ids(0, 95), no: ids(95, 100) },
      { yes: `${ids(0, 90)} ${ids(95, 100)}`, no: ids(90, 95) }
    )
    expect(result.same).toBe(0)
  })

  it('scores the same idea with a few differences high', () => {
    const result = compare(
      { yes: ids(0, 20), no: ids(20, 100) },
      { yes: `${ids(0, 18)} ${ids(20, 22)}`, no: `${ids(18, 20)} ${ids(22, 100)}` }
    )
    expect(result.same).toBeCloseTo(18 / 22)
  })

  it('scores a rule against its inverse as opposite', () => {
    const result = compare(
      { yes: ids(0, 40), no: ids(40, 100) },
      { yes: ids(40, 100), no: ids(0, 40) }
    )
    expect(result.opposite).toBe(1)
    expect(result.same).toBe(0)
  })

  it('only counts items both rules answer definitely', () => {
    expect(compare({ yes: ids(0, 50) }, { yes: ids(25, 100) }).shared).toBe(25)
  })
})

describe('buildMatrixReport', () => {
  const half = { yes: ids(0, 50), no: ids(50, 100) }
  const inverse = { yes: ids(50, 100), no: ids(0, 50) }
  const other = {
    yes: ids(0, 100)
      .split(' ')
      .filter((_, n) => n % 2 === 0)
      .join(' '),
    no: ids(0, 100)
      .split(' ')
      .filter((_, n) => n % 2 === 1)
      .join(' '),
  }

  it('flags near-duplicates in both directions, skipping retired rules', () => {
    const rules = [
      rule('visual-a'),
      rule('visual-b'),
      rule('visual-c'),
      rule('visual-d', 'physical', { retired: true }),
    ]
    const matrix = buildMatrix(
      { 'visual-a': half, 'visual-b': inverse, 'visual-c': other, 'visual-d': half },
      {}
    )
    const report = buildMatrixReport(rules, ITEMS, matrix)
    expect(report.nearDuplicates).toEqual([
      { a: 'visual-a', b: 'visual-b', inverted: true, similarity: 1, shared: 100 },
    ])
    expect(report.eligibleCount).toBe(3)
  })

  it('flags a family holding more than a third of the eligible rules', () => {
    const rules = [rule('visual-a', 'shape'), rule('visual-b', 'shape'), rule('visual-c', 'senses')]
    const matrix = buildMatrix({ 'visual-a': half, 'visual-b': other, 'visual-c': half }, {})
    expect(buildMatrixReport(rules, ITEMS, matrix).oversizeFamilies).toEqual([
      { family: 'shape', eligible: 2, share: 2 / 3 },
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/report.test.ts`
Expected: FAIL, because `./report.js` doesn't exist.

- [ ] **Step 3: Write the module**

`content-engine/visual/report.ts`:
```ts
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
  /** Usable rules before any are spent. Each one is a day of puzzles (§4.7). */
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

  const eligibleCount = counts.filter((c) => c.eligible).length
  const byFamily = new Map<Family, number>()
  for (const c of counts) if (c.eligible) byFamily.set(c.family, (byFamily.get(c.family) ?? 0) + 1)
  const oversizeFamilies = [...byFamily]
    .map(([family, eligible]) => ({ family, eligible, share: eligible / eligibleCount }))
    .filter((f) => f.share > MAX_FAMILY_SHARE)

  return { counts, nearDuplicates, oversizeFamilies, eligibleCount }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/report.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Write the report script**

`content-engine/visual/scripts/matrixReport.ts`:
```ts
// Prints the tagging-matrix review (planning-visual-pivot.md §4.3): per-rule
// counts, which rules are usable, near-duplicate pairs, oversize families and
// the runway. Read-only.
// Run with: npm run visual:report

import { ITEMS } from '../items.js'
import {
  buildMatrixReport,
  MAX_FAMILY_SHARE,
  MIN_DEFINITE_PER_SIDE,
  NEAR_DUPLICATE_SIMILARITY,
} from '../report.js'
import { VISUAL_RULES } from '../rules.js'
import { MATRIX } from '../tags/index.js'

const report = buildMatrixReport(VISUAL_RULES, ITEMS, MATRIX)
const pad = (n: number) => String(n).padStart(4)

console.log(`rule${' '.repeat(34)} yes   no  uns  unt`)
for (const c of report.counts) {
  const mark = c.eligible ? '' : `   below ${MIN_DEFINITE_PER_SIDE} on a side`
  console.log(
    `${c.ruleId.padEnd(38)}${pad(c.yes)} ${pad(c.no)} ${pad(c.unsure)} ${pad(c.untagged)}${mark}`
  )
}

console.log(
  `\nNear-duplicates (similarity >= ${NEAR_DUPLICATE_SIMILARITY}): merge or split each pair`
)
if (report.nearDuplicates.length === 0) console.log('  none')
for (const d of report.nearDuplicates) {
  console.log(
    `  ${d.a} ${d.inverted ? '~ NOT' : '~'} ${d.b}  (${d.similarity.toFixed(2)} over ${d.shared} items)`
  )
}

console.log(`\nFamilies over ${Math.round(MAX_FAMILY_SHARE * 100)}% of usable rules:`)
if (report.oversizeFamilies.length === 0) console.log('  none')
for (const f of report.oversizeFamilies) {
  console.log(`  ${f.family}: ${f.eligible} rules (${Math.round(f.share * 100)}%)`)
}

const untagged = report.counts.reduce((sum, c) => sum + c.untagged, 0)
console.log(`\nUsable rules: ${report.eligibleCount} of ${VISUAL_RULES.length}`)
console.log(`Runway before any are used: ${report.eligibleCount} days`)
if (untagged > 0) console.log(`Untagged cells: ${untagged} (npm run visual:tag fills them)`)
```

- [ ] **Step 6: List shape tags to re-check when an icon changes (§4.1)**

In `content-engine/visual/scripts/normalizeIcons.ts`, add two imports after the `normalize.js` import:
```ts
import { VISUAL_RULES } from '../rules.js'
import { MATRIX } from '../tags/index.js'
```
and replace these three lines:
```ts
// Phase 2 extends this line with the shape-family tags to re-check, since
// those are judged on the icon as drawn (planning-visual-pivot.md §4.1).
if (changed.length > 0) console.log(`Changed (${changed.length}): ${changed.join(', ')}`)
```
with:
```ts
if (changed.length > 0) console.log(`Changed (${changed.length}): ${changed.join(', ')}`)
// Shape rules are judged on the icon as drawn (planning-visual-pivot.md §4.1),
// so a redrawn icon's existing shape answers may now be wrong.
const shapeRules = VISUAL_RULES.filter((r) => r.family === 'shape')
for (const id of changed) {
  const tagged = shapeRules.filter((r) => MATRIX.cellOf(id, r.id) !== undefined)
  if (tagged.length > 0) {
    console.log(`  re-check ${id}'s shape tags: ${tagged.map((r) => r.id).join(', ')}`)
  }
}
```

- [ ] **Step 7: Add the npm script**

In `package.json`, after the `"visual:tag"` line, add:
```json
    "visual:report": "tsx content-engine/visual/scripts/matrixReport.ts",
```

- [ ] **Step 8: Run both scripts**

Run: `npm run visual:report`
Expected, before any tagging: every rule shows `0 0 0 165` and `below 20 on a side`; `none` near-duplicates; `none` oversize families; `Usable rules: 0 of 51`; `Untagged cells: 8415`.

Run: `npm run visual:icons`
Expected: `Normalized 165/165 icons`, no `Changed` line (the committed outputs are unchanged), exit code 0.

- [ ] **Step 9: Commit**

```bash
git add content-engine/visual/report.ts content-engine/visual/report.test.ts content-engine/visual/scripts/matrixReport.ts content-engine/visual/scripts/normalizeIcons.ts package.json
git commit -m "Add the visual matrix report and shape-tag re-check hints"
```

---

### Task 6: Backend types, the visualItems collection and the seed script

**Files:**
- Modify: `lib/types.ts` and `netlify/functions/_shared/types.ts` (the same edits in both)
- Modify: `lib/db.ts` and `netlify/functions/_shared/db.ts`
- Create: `content-engine/visual/scripts/seedVisual.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `ITEMS`, `validateItems` (Phase 1); `VISUAL_RULES` (Task 1); `getCollections` (`netlify/functions/_shared/db.js`, as `seedDatabase.ts` does).
- Produces (Phases 3–4 rely on these):
  - `interface VisualItemDoc { _id: string; name: string }`
  - `PuzzleDoc.kind?: 'word' | 'visual'` and `PuzzleDoc.generatorSeed?: number`
  - `getCollections().visualItems`
  - `npm run content:seed-visual`

These are type and wiring changes with nothing to unit-test. The typechecks are the test.

- [ ] **Step 1: Edit both `types.ts` copies**

Make these three edits in **both** `lib/types.ts` and `netlify/functions/_shared/types.ts` (the files are identical apart from import extensions, and neither edit touches an import).

After the closing `}` of `interface WordDoc`, add:
```ts

/** A visual item's caption (planning-visual-pivot.md §5.3). `_id` is the item id, which is also its icon's filename. */
export interface VisualItemDoc {
  _id: string
  name: string
}
```

In both `interface PuzzleClueDoc` and `interface PuzzleGuestDoc`, put this comment directly above `wordId: string`:
```ts
  /** A word id, or an item id when the puzzle is visual (planning-visual-pivot.md §3.3). */
```

In `interface PuzzleDoc`, between `difficultyTier: 'medium' | 'spicy'` and `ruleId: string`, add:
```ts
  /** Absent on every existing document, and absent means 'word', so nothing needs a backfill (planning-visual-pivot.md §3.3). */
  kind?: 'word' | 'visual'
  /** Visual only: the seed that reproduces this exact board (§4.6). */
  generatorSeed?: number
```

- [ ] **Step 2: Add the collection handle in both `db.ts` copies**

In `lib/db.ts`, replace the type import with:
```ts
import type { AiReviewDoc, PuzzleDoc, ResultDoc, RuleDoc, VisualItemDoc, WordDoc } from './types.js'
```
In `netlify/functions/_shared/db.ts`, the same, without the extension:
```ts
import type { AiReviewDoc, PuzzleDoc, ResultDoc, RuleDoc, VisualItemDoc, WordDoc } from './types'
```
In both, add the last line of the object `getCollections()` returns:
```ts
    aiReviews: db.collection<AiReviewDoc>('aiReviews'),
    visualItems: db.collection<VisualItemDoc>('visualItems'),
```

- [ ] **Step 3: Write the seed script**

`content-engine/visual/scripts/seedVisual.ts`:
```ts
// Loads the visual item captions and rules into MongoDB (planning-visual-pivot.md
// §5.3). Upserts only: nothing is ever deleted, and word documents are never
// touched. Retired rules and blocked items are written too, because a puzzle
// that already used one still needs its reveal text and captions.
// Run with: npm run content:seed-visual

import 'dotenv/config'
import { getCollections } from '../../../netlify/functions/_shared/db.js'
import { ITEMS } from '../items.js'
import { VISUAL_RULES } from '../rules.js'
import { validateItems } from '../validateItems.js'

async function main() {
  const problems = validateItems(ITEMS)
  if (problems.length > 0) {
    for (const p of problems) console.error(`INVALID  ${p}`)
    process.exit(1)
  }
  const { rules, visualItems } = await getCollections()

  console.log(`Upserting ${ITEMS.length} visual items...`)
  await visualItems.bulkWrite(
    ITEMS.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { name: item.name } },
        upsert: true,
      },
    }))
  )

  console.log(`Upserting ${VISUAL_RULES.length} visual rules...`)
  // $set, like seedDatabase.ts, so a live field set on a rule doc elsewhere
  // survives a re-seed. `subtlety` is required by RuleDoc; visual rules have
  // none (D7), so it is 0.
  await rules.bulkWrite(
    VISUAL_RULES.map((rule) => ({
      updateOne: {
        filter: { _id: rule.id },
        update: {
          $set: {
            name: rule.reveal,
            descriptionTemplate: rule.reveal,
            family: 'visual',
            subtlety: 0,
          },
        },
        upsert: true,
      },
    }))
  )

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Why the rule docs look like this:
- **`family: 'visual'`**, as spec §5.3 says. The visual family itself isn't needed on the server.
- **`name` and `descriptionTemplate` are both the reveal sentence.** `descriptionTemplate` is what `resolveRuleText` returns at the reveal, so the reveal works without a server change.
- **Nothing on the server lists the `rules` collection for the word generator.** The word engine generates from its code-defined `RULES`, and the only `rules.find` calls are id lookups and `subtletyOverride` reads. So visual rule docs can't leak into word generation.

- [ ] **Step 4: Add the npm script**

In `package.json`, after the `"visual:report"` line, add:
```json
    "content:seed-visual": "tsx content-engine/visual/scripts/seedVisual.ts",
```

- [ ] **Step 5: Run every typecheck, lint and the suite**

Run: `npm run typecheck:content-engine && npm run typecheck:netlify-functions && npm run typecheck:vercel-functions && npm run lint && npm test`
Expected: all clean. The suite was 594 tests after Phase 1 and is 633 now (39 new across Tasks 1, 2, 3 and 5).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/db.ts netlify/functions/_shared/types.ts netlify/functions/_shared/db.ts content-engine/visual/scripts/seedVisual.ts package.json
git commit -m "Add visual item and puzzle-kind fields and the visual seed script"
```

---

### Task 7: Tag the pilot, review it, and seed Atlas (human gate)

This task needs `GEMINI_API_KEY` and `MONGODB_URI` in `.env`, and a person to judge tags. It is the Phase 2 exit (spec §6): the pilot matrix AI-drafted and spot-reviewed, **≥30 pilot rules eligible**, and `content:seed-visual` run against Atlas.

- [ ] **Step 1: One-rule dry run**

Run: `npm run visual:tag -- --rule visual-floats --dry`
Expected: one line `visual-floats: <n> yes, <n> no, <n> unsure, 0 left untagged`, then up to 20 sample ids per answer, and `--dry: nothing written.` Read the samples. If the answers look systematically wrong, fix the rule's `reveal`/`basis` or the family's `FAMILY_BASIS` *before* spending the quota on a full run.

- [ ] **Step 2: Draft the whole pilot**

Run: `npm run visual:tag`
Expected: one line per rule, and the 11 `tags/*.ai.ts` files filled in. If it stops on quota, run the same command again later. It resumes where it left off.

- [ ] **Step 3: Read the report**

Run: `npm run visual:report`
Look at three things:
- **Usable rules.** The exit needs 30.
- **Near-duplicates.** For each pair, either retire one rule (`retired: true`, never delete) or edit the tags until the two ideas separate.
- **Oversize families.**

- [ ] **Step 4: Spot-review and override**

For each family, open `tags/<family>.ai.ts` next to the contact sheet (`content-engine/output/icon-sheet.html`) and check at least the `yes` list of every rule. A wrong cell becomes a line in `tags/<family>.overrides.ts`, for example:
```ts
export const TAGS: TagTable = {
  'visual-floats': { no: 'egg', yes: 'coconut' },
}
```
Pay particular attention to:
- **Shape rules.** These are judged on the icon as drawn, and the AI only saw the name.
- **Anything with a regional reading** (torch / flashlight).

Then:
- Re-run `npm run visual:report`.
- Re-run `npx vitest run content-engine/visual/matrix.test.ts`. It fails on a typo'd item or rule id in an override file.

- [ ] **Step 5: If fewer than 30 rules are usable**

Add broad pilot rules to `rules.ts` (they need ≥20 yes **and** ≥20 no among 165 items), then run `npm run visual:tag` again. It only asks about the new rules. Don't loosen `MIN_DEFINITE_PER_SIDE` to get there; the threshold is the spec's.

- [ ] **Step 6: Seed Atlas**

Run: `npm run content:seed-visual`
Expected: `Upserting 165 visual items...`, `Upserting <n> visual rules...`, `Done.`
In Atlas, `visualItems` has 165 documents. `rules` has the visual docs alongside the word ones, and its word docs are unchanged (same count as before, plus the visual ones).

- [ ] **Step 7: Mark Phase 2 done in the spec**

In `planning-visual-pivot.md`:
- §6, under Phase 2, add: `**Status:** done YYYY-MM-DD (<n> rules, <k> usable; <m> override cells).`
- §4.1, replace the authoring-check sentence's "agree on ≥90% of items both have definite tags for" with "overlap at ≥0.8 on both their yes-sets and their no-sets (see `report.ts`)".

- [ ] **Step 8: Commit**

```bash
git add content-engine/visual/tags content-engine/visual/rules.ts planning-visual-pivot.md planning-visual-pivot-phase2.md
git commit -m "Tag the visual pilot matrix and record the Phase 2 review"
```

---

## Self-review against the spec

| Spec requirement (planning-visual-pivot.md) | Task |
|---|---|
| §3.1 `types.ts` (Tri, VisualRule, Family), `rules.ts`, `tags/<family>.ai.ts` + `.overrides.ts`, `matrix.ts`, `tagging.ts`, scripts `tagVisualAi`, `matrixReport`, `seedVisual` | 1–6 |
| §3.5 rule ids permanent; retire, never rename or delete | 1 (id rules, comment), 2 (tag-file test fails on a renamed id) |
| §4.1 every family represented; group rules present; reveal text + tagging basis | 1 |
| §4.1 shape family judged on the icon; a redrawn icon lists its shape tags | 1 (`FAMILY_BASIS.shape`), 5 (Step 6), 7 (Step 4) |
| §4.1 near-duplicate authoring check | 5 (measure revised, recorded above) |
| §4.2 yes/no/unsure → true/false/null; untagged kept apart in reports; overrides win per cell; space-separated strings | 2 |
| §4.3 pure prompt + validation, unknown ids and answers dropped | 3 |
| §4.3 3 passes, unanimous or `unsure`; resumable; offline only | 3 (consensus, `itemsToTag`), 4 |
| §4.3 report: counts, thin rules, near-duplicates, family cap, runway | 5 |
| §4.5 step 1 eligibility (≥20 / ≥20, blocked excluded) | 5 (`countRule`, reused by Phase 3) |
| §5.3 `visualItems` collection; visual rules in `rules` with `visual-` ids and `family: 'visual'`; seed upserts only | 6 |
| §3.3 `PuzzleDoc.kind?`, `generatorSeed?` (additive, both copies) | 6 |
| §6 Phase 2 exit: AI-drafted, spot-reviewed, ≥30 eligible, seeded | 7 |
| Global: nothing deleted; word engine untouched; ESM `.js` imports | all tasks |

**Decisions this plan makes that the spec left open:**
- **The pilot taxonomy has 51 rules**, not "~40". That's headroom for the ≥30-usable exit.
- **The AI judges shape rules from the item's name**, with "as usually drawn in a simple emoji-style icon" as its basis. A human checks them against the contact sheet (Task 7). Sending icons to the model is a possible later improvement, not needed for the pilot.
- **A rule's tagging guidance is its family's `FAMILY_BASIS` plus an optional per-rule `basis`**, rather than a full `basis` on every rule.
- **`RuleDoc.subtlety` is 0 for visual rules** (D7). The field is required by the shared type.

## Changes made during execution

Fixes from the final whole-branch review (see `.superpowers/sdd/planning-visual-pivot-phase2/final-findings.md`):
- **I1:** `tagVisualAi.ts`'s `askOnce` now retries an incomplete response (fewer ids answered than asked) instead of letting `consensus` settle the gap as `unsure`; the last attempt returns `null` and logs the shortfall.
- **I2:** the tagger's rule filter no longer skips `retired` rules — retired rules stay rivals (§3.5) and so must still be tagged.
- **I3:** a failed call now stops the whole run: it writes the current rule's answers gathered so far (if any, and not `--dry`), logs which rule and item range failed, and exits 1 telling the operator to re-run later. Writing a tag-file row for a rule with zero new cells is now skipped on both the failure and normal paths.
- **M1:** `rules.test.ts` gained an inline-snapshot test of `VISUAL_RULES.map((r) => r.id)`, so a removed or renamed id (instead of `retired: true`) fails CI.
- **M2:** §4.1's authoring-check sentence now states the Jaccard ≥0.8 overlap measure `report.ts` actually implements, instead of the earlier "≥90% agreement" phrasing.
- **M3:** the tagger validates `--family` against `FAMILIES` and `--rule` against `VISUAL_RULES` ids before any network call, and a flag given with no value is also an error.
- **M4:** `matrix.ts`'s `idsOf` splits on `/\s+/` instead of a single space, so a tag-file row id list can wrap lines; `matrix.test.ts` covers it.
