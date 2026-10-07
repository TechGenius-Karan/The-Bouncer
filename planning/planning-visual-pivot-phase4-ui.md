# Visual Pivot — Phase 4b/4c Implementation Plan (player and admin UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show visual puzzles as icon + caption wherever a word appears today (cards, clues, trays, reveal, admin review), cache icons for offline play, ship the licence credits, and give the admin panel a visual generate option, a runway readout and no manual-edit/AI-refine on visual puzzles.

**Architecture:**
- **One component, `ItemFace`**, renders an item. A word puzzle gets its text exactly as today. A visual puzzle gets a CSS-mask icon over `currentColor` plus the caption: no inline SVG and no `dangerouslySetInnerHTML`.
- **A `visual` flag rides on each `CardState`**, so `SlipCard`, `TrayBin` and `RevealScreen` need no new props, and a resumed or finished round keeps it.
- **Clue ids come from the round's `clueIds`.**
- **Kept deliberately light**, as agreed when the spec was written. Layout stays as it is: the icon sits beside the caption inside today's card sizes, so `PlayScreen`'s card height doesn't change.

**Tech Stack:** React 18, Tailwind 3, vite-plugin-pwa (Workbox), Netlify headers.

**Spec:** [`planning-visual-pivot.md`](planning-visual-pivot.md) §5.5 (UI), §5.2 (licensing, CSP) and D11. Requires [Phase 4a](planning-visual-pivot-phase4.md), which supplies `kind`, `clueIds`, the admin `kind`/`negated` fields and the buffer `runway`.

## Global Constraints

- **Word puzzles render exactly as today.** `ItemFace` without `visual` returns the bare text, and the admin card for a word puzzle keeps its comma-separated clues and subtlety numbers.
- **Formatting:** most files here aren't Prettier-clean, so keep the edits hand-formatted as shown. Run Prettier only on files you create, plus these four, which are already clean:
  - `src/game/types.ts`
  - `src/components/TrayBin.tsx`
  - `src/components/PlayScreen.tsx`
  - `src/admin/PuzzleCardBody.tsx`
- **`react-refresh/only-export-components`** is on with `--max-warnings 0`: a `.tsx` file exports components only. That's why `iconUrl` lives in `src/game/icons.ts`.
- **`src/` never imports `content-engine/`** (CLAUDE.md). The credits list is kept in `src/` and checked against the item bank by a content-engine test.
- **Branch / commits:**
  - Stay on the pivot branch (`visual-pivot-phase1`, draft PR #1).
  - Use short one-line messages with no trailers, and commit only if okayed.
  - The diffs below are taken with line endings ignored, after Phases 1–4a.

## File structure

| File | Change |
|---|---|
| `src/game/icons.ts` (new) | `iconUrl`, `warmIcons` |
| `src/components/ItemFace.tsx` (new) | The icon + caption renderer |
| `src/game/types.ts`, `src/game/useGame.ts` | `CardState.visual?`, `GameState.clueIds?`; mark cards, keep clue ids, warm icons |
| `SlipCard.tsx`, `TrayBin.tsx`, `RevealScreen.tsx`, `ClueDeck.tsx`, `PlayScreen.tsx` | Render through `ItemFace` |
| `vite.config.ts`, `netlify.toml` | Icon runtime cache; CSP + `nosniff` on `/icons/visual/*` |
| `src/game/iconCredits.ts` (new), `SettingsModal.tsx`, `content-engine/visual/credits.test.ts` (new) | Licence credits, checked against the item bank |
| `src/admin/ClueList.tsx` (new), `PuzzleCardBody.tsx`, `PuzzleReviewCard.tsx` | Icons in review cards, "NOT" decoys, a Visual badge, Refine/Edit hidden for visual |
| `src/admin/GenerateBatchPanel.tsx`, `adminClient.ts`, `BufferHealthPanel.tsx` | Visual generate option; visual buffer + runway tiles |

---

### Task 1: ItemFace and the four player surfaces

**Files:**
- Create: `src/game/icons.ts`, `src/components/ItemFace.tsx`
- Modify: `src/game/types.ts`, `src/game/useGame.ts`
- Modify: `src/components/SlipCard.tsx`, `TrayBin.tsx`, `RevealScreen.tsx`, `ClueDeck.tsx`, `PlayScreen.tsx`

**Interfaces:**
- Consumes: `GetRoundResponse.kind`, `clueIds` (Phase 4a).
- Produces:
  - `iconUrl(itemId): string` and `warmIcons(itemIds): void`
  - `<ItemFace id name visual? size />`
  - `CardState.visual?: true` and `GameState.clueIds?`

There is no unit test: `src/` tests run in Vitest's `node` environment with no DOM, and the logic is a branch on one flag. Spec §6 verifies 4b by hand at 360×640 (Task 4).

**Icon sizes** come from the Phase 1 contact sheet columns: 36 px on the card, 22 px in the tray, 26 px on the reveal, 18 px in clue chips. The icon is `aria-hidden` and the caption is real text, so a screen reader reads the caption once. That's a small change from the spec's "`role="img"` + `aria-label`", which would have read the name twice.

- [ ] **Step 1: The icon helpers and ItemFace**

`src/game/icons.ts`:
```ts
// Visual puzzle icons (planning-visual-pivot.md §5.5). An item id is also its
// icon's filename, normalized and served from public/icons/visual/.

export function iconUrl(itemId: string): string {
  return `/icons/visual/${itemId}.svg`
}

/** Starts loading a round's icons as soon as it arrives, so cards don't pop in one by one. */
export function warmIcons(itemIds: string[]): void {
  for (const id of itemIds) new Image().src = iconUrl(id)
}
```
`src/components/ItemFace.tsx`:
```tsx
import { iconUrl } from '../game/icons'

interface Props {
  id: string
  name: string
  /** False (or absent) for word puzzles, which render exactly as before: the text alone. */
  visual?: boolean
  /** Icon box size in px. Fixed, so nothing shifts while the icon loads. */
  size: number
}

/**
 * One item, as players read it: for a visual puzzle the icon then its caption
 * (D2: the caption is always shown). The icon is a CSS mask over currentColor,
 * so it follows the text colour and theme with no inline SVG. It is decorative
 * to screen readers, which read the caption.
 */
export function ItemFace({ id, name, visual, size }: Props) {
  if (!visual) return <>{name}</>
  const mask = `url(${iconUrl(id)}) center / contain no-repeat`
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="flex-none bg-current"
        style={{ width: size, height: size, mask, WebkitMask: mask }}
      />
      <span>{name}</span>
    </span>
  )
}
```

- [ ] **Step 2: Game state**

```diff
--- a/src/game/types.ts
+++ b/src/game/types.ts
@@ -12,6 +12,8 @@ export interface CardState {
   result: CardResult
   /** Unknown (null) until this card resolves or the round ends — the server never reveals it early. */
   trueLabel: Label | null
+  /** Visual puzzles only: `id` is an item id and `word` its caption (planning-visual-pivot.md §5.5). */
+  visual?: true
 }
 
 export type Phase = 'loading' | 'play' | 'done' | 'error'
@@ -27,6 +29,8 @@ export interface GameState {
   /** Only known once the round is complete. */
   ruleText: string | null
   clues: { in: string[]; out: string[] }
+  /** Visual puzzles only: item ids in the same order as `clues`. */
+  clueIds?: { in: string[]; out: string[] }
   cards: CardState[]
   lives: number
   selected: string | null
```
```diff
--- a/src/game/useGame.ts
+++ b/src/game/useGame.ts
@@ -1,6 +1,7 @@
 import { useCallback, useEffect, useRef, useState } from 'react'
 import { checkSwipe, getRound } from '../api/client'
-import type { ApiLabel, PoolItem } from '../api/types'
+import type { ApiLabel, GetRoundResponse, PoolItem } from '../api/types'
+import { warmIcons } from './icons'
 import { loadResultId, saveResultId } from './resultStorage'
 import type { CardResult, CardState, GameState, Label } from './types'
 
@@ -24,6 +25,12 @@ function errorMessage(err: unknown): string {
   return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
 }
 
+/** Cards for a round. A visual round marks every card, so each one renders its icon. */
+function toCards(round: GetRoundResponse): CardState[] {
+  const cards = round.pool.map(cardFromPoolItem)
+  return round.kind === 'visual' ? cards.map((c) => ({ ...c, visual: true })) : cards
+}
+
 const OFFLINE_MESSAGE = "You're offline — reconnect to keep playing."
 
 /** fetch() throws a bare TypeError specifically for network-level failures (no connection, DNS, CORS) — a reliable signal distinct from a real HTTP error response. */
@@ -94,6 +101,10 @@ export function useGame() {
       .then((round) => {
         if (cancelled) return
         saveResultId(round.resultId)
+        if (round.kind === 'visual') {
+          const clueIds = round.clueIds ?? { in: [], out: [] }
+          warmIcons([...clueIds.in, ...clueIds.out, ...round.pool.map((p) => p.wordId)])
+        }
         setState({
           phase: round.roundComplete ? 'done' : 'play',
           error: null,
@@ -103,7 +114,8 @@ export function useGame() {
           date: round.date,
           ruleText: round.ruleText,
           clues: round.clues,
-          cards: round.pool.map(cardFromPoolItem),
+          clueIds: round.clueIds,
+          cards: toCards(round),
           lives: round.livesRemaining,
           selected: null,
           pendingIds: [],
@@ -136,7 +148,7 @@ export function useGame() {
             ...s,
             phase: round.roundComplete ? 'done' : 'play',
             ruleText: round.ruleText,
-            cards: round.pool.map(cardFromPoolItem),
+            cards: toCards(round),
             lives: round.livesRemaining,
           }))
         })
```

- [ ] **Step 3: Render through ItemFace**

```diff
--- a/src/components/SlipCard.tsx
+++ b/src/components/SlipCard.tsx
@@ -1,6 +1,7 @@
 import { memo, useRef, useState } from 'react'
 import { useReducedMotion } from 'framer-motion'
 import type { CardState } from '../game/types'
+import { ItemFace } from './ItemFace'
 
 const DRAG_THRESHOLD = 64
 const TAP_THRESHOLD = 8
@@ -133,7 +134,7 @@ export const SlipCard = memo(function SlipCard({
         zIndex: dragging ? 30 : 1,
       }}
     >
-      {card.word}
+      <ItemFace id={card.id} name={card.word} visual={card.visual} size={36} />
       {card.result === 'correct' && (
         <div className="absolute -right-2 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-bin-in font-sans text-xs text-white">
           ✓
```
```diff
--- a/src/components/TrayBin.tsx
+++ b/src/components/TrayBin.tsx
@@ -1,5 +1,6 @@
 import { memo } from 'react'
 import type { CardState, Label } from '../game/types'
+import { ItemFace } from './ItemFace'
 import { CARD_STEP, stackHeightFor, TOP_BASE } from './traySize'
 
 interface Props {
@@ -39,7 +40,7 @@ export const TrayBin = memo(function TrayBin({ side, cards, active, onClick }: P
             className={`absolute left-1/2 flex h-10 w-[92%] -translate-x-1/2 motion-safe:animate-settle items-center justify-center rounded-[11px] border font-display text-base font-bold tracking-wide ${isIn ? 'border-bin-in-chip text-bin-in-text' : 'border-bin-out-chip text-bin-out-text'} bg-slip`}
             style={{ top: `${TOP_BASE + n * CARD_STEP}px`, zIndex: n }}
           >
-            {c.word}
+            <ItemFace id={c.id} name={c.word} visual={c.visual} size={22} />
           </div>
         ))}
       </div>
```
```diff
--- a/src/components/RevealScreen.tsx
+++ b/src/components/RevealScreen.tsx
@@ -1,6 +1,7 @@
 import { useEffect, useState } from 'react'
 import { getCrackRate } from '../api/client'
 import { derivedEndedEarly, type CardState, type RoundResult } from '../game/types'
+import { ItemFace } from './ItemFace'
 import { ShareCardModal } from './ShareCardModal'
 
 interface Props {
@@ -86,7 +87,7 @@ export function RevealScreen({ result, onHome }: Props) {
                   {mark}
                 </div>
                 <div className={`font-display text-lg font-bold tracking-wide ${textColor}`}>
-                  {card.word}
+                  <ItemFace id={card.id} name={card.word} visual={card.visual} size={26} />
                 </div>
                 <div className={`ml-auto font-sans text-[13px] ${noteColor}`}>{note}</div>
               </div>
```
```diff
--- a/src/components/ClueDeck.tsx
+++ b/src/components/ClueDeck.tsx
@@ -1,17 +1,21 @@
+import { ItemFace } from './ItemFace'
+
 interface Props {
   clueIn: string[]
   clueOut: string[]
+  /** Visual puzzles only: item ids in the same order as the clue names. */
+  clueIds?: { in: string[]; out: string[] }
 }
 
-export function ClueDeck({ clueIn, clueOut }: Props) {
+export function ClueDeck({ clueIn, clueOut, clueIds }: Props) {
   return (
     <div className="mx-5 flex flex-col gap-3 rounded-bin border border-line bg-slip p-4">
       <div className="font-sans text-[11px] font-semibold tracking-wider text-ink-soft">
         THE LIST SO FAR
       </div>
-      <ClueRow label="● IN" labelColor="text-bin-in" words={clueIn} chipBg="bg-bin-in-chip" chipText="text-bin-in-text" />
+      <ClueRow label="● IN" labelColor="text-bin-in" words={clueIn} ids={clueIds?.in} chipBg="bg-bin-in-chip" chipText="text-bin-in-text" />
       <div className="h-px bg-skip-chip" />
-      <ClueRow label="▲ OUT" labelColor="text-bin-out-label" words={clueOut} chipBg="bg-bin-out-chip" chipText="text-bin-out-text" />
+      <ClueRow label="▲ OUT" labelColor="text-bin-out-label" words={clueOut} ids={clueIds?.out} chipBg="bg-bin-out-chip" chipText="text-bin-out-text" />
     </div>
   )
 }
@@ -20,12 +24,14 @@ function ClueRow({
   label,
   labelColor,
   words,
+  ids,
   chipBg,
   chipText,
 }: {
   label: string
   labelColor: string
   words: string[]
+  ids?: string[]
   chipBg: string
   chipText: string
 }) {
@@ -43,7 +49,7 @@ function ClueRow({
           overflow-x-auto stays only as a last-resort safety net for a case
           these two steps can't fit; it should never engage in practice. */}
       <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto">
-        {words.map((w) => {
+        {words.map((w, i) => {
           const compact = w.length > 7
           const small = w.length > 10
           return (
@@ -57,7 +63,7 @@ function ClueRow({
                     : 'px-2.5 py-1.5 text-sm tracking-wide'
               }`}
             >
-              {w}
+              <ItemFace id={ids?.[i] ?? w} name={w} visual={ids !== undefined} size={18} />
             </div>
           )
         })}
```
```diff
--- a/src/components/PlayScreen.tsx
+++ b/src/components/PlayScreen.tsx
@@ -153,7 +153,7 @@ export function PlayScreen({ game, onDone, onHowToPlay, onShowStats, onShowSetti
       </div>
 
       <div className="mt-4">
-        <ClueDeck clueIn={state.clues.in} clueOut={state.clues.out} />
+        <ClueDeck clueIn={state.clues.in} clueOut={state.clues.out} clueIds={state.clueIds} />
       </div>
 
       {state.offlineNotice && (
```

- [ ] **Step 4: Check**

Run: `npx prettier --write src/game/icons.ts src/components/ItemFace.tsx src/game/types.ts src/components/TrayBin.tsx src/components/PlayScreen.tsx && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/icons.ts src/components/ItemFace.tsx src/game/types.ts src/game/useGame.ts src/components/SlipCard.tsx src/components/TrayBin.tsx src/components/RevealScreen.tsx src/components/ClueDeck.tsx src/components/PlayScreen.tsx
git commit -m "Render visual puzzle items as icon and caption"
```

---

### Task 2: Offline icons and the icon CSP header

**Files:**
- Modify: `vite.config.ts`, `netlify.toml`

The precache only takes the Workbox default (`js`, `css`, `html`), so icons are cached at runtime. `StaleWhileRevalidate` lets a redrawn icon reach players. The `get-round` and `check-swipe` rules are not touched (spec §5.5).

The CSP header is the second layer behind Phase 1's normalizer gate: an icon file is same-origin with the admin panel, and `default-src 'none'` keeps a file that ever slipped through inert if someone opens it directly. Masks loaded from CSS aren't affected, because a resource's own CSP only governs it when it's opened as a document.

- [ ] **Step 1: Apply**

```diff
--- a/vite.config.ts
+++ b/vite.config.ts
@@ -91,6 +91,14 @@ export default defineConfig({
             handler: 'NetworkOnly',
             method: 'GET',
           },
+          {
+            // Visual puzzle icons (planning-visual-pivot.md §5.5). The precache
+            // only takes js/css/html, so these are cached as they're used;
+            // StaleWhileRevalidate so a redrawn icon still reaches players.
+            urlPattern: /\/icons\/visual\/[a-z0-9-]+\.svg$/,
+            handler: 'StaleWhileRevalidate',
+            options: { cacheName: 'visual-icons', expiration: { maxEntries: 800 } },
+          },
         ],
       },
     }),
```
```diff
--- a/netlify.toml
+++ b/netlify.toml
@@ -39,6 +39,15 @@
   [headers.values]
     Cache-Control = "no-cache"
 
+# Icons are same-origin with the admin panel. The normalizer already rejects
+# anything executable; this keeps a file that slipped through inert if it is
+# ever opened directly (planning-visual-pivot.md §5.2).
+[[headers]]
+  for = "/icons/visual/*"
+  [headers.values]
+    Content-Security-Policy = "default-src 'none'; style-src 'unsafe-inline'"
+    X-Content-Type-Options = "nosniff"
+
 [[headers]]
   for = "/manifest.webmanifest"
   [headers.values]
```

- [ ] **Step 2: Check**

Run: `npx vitest run vite.config.test.ts && npm run build`
Expected: PASS, and the build prints the precache line as before (no SVGs in it).

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts netlify.toml
git commit -m "Cache visual icons offline and lock down their CSP"
```

---

### Task 3: Licence credits

**Files:**
- Create: `src/game/iconCredits.ts`
- Test: `content-engine/visual/credits.test.ts`
- Modify: `src/components/SettingsModal.tsx`

**Why this shape:**
- **OpenMoji (CC BY-SA 4.0)** needs one credit for the whole set. The exact wording is from `content-engine/visual/icons/README.md`.
- **Each Noun Project icon (CC BY 3.0)** needs its creator named.
- **The list has to live in `src/`**, which can't import the item bank. So the list is kept by hand and a test fails the moment it drifts from `items.ts`.
- **The credits sit in a native `<details>`** in Settings, so no new screen or state is needed. The spec requires them before the first visual puzzle goes live; shipping them earlier is harmless.

- [ ] **Step 1: Write the failing test**

`content-engine/visual/credits.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { NOUN_CREDITS } from '../../src/game/iconCredits.js'
import { ITEMS } from './items.js'

// The credits screen lives in src/ and can't import the item bank, so this
// keeps its hand-kept list honest (planning-visual-pivot.md §5.2).
describe('icon credits', () => {
  it('names the creator of every Noun Project icon, and nothing else', () => {
    const expected = ITEMS.flatMap((item) =>
      item.icon.set === 'noun'
        ? [{ itemId: item.id, creator: item.icon.creator, url: item.icon.url }]
        : []
    )
    expect(NOUN_CREDITS).toEqual(expected)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/credits.test.ts`
Expected: FAIL, because `../../src/game/iconCredits.js` doesn't exist.

- [ ] **Step 3: Write the credits and show them**

`src/game/iconCredits.ts`:
```ts
// Icon licence credits (planning-visual-pivot.md §5.2, §5.5). OpenMoji needs one
// credit for the whole set; each Noun Project icon (CC BY 3.0) needs its
// creator named. content-engine/visual/credits.test.ts fails if NOUN_CREDITS
// drifts from the item bank, so add a line here with every Noun Project icon.

export const OPENMOJI_CREDIT =
  'All emojis designed by OpenMoji – the open-source emoji and icon project. License: CC BY-SA 4.0'

export const NOUN_CREDITS: { itemId: string; creator: string; url: string }[] = []
```
```diff
--- a/src/components/SettingsModal.tsx
+++ b/src/components/SettingsModal.tsx
@@ -1,6 +1,7 @@
 import { useEffect, useState } from 'react'
 import { version } from '../../package.json'
 import { getPuzzleMeta } from '../api/client'
+import { NOUN_CREDITS, OPENMOJI_CREDIT } from '../game/iconCredits'
 // Dark mode is shelved for now — commented out, not removed, so it's a
 // quick re-enable later (see src/theme.ts).
 // import { getTheme, toggleTheme } from '../theme'
@@ -85,6 +86,27 @@ export function SettingsModal({ onClose, onHowToPlay, onShowStats }: Props) {
             <span className="font-sans text-[15px] font-semibold">Reset stats & history</span>
             <span className="text-ink-soft">›</span>
           </button>
+
+          {/* Required by the icon licences before any visual puzzle goes live (planning-visual-pivot.md §5.5). */}
+          <details className="rounded-bin border border-line bg-slip px-4 py-3 font-sans text-[13px] text-ink-soft">
+            <summary className="cursor-pointer text-[15px] font-semibold text-ink">Icon credits</summary>
+            <p className="mt-2">
+              {OPENMOJI_CREDIT} (
+              <a href="https://openmoji.org" className="underline">
+                openmoji.org
+              </a>
+              )
+            </p>
+            {NOUN_CREDITS.map((c) => (
+              <p key={c.itemId} className="mt-1">
+                {c.itemId.replace(/-/g, ' ')}:{' '}
+                <a href={c.url} className="underline">
+                  {c.creator}
+                </a>
+                , Noun Project, CC BY 3.0
+              </p>
+            ))}
+          </details>
         </div>
 
         <div className="flex flex-col items-center gap-1 px-7 pb-2 pt-1 text-center">
```

- [ ] **Step 4: Run the test to verify it passes, then check**

Run: `npx vitest run content-engine/visual/credits.test.ts && npx prettier --write src/game/iconCredits.ts content-engine/visual/credits.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS (1 test) and clean. The pilot has no Noun Project icons, so `NOUN_CREDITS` is `[]`.

- [ ] **Step 5: Commit**

```bash
git add src/game/iconCredits.ts content-engine/visual/credits.test.ts src/components/SettingsModal.tsx
git commit -m "Add the icon licence credits to Settings"
```

---

### Task 4: Admin, plus the hand check (4c, and the 4b exit)

**Files:**
- Create: `src/admin/ClueList.tsx`
- Modify: `src/admin/PuzzleCardBody.tsx`, `PuzzleReviewCard.tsx`, `GenerateBatchPanel.tsx`, `adminClient.ts`, `BufferHealthPanel.tsx`

**Interfaces:**
- Consumes:
  - `AdminPuzzleDetail.kind`, `AdminLiveDecoyDetail.negated`, `AdminBufferHealthResponse.kind / visualBufferDays / runway`, and the generate endpoint's `kind` (Phase 4a)
  - `ItemFace` (Task 1)
- Produces:
  - `<ClueList puzzle label />`
  - `generateBatch(code, count, tiers?, kind?)`

What changes for a visual puzzle:
- **Review cards** show icons with captions and a "Visual" badge, and decoys read "NOT …" when inverted, with no subtlety (D7).
- **Refine (AI) and Edit manually are hidden** (D11). Approve and plain Reject stay. The reject reason is kept for tuning.
- **Generate batch** gains a **Visual** option.
- **Buffer health** shows the visual buffer (amber under 14 days) and the rule runway (amber under 60, spec §4.7) when `PUZZLE_KIND=visual`.

- [ ] **Step 1: Write the components**

`src/admin/ClueList.tsx`:
```tsx
import { ItemFace } from '../components/ItemFace'
import type { AdminPuzzleDetail } from './types'

/** One side's clues on a review card: comma-separated words, or icons with captions for a visual puzzle. */
export function ClueList({ puzzle, label }: { puzzle: AdminPuzzleDetail; label: 'IN' | 'OUT' }) {
  const clues = puzzle.clues.filter((c) => c.label === label)
  if (puzzle.kind !== 'visual') return <div>{clues.map((c) => c.word).join(', ')}</div>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {clues.map((c) => (
        <ItemFace key={c.wordId} id={c.wordId} name={c.word} visual size={18} />
      ))}
    </div>
  )
}
```
```diff
--- a/src/admin/PuzzleCardBody.tsx
+++ b/src/admin/PuzzleCardBody.tsx
@@ -1,3 +1,5 @@
+import { ItemFace } from '../components/ItemFace'
+import { ClueList } from './ClueList'
 import type { AdminPuzzleDetail } from './types'
 
 // The reviewer-detail body shared by every "here's a whole puzzle" admin
@@ -9,9 +11,6 @@ interface Props {
 }
 
 export function PuzzleCardBody({ puzzle }: Props) {
-  const clueIn = puzzle.clues.filter((c) => c.label === 'IN').map((c) => c.word)
-  const clueOut = puzzle.clues.filter((c) => c.label === 'OUT').map((c) => c.word)
-
   return (
     <>
       <div className="font-sans text-sm">{puzzle.ruleDescription}</div>
@@ -25,11 +24,11 @@ export function PuzzleCardBody({ puzzle }: Props) {
       <div className="grid grid-cols-2 gap-4 font-sans text-sm">
         <div>
           <div className="mb-1 font-semibold text-bin-in-text">IN clues</div>
-          <div>{clueIn.join(', ')}</div>
+          <ClueList puzzle={puzzle} label="IN" />
         </div>
         <div>
           <div className="mb-1 font-semibold text-bin-out-label">OUT clues</div>
-          <div>{clueOut.join(', ')}</div>
+          <ClueList puzzle={puzzle} label="OUT" />
         </div>
       </div>
 
@@ -43,7 +42,7 @@ export function PuzzleCardBody({ puzzle }: Props) {
                 : 'border-bin-out bg-bin-out-chip text-bin-out-text'
             }`}
           >
-            {g.word}
+            <ItemFace id={g.wordId} name={g.word} visual={puzzle.kind === 'visual'} size={16} />
             {g.isTrap && <span className="ml-1 opacity-70">({g.trapType})</span>}
           </div>
         ))}
@@ -52,7 +51,13 @@ export function PuzzleCardBody({ puzzle }: Props) {
       <div className="font-sans text-xs text-ink-soft">
         Live decoys:{' '}
         {puzzle.liveDecoys.length > 0
-          ? puzzle.liveDecoys.map((d) => `${d.ruleName} (subtlety ${d.subtlety})`).join(', ')
+          ? puzzle.liveDecoys
+              .map((d) =>
+                puzzle.kind === 'visual'
+                  ? `${d.negated ? 'NOT ' : ''}${d.ruleName}`
+                  : `${d.ruleName} (subtlety ${d.subtlety})`
+              )
+              .join(', ')
           : 'none'}
       </div>
     </>
```
```diff
--- a/src/admin/PuzzleReviewCard.tsx
+++ b/src/admin/PuzzleReviewCard.tsx
@@ -1,4 +1,6 @@
 import { useState } from 'react'
+import { ItemFace } from '../components/ItemFace'
+import { ClueList } from './ClueList'
 import { ManualEditPanel } from './ManualEditPanel'
 import type { AdminPuzzleDetail, Label } from './types'
 
@@ -32,8 +34,6 @@ export function PuzzleReviewCard({
   const [busy, setBusy] = useState(false)
   const [editing, setEditing] = useState(false)
 
-  const clueIn = puzzle.clues.filter((c) => c.label === 'IN').map((c) => c.word)
-  const clueOut = puzzle.clues.filter((c) => c.label === 'OUT').map((c) => c.word)
 
   const handleApprove = async () => {
     setBusy(true)
@@ -70,7 +70,9 @@ export function PuzzleReviewCard({
   return (
     <div className="flex flex-col gap-4 rounded-bin border border-line bg-slip p-5">
       <div className="flex items-baseline justify-between">
-        <div className="font-display text-lg font-bold capitalize">{puzzle.difficultyTier}</div>
+        <div className="font-display text-lg font-bold capitalize">
+          {puzzle.kind === 'visual' ? 'Visual' : puzzle.difficultyTier}
+        </div>
         <div className="font-sans text-xs uppercase tracking-wide text-ink-soft">
           {puzzle.ruleId}
         </div>
@@ -89,11 +91,11 @@ export function PuzzleReviewCard({
       <div className="grid grid-cols-2 gap-4 font-sans text-sm">
         <div>
           <div className="mb-1 font-semibold text-bin-in-text">IN clues</div>
-          <div>{clueIn.join(', ')}</div>
+          <ClueList puzzle={puzzle} label="IN" />
         </div>
         <div>
           <div className="mb-1 font-semibold text-bin-out-label">OUT clues</div>
-          <div>{clueOut.join(', ')}</div>
+          <ClueList puzzle={puzzle} label="OUT" />
         </div>
       </div>
 
@@ -109,7 +111,7 @@ export function PuzzleReviewCard({
                   : 'border-bin-out bg-bin-out-chip text-bin-out-text'
               }`}
             >
-              {g.word}
+              <ItemFace id={g.wordId} name={g.word} visual={puzzle.kind === 'visual'} size={16} />
               {g.isTrap && <span className="ml-1 opacity-70">({g.trapType})</span>}
             </div>
           ))}
@@ -119,7 +121,13 @@ export function PuzzleReviewCard({
       <div className="font-sans text-sm text-ink-soft">
         Live decoys:{' '}
         {puzzle.liveDecoys.length > 0
-          ? puzzle.liveDecoys.map((d) => `${d.ruleName} (subtlety ${d.subtlety})`).join(', ')
+          ? puzzle.liveDecoys
+              .map((d) =>
+                puzzle.kind === 'visual'
+                  ? `${d.negated ? 'NOT ' : ''}${d.ruleName}`
+                  : `${d.ruleName} (subtlety ${d.subtlety})`
+              )
+              .join(', ')
           : 'none'}
       </div>
 
@@ -141,9 +149,15 @@ export function PuzzleReviewCard({
           <input
             value={reason}
             onChange={(e) => setReason(e.target.value)}
-            placeholder="What should change? The AI reads this and rewrites the puzzle…"
+            placeholder={
+              puzzle.kind === 'visual'
+                ? 'Why reject it? Kept for tuning the rules and tags.'
+                : 'What should change? The AI reads this and rewrites the puzzle…'
+            }
             className="min-w-[180px] flex-1 rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
           />
+          {/* planning-visual-pivot.md D11: a bad visual board is rejected and regenerated, never patched. */}
+          {puzzle.kind !== 'visual' && (
           <button
             onClick={handleRefine}
             disabled={busy || !reason.trim()}
@@ -152,6 +166,7 @@ export function PuzzleReviewCard({
           >
             Refine
           </button>
+          )}
           <button
             onClick={handleReject}
             disabled={busy}
@@ -160,6 +175,7 @@ export function PuzzleReviewCard({
           >
             Reject
           </button>
+          {puzzle.kind !== 'visual' && (
           <button
             onClick={() => setEditing((v) => !v)}
             disabled={busy}
@@ -168,6 +184,7 @@ export function PuzzleReviewCard({
           >
             {editing ? 'Close editor' : 'Edit manually'}
           </button>
+          )}
         </div>
 
         {editing && (
```
```diff
--- a/src/admin/GenerateBatchPanel.tsx
+++ b/src/admin/GenerateBatchPanel.tsx
@@ -2,7 +2,7 @@ import { useState } from 'react'
 import type { FormEvent } from 'react'
 import { generateBatch } from './adminClient'
 
-type TierChoice = 'both' | 'medium' | 'spicy'
+type TierChoice = 'both' | 'medium' | 'spicy' | 'visual'
 
 interface Props {
   code: string
@@ -27,8 +27,10 @@ export function GenerateBatchPanel({ code, onGenerated }: Props) {
     setError(null)
     setMessage(null)
     try {
-      const tiers = tierChoice === 'both' ? undefined : [tierChoice]
-      const result = await generateBatch(code, count, tiers)
+      const result =
+        tierChoice === 'visual'
+          ? await generateBatch(code, count, undefined, 'visual')
+          : await generateBatch(code, count, tierChoice === 'both' ? undefined : [tierChoice], 'word')
       setMessage(`Generated ${result.generated}/${result.requested} candidates — added to the review queue below.`)
       onGenerated()
     } catch (err) {
@@ -57,6 +59,7 @@ export function GenerateBatchPanel({ code, onGenerated }: Props) {
           <option value="both">Medium + Spicy</option>
           <option value="medium">Medium only</option>
           <option value="spicy">Spicy only</option>
+          <option value="visual">Visual</option>
         </select>
         <button
           type="submit"
```
```diff
--- a/src/admin/adminClient.ts
+++ b/src/admin/adminClient.ts
@@ -153,11 +153,12 @@ export async function generateBatch(
   code: string,
   count: number,
   tiers?: ('medium' | 'spicy')[],
+  kind?: 'word' | 'visual',
 ): Promise<AdminGenerateBatchResponse> {
   const res = await adminFetch('/api/admin-generate-batch', code, {
     method: 'POST',
     headers: { 'content-type': 'application/json' },
-    body: JSON.stringify({ count, tiers }),
+    body: JSON.stringify({ count, tiers, kind }),
   })
   if (!res.ok) throw new Error(`Failed to generate batch (${res.status})`)
   return res.json() as Promise<AdminGenerateBatchResponse>
```
```diff
--- a/src/admin/BufferHealthPanel.tsx
+++ b/src/admin/BufferHealthPanel.tsx
@@ -4,6 +4,8 @@ import type { AdminBufferHealthResponse } from './types'
 // against, matching the plan's "healthy" bar for each tier.
 const MEDIUM_TARGET_DAYS = 14
 const SPICY_TARGET_WEEKS = 4
+// planning-visual-pivot.md §4.7: below this many unused rules, write more.
+const RUNWAY_WARN_DAYS = 60
 
 interface Props {
   health: AdminBufferHealthResponse
@@ -17,10 +19,25 @@ export function BufferHealthPanel({ health }: Props) {
     <div className="flex flex-col gap-3 rounded-bin border border-line bg-slip p-5">
       <div className="font-display text-lg font-bold">Content buffer</div>
 
-      <div className="grid grid-cols-2 gap-4 font-sans text-sm">
-        <BufferTile label="Medium buffer" value={`${health.mediumBufferDays} days`} low={mediumLow} />
-        <BufferTile label="Spicy buffer" value={`${health.spicyBufferWeeks} weeks`} low={spicyLow} />
-      </div>
+      {health.kind === 'visual' ? (
+        <div className="grid grid-cols-2 gap-4 font-sans text-sm">
+          <BufferTile
+            label="Visual buffer"
+            value={`${health.visualBufferDays} days`}
+            low={health.visualBufferDays < MEDIUM_TARGET_DAYS}
+          />
+          <BufferTile
+            label="Rule runway"
+            value={`${health.runway ?? 0} days`}
+            low={(health.runway ?? 0) < RUNWAY_WARN_DAYS}
+          />
+        </div>
+      ) : (
+        <div className="grid grid-cols-2 gap-4 font-sans text-sm">
+          <BufferTile label="Medium buffer" value={`${health.mediumBufferDays} days`} low={mediumLow} />
+          <BufferTile label="Spicy buffer" value={`${health.spicyBufferWeeks} weeks`} low={spicyLow} />
+        </div>
+      )}
 
       {health.gapDates.length > 0 && (
         <div className="rounded-card border border-miss-border bg-miss-tint p-3 font-sans text-sm text-miss-text">
```

- [ ] **Step 2: Check**

Run: `npx prettier --write src/admin/ClueList.tsx src/admin/PuzzleCardBody.tsx && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all clean, 683 tests (682 after Phase 4a, plus the credits test).

- [ ] **Step 3: Hand check at 360×640 (spec §6 Phase 4b)**

Under `npm run dev:functions` (with `PUZZLE_KIND=visual` in `.env` for the admin parts), play the test puzzle from Phase 4a Task 5 on `?asOf=2030-01-01`, in a 360×640 window. Check each of these:
- **Clues:** six chips with icons and captions on one line each, with no wrapping and no horizontal scroll at 360 px.
- **Cards:** the icon is left of the caption. The longest pilot caption ("fire extinguisher") fits without overflowing the card.
- **Play:** swipe both ways; the tray chips show icons.
- **Lose all 3 lives:** the reveal lists all six items with icons and the reveal sentence.
- **Reload mid-round:** it resumes with icons (cards keep `visual`).
- **Share:** the card shows emoji squares only, no captions.
- **Light and dark:** icons follow the text colour (dark mode is shelved; flip `data-theme` in devtools to check anyway).
- **Screen reader** (NVDA or VoiceOver): each item is read once, by its caption.
- **Admin:** a visual card shows icons, "Visual", "NOT …" decoys, no Refine/Edit; Generate → Visual queues candidates; buffer health shows the two visual tiles.
- **Word path:** with `PUZZLE_KIND` unset, today's word puzzle and the admin look exactly as before.

Then clean up the 2030 test puzzle as in Phase 4a Task 5 Step 6.

- [ ] **Step 4: Mark Phase 4 done in the spec**

In `planning-visual-pivot.md` §6, under Phase 4, add: `**4b/4c status:** done YYYY-MM-DD.`

- [ ] **Step 5: Commit**

```bash
git add src/admin planning-visual-pivot.md
git commit -m "Show visual puzzles in the admin panel and add the visual generate option"
```

---

## Self-review against the spec

| Spec requirement (planning-visual-pivot.md) | Task |
|---|---|
| §5.5 one `ItemFace`: text for words, icon + caption for visual; CSS mask over currentColor; fixed icon box; no `dangerouslySetInnerHTML` | 1 |
| §5.5 icons warmed after `get-round` | 1 (`warmIcons` in `useGame`) |
| §5.5 plugs into `SlipCard`, `ClueDeck`, `TrayBin`, `RevealScreen`; `useGame`/types gain `kind`/`clueIds`; `CARD_HEIGHT` unchanged | 1 |
| §5.5 offline: one `StaleWhileRevalidate` rule for `/icons/visual/`; get-round/check-swipe rules untouched | 2 |
| §5.2 CSP for `/icons/visual/*` (deferred from Phase 1) | 2 |
| §5.5 credits in Settings, generated from `items.ts`, before the first visual puzzle | 3 (kept in `src/`, test-checked against `items.ts`) |
| §5.5 admin: icons on review cards, kind badge, edit/AI review hidden, generate selector | 4 |
| §4.7 runway shown next to the buffer, warning below 60 | 4 |
| §6 4b exit: hand check at 360×640 (play, 3 lives, resume, share, light/dark, screen reader) | 4 |

**Deviations, recorded:**
- **The icon is `aria-hidden`, not `role="img"` with a label.** The caption is always visible text, so the label would read every item twice.
- **The credits are a `<details>` section in Settings**, not a separate screen.
- **D2 and the "captions as text" fallback** for players on an old bundle are unchanged: an old client ignores `kind` and shows the captions as words.
