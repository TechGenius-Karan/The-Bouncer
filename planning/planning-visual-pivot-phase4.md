# Visual Pivot — Phase 4a Implementation Plan (server and ops)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both backends serve, generate, approve and report on visual puzzles behind the `PUZZLE_KIND` switch, while word puzzles behave exactly as they do today.

**Architecture:**
- **Additive contract.** `GetRoundResponse` gains `kind?` and `clueIds?`. Everything else keeps its shape, with item ids in the existing `wordId` fields and captions in the existing `word` fields. `check-swipe` is untouched.
- **Captions** come from one `resolveNames(puzzle, ids)` helper per backend. It reads `visualItems` for a visual puzzle and `words` otherwise, and every place that used to look up spellings calls it.
- **Testable rules live in db-free modules.** `lib/visual.ts` (and its `_shared` twin) holds rule uniqueness, the `PUZZLE_KIND` reading and the get-round fields. `content-engine/visual/batch.ts` holds generation and the puzzle-document mapping, and **all four** generation entry points call it. That removes spec §2.7's risk (a new field silently dropped by one of four hand-written mappings) by construction, rather than with four mapping tests.

**Tech Stack:** TypeScript, MongoDB driver 7, Vitest 4 (with `vi.mock` for the one db-backed test), Netlify Functions, Vercel Functions.

**Spec:** [`planning-visual-pivot.md`](planning-visual-pivot.md). Phase 4a is §6, implementing §3.3 (the switch), §3.5 (uniqueness at approval), §5.3 (contract and server) and §5.4 (buffer, runway, cron). Requires Phases 2 and 3 ([`phase2`](planning-visual-pivot-phase2.md), [`phase3`](planning-visual-pivot-phase3.md)). The UI half is [`planning-visual-pivot-phase4-ui.md`](planning-visual-pivot-phase4-ui.md).

## Global Constraints

- **With `PUZZLE_KIND` unset, production behaves byte-for-byte as today** (spec §5.6 step 1). Every visual branch is keyed on `puzzle.kind === 'visual'` or on `PUZZLE_KIND=visual`, and no word puzzle has `kind`.
- **Nothing existing is deleted.** No Mongo document or collection is removed. `check-swipe.ts` (both copies) is not touched (spec §2.2).
- **Three contract copies, two backend copies.**
  - The wire contract lives in `lib/api.ts`, `netlify/functions/_shared/api.ts` and `src/api/types.ts`.
  - Admin wire types live in `lib/adminApi.ts`, `netlify/functions/_shared/adminApi.ts` and `src/admin/types.ts`.
  - Every `lib/X.ts` change is made to `netlify/functions/_shared/X.ts` too.
  - Imports: `.js` extensions in `lib/`, `api/`, `content-engine/`; none in `netlify/functions/` (CLAUDE.md).
- **Zero new files under `api/`.** Vercel Hobby allows 12 functions and 9 are in use (CLAUDE.md). New admin behaviour goes into `api/admin.ts`'s existing actions.
- **`api/admin.ts` is not live but is kept in sync** with the Netlify admin functions (CLAUDE.md). It has no edit action, so the manual-edit refusal is Netlify-only.
- **Branch:** keep working on the pivot branch, `visual-pivot-phase1` (draft PR #1). The whole pivot reaches `main` as one squash-merge, since each Netlify production deploy costs 15 credits. Vercel deploys from the same merge.
- **Formatting:** run Prettier only on files that were Prettier-clean before you touched them. These four aren't, so keep their edits hand-formatted exactly as shown:
  - `netlify/functions/_shared/puzzleStats.ts`
  - `netlify/functions/admin-approve.ts`
  - `netlify/functions/admin-edit-puzzle.ts`
  - `netlify/functions/admin-ai-review.ts`

  Check a file with `npx prettier --check --end-of-line auto <file>`.
- **Windows line endings:** `git diff --ignore-cr-at-eol` shows the real change. The diffs below were taken that way from a verified working copy, so their `@@` line numbers assume Phases 1–3 are in.
- **Commits:** a short one-line message, with no `Co-Authored-By` or `Claude-Session` trailer. Commit only if the user has okayed it for this run.

## File structure

| File | Change |
|---|---|
| `lib/api.ts`, `netlify/functions/_shared/api.ts`, `src/api/types.ts` | `GetRoundResponse.kind?`, `clueIds?` |
| `lib/types.ts`, `netlify/functions/_shared/types.ts` | `DecoyResult.negated?` |
| `lib/visual.ts`, `netlify/functions/_shared/visual.ts` (new, + tests) | `PuzzleKind`, `puzzleKindFrom`, `RULE_HOLDING_STATUSES`, `VISUAL_RULE_USAGE_FILTER`, `splitVisualRuleUsage`, `ruleHolderFilter`, `visualRoundFields` |
| `lib/names.ts`, `netlify/functions/_shared/names.ts` (new) | `resolveNames`: captions for a puzzle's ids |
| `lib/roundView.ts` (+ new `roundView.test.ts`), `_shared/roundView.ts` | Captions via `resolveNames` |
| `api/get-round.ts`, `netlify/functions/get-round.ts` | `...visualRoundFields(puzzle)` |
| `lib/adminPuzzleDetail.ts`, `_shared/adminPuzzleDetail.ts` | Captions, `kind`, `negated` |
| `lib/puzzleStats.ts`, `_shared/puzzleStats.ts` | Captions; buffer health takes `kind`, counts visual separately, word counts exclude visual |
| `api/archive.ts`, `netlify/functions/archive.ts` | Captions |
| `lib/adminApi.ts`, `_shared/adminApi.ts`, `src/admin/types.ts` | `kind?`, `negated?`, buffer fields, `AdminGenerateBatchRequest.kind?` |
| `content-engine/visual/batch.ts` (new, + test) | `generateVisualBatch`, `toVisualPuzzleDoc`, `generateVisualDocs`, `visualRunway` |
| `netlify/functions/admin-approve.ts`, `api/admin.ts` (approve) | Refuse an already-held visual rule (409) |
| `netlify/functions/admin-edit-puzzle.ts`, `admin-ai-review.ts`, `api/admin.ts` (ai-review) | Refuse visual puzzles (400, D11) |
| `netlify/functions/admin-buffer-health.ts`, `api/admin.ts` (buffer-health) | `PUZZLE_KIND` and the runway |
| `netlify/functions/admin-generate-batch.ts`, `api/admin.ts` (generate-batch), `api/scheduled-generate-puzzles.ts`, `content-engine/scripts/queuePuzzles.ts` | The visual generation path |

---

### Task 1: The contract fields and the server's visual rules

**Files:**
- Modify: `lib/api.ts`, `netlify/functions/_shared/api.ts`, `src/api/types.ts`
- Modify: `lib/types.ts`, `netlify/functions/_shared/types.ts`
- Create: `lib/visual.ts`, `netlify/functions/_shared/visual.ts`
- Test: `lib/visual.test.ts`, `netlify/functions/_shared/visual.test.ts`

**Interfaces:**
- Consumes: `PuzzleDoc.kind?` (Phase 2).
- Produces:
  - `GetRoundResponse.kind?: 'visual'` and `clueIds?: { in: string[]; out: string[] }`
  - `DecoyResult.negated?: true`
  - From `visual.ts`:
    - `type PuzzleKind`
    - `puzzleKindFrom(value): PuzzleKind`
    - `RULE_HOLDING_STATUSES`
    - `VISUAL_RULE_USAGE_FILTER: Filter<PuzzleDoc>`
    - `splitVisualRuleUsage(docs): { usedRuleIds; pendingRuleIds }`
    - `ruleHolderFilter(ruleId, exceptId): Filter<PuzzleDoc>`
    - `visualRoundFields(puzzle): Pick<GetRoundResponse, 'kind' | 'clueIds'>`

- [ ] **Step 1: Write the failing test**

`lib/visual.test.ts`:
```ts
import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import type { PuzzleClueDoc } from './types.js'
import {
  puzzleKindFrom,
  ruleHolderFilter,
  splitVisualRuleUsage,
  VISUAL_RULE_USAGE_FILTER,
  visualRoundFields,
} from './visual.js'

describe('puzzleKindFrom', () => {
  it('is visual only for exactly "visual"', () => {
    expect(puzzleKindFrom('visual')).toBe('visual')
    expect(puzzleKindFrom(undefined)).toBe('word')
    expect(puzzleKindFrom('')).toBe('word')
  })
})

describe('visual rule usage (§3.5)', () => {
  it('counts approved, scheduled and live as used, pending as pending, and frees rejected', () => {
    const { usedRuleIds, pendingRuleIds } = splitVisualRuleUsage([
      { ruleId: 'visual-a', status: 'approved' },
      { ruleId: 'visual-b', status: 'scheduled' },
      { ruleId: 'visual-c', status: 'live' },
      { ruleId: 'visual-d', status: 'pending_approval' },
      { ruleId: 'visual-e', status: 'rejected' },
    ])
    expect([...usedRuleIds]).toEqual(['visual-a', 'visual-b', 'visual-c'])
    expect([...pendingRuleIds]).toEqual(['visual-d'])
  })

  it('only reads visual puzzles', () => {
    expect(VISUAL_RULE_USAGE_FILTER).toMatchObject({ kind: 'visual' })
  })

  it('lets approval through when the only earlier use was rejected or unscheduled', () => {
    const self = new ObjectId()
    expect(ruleHolderFilter('visual-a', self)).toEqual({
      kind: 'visual',
      ruleId: 'visual-a',
      status: { $in: ['approved', 'scheduled', 'live'] },
      _id: { $ne: self },
    })
  })
})

describe('visualRoundFields', () => {
  const clues: PuzzleClueDoc[] = [
    { wordId: 'anchor', label: 'IN', displayOrder: 0 },
    { wordId: 'cork', label: 'OUT', displayOrder: 1 },
    { wordId: 'coin', label: 'IN', displayOrder: 2 },
  ]

  it('adds nothing to a word round', () => {
    expect(visualRoundFields({ clues })).toEqual({})
    expect(visualRoundFields({ kind: 'word', clues })).toEqual({})
  })

  it('adds kind and the clue ids, in clue order, to a visual round', () => {
    expect(visualRoundFields({ kind: 'visual', clues })).toEqual({
      kind: 'visual',
      clueIds: { in: ['anchor', 'coin'], out: ['cork'] },
    })
  })
})
```
`netlify/functions/_shared/visual.test.ts` is the same file with extensionless imports (`'./types'`, `'./visual'`).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/visual.test.ts netlify/functions/_shared/visual.test.ts`
Expected: FAIL, because `./visual.js` doesn't exist.

- [ ] **Step 3: Add the contract fields**

Apply to `lib/api.ts`, and the identical hunk to `netlify/functions/_shared/api.ts`:
```diff
--- a/lib/api.ts
+++ b/lib/api.ts
@@ -26,6 +26,10 @@ export interface GetRoundResponse {
   roundComplete: boolean
   /** Only populated once roundComplete is true — never sent early. */
   ruleText: string | null
+  /** Absent for word puzzles. Old clients ignore it and render `clues`, which hold item names (planning-visual-pivot.md §5.3). */
+  kind?: 'visual'
+  /** Visual only: item ids in the same order as `clues.in` / `clues.out`. */
+  clueIds?: { in: string[]; out: string[] }
 }
 
 export interface CheckSwipeRequest {
```
And to `src/api/types.ts`:
```diff
--- a/src/api/types.ts
+++ b/src/api/types.ts
@@ -23,6 +23,10 @@ export interface GetRoundResponse {
   livesRemaining: number
   roundComplete: boolean
   ruleText: string | null
+  /** Absent for word puzzles. Old clients ignore it and render `clues`, which hold item names (planning-visual-pivot.md §5.3). */
+  kind?: 'visual'
+  /** Visual only: item ids in the same order as `clues.in` / `clues.out`. */
+  clueIds?: { in: string[]; out: string[] }
 }
 
 export interface CheckSwipeResponse {
```

In **both** `lib/types.ts` and `netlify/functions/_shared/types.ts`, add the last field of `interface DecoyResult`:
```ts
export interface DecoyResult {
  ruleId: string
  subtlety: number
  /** Visual only: the rule fits read the other way round (planning-visual-pivot.md §4.4). */
  negated?: true
}
```

- [ ] **Step 4: Write the helpers**

`lib/visual.ts`:
```ts
import type { Filter, ObjectId } from 'mongodb'
import type { GetRoundResponse } from './api.js'
import type { PuzzleDoc, PuzzleStatus } from './types.js'

// Server-side rules for visual puzzles (planning-visual-pivot.md). Nothing
// here touches the database, so all of it is unit-tested; handlers run the
// queries.

export type PuzzleKind = 'word' | 'visual'

/** `PUZZLE_KIND` (§3.3). Unset means word, so deploying changes nothing. Same reading as content-engine/scheduling/placement.ts. */
export function puzzleKindFrom(value: string | undefined): PuzzleKind {
  return value === 'visual' ? 'visual' : 'word'
}

/**
 * §3.5: a visual rule is spent while any visual puzzle using it is in one of
 * these. Rejecting frees it, and unscheduling returns a puzzle to pending.
 */
export const RULE_HOLDING_STATUSES: PuzzleStatus[] = ['approved', 'scheduled', 'live']

/** Every visual puzzle that holds a rule or is queued for review with one. */
export const VISUAL_RULE_USAGE_FILTER: Filter<PuzzleDoc> = {
  kind: 'visual',
  status: { $in: [...RULE_HOLDING_STATUSES, 'pending_approval'] },
}

/** Splits VISUAL_RULE_USAGE_FILTER's results into the generator's two exclusion sets. */
export function splitVisualRuleUsage(docs: Pick<PuzzleDoc, 'ruleId' | 'status'>[]): {
  usedRuleIds: Set<string>
  pendingRuleIds: Set<string>
} {
  const usedRuleIds = new Set<string>()
  const pendingRuleIds = new Set<string>()
  for (const doc of docs) {
    if (RULE_HOLDING_STATUSES.includes(doc.status)) usedRuleIds.add(doc.ruleId)
    else if (doc.status === 'pending_approval') pendingRuleIds.add(doc.ruleId)
  }
  return { usedRuleIds, pendingRuleIds }
}

/** Another visual puzzle already holding this rule. Approval refuses while one exists. */
export function ruleHolderFilter(ruleId: string, exceptId: ObjectId): Filter<PuzzleDoc> {
  return { kind: 'visual', ruleId, status: { $in: RULE_HOLDING_STATUSES }, _id: { $ne: exceptId } }
}

/** get-round's additive fields (§5.3). None for a word puzzle, so word rounds are unchanged. */
export function visualRoundFields(
  puzzle: Pick<PuzzleDoc, 'kind' | 'clues'>
): Pick<GetRoundResponse, 'kind' | 'clueIds'> {
  if (puzzle.kind !== 'visual') return {}
  const idsOf = (label: 'IN' | 'OUT') =>
    puzzle.clues.filter((c) => c.label === label).map((c) => c.wordId)
  return { kind: 'visual', clueIds: { in: idsOf('IN'), out: idsOf('OUT') } }
}
```
`netlify/functions/_shared/visual.ts` is the same file with extensionless imports (`'./api'`, `'./types'`).

`PuzzleKind` and `puzzleKindFrom` repeat `content-engine/scheduling/placement.ts`'s two lines on purpose: `lib/` and `_shared/` don't import `content-engine/` (CLAUDE.md), and the reading is a one-liner.

- [ ] **Step 5: Run the tests and every typecheck**

Run: `npx vitest run lib/visual.test.ts netlify/functions/_shared/visual.test.ts && npm run typecheck:vercel-functions && npm run typecheck:netlify-functions && npx tsc --noEmit`
Expected: PASS (6 + 6 tests), clean typechecks.

- [ ] **Step 6: Commit**

```bash
git add lib/api.ts lib/types.ts lib/visual.ts lib/visual.test.ts netlify/functions/_shared/api.ts netlify/functions/_shared/types.ts netlify/functions/_shared/visual.ts netlify/functions/_shared/visual.test.ts src/api/types.ts
git commit -m "Add the visual round fields and server-side rule-uniqueness helpers"
```

---

### Task 2: Captions everywhere, and kind-aware buffer counts

**Files:**
- Create: `lib/names.ts`, `netlify/functions/_shared/names.ts`
- Modify: `lib/roundView.ts`, `netlify/functions/_shared/roundView.ts`
- Test: `lib/roundView.test.ts`
- Modify: `api/get-round.ts`, `netlify/functions/get-round.ts`
- Modify: `lib/adminPuzzleDetail.ts`, `netlify/functions/_shared/adminPuzzleDetail.ts`
- Modify: `lib/puzzleStats.ts`, `netlify/functions/_shared/puzzleStats.ts`
- Modify: `api/archive.ts`, `netlify/functions/archive.ts`
- Modify: `lib/adminApi.ts`, `netlify/functions/_shared/adminApi.ts`, `src/admin/types.ts`

**Interfaces:**
- Consumes: `visualRoundFields`, `PuzzleKind` (Task 1); `getCollections().visualItems` (Phase 2).
- Produces:
  - `resolveNames(puzzle: Pick<PuzzleDoc, 'kind'>, ids: string[]): Promise<(id: string) => string>`
  - `resolveBufferHealth(now?: Date, kind?: PuzzleKind)`, now returning `kind` and `visualBufferDays` as well
  - Admin types:
    - `AdminPuzzleDetail.kind?: 'visual'`
    - `AdminLiveDecoyDetail.negated?: true`
    - `AdminBufferHealthResponse { kind; mediumBufferDays; spicyBufferWeeks; visualBufferDays; runway?; gapDates }`
    - `AdminGenerateBatchRequest.kind?: 'word' | 'visual'`

**The one behaviour change on the word path, and why it's a no-op today:** the word buffer counts gain `kind: { $ne: 'visual' }`. Visual puzzles are stored as medium (§3.4), so without it they'd be counted as word days. No document has `kind` yet, so the numbers are unchanged until visual puzzles exist.

- [ ] **Step 1: Write the failing test**

`lib/roundView.test.ts` fakes `db.js`, the same way `content-engine/words/tagSuggestion.test.ts` fakes its network module, because `db.ts` throws at import without `MONGODB_URI`:
```ts
import { describe, expect, it, vi } from 'vitest'

// db.ts throws at import without MONGODB_URI, so the collections are faked:
// just enough of find({ _id: { $in } }).toArray() for the name lookups.
vi.mock('./db.js', () => {
  const collection = <T extends { _id: string }>(docs: T[]) => ({
    find: (filter: { _id: { $in: string[] } }) => ({
      toArray: async () => docs.filter((d) => filter._id.$in.includes(d._id)),
    }),
  })
  return {
    getCollections: async () => ({
      words: collection([{ _id: 'anchor', spelling: 'anchor-word' }]),
      visualItems: collection([
        { _id: 'anchor', name: 'anchor' },
        { _id: 'ice-cube', name: 'ice cube' },
        { _id: 'stick-of-butter', name: 'stick of butter' },
      ]),
    }),
  }
})

import { buildPool, resolveClueWords } from './roundView.js'
import type { PuzzleDoc, ResultDoc } from './types.js'

const puzzle = {
  kind: 'visual',
  clues: [
    { wordId: 'anchor', label: 'IN', displayOrder: 0 },
    { wordId: 'ice-cube', label: 'OUT', displayOrder: 1 },
  ],
  guests: [
    { wordId: 'stick-of-butter', trueLabel: 'OUT', displayOrder: 0, isTrap: false, trapType: null },
    { wordId: 'ice-cube', trueLabel: 'IN', displayOrder: 1, isTrap: true, trapType: 'decoy' },
  ],
} as unknown as PuzzleDoc

const result = (roundComplete: boolean) =>
  ({
    roundComplete,
    placements: [{ wordId: 'ice-cube', attemptedLabel: 'OUT', correct: false }],
  }) as unknown as ResultDoc

describe('roundView for a visual puzzle (planning-visual-pivot.md §5.3)', () => {
  it('captions clues with item names', async () => {
    expect(await resolveClueWords(puzzle)).toEqual({ in: ['anchor'], out: ['ice cube'] })
  })

  it('keeps every true label hidden mid-round, apart from what the swipe already showed', async () => {
    expect(await buildPool(puzzle, result(false))).toEqual([
      { wordId: 'stick-of-butter', word: 'stick of butter' },
      { wordId: 'ice-cube', word: 'ice cube', attempted: { label: 'OUT', correct: false } },
    ])
  })

  it('reveals every item, swiped or not, once the round is over', async () => {
    const pool = await buildPool(puzzle, result(true))
    expect(pool.map((p) => [p.word, p.trueLabel])).toEqual([
      ['stick of butter', 'OUT'],
      ['ice cube', 'IN'],
    ])
  })

  it('still reads spellings for a word puzzle', async () => {
    const word = { ...puzzle, kind: undefined } as PuzzleDoc
    expect((await resolveClueWords(word)).in).toEqual(['anchor-word'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/roundView.test.ts`
Expected: FAIL. Captions come back as raw ids (`ice-cube`), because `roundView` still reads `words` only.

- [ ] **Step 3: Write the caption helper**

`lib/names.ts`:
```ts
import { getCollections } from './db.js'
import type { PuzzleDoc } from './types.js'

/**
 * What a player or reviewer reads for each id on a puzzle: item names for a
 * visual puzzle, spellings for a word one (planning-visual-pivot.md §5.3). An
 * id with no document reads as itself, which for an item slug is still sensible.
 */
export async function resolveNames(
  puzzle: Pick<PuzzleDoc, 'kind'>,
  ids: string[]
): Promise<(id: string) => string> {
  const { words, visualItems } = await getCollections()
  const pairs: [string, string][] =
    puzzle.kind === 'visual'
      ? (await visualItems.find({ _id: { $in: ids } }).toArray()).map((d) => [d._id, d.name])
      : (await words.find({ _id: { $in: ids } }).toArray()).map((w) => [w._id, w.spelling])
  const nameOf = new Map(pairs)
  return (id) => nameOf.get(id) ?? id
}
```
`netlify/functions/_shared/names.ts` is the same file with extensionless imports (`'./db'`, `'./types'`).

- [ ] **Step 4: Use it in roundView (both copies)**

`lib/roundView.ts` (apply the same change to `netlify/functions/_shared/roundView.ts`, with `'./names'`):
```diff
--- a/lib/roundView.ts
+++ b/lib/roundView.ts
@@ -1,15 +1,17 @@
 import type { PoolItem } from './api.js'
 import { getCollections } from './db.js'
+import { resolveNames } from './names.js'
 import type { PuzzleDoc, ResultDoc } from './types.js'
 
 export async function buildPool(puzzle: PuzzleDoc, result: ResultDoc): Promise<PoolItem[]> {
-  const { words } = await getCollections()
-  const wordDocs = await words.find({ _id: { $in: puzzle.guests.map((g) => g.wordId) } }).toArray()
-  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
+  const nameOf = await resolveNames(
+    puzzle,
+    puzzle.guests.map((g) => g.wordId)
+  )
   const placementsByWordId = new Map(result.placements.map((p) => [p.wordId, p]))
 
   return puzzle.guests.map((g) => {
-    const item: PoolItem = { wordId: g.wordId, word: spellingOf.get(g.wordId) ?? g.wordId }
+    const item: PoolItem = { wordId: g.wordId, word: nameOf(g.wordId) }
     if (result.roundComplete) item.trueLabel = g.trueLabel
     const placement = placementsByWordId.get(g.wordId)
     if (placement) item.attempted = { label: placement.attemptedLabel, correct: placement.correct }
@@ -39,16 +41,12 @@ export async function resolveRuleText(puzzle: PuzzleDoc): Promise<string | null>
 export async function resolveClueWords(
   puzzle: PuzzleDoc
 ): Promise<{ in: string[]; out: string[] }> {
-  const { words } = await getCollections()
-  const wordDocs = await words.find({ _id: { $in: puzzle.clues.map((c) => c.wordId) } }).toArray()
-  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
-
+  const nameOf = await resolveNames(
+    puzzle,
+    puzzle.clues.map((c) => c.wordId)
+  )
   return {
-    in: puzzle.clues
-      .filter((c) => c.label === 'IN')
-      .map((c) => spellingOf.get(c.wordId) ?? c.wordId),
-    out: puzzle.clues
-      .filter((c) => c.label === 'OUT')
-      .map((c) => spellingOf.get(c.wordId) ?? c.wordId),
+    in: puzzle.clues.filter((c) => c.label === 'IN').map((c) => nameOf(c.wordId)),
+    out: puzzle.clues.filter((c) => c.label === 'OUT').map((c) => nameOf(c.wordId)),
   }
 }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/roundView.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Pass the fields through get-round (both copies)**

```diff
--- a/api/get-round.ts
+++ b/api/get-round.ts
@@ -14,6 +14,7 @@ import { isValidPuzzleDateString, resolvePuzzleDateString } from '../lib/puzzleD
 import { jsonResponse } from '../lib/respond.js'
 import { buildPool, resolveClueWords, resolveRuleText } from '../lib/roundView.js'
 import type { PuzzleDoc, ResultDoc } from '../lib/types.js'
+import { visualRoundFields } from '../lib/visual.js'
 
 // Lets us simulate a different "today" to manually walk through a
 // multi-day schedule without touching the system clock. Fails closed: local
@@ -94,6 +95,7 @@ export default {
       livesRemaining: result.livesRemaining,
       roundComplete: result.roundComplete,
       ruleText,
+      ...visualRoundFields(puzzle),
     }
 
     return jsonResponse(response)
```
```diff
--- a/netlify/functions/get-round.ts
+++ b/netlify/functions/get-round.ts
@@ -13,6 +13,7 @@ import { isValidPuzzleDateString, resolvePuzzleDateString } from './_shared/puzz
 import { jsonResponse } from './_shared/respond'
 import { buildPool, resolveClueWords, resolveRuleText } from './_shared/roundView'
 import type { PuzzleDoc, ResultDoc } from './_shared/types'
+import { visualRoundFields } from './_shared/visual'
 
 // Lets us simulate a different "today" to manually walk through a
 // multi-day schedule without touching the system clock. Fails closed: only
@@ -96,6 +97,7 @@ export default async (req: Request): Promise<Response> => {
     livesRemaining: result.livesRemaining,
     roundComplete: result.roundComplete,
     ruleText,
+    ...visualRoundFields(puzzle),
   }
 
   return jsonResponse(response)
```

- [ ] **Step 7: Captions in the admin detail, stats and archive**

`lib/adminPuzzleDetail.ts` (same change in `netlify/functions/_shared/adminPuzzleDetail.ts`, extensionless):
```diff
--- a/lib/adminPuzzleDetail.ts
+++ b/lib/adminPuzzleDetail.ts
@@ -1,5 +1,6 @@
 import type { AdminPuzzleDetail } from './adminApi.js'
 import { getCollections } from './db.js'
+import { resolveNames } from './names.js'
 import type { PuzzleDoc } from './types.js'
 
 /**
@@ -10,18 +11,17 @@ import type { PuzzleDoc } from './types.js'
  * resolvers, which are gated the opposite way on purpose.
  */
 export async function resolveFullPuzzleDetail(puzzle: PuzzleDoc): Promise<AdminPuzzleDetail> {
-  const { words, rules } = await getCollections()
+  const { rules } = await getCollections()
 
   const wordIds = [...puzzle.clues.map((c) => c.wordId), ...puzzle.guests.map((g) => g.wordId)]
   const ruleIds = [puzzle.ruleId, ...puzzle.liveDecoys.map((d) => d.ruleId)]
   if (puzzle.revealRuleId) ruleIds.push(puzzle.revealRuleId)
 
-  const [wordDocs, ruleDocs] = await Promise.all([
-    words.find({ _id: { $in: wordIds } }).toArray(),
+  const [nameOf, ruleDocs] = await Promise.all([
+    resolveNames(puzzle, wordIds),
     rules.find({ _id: { $in: ruleIds } }).toArray(),
   ])
 
-  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
   const ruleById = new Map(ruleDocs.map((r) => [r._id, r]))
   // The reviewer must be shown the text the PLAYER will get, which is the
   // reveal rule where the validator accepted a collision and swapped it —
@@ -31,6 +31,7 @@ export async function resolveFullPuzzleDetail(puzzle: PuzzleDoc): Promise<AdminP
 
   return {
     puzzleId: puzzle._id!.toString(),
+    ...(puzzle.kind === 'visual' ? { kind: 'visual' as const } : {}),
     number: puzzle.number,
     difficultyTier: puzzle.difficultyTier,
     status: puzzle.status,
@@ -51,12 +52,12 @@ export async function resolveFullPuzzleDetail(puzzle: PuzzleDoc): Promise<AdminP
       `(No description found for rule "${puzzle.ruleId}" — run "npm run content:seed-db" to sync the rules collection.)`,
     clues: puzzle.clues.map((c) => ({
       wordId: c.wordId,
-      word: spellingOf.get(c.wordId) ?? c.wordId,
+      word: nameOf(c.wordId),
       label: c.label,
     })),
     guests: puzzle.guests.map((g) => ({
       wordId: g.wordId,
-      word: spellingOf.get(g.wordId) ?? g.wordId,
+      word: nameOf(g.wordId),
       trueLabel: g.trueLabel,
       isTrap: g.isTrap,
       trapType: g.trapType,
@@ -65,6 +66,7 @@ export async function resolveFullPuzzleDetail(puzzle: PuzzleDoc): Promise<AdminP
       ruleId: d.ruleId,
       ruleName: ruleById.get(d.ruleId)?.name ?? d.ruleId,
       subtlety: d.subtlety,
+      ...(d.negated ? { negated: true as const } : {}),
     })),
     knobValues: puzzle.knobValues,
     createdAt: puzzle.createdAt.toISOString(),
```

`api/archive.ts`:
```diff
--- a/api/archive.ts
+++ b/api/archive.ts
@@ -20,6 +20,7 @@ import {
 } from '../lib/archiveView.js'
 import { pastPuzzleFilter } from '../lib/archiveQuery.js'
 import { getCollections } from '../lib/db.js'
+import { resolveNames } from '../lib/names.js'
 import { isValidPuzzleDateString, resolvePuzzleDateString } from '../lib/puzzleDate.js'
 
 // A past puzzle never changes, so these are safe to cache hard. Keeps crawler
@@ -44,7 +45,7 @@ export default {
     const wantsDetail = requested !== undefined && requested !== 'archive'
 
     const today = resolvePuzzleDateString()
-    const { puzzles, words, rules } = await getCollections()
+    const { puzzles, rules } = await getCollections()
 
     if (!wantsDetail) {
       const docs = await puzzles
@@ -76,12 +77,8 @@ export default {
     const doc = await puzzles.findOne(pastPuzzleFilter(today, { date: requested }))
     if (!doc) return html(renderNotFound(), 404)
 
-    const [wordDocs, rule, previousDoc, nextDoc] = await Promise.all([
-      words
-        .find({
-          _id: { $in: [...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)] },
-        })
-        .toArray(),
+    const [nameOf, rule, previousDoc, nextDoc] = await Promise.all([
+      resolveNames(doc, [...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)]),
       rules.findOne({ _id: doc.revealRuleId ?? doc.ruleId }),
       puzzles.findOne(pastPuzzleFilter(today, { date: { $lt: requested } }), {
         projection: { date: 1 },
@@ -92,16 +89,14 @@ export default {
         sort: { date: 1 },
       }),
     ])
-
-    const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
     const puzzle: ArchivePuzzle = {
       date: doc.date as string,
       number: doc.number,
       ruleName: rule?.name ?? doc.ruleId,
       ruleDescription: doc.manualRuleText ?? rule?.descriptionTemplate ?? '',
-      clues: doc.clues.map((c) => ({ word: spellingOf.get(c.wordId) ?? c.wordId, label: c.label })),
+      clues: doc.clues.map((c) => ({ word: nameOf(c.wordId), label: c.label })),
       guests: doc.guests.map((g) => ({
-        word: spellingOf.get(g.wordId) ?? g.wordId,
+        word: nameOf(g.wordId),
         trueLabel: g.trueLabel,
       })),
     }
```
`netlify/functions/archive.ts`:
```diff
--- a/netlify/functions/archive.ts
+++ b/netlify/functions/archive.ts
@@ -20,6 +20,7 @@ import {
 } from './_shared/archiveView'
 import { pastPuzzleFilter } from './_shared/archiveQuery'
 import { getCollections } from './_shared/db'
+import { resolveNames } from './_shared/names'
 import { isValidPuzzleDateString, resolvePuzzleDateString } from './_shared/puzzleDate'
 
 // A past puzzle never changes, so these are safe to cache hard. Keeps crawler
@@ -43,7 +44,7 @@ export default async (req: Request): Promise<Response> => {
   const wantsDetail = requested !== undefined && requested !== 'archive'
 
   const today = resolvePuzzleDateString()
-  const { puzzles, words, rules } = await getCollections()
+  const { puzzles, rules } = await getCollections()
 
   if (!wantsDetail) {
     const docs = await puzzles
@@ -75,12 +76,8 @@ export default async (req: Request): Promise<Response> => {
   const doc = await puzzles.findOne(pastPuzzleFilter(today, { date: requested }))
   if (!doc) return html(renderNotFound(), 404)
 
-  const [wordDocs, rule, previousDoc, nextDoc] = await Promise.all([
-    words
-      .find({
-        _id: { $in: [...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)] },
-      })
-      .toArray(),
+  const [nameOf, rule, previousDoc, nextDoc] = await Promise.all([
+    resolveNames(doc, [...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)]),
     rules.findOne({ _id: doc.revealRuleId ?? doc.ruleId }),
     puzzles.findOne(pastPuzzleFilter(today, { date: { $lt: requested } }), {
       projection: { date: 1 },
@@ -91,16 +88,14 @@ export default async (req: Request): Promise<Response> => {
       sort: { date: 1 },
     }),
   ])
-
-  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
   const puzzle: ArchivePuzzle = {
     date: doc.date as string,
     number: doc.number,
     ruleName: rule?.name ?? doc.ruleId,
     ruleDescription: doc.manualRuleText ?? rule?.descriptionTemplate ?? '',
-    clues: doc.clues.map((c) => ({ word: spellingOf.get(c.wordId) ?? c.wordId, label: c.label })),
+    clues: doc.clues.map((c) => ({ word: nameOf(c.wordId), label: c.label })),
     guests: doc.guests.map((g) => ({
-      word: spellingOf.get(g.wordId) ?? g.wordId,
+      word: nameOf(g.wordId),
       trueLabel: g.trueLabel,
     })),
   }
```

- [ ] **Step 8: Admin wire types (three copies)**

`lib/adminApi.ts` (identical in `netlify/functions/_shared/adminApi.ts`):
```diff
--- a/lib/adminApi.ts
+++ b/lib/adminApi.ts
@@ -23,10 +23,14 @@ export interface AdminLiveDecoyDetail {
   ruleId: string
   ruleName: string
   subtlety: number
+  /** Visual only: the decoy is this rule read the other way round, "NOT …". */
+  negated?: true
 }
 
 export interface AdminPuzzleDetail {
   puzzleId: string
+  /** Absent for word puzzles (planning-visual-pivot.md §3.3). */
+  kind?: 'visual'
   /** Null for a still-pending/rejected/approved-but-unscheduled puzzle — only assigned once actually scheduled. */
   number: number | null
   difficultyTier: 'medium' | 'spicy'
@@ -99,8 +103,14 @@ export interface AdminAiReviewResponse {
 }
 
 export interface AdminBufferHealthResponse {
+  /** What PUZZLE_KIND says generation and scheduling are on (planning-visual-pivot.md §3.3). */
+  kind: 'word' | 'visual'
   mediumBufferDays: number
   spicyBufferWeeks: number
+  /** Approved or scheduled-ahead visual puzzles. Word puzzles never count toward it (§5.4). */
+  visualBufferDays: number
+  /** Visual only: usable rules not used yet, i.e. days of puzzles left (§4.7). */
+  runway?: number
   gapDates: string[]
 }
 
@@ -148,6 +158,8 @@ export interface AdminBatchStatsResponse {
 export interface AdminGenerateBatchRequest {
   count: number
   tiers?: ('medium' | 'spicy')[]
+  /** Defaults to PUZZLE_KIND. `tiers` is ignored for visual (planning-visual-pivot.md D7). */
+  kind?: 'word' | 'visual'
 }
 
 export interface AdminGenerateBatchResponse {
```
`src/admin/types.ts` gets the same three type changes, but not `AdminGenerateBatchRequest`, which the frontend doesn't declare:
```diff
--- a/src/admin/types.ts
+++ b/src/admin/types.ts
@@ -22,6 +22,8 @@ export interface AdminLiveDecoyDetail {
   ruleId: string
   ruleName: string
   subtlety: number
+  /** Visual only: the decoy is this rule read the other way round, "NOT …". */
+  negated?: true
 }
 
 export interface KnobValues {
@@ -36,6 +38,8 @@ export interface KnobValues {
 
 export interface AdminPuzzleDetail {
   puzzleId: string
+  /** Absent for word puzzles (planning-visual-pivot.md §3.3). */
+  kind?: 'visual'
   /** Null for a still-pending/rejected/approved-but-unscheduled puzzle — only assigned once actually scheduled. */
   number: number | null
   difficultyTier: 'medium' | 'spicy'
@@ -72,8 +76,14 @@ export interface AdminListApprovedResponse {
 }
 
 export interface AdminBufferHealthResponse {
+  /** What PUZZLE_KIND says generation and scheduling are on (planning-visual-pivot.md §3.3). */
+  kind: 'word' | 'visual'
   mediumBufferDays: number
   spicyBufferWeeks: number
+  /** Approved or scheduled-ahead visual puzzles. Word puzzles never count toward it (§5.4). */
+  visualBufferDays: number
+  /** Visual only: usable rules not used yet, i.e. days of puzzles left (§4.7). */
+  runway?: number
   gapDates: string[]
 }
 
```

- [ ] **Step 9: Captions and kind-aware buffer counts in puzzleStats**

`lib/puzzleStats.ts`:
```diff
--- a/lib/puzzleStats.ts
+++ b/lib/puzzleStats.ts
@@ -5,8 +5,10 @@ import type {
   AdminPuzzleStatsResponse,
 } from './adminApi.js'
 import { getCollections } from './db.js'
+import { resolveNames } from './names.js'
 import { addDaysToDateString, isSaturday, resolvePuzzleDateString } from './puzzleDate.js'
 import type { PuzzleDoc } from './types.js'
+import type { PuzzleKind } from './visual.js'
 
 // planning.md §4's target average (~4-5/6) — a puzzle only gets flagged
 // once it has a real completed attempt to judge; see resolveBatchStats.
@@ -29,29 +31,36 @@ const GAP_SCAN_DAYS = 28
  * hide a real hole inside the window.
  */
 export async function resolveBufferHealth(
-  now: Date = new Date()
+  now: Date = new Date(),
+  kind: PuzzleKind = 'word'
 ): Promise<AdminBufferHealthResponse> {
   const { puzzles } = await getCollections()
   const today = resolvePuzzleDateString(now)
 
-  const readyOrScheduledAhead = (tier: PuzzleDoc['difficultyTier']): Filter<PuzzleDoc> => ({
-    difficultyTier: tier,
+  const readyOrScheduledAhead = (filter: Filter<PuzzleDoc>): Filter<PuzzleDoc> => ({
+    ...filter,
     $or: [
       { status: 'approved', date: null },
       { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
     ],
   })
 
-  const [mediumBufferDays, spicyBufferWeeks, scheduledAheadDocs] = await Promise.all([
-    puzzles.countDocuments(readyOrScheduledAhead('medium')),
-    puzzles.countDocuments(readyOrScheduledAhead('spicy')),
-    puzzles
-      .find(
-        { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
-        { projection: { date: 1, difficultyTier: 1 } }
-      )
-      .toArray(),
-  ])
+  // Visual puzzles are stored as medium (planning-visual-pivot.md §3.4), so the
+  // word counts exclude them explicitly.
+  const word = (tier: PuzzleDoc['difficultyTier']) =>
+    readyOrScheduledAhead({ difficultyTier: tier, kind: { $ne: 'visual' } })
+  const [mediumBufferDays, spicyBufferWeeks, visualBufferDays, scheduledAheadDocs] =
+    await Promise.all([
+      puzzles.countDocuments(word('medium')),
+      puzzles.countDocuments(word('spicy')),
+      puzzles.countDocuments(readyOrScheduledAhead({ kind: 'visual' })),
+      puzzles
+        .find(
+          { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
+          { projection: { date: 1, difficultyTier: 1 } }
+        )
+        .toArray(),
+    ])
 
   const tierByDate = new Map(
     scheduledAheadDocs.map((doc) => [doc.date as string, doc.difficultyTier])
@@ -61,13 +70,16 @@ export async function resolveBufferHealth(
   let cursor = today
   for (let i = 0; i < GAP_SCAN_DAYS; i++) {
     const expectedTier: PuzzleDoc['difficultyTier'] = isSaturday(cursor) ? 'spicy' : 'medium'
-    if (tierByDate.get(cursor) !== expectedTier) {
+    // Under visual any puzzle fills a day: word puzzles scheduled before the
+    // cutover still play out (planning-visual-pivot.md §5.6).
+    const scheduled = tierByDate.get(cursor)
+    if (kind === 'visual' ? scheduled === undefined : scheduled !== expectedTier) {
       gapDates.push(cursor)
     }
     cursor = addDaysToDateString(cursor, 1)
   }
 
-  return { mediumBufferDays, spicyBufferWeeks, gapDates }
+  return { kind, mediumBufferDays, spicyBufferWeeks, visualBufferDays, gapDates }
 }
 
 /**
@@ -79,7 +91,7 @@ export async function resolveBufferHealth(
  * given guest a decoy — see build-plan.md Phase 8 notes.
  */
 export async function resolvePuzzleStats(puzzle: PuzzleDoc): Promise<AdminPuzzleStatsResponse> {
-  const { results, words } = await getCollections()
+  const { results } = await getCollections()
   const puzzleId = puzzle._id!.toString() // ResultDoc.puzzleId is a plain string, not an ObjectId
 
   const [missRateDocs, scoreStatsDocs] = await Promise.all([
@@ -105,8 +117,10 @@ export async function resolvePuzzleStats(puzzle: PuzzleDoc): Promise<AdminPuzzle
   ])
 
   const missStatsByWordId = new Map(missRateDocs.map((d) => [d._id, d]))
-  const wordDocs = await words.find({ _id: { $in: puzzle.guests.map((g) => g.wordId) } }).toArray()
-  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
+  const nameOf = await resolveNames(
+    puzzle,
+    puzzle.guests.map((g) => g.wordId)
+  )
 
   const guestMissRates = puzzle.guests
     .map((guest) => {
@@ -115,7 +129,7 @@ export async function resolvePuzzleStats(puzzle: PuzzleDoc): Promise<AdminPuzzle
       const misses = stats?.misses ?? 0
       return {
         wordId: guest.wordId,
-        word: spellingOf.get(guest.wordId) ?? guest.wordId,
+        word: nameOf(guest.wordId),
         trueLabel: guest.trueLabel,
         isTrap: guest.isTrap,
         trapType: guest.trapType,
```
`netlify/functions/_shared/puzzleStats.ts` isn't Prettier-clean, so apply this hand-formatted version and don't run Prettier on it:
```diff
--- a/netlify/functions/_shared/puzzleStats.ts
+++ b/netlify/functions/_shared/puzzleStats.ts
@@ -1,8 +1,10 @@
 import type { Filter } from 'mongodb'
 import type { AdminBatchStatsResponse, AdminBufferHealthResponse, AdminPuzzleStatsResponse } from './adminApi'
 import { getCollections } from './db'
+import { resolveNames } from './names'
 import { addDaysToDateString, isSaturday, resolvePuzzleDateString } from './puzzleDate'
 import type { PuzzleDoc } from './types'
+import type { PuzzleKind } from './visual'
 
 // planning.md §4's target average (~4-5/6) — a puzzle only gets flagged
 // once it has a real completed attempt to judge; see resolveBatchStats.
@@ -24,21 +26,29 @@ const GAP_SCAN_DAYS = 28
  * missing their correctly-tiered puzzle, so a healthy-looking count can't
  * hide a real hole inside the window.
  */
-export async function resolveBufferHealth(now: Date = new Date()): Promise<AdminBufferHealthResponse> {
+export async function resolveBufferHealth(
+  now: Date = new Date(),
+  kind: PuzzleKind = 'word'
+): Promise<AdminBufferHealthResponse> {
   const { puzzles } = await getCollections()
   const today = resolvePuzzleDateString(now)
 
-  const readyOrScheduledAhead = (tier: PuzzleDoc['difficultyTier']): Filter<PuzzleDoc> => ({
-    difficultyTier: tier,
+  const readyOrScheduledAhead = (filter: Filter<PuzzleDoc>): Filter<PuzzleDoc> => ({
+    ...filter,
     $or: [
       { status: 'approved', date: null },
       { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
     ],
   })
 
-  const [mediumBufferDays, spicyBufferWeeks, scheduledAheadDocs] = await Promise.all([
-    puzzles.countDocuments(readyOrScheduledAhead('medium')),
-    puzzles.countDocuments(readyOrScheduledAhead('spicy')),
+  // Visual puzzles are stored as medium (planning-visual-pivot.md §3.4), so the
+  // word counts exclude them explicitly.
+  const word = (tier: PuzzleDoc['difficultyTier']) =>
+    readyOrScheduledAhead({ difficultyTier: tier, kind: { $ne: 'visual' } })
+  const [mediumBufferDays, spicyBufferWeeks, visualBufferDays, scheduledAheadDocs] = await Promise.all([
+    puzzles.countDocuments(word('medium')),
+    puzzles.countDocuments(word('spicy')),
+    puzzles.countDocuments(readyOrScheduledAhead({ kind: 'visual' })),
     puzzles
       .find(
         { status: { $in: ['scheduled', 'live'] }, date: { $gte: today } },
@@ -53,13 +63,16 @@ export async function resolveBufferHealth(now: Date = new Date()): Promise<Admin
   let cursor = today
   for (let i = 0; i < GAP_SCAN_DAYS; i++) {
     const expectedTier: PuzzleDoc['difficultyTier'] = isSaturday(cursor) ? 'spicy' : 'medium'
-    if (tierByDate.get(cursor) !== expectedTier) {
+    // Under visual any puzzle fills a day: word puzzles scheduled before the
+    // cutover still play out (planning-visual-pivot.md §5.6).
+    const scheduled = tierByDate.get(cursor)
+    if (kind === 'visual' ? scheduled === undefined : scheduled !== expectedTier) {
       gapDates.push(cursor)
     }
     cursor = addDaysToDateString(cursor, 1)
   }
 
-  return { mediumBufferDays, spicyBufferWeeks, gapDates }
+  return { kind, mediumBufferDays, spicyBufferWeeks, visualBufferDays, gapDates }
 }
 
 /**
@@ -71,7 +84,7 @@ export async function resolveBufferHealth(now: Date = new Date()): Promise<Admin
  * given guest a decoy — see build-plan.md Phase 8 notes.
  */
 export async function resolvePuzzleStats(puzzle: PuzzleDoc): Promise<AdminPuzzleStatsResponse> {
-  const { results, words } = await getCollections()
+  const { results } = await getCollections()
   const puzzleId = puzzle._id!.toString() // ResultDoc.puzzleId is a plain string, not an ObjectId
 
   const [missRateDocs, scoreStatsDocs] = await Promise.all([
@@ -97,8 +110,10 @@ export async function resolvePuzzleStats(puzzle: PuzzleDoc): Promise<AdminPuzzle
   ])
 
   const missStatsByWordId = new Map(missRateDocs.map((d) => [d._id, d]))
-  const wordDocs = await words.find({ _id: { $in: puzzle.guests.map((g) => g.wordId) } }).toArray()
-  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
+  const nameOf = await resolveNames(
+    puzzle,
+    puzzle.guests.map((g) => g.wordId)
+  )
 
   const guestMissRates = puzzle.guests
     .map((guest) => {
@@ -107,7 +122,7 @@ export async function resolvePuzzleStats(puzzle: PuzzleDoc): Promise<AdminPuzzle
       const misses = stats?.misses ?? 0
       return {
         wordId: guest.wordId,
-        word: spellingOf.get(guest.wordId) ?? guest.wordId,
+        word: nameOf(guest.wordId),
         trueLabel: guest.trueLabel,
         isTrap: guest.isTrap,
         trapType: guest.trapType,
```

**Gap dates under visual:** a date counts as filled by *any* scheduled puzzle. Word puzzles scheduled before the cutover still play out (§5.6), and they shouldn't read as holes.

- [ ] **Step 10: Format, typecheck, test**

Run:
```bash
npx prettier --write lib/names.ts netlify/functions/_shared/names.ts lib/roundView.ts lib/roundView.test.ts netlify/functions/_shared/roundView.ts api/get-round.ts netlify/functions/get-round.ts lib/adminPuzzleDetail.ts netlify/functions/_shared/adminPuzzleDetail.ts lib/puzzleStats.ts api/archive.ts netlify/functions/archive.ts lib/adminApi.ts netlify/functions/_shared/adminApi.ts src/admin/types.ts
npm run typecheck:vercel-functions && npm run typecheck:netlify-functions && npx tsc --noEmit && npm test
```
Expected: all clean.

- [ ] **Step 11: Commit**

```bash
git add lib netlify/functions/_shared netlify/functions/get-round.ts netlify/functions/archive.ts api/get-round.ts api/archive.ts src/admin/types.ts
git commit -m "Caption visual puzzles from visualItems and count the visual buffer"
```

---

### Task 3: The shared visual batch module

**Files:**
- Create: `content-engine/visual/batch.ts`
- Test: `content-engine/visual/batch.test.ts`

**Interfaces:**
- Consumes: `generateVisualCandidate`, `eligibleRules`, `GeneratorInput` (Phase 3); `batchSeed` (Phase 3); `ITEMS`, `VISUAL_RULES`, `MATRIX` (Phase 2); `worldInput` (Phase 3's `testWorld.ts`).
- Produces:
  - `generateVisualBatch(count, input, date): VisualCandidate[]`
  - `toVisualPuzzleDoc(candidate, createdAt)`, a document assignable to `PuzzleDoc` in both backends
  - `generateVisualDocs(count, { usedRuleIds, pendingRuleIds, rejectCounts }, date, createdAt?)`
  - `visualRunway(usedRuleIds): number`

- [ ] **Step 1: Write the failing test**

`content-engine/visual/batch.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { generateVisualBatch, toVisualPuzzleDoc } from './batch.js'
import { worldInput } from './testWorld.js'

describe('generateVisualBatch', () => {
  it('gives every candidate a different rule, skipping used and pending ones', () => {
    const batch = generateVisualBatch(
      5,
      worldInput({ usedRuleIds: new Set(['visual-t']), pendingRuleIds: new Set(['visual-t2']) }),
      '2026-11-01'
    )
    const ruleIds = batch.map((c) => c.ruleId)
    expect(batch.length).toBeGreaterThan(0)
    expect(new Set(ruleIds).size).toBe(ruleIds.length)
    expect(ruleIds).not.toContain('visual-t')
    expect(ruleIds).not.toContain('visual-t2')
  })

  it('stops at the requested count', () => {
    expect(generateVisualBatch(1, worldInput(), '2026-11-01')).toHaveLength(1)
  })

  it('reproduces the same batch for the same date', () => {
    expect(generateVisualBatch(3, worldInput(), '2026-11-01')).toEqual(
      generateVisualBatch(3, worldInput(), '2026-11-01')
    )
  })

  it('returns an empty batch once every rule is spent', () => {
    const spent = worldInput()
    spent.usedRuleIds = new Set(spent.rules.map((r) => r.id))
    expect(generateVisualBatch(3, spent, '2026-11-01')).toEqual([])
  })
})

describe('toVisualPuzzleDoc', () => {
  it('stores kind and generatorSeed, and leaves number and date for scheduling', () => {
    const [candidate] = generateVisualBatch(1, worldInput(), '2026-11-01')
    const createdAt = new Date('2026-11-01T06:00:00Z')
    expect(toVisualPuzzleDoc(candidate, createdAt)).toEqual({
      number: null,
      kind: 'visual',
      generatorSeed: candidate.generatorSeed,
      difficultyTier: 'medium',
      ruleId: candidate.ruleId,
      status: 'pending_approval',
      date: null,
      clues: candidate.clues,
      guests: candidate.guests,
      liveDecoys: candidate.liveDecoys,
      knobValues: candidate.knobValues,
      createdAt,
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/batch.test.ts`
Expected: FAIL, because `./batch.js` doesn't exist.

- [ ] **Step 3: Write the module**

`content-engine/visual/batch.ts`:
```ts
import { eligibleRules, generateVisualCandidate, type GeneratorInput } from './generator.js'
import { ITEMS } from './items.js'
import { batchSeed } from './random.js'
import { VISUAL_RULES } from './rules.js'
import { MATRIX } from './tags/index.js'
import type { VisualCandidate } from './types.js'

// The one way visual puzzles get generated and stored. The cron, the admin
// "Generate batch" endpoints and queuePuzzles.ts all call generateVisualDocs,
// so none of them builds a puzzle document field by field — which is how a
// new field like `kind` would otherwise get silently dropped by one of them
// (planning-visual-pivot.md §2.7).

/** Up to `count` candidates, each for a different rule. Seeds come from the date plus an index (§4.6). */
export function generateVisualBatch(
  count: number,
  input: GeneratorInput,
  date: string
): VisualCandidate[] {
  const pending = new Set(input.pendingRuleIds)
  const batch: VisualCandidate[] = []
  for (let index = 0; batch.length < count && index < count * 3; index++) {
    const candidate = generateVisualCandidate(
      { ...input, pendingRuleIds: pending },
      batchSeed(date, index)
    )
    if (!candidate) continue
    pending.add(candidate.ruleId)
    batch.push(candidate)
  }
  return batch
}

/** A visual candidate as a `puzzles` document. Assignable to PuzzleDoc in both backends. */
export function toVisualPuzzleDoc(candidate: VisualCandidate, createdAt: Date) {
  return {
    // Left null: only assigned once actually scheduled, see schedulePuzzles.ts.
    number: null,
    kind: candidate.kind,
    generatorSeed: candidate.generatorSeed,
    difficultyTier: candidate.difficultyTier,
    ruleId: candidate.ruleId,
    status: candidate.status,
    date: null,
    clues: candidate.clues,
    guests: candidate.guests,
    liveDecoys: candidate.liveDecoys,
    knobValues: candidate.knobValues,
    createdAt,
  }
}

/** Generates from the committed item bank, rules and matrix, ready to insert. */
export function generateVisualDocs(
  count: number,
  state: Pick<GeneratorInput, 'usedRuleIds' | 'pendingRuleIds' | 'rejectCounts'>,
  date: string,
  createdAt: Date = new Date()
) {
  const input = { items: ITEMS, rules: VISUAL_RULES, matrix: MATRIX, ...state }
  return generateVisualBatch(count, input, date).map((c) => toVisualPuzzleDoc(c, createdAt))
}

/** §4.7: usable rules not used yet, i.e. days of puzzles left. Pending rules still count: they have not run. */
export function visualRunway(usedRuleIds: Set<string>): number {
  const input = { items: ITEMS, rules: VISUAL_RULES, matrix: MATRIX, usedRuleIds }
  return eligibleRules({ ...input, pendingRuleIds: new Set(), rejectCounts: new Map() }).length
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/batch.test.ts && npm run typecheck:content-engine`
Expected: PASS (5 tests), clean.

- [ ] **Step 5: Commit**

```bash
git add content-engine/visual/batch.ts content-engine/visual/batch.test.ts
git commit -m "Add the shared visual batch and puzzle-document mapping"
```

---

### Task 4: Wire the handlers: generation, approval, refusals, buffer health

**Files:**
- Modify: `netlify/functions/admin-approve.ts`, `admin-edit-puzzle.ts`, `admin-ai-review.ts`, `admin-buffer-health.ts`, `admin-generate-batch.ts`
- Modify: `api/admin.ts`, `api/scheduled-generate-puzzles.ts`
- Modify: `content-engine/scripts/queuePuzzles.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces these behaviours:
  - **Approve** refuses a visual puzzle with **409** when another visual puzzle is `approved`, `scheduled` or `live` with the same `ruleId`, naming it. A rule whose only earlier puzzle was rejected or unscheduled (back to pending) is free.
  - **Edit and AI review** return **400** for a visual puzzle (D11). The admin UI offers plain Reject instead (Phase 4 UI plan).
  - **Buffer health** reports `kind` from `PUZZLE_KIND`, plus `runway` when visual.
  - **Generate batch** takes `kind` from the body, defaulting to `PUZZLE_KIND`. It ignores `tiers` for visual.
  - **The cron**, under `PUZZLE_KIND=visual`, tops up to 28 days when under 14, **counting pending visual puzzles toward the target**.
  - **`content:queue-puzzles -- [count] --visual`.**

**A decision the spec leaves open:** the cron counts pending visual puzzles toward its target. The word path doesn't, and that's harmless there. But a pending visual puzzle holds a rule (D6), so without this a slow review week would keep drafting fresh rules every morning.

These handlers are thin glue over tested helpers (`ruleHolderFilter`, `splitVisualRuleUsage`, `generateVisualDocs`, `visualRunway`). That follows the codebase's pattern: no handler has its own test, and Task 5 exercises them end to end.

- [ ] **Step 1: Approve (Netlify)**

Hand-formatted, because the file isn't Prettier-clean:
```diff
--- a/netlify/functions/admin-approve.ts
+++ b/netlify/functions/admin-approve.ts
@@ -10,6 +10,7 @@ import { requireAdmin } from './_shared/adminAuth'
 import type { AdminApproveRequest } from './_shared/adminApi'
 import { getCollections } from './_shared/db'
 import { jsonResponse } from './_shared/respond'
+import { ruleHolderFilter } from './_shared/visual'
 
 export default async (req: Request): Promise<Response> => {
   if (req.method !== 'POST') {
@@ -32,8 +33,30 @@ export default async (req: Request): Promise<Response> => {
   }
 
   const { puzzles } = await getCollections()
+  const id = new ObjectId(puzzleId)
+
+  // planning-visual-pivot.md §3.5: a visual rule runs once ever, and this check
+  // is the hard guarantee. ponytail: check-then-write, so two approvals racing
+  // could both pass; there is one reviewer. A unique partial index on ruleId
+  // closes it if that changes.
+  const target = await puzzles.findOne({ _id: id }, { projection: { kind: 1, ruleId: 1 } })
+  if (target?.kind === 'visual') {
+    const holder = await puzzles.findOne(ruleHolderFilter(target.ruleId, id), {
+      projection: { number: 1, status: 1 },
+    })
+    if (holder) {
+      const name = holder.number ? `#${holder.number}` : holder._id.toString()
+      return jsonResponse(
+        {
+          error: `Rule ${target.ruleId} already belongs to puzzle ${name} (${holder.status}). A visual rule runs once ever: reject this one.`,
+        },
+        409
+      )
+    }
+  }
+
   const update = await puzzles.updateOne(
-    { _id: new ObjectId(puzzleId), status: 'pending_approval' },
+    { _id: id, status: 'pending_approval' },
     { $set: { status: 'approved' } },
   )
 
```

- [ ] **Step 2: Refuse edit and AI review (Netlify)**

```diff
--- a/netlify/functions/admin-edit-puzzle.ts
+++ b/netlify/functions/admin-edit-puzzle.ts
@@ -65,6 +65,11 @@ export default async (req: Request): Promise<Response> => {
     return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
   }
 
+  // planning-visual-pivot.md D11: a bad visual board is rejected and regenerated, never patched.
+  if (doc.kind === 'visual') {
+    return jsonResponse({ error: 'Visual puzzles are not edited by hand. Reject it instead.' }, 400)
+  }
+
   // Structural checks only. None of these is a judgement about what a word
   // means — they are the things that make a puzzle playable at all, and the
   // reviewer overriding them would just produce a broken round.
```
```diff
--- a/netlify/functions/admin-ai-review.ts
+++ b/netlify/functions/admin-ai-review.ts
@@ -55,6 +55,11 @@ export default async (req: Request): Promise<Response> => {
     return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
   }
 
+  // planning-visual-pivot.md D11: a bad visual board is rejected and regenerated, never patched.
+  if (doc.kind === 'visual') {
+    return jsonResponse({ error: 'Visual puzzles are not AI-reviewed. Reject it instead.' }, 400)
+  }
+
   const detail = await resolveFullPuzzleDetail(doc)
   const wordBank = buildWordBank()
 
```

- [ ] **Step 3: Buffer health and generation (Netlify)**

```diff
--- a/netlify/functions/admin-buffer-health.ts
+++ b/netlify/functions/admin-buffer-health.ts
@@ -2,15 +2,26 @@
 // behind planning.md §9.2's "never let the buffer run to zero" requirement,
 // previously only checkable by hand-counting documents in Mongo.
 
+import { visualRunway } from '../../content-engine/visual/batch'
 import { requireAdmin } from './_shared/adminAuth'
 import type { AdminBufferHealthResponse } from './_shared/adminApi'
+import { getCollections } from './_shared/db'
 import { resolveBufferHealth } from './_shared/puzzleStats'
 import { jsonResponse } from './_shared/respond'
+import { puzzleKindFrom, splitVisualRuleUsage, VISUAL_RULE_USAGE_FILTER } from './_shared/visual'
 
 export default async (req: Request): Promise<Response> => {
   if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
   if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)
 
-  const response: AdminBufferHealthResponse = await resolveBufferHealth()
+  const kind = puzzleKindFrom(process.env.PUZZLE_KIND)
+  const response: AdminBufferHealthResponse = await resolveBufferHealth(new Date(), kind)
+  if (kind === 'visual') {
+    const { puzzles } = await getCollections()
+    const usage = await puzzles
+      .find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } })
+      .toArray()
+    response.runway = visualRunway(splitVisualRuleUsage(usage).usedRuleIds)
+  }
   return jsonResponse(response)
 }
```
```diff
--- a/netlify/functions/admin-generate-batch.ts
+++ b/netlify/functions/admin-generate-batch.ts
@@ -11,13 +11,16 @@ import { requireAdmin } from './_shared/adminAuth'
 import type { AdminGenerateBatchRequest } from './_shared/adminApi'
 import { getCollections } from './_shared/db'
 import { generateBatchCore } from '../../content-engine/generator/batch'
+import { generateVisualDocs } from '../../content-engine/visual/batch'
 import { RULES } from '../../content-engine/rules'
 import { applyRuleOverrides } from '../../content-engine/rules/ruleOverrides'
+import { resolvePuzzleDateString } from './_shared/puzzleDate'
 import { resolveRejectCounts } from './_shared/rejectStats'
 import { resolveRuleOverrides } from './_shared/ruleOverrides'
 import { resolveRecentRuleUsage } from './_shared/ruleUsage'
 import type { PuzzleDoc } from './_shared/types'
 import { jsonResponse } from './_shared/respond'
+import { puzzleKindFrom, splitVisualRuleUsage, VISUAL_RULE_USAGE_FILTER } from './_shared/visual'
 
 const MAX_COUNT = 20
 
@@ -40,6 +43,23 @@ export default async (req: Request): Promise<Response> => {
   if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
     return jsonResponse({ error: `count must be an integer between 1 and ${MAX_COUNT}` }, 400)
   }
+  if (body.kind !== undefined && body.kind !== 'word' && body.kind !== 'visual') {
+    return jsonResponse({ error: "kind must be 'word' or 'visual'" }, 400)
+  }
+  if ((body.kind ?? puzzleKindFrom(process.env.PUZZLE_KIND)) === 'visual') {
+    const { puzzles } = await getCollections()
+    const [usage, rejectCounts] = await Promise.all([
+      puzzles.find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } }).toArray(),
+      resolveRejectCounts(),
+    ])
+    const docs = generateVisualDocs(
+      count,
+      { ...splitVisualRuleUsage(usage), rejectCounts },
+      resolvePuzzleDateString()
+    )
+    if (docs.length > 0) await puzzles.insertMany(docs)
+    return jsonResponse({ ok: true, requested: count, generated: docs.length })
+  }
   const tiers: ('medium' | 'spicy')[] =
     body.tiers && body.tiers.length > 0 ? body.tiers : ['medium', 'spicy']
 
```

- [ ] **Step 4: The same four behaviours in `api/admin.ts`**

```diff
--- a/api/admin.ts
+++ b/api/admin.ts
@@ -9,6 +9,7 @@
 
 import { ObjectId } from 'mongodb'
 import { generateBatchCore } from '../content-engine/generator/batch.js'
+import { generateVisualDocs, visualRunway } from '../content-engine/visual/batch.js'
 import { planAiReviewDispatch } from '../content-engine/generator/aiReviewDispatch.js'
 import { buildReviewMenus } from '../content-engine/generator/aiReviewMenu.js'
 import { buildWordBank } from '../content-engine/words/wordBank.js'
@@ -42,6 +43,12 @@ import { jsonResponse } from '../lib/respond.js'
 import { resolveRuleOverrides, writeRuleOverride } from '../lib/ruleOverrides.js'
 import { resolveRecentRuleUsage } from '../lib/ruleUsage.js'
 import type { AiReviewDoc, PuzzleDoc } from '../lib/types.js'
+import {
+  puzzleKindFrom,
+  ruleHolderFilter,
+  splitVisualRuleUsage,
+  VISUAL_RULE_USAGE_FILTER,
+} from '../lib/visual.js'
 
 // How many real, correctly-sided bank words to offer the AI as a menu for the
 // rewrite-puzzle action. IN is generous so skewed rules (e.g. hidden-number,
@@ -118,8 +125,30 @@ async function handleApprove(req: Request): Promise<Response> {
   }
 
   const { puzzles } = await getCollections()
+  const id = new ObjectId(puzzleId)
+
+  // planning-visual-pivot.md §3.5: a visual rule runs once ever, and this check
+  // is the hard guarantee. ponytail: check-then-write, so two approvals racing
+  // could both pass; there is one reviewer. A unique partial index on ruleId
+  // closes it if that changes.
+  const target = await puzzles.findOne({ _id: id }, { projection: { kind: 1, ruleId: 1 } })
+  if (target?.kind === 'visual') {
+    const holder = await puzzles.findOne(ruleHolderFilter(target.ruleId, id), {
+      projection: { number: 1, status: 1 },
+    })
+    if (holder) {
+      const name = holder.number ? `#${holder.number}` : holder._id.toString()
+      return jsonResponse(
+        {
+          error: `Rule ${target.ruleId} already belongs to puzzle ${name} (${holder.status}). A visual rule runs once ever: reject this one.`,
+        },
+        409
+      )
+    }
+  }
+
   const update = await puzzles.updateOne(
-    { _id: new ObjectId(puzzleId), status: 'pending_approval' },
+    { _id: id, status: 'pending_approval' },
     { $set: { status: 'approved' } }
   )
 
@@ -203,6 +232,11 @@ async function handleAiReview(req: Request): Promise<Response> {
     return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
   }
 
+  // planning-visual-pivot.md D11: a bad visual board is rejected and regenerated, never patched.
+  if (doc.kind === 'visual') {
+    return jsonResponse({ error: 'Visual puzzles are not AI-reviewed. Reject it instead.' }, 400)
+  }
+
   const detail = await resolveFullPuzzleDetail(doc)
   const wordBank = buildWordBank()
 
@@ -560,7 +594,15 @@ async function handleBufferHealth(req: Request): Promise<Response> {
   if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
   if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)
 
-  const response: AdminBufferHealthResponse = await resolveBufferHealth()
+  const kind = puzzleKindFrom(process.env.PUZZLE_KIND)
+  const response: AdminBufferHealthResponse = await resolveBufferHealth(new Date(), kind)
+  if (kind === 'visual') {
+    const { puzzles } = await getCollections()
+    const usage = await puzzles
+      .find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } })
+      .toArray()
+    response.runway = visualRunway(splitVisualRuleUsage(usage).usedRuleIds)
+  }
   return jsonResponse(response)
 }
 
@@ -647,6 +689,23 @@ async function handleGenerateBatch(req: Request): Promise<Response> {
       400
     )
   }
+  if (body.kind !== undefined && body.kind !== 'word' && body.kind !== 'visual') {
+    return jsonResponse({ error: "kind must be 'word' or 'visual'" }, 400)
+  }
+  if ((body.kind ?? puzzleKindFrom(process.env.PUZZLE_KIND)) === 'visual') {
+    const { puzzles } = await getCollections()
+    const [usage, rejectCounts] = await Promise.all([
+      puzzles.find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } }).toArray(),
+      resolveRejectCounts(),
+    ])
+    const docs = generateVisualDocs(
+      count,
+      { ...splitVisualRuleUsage(usage), rejectCounts },
+      resolvePuzzleDateString()
+    )
+    if (docs.length > 0) await puzzles.insertMany(docs)
+    return jsonResponse({ ok: true, requested: count, generated: docs.length })
+  }
   const tiers: ('medium' | 'spicy')[] =
     body.tiers && body.tiers.length > 0 ? body.tiers : ['medium', 'spicy']
 
```

- [ ] **Step 5: The cron**

```diff
--- a/api/scheduled-generate-puzzles.ts
+++ b/api/scheduled-generate-puzzles.ts
@@ -17,20 +17,54 @@
 // (generate -> validate -> human-approve -> schedule).
 
 import { generateBatchCore } from '../content-engine/generator/batch.js'
+import { generateVisualDocs } from '../content-engine/visual/batch.js'
 import { RULES } from '../content-engine/rules/index.js'
 import { applyRuleOverrides } from '../content-engine/rules/ruleOverrides.js'
 import { getCollections } from '../lib/db.js'
+import { resolvePuzzleDateString } from '../lib/puzzleDate.js'
 import { resolveBufferHealth } from '../lib/puzzleStats.js'
 import { resolveRejectCounts } from '../lib/rejectStats.js'
 import { resolveRuleOverrides } from '../lib/ruleOverrides.js'
 import { resolveRecentRuleUsage } from '../lib/ruleUsage.js'
 import type { PuzzleDoc } from '../lib/types.js'
 import { jsonResponse } from '../lib/respond.js'
+import { puzzleKindFrom, splitVisualRuleUsage, VISUAL_RULE_USAGE_FILTER } from '../lib/visual.js'
 
 const MEDIUM_MIN_DAYS = 14
 const MEDIUM_TARGET_DAYS = 28
 const SPICY_MIN_WEEKS = 4
 const SPICY_TARGET_WEEKS = 6
+const VISUAL_MIN_DAYS = 14
+const VISUAL_TARGET_DAYS = 28
+
+/**
+ * planning-visual-pivot.md §5.4: one visual queue, topped up to 28 days when
+ * it drops under 14. Pending puzzles count toward the target: each one holds a
+ * rule (D6), so a slow review week must not draft rules nobody has looked at.
+ */
+async function topUpVisual(bufferDays: number): Promise<Response> {
+  if (bufferDays >= VISUAL_MIN_DAYS) {
+    console.log('Visual buffer healthy, nothing to generate.', { bufferDays })
+    return jsonResponse({ ok: true, generated: 0 })
+  }
+  const { puzzles } = await getCollections()
+  const [usageDocs, rejectCounts] = await Promise.all([
+    puzzles.find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } }).toArray(),
+    resolveRejectCounts(),
+  ])
+  const usage = splitVisualRuleUsage(usageDocs)
+  const count = VISUAL_TARGET_DAYS - bufferDays - usage.pendingRuleIds.size
+  if (count <= 0) {
+    console.log('Enough visual puzzles are waiting for review.', { bufferDays })
+    return jsonResponse({ ok: true, generated: 0 })
+  }
+
+  const docs = generateVisualDocs(count, { ...usage, rejectCounts }, resolvePuzzleDateString())
+  if (docs.length < count) console.warn(`Only generated ${docs.length}/${count} visual candidates.`)
+  if (docs.length > 0) await puzzles.insertMany(docs)
+  console.log(`Generated ${docs.length} visual candidate puzzle(s) as pending_approval.`)
+  return jsonResponse({ ok: true, generated: docs.length })
+}
 
 export default {
   fetch: async (req: Request): Promise<Response> => {
@@ -41,7 +75,9 @@ export default {
       return jsonResponse({ error: 'Unauthorized' }, 401)
     }
 
-    const health = await resolveBufferHealth()
+    const kind = puzzleKindFrom(process.env.PUZZLE_KIND)
+    const health = await resolveBufferHealth(new Date(), kind)
+    if (kind === 'visual') return topUpVisual(health.visualBufferDays)
 
     const tiersToGenerate: { tier: PuzzleDoc['difficultyTier']; count: number }[] = []
     if (health.mediumBufferDays < MEDIUM_MIN_DAYS) {
```

- [ ] **Step 6: The queue script**

```diff
--- a/content-engine/scripts/queuePuzzles.ts
+++ b/content-engine/scripts/queuePuzzles.ts
@@ -7,22 +7,48 @@
 // puzzle is actually scheduled (schedulePuzzles.ts), so a rejected or
 // still-pending candidate never burns a number that would otherwise leave
 // a gap in what players/admins actually see.
-// Run with: npm run content:queue-puzzles -- [count]
+// Run with: npm run content:queue-puzzles -- [count] [--visual]
+// --visual (or PUZZLE_KIND=visual in .env) queues visual puzzles instead
+// (planning-visual-pivot.md §5.3).
 
 import 'dotenv/config'
 import { getCollections } from '../../netlify/functions/_shared/db.js'
+import { resolvePuzzleDateString } from '../../netlify/functions/_shared/puzzleDate.js'
 import { resolveRejectCounts } from '../../netlify/functions/_shared/rejectStats.js'
 import { resolveRuleOverrides } from '../../netlify/functions/_shared/ruleOverrides.js'
 import { resolveRecentRuleUsage } from '../../netlify/functions/_shared/ruleUsage.js'
 import type { PuzzleDoc } from '../../netlify/functions/_shared/types.js'
+import {
+  puzzleKindFrom,
+  splitVisualRuleUsage,
+  VISUAL_RULE_USAGE_FILTER,
+} from '../../netlify/functions/_shared/visual.js'
 import { RULES } from '../rules/index.js'
 import { applyRuleOverrides } from '../rules/ruleOverrides.js'
 import { generateBatchCore } from '../generator/batch.js'
+import { generateVisualDocs } from '../visual/batch.js'
 
-const PUZZLE_COUNT = Number(process.argv[2]) || 5
+const PUZZLE_COUNT = Number(process.argv.slice(2).find((arg) => /^\d+$/.test(arg))) || 5
+const VISUAL =
+  process.argv.includes('--visual') || puzzleKindFrom(process.env.PUZZLE_KIND) === 'visual'
 
 async function main() {
   const { puzzles } = await getCollections()
+  if (VISUAL) {
+    const [usage, rejectCounts] = await Promise.all([
+      puzzles.find(VISUAL_RULE_USAGE_FILTER, { projection: { ruleId: 1, status: 1 } }).toArray(),
+      resolveRejectCounts(),
+    ])
+    const docs = generateVisualDocs(
+      PUZZLE_COUNT,
+      { ...splitVisualRuleUsage(usage), rejectCounts },
+      resolvePuzzleDateString()
+    )
+    console.log(`Generated ${docs.length}/${PUZZLE_COUNT} visual candidates.`)
+    if (docs.length > 0) await puzzles.insertMany(docs)
+    process.exit(0)
+  }
+
   const [rejectCounts, ruleOverrides, recentUsage] = await Promise.all([
     resolveRejectCounts(),
     resolveRuleOverrides(),
```

- [ ] **Step 7: Format, then run every check**

Run:
```bash
npx prettier --write api/admin.ts api/scheduled-generate-puzzles.ts netlify/functions/admin-buffer-health.ts netlify/functions/admin-generate-batch.ts content-engine/scripts/queuePuzzles.ts
npm run typecheck:content-engine && npm run typecheck:netlify-functions && npm run typecheck:vercel-functions && npm run lint && npm test && npm run build
```
Expected: all clean. The suite is 682 tests: 661 after Phase 3, plus 6 + 6 (Task 1), 4 (Task 2) and 5 (Task 3).

- [ ] **Step 8: Commit**

```bash
git add netlify/functions/admin-approve.ts netlify/functions/admin-edit-puzzle.ts netlify/functions/admin-ai-review.ts netlify/functions/admin-buffer-health.ts netlify/functions/admin-generate-batch.ts api/admin.ts api/scheduled-generate-puzzles.ts content-engine/scripts/queuePuzzles.ts
git commit -m "Generate, approve and report on visual puzzles behind PUZZLE_KIND"
```

---

### Task 5: Exercise it end to end, locally (human gate)

This uses the real Atlas database through `npm run dev:functions` (the Netlify copies). Nothing is deployed. The test puzzle goes on a far-future date and is unscheduled afterwards, so players never see it.

- [ ] **Step 1: Word path unchanged**

Run `npm run dev:functions` with `PUZZLE_KIND` unset. Then:
- Play today's word puzzle: the round loads, swipes work and the reveal shows.
- Open `/admin`. Buffer health shows the same medium/spicy numbers as production.

- [ ] **Step 2: Queue visual candidates**

Run: `npm run content:queue-puzzles -- 3 --visual`
Expected: `Generated 3/3 visual candidates.` In `/admin`, three cards show item names (icons arrive with the UI plan), with no spicy/medium label.

- [ ] **Step 3: Approve, and check uniqueness**

- Approve one. It succeeds.
- In Atlas, copy that approved puzzle's `ruleId` onto another pending visual puzzle, then try to approve that second one. Expected: 409, `Rule … already belongs to puzzle …`.
- Put the `ruleId` back and reject the second puzzle.

- [ ] **Step 4: Refusals**

From the browser console on `/admin`, POST to `/api/admin-ai-review` for a pending visual puzzle. Expected: 400, `Visual puzzles are not AI-reviewed. Reject it instead.`

- [ ] **Step 5: Play it on a test date**

Run: `PUZZLE_KIND=visual npm run content:schedule -- 1 2030-01-01` (Git Bash).
Open `http://localhost:8888/?asOf=2030-01-01`. The client forwards `asOf` to `get-round`, which honours it under `netlify dev`. In the network tab, check:
- the response has `kind: 'visual'` and `clueIds`
- `clues` and `pool` hold captions
- no `trueLabel` appears before the round ends
- after three misses, `ruleText` is the reveal sentence and `poolReveal` lists all six items

- [ ] **Step 6: Clean up**

Unschedule the 2030 puzzle from `/admin/schedule`. It returns to pending, which frees its rule. Then reject it and any leftover test candidates.

- [ ] **Step 7: Mark Phase 4a done in the spec**

In `planning-visual-pivot.md` §6, under Phase 4, add: `**4a status:** done YYYY-MM-DD.`

---

## Self-review against the spec

| Spec requirement (planning-visual-pivot.md) | Task |
|---|---|
| §5.3 contract: `kind?`, `clueIds?`, additive, all three copies; `PoolItem` and check-swipe unchanged | 1 |
| §5.3 `roundView` reads names from `visualItems` for visual; clue ids returned | 2 (`resolveNames`), 1 (`visualRoundFields`) |
| §5.3 `get-round` passes `kind` / `clueIds` for visual only | 2 |
| §5.3 four generation entry points copy `kind` + `generatorSeed` | 3 (one shared mapping), 4 |
| §5.3 approve refuses a used rule (409, naming the holder) | 1 (`ruleHolderFilter`), 4 |
| §5.3 edit and AI review return 400 for visual (D11) | 4 |
| §5.3 admin detail, stats, archive resolve visual names and pass `kind` | 2 |
| §3.3 `PUZZLE_KIND` read on Vercel (cron), Netlify (buffer health, generate default), local (queue/schedule) | 4, Phase 3 (schedule) |
| §3.5 used = approved/scheduled/live; pending excluded from generation; rejected and unscheduled free the rule | 1 (tests), 4 |
| §5.4 visual buffer; parked word puzzles don't count; runway; cron tops up 14 → 28 | 2, 3 (`visualRunway`), 4 |
| §6 Phase 4a tests: roundView hides labels mid-round and reveals all; mapping test; approve refusal; buffer excludes parked words | 2 (`roundView.test`), 3 (`toVisualPuzzleDoc` test), 1 (`ruleHolderFilter` test), 2 (filter `kind: { $ne }` / `{ kind: 'visual' }`) |
| Global: no new `api/` files; word path unchanged with `PUZZLE_KIND` unset | all tasks |

**Deviations from the spec, recorded:**
- **§2.7 asked for four mapping tests.** Instead, all four entry points call one mapping (`generateVisualDocs` → `toVisualPuzzleDoc`), which has one test.
- **The approve check is check-then-write.** Two simultaneous approvals could both pass. With one reviewer that can't happen in practice. A unique partial index on `ruleId` closes it if that ever changes; the code comment says so.
