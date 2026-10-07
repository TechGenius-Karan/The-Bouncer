# The Bouncer — Visual Pivot Plan

> **Status:** Design approved 2026-10-01 (all three sections). Phase 1 done on branch `visual-pivot-phase1` (draft PR #1), contact sheet reviewed 2026-10-02. Implementation plans for every remaining phase written 2026-10-02 (§6), each with code verified end to end against the branch; nothing past Phase 1 is implemented yet.
> **Scope:** Change the puzzle content from words to monochrome line-art icons of everyday things, judged on their physical and practical properties. The game loop stays the same. The word engine stays in the repo, intact, as an archived baseline.
> **How to read this doc:** 🔒 = decided directly by the user for this pivot (2026-09-30 / 2026-10-01, through explicit questions). Not open to casual re-litigation. 💡 = a suggested default; change freely. Same convention as `ai-feedback-plan.md`.
> **Companion docs:** `planning.md` (locked game spec; §1 of this doc lists what the pivot overrides there), `build-plan.md` (phase history), `CLAUDE.md` (architecture).

---

## Table of Contents
0. [Decision log](#0-decision-log)
1. [What changes and what doesn't](#1-what-changes-and-what-doesnt)
2. [Codebase findings that shape this plan](#2-codebase-findings-that-shape-this-plan)
3. [Section 1 — Structure and engine model](#3-section-1--structure-and-engine-model)
4. [Section 2 — Rules, tagging matrix, generator](#4-section-2--rules-tagging-matrix-generator)
5. [Section 3 — Icons, backend, ops, UI, rollout](#5-section-3--icons-backend-ops-ui-rollout)
6. [Implementation phases](#6-implementation-phases)
7. [Risks and known limits](#7-risks-and-known-limits)
8. [Preservation ledger](#8-preservation-ledger)
9. [Appendix A — Icon-library measurements](#appendix-a--icon-library-measurements)

---

## 0. Decision log

| # | Decision | Outcome |
|---|---|---|
| D1 | Cutover | 🔒 **Full switch.** All new generation is visual. Word puzzles already scheduled still play out. Word puzzles that are approved but not yet scheduled are parked in the DB and never scheduled again. Scheduling and buffer health become kind-aware. |
| D2 | Captions | 🔒 **Always.** Every icon shows its name as a small caption on cards, clues and the reveal. Recognizing the object is never part of the puzzle. |
| D3 | Tagging | 🔒 **AI draft plus human review.** Offline Gemini, 3 independent passes, and anything short of unanimous becomes `null`. Human overrides always win. Never run at game time. |
| D4 | Icon source | 🔒 **OpenMoji (black line set) as the base, free Noun Project (CC BY) for gaps.** Attribution goes on a credits screen. It must be free, not paid. The measurements behind this choice are in Appendix A. |
| D5 | Item scope | 🔒 **Things, food, vehicles, animals, plants.** Any concrete, single physical thing you could picture on its own. People, body parts, places/buildings, weather, symbols and events are out. |
| D6 | Rule reuse | 🔒 **Every rule is unique, used once ever.** An icon/item may appear in many puzzles; a rule may not. |
| D7 | Difficulty | 🔒 **One uniform difficulty.** No medium/spicy tiers, no Spicy Saturday, no subtlety ratings for visual rules. |
| D8 | Rule space | 🔒 **Many atomic rules organized in families.** ~500 authored to yield ~400 usable. No compound ("A and B") rules. |
| D9 | Engine approach | 🔒 **A separate visual generator** (Approach A, §3.2). The word generator is not generalized or adapted. |
| D10 | Negated hidden rules ("IN: does *not* float") | 💡 Never the hidden rule. Both polarities are still checked as decoys and collisions. |
| D11 | Admin manual-edit / AI-review on visual puzzles | 💡 Disabled. A bad board is rejected and regenerated. |
| D12 | Copy/branding ("daily word puzzle", home-screen demo, how-to-play, manifest) | 💡 Rewritten at cutover (§5.6), not when the code ships. |
| D13 | Pilot | 💡 ~150 items × ~40 rules run through every phase before the full content build-out. |
| D14 | Runway target | 💡 400 puzzles, i.e. ~400 usable unique rules. The runway is set by the rule count, not the icon count. |

---

## 1. What changes and what doesn't

### Preserved, unchanged
- 3 lives. One swipe per guest. Auto-correct on a miss. The round ends on the 3rd miss (`planning.md` §3.2–3.4).
- **Correctness and lives are decided by the server.** True labels are never sent early (§8.4).
- No credit for naming the rule. The rule text appears only at the reveal (§3.5).
- Spoiler-safe share card (§6.2). It's an emoji grid, so it doesn't depend on content type.
- Pipeline: **generate → validate → human-approve → schedule**, with a buffer always kept ahead (§9). Nothing skips the human.
- 3 + 3 clues, a 6-guest pool, the IN-count distribution, the swipe and tray interaction, the PWA's `prompt` update model, and `check-swipe` staying `NetworkOnly`.

### Overridden by this pivot (product-owner decisions above)
| `planning.md` | Was | Now |
|---|---|---|
| §1 🔒 | "a daily word puzzle" | a daily puzzle about **things** |
| §4 🔒 | medium + Spicy Saturday calendar, subtlety tiers | one uniform difficulty, every day (D7) |
| §7.1 | lexical/semantic word taxonomy | atomic property rules in families (§4.1) |
| §7.3 | boolean uniqueness check | **three-valued** uniqueness check (§4.4) |
| §7.4 | per-tier knobs | one knob set: today's medium values |
| §7.5 | word-bank requirements | item bank + tagging matrix (§4.2) |
| §9.1 / scheduling | rule cooldown (60 days) | **rule used once ever** (D6) |
| §10 | "image-based themed weeks, needs its own planning pass" | this document |

Once Section 3 is approved, I'll add a one-line pointer at the top of `planning.md` §1/§4/§7 and a phase entry in `build-plan.md`, both linking here.

---

## 2. Codebase findings that shape this plan

From a review of `content-engine/`, `lib/`, `api/`, `netlify/functions/` and `src/` at `f786878`.

1. **The live player backend is on Vercel.** `get-round`, `check-swipe`, `get-crack-rate` and `get-puzzle-meta` run from `api/` + `lib/` (region `bom1`). The copies in `netlify/functions/` are dormant in production, but `npm run dev:functions` still uses them locally. Every backend change therefore goes into **both** `lib/` and `netlify/functions/_shared/` (CLAUDE.md already requires this).
2. **`check-swipe` already works the same for any content.** It compares `wordId` + `attemptedLabel` against the stored true label and never reads `words`. It needs **no change**. Its one content-dependent output, `poolReveal`, comes from `buildPool()`.
3. **All word-specific code on the player path is in one file**, `roundView.ts` (`buildPool`, `resolveClueWords`), which looks up spellings. `adminPuzzleDetail.ts`, `puzzleStats.ts` and `archive.ts` read `words` too, but fall back to the raw id (`spellingOf.get(id) ?? id`). With slug ids like `stick-of-butter` they degrade to readable text instead of breaking.
4. **`resolveRuleText` reads the `rules` collection by id.** If visual rules are upserted into the same collection, the reveal, the admin detail view and rule overrides all keep working.
5. **The word generator can't express "exclude on null".** `Rule.evaluate(word): boolean` is compared with `=== isIn` in `decoyScan.ts`, `trapSelection.ts` and `validator.ts`. The phonetics precedent (null = "does not match") is the opposite of what this pivot needs. That's why the engine is separate (§3.2).
6. **The rule-category type is closed.** `ruleSelection.ts` has `MECHANIC_WEIGHTS: Record<Rule['mechanic'], number>`, so adding visual families to the `Mechanic` union would *force* edits inside the word engine. Visual rules keep their own `family` type, and the scheduler builds a `Map<string, string>` from both sets.
7. **Four places build a `PuzzleDoc` field by field from a generated candidate:** `api/scheduled-generate-puzzles.ts`, `content-engine/scripts/queuePuzzles.ts`, `netlify/functions/admin-generate-batch.ts`, `api/admin.ts`. Any new field (`kind`, `generatorSeed`) is silently dropped unless all four copy it. The result would be a visual puzzle rendered as words. Each one gets a mapping test.
8. **Rule repetition is controlled in two separate places:** the 60-day generation cooldown (`lib/ruleUsage.ts`) and the 60-day scheduling spacing (`content-engine/scheduling/placement.ts`). Both are keyed on rule id. Visual uniqueness (D6) replaces both for visual rules.
9. **Tiers are spread through ops:** `schedulePuzzles.ts` (Saturday pulls from spicy), `puzzleStats.ts` (`spicyBufferWeeks`), the cron's per-tier top-up, `GenerateBatchPanel`, `BufferHealthPanel`, `ApprovedPanel`. The word path keeps all of it. The visual path bypasses it (§5.4). `admin-schedule-puzzle.ts` has **no** tier check, so manually scheduling a visual puzzle on a Saturday already works.
10. **There's a precedent for AI tagging plus human overrides.** `words/aiTags.ts` is generated and `words/tagOverrides.ts` is human-reviewed and wins on conflict. The prompt and validation core (`words/aiTagging.ts`) is unit-tested separately from the script that calls the network (`scripts/tagWordsAi.ts`). Visual tagging mirrors this split.
11. **Old clients will see visual puzzles.** With `registerType: 'prompt'`, players can keep an old bundle for days. The contract change is **additive only**, so an old client still renders the item's *name* as text: playable, just not pretty.
12. **Vercel Hobby allows 12 functions, and 9 are in use.** This plan adds **zero** files under `api/`.
13. **Node ESM on Vercel:** `content-engine/` is imported by the Vercel cron, so new relative imports need `.js` extensions. Data modules are `.ts`, not `.json`, which avoids the import-attribute pitfall (same failure class CLAUDE.md warns about).

---

## 3. Section 1 — Structure and engine model *(approved)*

### 3.1 Where things live (all new)
```
content-engine/visual/
  types.ts            Tri, Item, VisualRule, Family
  items.ts            item bank: id, name, scope group, icon source + credit
  rules.ts            rule families -> ~500 atomic rules (id, family, reveal text, tagging guidance)
  tags/<family>.ai.ts         generated AI draft (never hand-edited)
  tags/<family>.overrides.ts  human decisions; win per cell
  matrix.ts           valueOf(itemId, ruleId) -> true | false | null  (merges ai + overrides)
  random.ts           seeded PRNG (mulberry32) + shuffle/pickWeighted over it
  generator.ts        rule -> clues -> decoys -> pool -> validate (pure, seeded)
  tagging.ts          prompt building + response validation (pure, unit-tested)
  scripts/            normalizeIcons, tagVisualAi, matrixReport, seedVisual, generateVisualBatch
  icons/openmoji/<HEX>.svg  vendored raw OpenMoji 17.0.0 files
  icons/noun/<id>.svg       raw Noun Project gap-fill files
public/icons/visual/<id>.svg   normalized output, committed, served by Netlify
```
The word engine (`content-engine/words/`, `rules/`, `generator/`, their scripts and tests) is **not edited**. The only exception is `scheduling/placement.ts` (§5.4), which is shared ops code and not part of the engine.

### 3.2 Engine approach — A: a separate visual generator 🔒
| Approach | Verdict |
|---|---|
| **A. A separate generator, same pipeline shape** (pick rule → clues → decoy scan → trap pool → validate/repair), built on true/false/null natively, ~250 lines | **Chosen.** Small, isolated, and correct by construction. |
| B. Make the word generator handle three values | Rejected: it means rewriting the archived baseline and risks regressions in a system that works. |
| C. Wrap items/rules in the word engine's `Word`/`Rule` types | Rejected as **incorrect**: its collision check can't treat `null` as "could agree" (§4.4), so it would ship boards with a hidden second valid rule. |

Reused as-is from the word engine: the `MEDIUM_KNOBS` values (`generator/difficulty.ts`), `trapAllocation`, and the IN-count weight table. The weight table is copied as a constant, because `trapSelection.ts` doesn't export it and uses `Math.random`.

### 3.3 The switch: one field on the puzzle
```ts
// PuzzleDoc (lib/types.ts + netlify/functions/_shared/types.ts): additive, optional
/** Absent on every existing document. Absent means 'word', so nothing needs a backfill. */
kind?: 'word' | 'visual'
/** Visual only: the seed that reproduces this exact board (§4.6). */
generatorSeed?: number
```
- **Server:** branches only in `roundView.ts`, where names come from `visualItems` or from `words`.
- **Client:** branches only in one card component (`ItemFace`, §5.5).
- **What plays on a given day** is whichever puzzle is scheduled. Rolling back a visual day = `admin-unschedule` (already exists).
- **What gets generated and scheduled** is set by the `PUZZLE_KIND` env var (default `word`, so deploying changes nothing), plus a word/visual selector in the admin "Generate batch" panel. It has to be set in **three places**, because the ops code spans both platforms and the local scripts: Vercel (the cron), Netlify (buffer health and the admin generate default) and the local `.env` (`schedulePuzzles.ts`, `queuePuzzles.ts`).
- Ids stay in the existing `wordId` fields. For a visual puzzle they hold an item id. Renaming the field would touch three contract copies and every stored result for no gain. A comment on each type records the dual meaning.

### 3.4 Difficulty (D7)
Visual puzzles use a single knob set, today's medium values: 3 + 3 clues, 6 guests, 2 traps (1 decoy trap + 1 "fits but looks wrong" guest, or a second decoy trap when no "fits but looks wrong" guest exists; owner decision 2026-10-04), and a 2–3 live-decoy target. They're stored as `difficultyTier: 'medium'` so the existing typed fields (`PuzzleDoc`, admin types, stats) keep working without a migration. The visual paths in scheduling, buffer health and the cron ignore the tier field.

### 3.5 Rule uniqueness (D6)
A visual rule is **used** once any visual puzzle with that `ruleId` has status `approved`, `scheduled` or `live`.
- **Generation** never drafts a used rule, nor a rule already in the `pending_approval` queue. Otherwise a reviewer could approve two boards for the same rule.
- **Approval is the hard guarantee:** `admin-approve` (and `api/admin.ts`'s approve action) **refuses** a visual puzzle whose rule is already used, with 409 and a message naming the puzzle that holds it.
- **Rejected** puzzles don't use up the rule, so it can be retried with a new board. **Unscheduling** returns a puzzle to `pending_approval`, which frees its rule again (consistent with the existing unschedule behavior).
- **Rule ids are permanent.** Uniqueness is checked by `ruleId`, so renaming a rule would let its idea run twice. Rules are never renamed or deleted. A rule that's been dropped gets `retired: true` instead, which takes it out of generation while keeping its id reserved. A retired duplicate also names the rules it duplicated in `mergedInto`: it is not treated as a rival of those rules (it would otherwise block every board for them), but stays a rival of every other rule. This is enforced by convention and a comment at the top of `rules.ts`; nothing else is needed while one person edits the taxonomy.

---

## 4. Section 2 — Rules, tagging matrix, generator *(approved)*

### 4.1 Rule families (~500 authored → ~400 usable)
Every rule is a single plain property, with reveal text (e.g. "IN: it has a handle") and tagging guidance (`basis`, e.g. "a typical, intact example, as normally sold or found"):

| Family | Examples | ~Count |
|---|---|---|
| has-part | handle, wheels, blade, lid, strings, screen, legs, zip, spout, buttons | 60 |
| made-of | metal, wood, glass, fabric, rubber, ceramic, paper | 15 |
| where-found | kitchen, bathroom, garage, beach, farm, ocean, classroom | 35 |
| what-it-does | cuts, holds liquid, makes light, keeps you warm, measures, cleans | 80 |
| physical | floats, conducts electricity, melts below 100 °C, magnetic, fragile, flammable | 70 |
| how-you-use-it | needs two hands, worn on the body, pushed, plugged in, battery-powered, ridden | 60 |
| size-weight | fits in a pocket / a backpack, heavier than an adult, bigger than a car | 25 |
| senses | makes noise by itself, shiny, smells strong, cold to the touch | 35 |
| living | alive, edible, grows on trees, comes from an animal, is an animal / food / plant / vehicle | 50 |
| shape *(judged on the icon)* | has a closed loop or hole, round, long and thin, has a point | 40 |
| context | used in winter, at night, at a party, in sport | 30 |

- **The obvious group ideas are rules too** (*is an animal*, *is food*, *is a vehicle*, *is a plant*). That's deliberate: the validator has to know about the first hypothesis a player will form.
- **The physical, how-you-use-it and size-weight families** are judged on the **canonical real-world version**: typical size and material, intact, in its everyday state.
- **The shape family** is judged on the **icon as drawn**, because that's what the player sees. Redrawing an icon means re-checking its shape tags, and the normalizer lists them whenever an icon's bytes change.
- **When in doubt, tag `unsure`.** An unused item costs nothing; a debatable item in a live puzzle costs a player a life.
- **Authoring check:** two rules whose yes-sets and no-sets both overlap at ≥0.8 (Jaccard, on items both answer definitely; see `content-engine/visual/report.ts`) are the same idea twice. They get merged, or split apart with items where they disagree. The report in §4.3 enforces this, so the runway count isn't inflated by duplicates.

### 4.2 Tagging matrix: storage and semantics
```ts
// tags/<family>.ai.ts (generated) and tags/<family>.overrides.ts (human)
export const TAGS: Record<RuleId, { yes: string; no: string; unsure: string }> = {
  'floats-in-water': { yes: 'cork stick-of-butter ice-cube …', no: 'anchor brick …', unsure: 'glass-bottle' },
}
```
- **Three values:** `yes` → true, `no` → false, `unsure` → **null**. An item missing from all three is **untagged**. The generator treats it like null, but reports count it separately, so "we debated this" is never confused with "nobody looked yet".
- **Overrides win per cell.** An item in an override list is removed from every list in the AI draft for that rule. Re-running the tagger can never overwrite a human decision.
- **Ids are space-separated strings, not arrays.** ~500 rules × ~600 items is ~300k ids, and string literals keep the generated files cheap for `tsc` and for the Vercel and Netlify bundles that import the generator.

### 4.3 Tagging pipeline (D3)
- **`tagging.ts`** (pure, unit-tested) builds the prompt for one rule plus a batch of ~100 items (names and scope group), and validates the structured response (`{ id, answer: 'yes'|'no'|'unsure' }[]`). Unknown ids and unexpected answers are dropped, never trusted. Same split as `words/aiTagging.ts`.
- **`scripts/tagVisualAi.ts`** calls Gemini (`GEMINI_MODEL`, default flash-lite, as in `tagWordsAi.ts`) for **3 independent passes**. A cell is `yes`/`no` only if all three agree, otherwise it's `unsure`. Results are written to `tags/<family>.ai.ts`. The script is **resumable**: it skips rules already drafted for the current item list, so a free-tier quota limit just pauses the run. Rough volume: 500 rules × ~600 items / 100 per call × 3 passes ≈ 9,000 calls. It's offline, and nothing under `api/`, `lib/` or `src/` imports it.
- **Two layers of human review:**
  1. **`scripts/matrixReport.ts`** reports, per rule, the yes/no/unsure/untagged counts. It flags rules that are too thin to be usable (§4.5), near-duplicate pairs (§4.1), families too large to space out (§5.4), and the runway count.
  2. **Puzzle approval is the real guarantee.** The reviewer checks the hidden rule's answer on all 12 board items. Each bad tag found becomes an override line. Reviewing the whole matrix by hand isn't realistic, but reviewing the cells that actually ship is.

### 4.4 The three-valued uniqueness check (core correctness rule)
Across the 12 board items (clues + pool) and their true labels, a rival rule R ≠ T, checked in **both polarities**, **collides** unless **at least one item definitely contradicts it**: R is `true`/`false` on that item and disagrees with its label.
- **`null` counts as "could agree".** A player who sees a debatable item can read it whichever way keeps their theory alive, so an item that's null on R can't be what rules R out. This is the opposite of how the decoy scan treats null (§4.5 step 4), and that asymmetry is deliberate.
- **Both polarities**, because "OUT: things that float" is as valid a reading of a board as "IN: things that float". The word validator only checks one direction.
- An R that is untagged or null on **all 12** items therefore counts as a collision. That's conservative on purpose: we can't show the board rules it out.

### 4.5 Generator algorithm (pure, seeded)
1. **Eligible rules:** not used (§3.5), not pending, and **≥20 definite-yes and ≥20 definite-no** items (blocked items excluded). Picked seeded-random, with recently rejected rules down-weighted using the existing `rejectCounts` (`1/(1+count)`, same as `pickTrueRule`).
2. **Candidate items:** every item where T is exactly `true` or `false`. **Null and untagged items are removed here, before anything else runs**, so they can't reach the clues, the pool or a repair swap.
3. **Clues:** 3 IN + 3 OUT. The IN clues span **at least 2 scope groups** when the rule's yes-set allows it, so the board doesn't accidentally read as "they're all animals". The rival-rule check would catch that anyway, but avoiding it up front saves retries.
4. **Decoy scan:** a rival R (either polarity) is a live decoy if it's definite on every clue *and* agrees with every clue label. Re-draft the clues (bounded, keeping the attempt closest to target, as `orchestrator.ts` does) until there are 2–3 decoys. **Zero decoys means try another rule** (same hard gate as the word engine).
5. **Pool:** 6 guests, with the IN count drawn from the copied `IN_COUNT_WEIGHTS` (3:50, 4:20, 2:20, 5:5, 1:5):
   - **1 decoy trap** — the decoy says IN, T says OUT. It must be **definite on the decoy**, or it isn't really a trap.
   - **1 "fits but looks wrong" guest** — T says IN, the decoy says OUT. Also definite on the decoy. When no decoy has one (every decoy is a superset of T), a **second decoy trap** takes its place: the decoy trap is what catches the broader theory (owner decision 2026-10-04).
   - **Padding** fills the rest toward the drawn IN count.
   - Then shuffle and assign display order.
6. **Validate (§4.4).** On a collision, swap one non-trap guest for an unused item that has T's label and **definitely contradicts** the rival. Up to 5 attempts, then move to the next rule.
7. **Emit** `{ kind: 'visual', ruleId, difficultyTier: 'medium', knobValues, status: 'pending_approval', clues, guests, liveDecoys, generatorSeed }`.

### 4.6 Determinism
- The same `(seed, items, tags, rules, usedRuleIds, pendingRuleIds, rejectCounts)` always produces an identical candidate. A test asserts this.
- `generatorSeed` is stored on the puzzle, so any live board can be regenerated for audit or debugging.
- Batch seeds come from the run date plus an index, so a cron re-run on the same day reproduces the same candidates instead of piling up new ones.

### 4.7 Runway
- **Runway = unused eligible rules = days of puzzles left.** The admin buffer-health panel shows it next to the buffer, and warns below 60.
- At ~400 usable rules, that's ~13 months of daily play.
- Growing the runway means authoring more rules (more families, or more members within one). It never means repeating a rule (D6).

---

## 5. Section 3 — Icons, backend, ops, UI, rollout *(approved)*

### 5.1 Item bank (`items.ts`)
```ts
export interface Item {
  id: string                 // kebab slug, permanent; also the icon filename
  name: string               // caption: "stick of butter"
  group: 'thing' | 'food' | 'vehicle' | 'animal' | 'plant'
  icon: { set: 'openmoji'; hex: string }
      | { set: 'noun'; creator: string; url: string }   // file: icons/noun/<id>.svg
  blocked?: boolean
}
```
- **Seeding the bank:** `scripts/listOpenMojiCandidates.ts` prints every OpenMoji entry in the in-scope groups (objects, food-drink, animals-nature; the transport and sky-weather subgroups of travel-places, the latter only for things like the umbrella; and the sport/game/arts-crafts/event/award subgroups of activities). A human picks from that list and names each item.
- **Inclusion rules:**
  - globally familiar things only, so no regional dishes or brand items
  - one clear name per item (no regional variants: pick "eggplant" *or* "aubergine")
  - no two items so alike that a player can't tell them apart at card size
- **💡 Target ~600 items.** At 400 puzzles × 12 items, each item appears about every 35 days on average. Appendix A estimates roughly 440 in-scope OpenMoji objects; Noun Project fills the rest.

### 5.2 Icon pipeline (`npm run visual:icons`)
- **Source:**
  - OpenMoji's black SVGs are **vendored** from one pinned release (`17.0.0`) into `content-engine/visual/icons/openmoji/<HEX>.svg` by `npm run visual:fetch-icons`. Existing files are never re-fetched over.
  - Why not a devDependency: the `openmoji` npm package is 43 MB across 11,539 files and would be installed on every Netlify *and* Vercel build. Vendoring only the files we use is also reproducible, and it keeps a reviewable record of exactly what was normalized.
  - Noun Project gap-fill files live in `content-engine/visual/icons/noun/<id>.svg`.
  - `svgo` is the only new devDependency.
- **The input format, verified:** OpenMoji black icons are pure **stroke** line art: `fill="none"`, `stroke="#000"`, `stroke-width="2"`, `viewBox="0 0 72 72"`, with `<path>/<line>/<polyline>/<ellipse>` elements and some `transform` attributes.
- **Steps, per file.** A file that fails a check is **rejected, not patched**, and the script exits non-zero listing each file and the reason.
  1. **Optimize** with `svgo`: `preset-default` (it also removes the `id="emoji"`/`id="line"` ids, which would clash if two icons were ever inlined on one page) plus `removeDimensions`.
  2. **Recolor** with `convertColors: { currentColor: true }`. **Keep every `fill="none"`.** The brief's literal "strip fill and stroke" breaks stroke art: removing `stroke` makes it invisible (the default is none), and removing `fill="none"` turns it solid black (the default is black). Elements with no fill or stroke inherit from `fill="currentColor"` set on the root.
  3. **Stroke weight.** OpenMoji's 2/72 stroke renders at ~1 px on a 36 px card, which is too thin. A single `STROKE_SCALE` constant (💡 start at 1.5, tune on the contact sheet) multiplies `stroke-width` on every stroke-based icon. It's a calibration knob, not a guess baked into each file. Noun Project icons are usually filled outlines, so they're judged on the contact sheet instead.
  4. **Allowlist gate:**
     - Allowed elements: `svg, g, path, circle, ellipse, line, polyline, polygon, rect`.
     - Allowed attributes: geometry (`d`, `x`/`y`, `x1`…`y2`, `cx`/`cy`, `r`/`rx`/`ry`, `width`/`height`, `points`), `transform`, `viewBox`, `xmlns`, `version`, `xml:space`, `id`, `fill`, `fill-rule`, `clip-rule`, `fill-opacity`, `opacity`, `paint-order`, and the `stroke*` family. Text content (other than whitespace) and CDATA sections are rejected too.
     - Rejected outright: `on*`, `href`, `url(`, `<script>`, `<style>`, `<foreignObject>`, `<image>`, `<text>`, and any XML processing instruction other than the `<?xml …?>` declaration (e.g. `<?xml-stylesheet?>`, which svgo's preset leaves in place).
     - Why this matters even though the game renders icons as images (where scripts never run): these files are **same-origin** with the admin panel. A script in `/icons/visual/x.svg` opened directly in a tab *would* run on the origin whose `sessionStorage` holds the admin session.
  5. **Reject `<text>`.** Free Noun Project downloads can embed a "Created by … from the Noun Project" line and stretch the `viewBox` to fit it, leaving the icon off-center. Remove that line from the raw file before committing it; the attribution moves to the credits screen (§5.5).
  6. **Reject multi-colour cutouts.** Some icons fake holes by painting white shapes over black. After recoloring, the hole fills in. If there's more than one distinct non-`none` color before conversion (`#000` and `#000000` count as one), the file is rejected.
  7. **Size budget:** warn above 6 KB, reject above 20 KB.
  8. **1:1 check:** every item has exactly one output file, and there are no orphan files. Enforced by a test, not just by the script.
- **Contact sheet** (`content-engine/output/icon-sheet.html`, gitignored): every icon at the exact card / clue / tray sizes, in light and dark, with its caption. This is where recognizability and the anti-ambiguity rule actually get checked: a human scans it before items are tagged. There's no automated way to check recognizability.
- **Licensing:** OpenMoji is CC BY-SA 4.0, so our normalized derivatives of its files are CC BY-SA 4.0 too. That applies only to the icon files, not to the game's code. Noun Project free icons are CC BY 3.0, with per-icon creator credit. Every item records its source, so the credits screen is generated from `items.ts`.

### 5.3 Backend contract and server (Phase 4a)
**Wire contract** (all three copies: `lib/api.ts`, `netlify/functions/_shared/api.ts`, `src/api/types.ts`). Additive only:
```ts
export interface GetRoundResponse {
  // ...existing fields unchanged...
  /** Absent for word puzzles. Old clients ignore it and render `word`, which holds the item name. */
  kind?: 'visual'
  /** Visual only: item ids in the same order as `clues.in/out`, which carry captions. */
  clueIds?: { in: string[]; out: string[] }
}
// PoolItem unchanged: `wordId` = item id, `word` = caption. CheckSwipe* unchanged.
```
**Server changes (both copies where duplicated):**
- **`roundView.ts`:** names come from `visualItems` when `puzzle.kind === 'visual'`, otherwise from `words`. The visual clue resolver also returns ids.
- **`get-round.ts`:** adds `kind` and `clueIds` for visual puzzles only.
- **`check-swipe.ts`:** **no change**.
- **Mongo, additive only:**
  - a new `visualItems` collection (`{ _id, name }`), and `getCollections()` gains its handle
  - visual rules upserted into `rules` with ids prefixed `visual-` (no clash with word rule ids) and `family: 'visual'`
  - `npm run content:seed-visual` **upserts only**, never deletes. `seedDatabase.ts` is untouched.
- **Generation entry points, which must copy `kind` and `generatorSeed`:**
  - `api/scheduled-generate-puzzles.ts` reads `PUZZLE_KIND`
  - `netlify/functions/admin-generate-batch.ts` takes `kind` from the request body (default `PUZZLE_KIND`)
  - `content-engine/scripts/queuePuzzles.ts` gets a `--visual` flag
  - `api/admin.ts` (not live, kept in sync)
- **Approve:** the uniqueness refusal from §3.5.
- **Edit and AI review:** `admin-edit-puzzle` and `admin-ai-review` return 400 for visual puzzles (D11).
- **`adminPuzzleDetail.ts`, `puzzleStats.ts`, `archive.ts`:** resolve visual names and pass `kind` through. The admin wire types gain `kind?`.

### 5.4 Ops: scheduling, buffer, runway
- **`content-engine/scheduling/placement.ts`:**
  - Builds its id→family map from `[...RULES, ...VISUAL_RULES]` as a `Map<string, string>` (no `Mechanic` change, see §2.6).
  - A visual rule's spacing unit is its **family**: the same family can't run within 3 days.
  - Rule spacing never triggers for visual rules, because they're unique.
  - Capacity: no family may hold more than ~⅓ of usable rules, or 3-day spacing can't be satisfied. `matrixReport` checks this.
- **`content-engine/scripts/schedulePuzzles.ts`:** under `PUZZLE_KIND=visual` it fills every date from one FIFO queue of approved visual puzzles, with no Saturday special. The word path is unchanged.
- **Buffer health** (`puzzleStats.ts`, both copies, plus `BufferHealthPanel`): when the active kind is visual it reports one `visualBufferDays` and the **runway** (§4.7). Word puzzles parked by the cutover don't count, so they can't stall visual generation.
- **Cron** (`api/scheduled-generate-puzzles.ts`): under `PUZZLE_KIND=visual`, if the visual buffer is under 14 days it tops up to 28 via the visual generator. Still no Gemini calls and no auto-approve.

### 5.5 Player UI (Phase 4b — kept light, detailed later)
- **One new component, `ItemFace`**, renders text for word puzzles and icon + caption for visual ones.
  - The icon is drawn as a **CSS mask** (`mask: url(/icons/visual/<id>.svg) center / contain no-repeat`, plus the `-webkit-` prefix) over `background-color: currentColor`. It follows the theme and needs **no `dangerouslySetInnerHTML`**.
  - Fixed icon box size, so nothing shifts while icons load.
  - `role="img"` + `aria-label`.
  - The 12 icon URLs are warmed after `get-round` returns, so cards don't pop in.
- **Where it plugs in:** `SlipCard`, `ClueDeck`, `TrayBin`, `RevealScreen`. `useGame`/`game/types` gain `kind`/`clueIds`. If the card height has to grow, `PlayScreen`'s `CARD_HEIGHT` constant changes **with it**.
- **Offline:** one `vite.config.ts` runtime-cache entry for `/icons/visual/`, `StaleWhileRevalidate` so a redrawn icon does update. The service-worker precache already excludes SVGs. The `get-round`/`check-swipe` caching rules are untouched.
- **Credits screen** (a link in the Settings modal), generated from `items.ts`. It's **required by the licenses before the first visual puzzle goes live.**
- **Admin:** the review cards use `ItemFace` plus a kind badge; manual edit and AI review are hidden for visual puzzles; the Generate panel gets a word/visual selector.

### 5.6 Rollout and rollback
1. **Ship Phases 1–4 with `PUZZLE_KIND` unset.** Production behaves byte-for-byte as today: no visual puzzle exists, so no response carries `kind`.
2. **Pilot (D13):** generate visual candidates from the admin panel, review them, and play one scheduled on a test date via `?asOf=` on a preview deploy.
3. **Deploy order:** the Netlify frontend (icons, `ItemFace`, credits) must be live **before** the first visual puzzle's date. The backend change is harmless on its own. Players on a stale bundle see captions as text (§2.11).
4. **Cutover (D1):**
   - set `PUZZLE_KIND=visual` on Vercel, Netlify and the local `.env` (§3.3)
   - do the copy/branding pass (D12)
   - let the already-scheduled word puzzles run out
   - generate the first visual batch, and schedule it from the first free date onward
5. **Rollback:** unschedule the visual days (`/admin/schedule`), schedule parked word puzzles in their place, and unset `PUZZLE_KIND` in all three places. No code deploy needed. (Netlify needs a redeploy to pick up a changed env var, which is a click, not a code change.)

---

## 6. Implementation phases

Every phase is test-first (TDD): for each behavior listed under *Tests*, the test is written and watched failing before the code that makes it pass. Each phase ends with `npm test`, `npm run lint` and every affected `typecheck:*` script green, and is a natural commit point.

### Phase 1 — Scaffolding, item bank, icon pipeline
**Status:** done 2026-10-02 (STROKE_SCALE = 1.75; 165 items, 0 blocked; truck and book icons swapped to 1F69B / 1F4D6; captions torch, football, biscuit for an India-heavy audience).
**Implementation plan:** [`planning-visual-pivot-phase1.md`](planning-visual-pivot-phase1.md) (6 tasks, test-first, with the code already verified end to end against the 165-item pilot).
- **Build:** `visual/types.ts` (Item), `items.ts` (165-item pilot), `listOpenMojiCandidates.ts`, `fetchOpenMojiIcons.ts`, `normalizeIcons.ts`, `public/icons/visual/`, the contact sheet, `package.json` scripts, and the `svgo` devDependency.
- **Tests:** each rejection rule (script, `<text>`, two-colour cutout, oversize, missing `viewBox`, a disallowed attribute); `fill="none"` survives; strokes become `currentColor`; `STROKE_SCALE` is applied; the 1:1 item↔file check; item ids are unique permanent slugs; every item has a credit-capable source.
- **Exit:** the pilot icons normalize cleanly, and the contact sheet has been reviewed for recognizability.

### Phase 2 — Rules, tagging matrix, Mongo seed
**Status:** done 2026-10-03 (Atlas seeded by the owner): 66 rules (3 retired), 23 usable; ~240 override cells after review of the Gemini draft. The ≥30-usable exit was waived for the pilot by the product owner: the 165-item bank is the ceiling (several rules sit at 14–19 confident yeses), and the build-out grows it. Remaining near-duplicates on this bank: has-wheels/ridden ≈ is-a-vehicle, found-in-a-kitchen ≈ is-food, made-of-metal ≈ sticks-to-a-magnet ≈ shiny; re-check after the bank grows.
**Implementation plan:** [`planning-visual-pivot-phase2.md`](planning-visual-pivot-phase2.md) (7 tasks; a 51-rule pilot across all 11 families).
- **Build:** `rules.ts` (pilot ~40 rules across all families), `tags/` layout, `matrix.ts`, `tagging.ts`, `tagVisualAi.ts`, `matrixReport.ts`, `seedVisual.ts`, plus the additive types and `db.ts` handles in both backends.
- **Tests:**
  - **Three-valued merge:** overrides win per cell; untagged ≠ unsure in reports but both read as null.
  - **Tagging:** response validation drops unknown ids and answers; 3-pass consensus (unanimous → value, anything else → null).
  - **Matrix integrity:** no id in two lists of one rule; every id exists; rule ids are permanent (snapshot).
  - **Report:** eligibility thresholds; near-duplicate detection; family-size cap.
- **Exit:** the pilot matrix is AI-drafted and spot-reviewed; ≥30 pilot rules are eligible; `content:seed-visual` has been run against Atlas.

### Phase 3 — Generator, uniqueness, scheduling
**Implementation plan:** [`planning-visual-pivot-phase3.md`](planning-visual-pivot-phase3.md) (5 tasks).
- **Build:** `random.ts`, `generator.ts`, `generateVisualBatch.ts`, the uniqueness gate in generation, and the `placement.ts` / `schedulePuzzles.ts` visual paths.
- **Tests:**
  - **Null exclusion:** a null or untagged item on T never appears in clues, pool or repairs, across many seeds.
  - **Collision detection:** a rival that's null on one item and agrees on the rest is a collision; a rival matching the board inverted is a collision; an all-null rival is a collision.
  - **Pool shape:** traps are definite on their decoy; IN clues span ≥2 groups when possible.
  - **Rule exclusion:** used rules and pending rules are never drafted.
  - **Determinism:** same seed → deep-equal candidate; different seed → different candidate.
  - **Placement:** family spacing; every day filled from the single visual queue.
- **Exit:** **Yield ≥75%**, measured offline per eligible pilot rule (`content:generate-visual` writing to `content-engine/output/`, nothing queued): 20 board attempts per rule on the fixed seeds 1..20, and yield is the mean per-attempt success, boards / (eligible rules × 20), so every run measures the same number. **Coverage** (rules with at least one board / eligible rules) is reported alongside it. This yield number is the go/no-go signal for scaling content to ~600 items × ~500 rules. Each rule can be drafted only once per batch, so yield has to be measured per rule, not across rules.

### Phase 4 — Backend contract, ops wiring, UI (light)
**Implementation plans:** [`planning-visual-pivot-phase4.md`](planning-visual-pivot-phase4.md) (4a, 5 tasks) and [`planning-visual-pivot-phase4-ui.md`](planning-visual-pivot-phase4-ui.md) (4b/4c, 4 tasks).
- **4a (server):**
  - Build the contract fields, the `roundView` branch, `get-round` passthrough, the generation entry points, the approve-uniqueness refusal, the edit/AI-review refusal, buffer health and runway, the cron kind switch, and name lookup in admin/stats/archive.
  - Tests:
    - the `roundView` visual branch: labels stay hidden mid-round, and `poolReveal` contains every item
    - a **mapping test per generation entry point** (§2.7)
    - approve refuses a used rule, but allows one whose only previous use was rejected or unscheduled
    - buffer health ignores parked word puzzles
  - **4a status:** done 2026-10-06. The local end-to-end check against Atlas passed: word path unchanged, 409 on a held rule, 400 on AI review, visual round served and revealed, test puzzles cleaned up.
- **4b (player UI):** `ItemFace`, the four plug-in points, offline caching, credits screen. Verified by hand under `npm run dev:functions` at 360×640: play through, lose all 3 lives, resume after a reload, share, light/dark, screen-reader labels.
- **4c (admin):** icons in review cards, kind badge, generate selector, edit/AI-review hidden for visual puzzles.
  - **4b/4c status:** functionally done 2026-10-07 (commits bd84b53..51065ba). After the final review, the layout was refitted for 360 px: the icon sits over the caption on the card and in the clue grid, and the licence links are in. **The visual design is deferred.** The owner finds the icons too secondary, reading as an add-on rather than the main thing, and wants them bigger, with captions small. That's a v2 redesign, possibly with Claude Design, done last, before the cutover deploy.

### After Phase 4 — content build-out and cutover
**Runbook:** [`planning-visual-pivot-cutover.md`](planning-visual-pivot-cutover.md) (two production deploys in total).
Scale to ~600 items and ~500 rules, run the full AI tagging pass, re-run `matrixReport` until the runway reads ≥400 with no near-duplicates or oversize families, then follow §5.6.

**Order of work, agreed 2026-10-07:**

| # | Step | Where |
|---|---|---|
| 1 | **Content build-out:** items, rules, tagging, report, yield | Runbook Part A |
| 2 | **Admin and review run-through**, no deploy: generate through `/admin`, review end to end, approve, schedule on a test date, and fix reviewing friction found at scale | Runbook Part C, run early on a deploy preview or `dev:functions` |
| 3 | **v2 UI redesign:** icon-first, bigger icons | Its own brainstorm and spec |
| 4 | **Cutover:** two production deploys | Runbook Parts B and D |

Decisions for the build-out:
- **Captions stay (D2 holds) as the safety net.** Items are still picked to be recognisable from the icon alone, so the redesign can shrink captions.
- **Claude drafts each batch of about 100 items** from `npm run visual:candidates`. Each item must be familiar worldwide, with one clear name for an India-heavy audience, and have no lookalike at card size. Doubtful ones are flagged. The owner reviews the contact sheet.
- **Item ceiling.** There are 753 in-scope OpenMoji entries, 165 already used, leaving about 590. Many of them are variants or lookalikes, so a realistic usable count is about 350–450.
  - Measure this on the first batch.
  - Then either fill gaps from the Noun Project (CC BY 3.0, credited in `src/game/iconCredits.ts`), or lower the ≥400-rule runway target with the owner.
- **Clearing the old review queue.** Reject pending word puzzles rather than deleting them: `updateMany({status:'pending_approval', kind:{$ne:'visual'}}, {$set:{status:'rejected', rejectionReason:'Parked: visual pivot'}})`. To undo, filter on that reason. The live cron keeps drafting word puzzles until cutover.
- **Housekeeping still open:**
  - `generator.ts`'s docstring "one call per eligible rule" is stale.
  - Spec §6 Phase 3 Exit's last sentence is stale.
  - Phase 3 Task 5 Step 4: record the gate result here (yield 365/460 = 79%, coverage 23/23).

---

## 7. Risks and known limits

- **The validator only knows what the matrix knows.** A player may infer an idea that isn't a rule. Mitigations: the group rules (*is an animal*…) are in the taxonomy, reject reasons are tracked, and `planning.md` §9.3's feedback loop still applies. The difference now is that new ideas become new rules, which also extends the runway.
- **Runway is finite by design (D6).** ~400 usable rules is ~13 months. The admin runway warning (below 60 days) is the signal to author more rules or families.
- **Correlated physics.** Metal things tend to conduct, sink and be heavy all at once. Correlated rules collide more often and lower the yield. The Phase 3 yield gate catches this before we invest in scale.
- **Tag quality varies.** LLM drafts carry the model's biases. Three-pass unanimity plus checking every shipped hidden-rule cell bounds this. Rival-rule cells are only AI-checked, and null-as-agree is the safety margin there.
- **Coincidences in the captions.** If all IN captions happen to be one word, players may chase that. It's rare with 12 items, and the reviewer is expected to catch it. The lexical taxonomy isn't run against captions.
- **Recognizability is subjective.** Only the contact sheet and approval defend it.
- **License compliance.** The credits screen must ship before the first visual puzzle (§5.5). CC BY-SA covers our normalized OpenMoji files.
- **`planning.md` drift.** Until the pointer lines land (§1), `planning.md` still describes a word game with Spicy Saturdays.

**Out of scope:** compound rules, color-dependent properties, photos, caption localization, and per-item difficulty ratings.

---

## 8. Preservation ledger

**Deleted, overwritten, or purged: nothing.**
- No existing file is removed or renamed.
- No Mongo collection or document is deleted. Every seed step upserts.
- The word engine (`content-engine/words/`, `rules/`, `generator/`) is **not modified**. That includes `rules/types.ts`; the `Mechanic` change considered in an earlier draft was dropped (§2.6).

**New:** everything under `content-engine/visual/`, `public/icons/visual/`, `lib/` + `netlify/functions/_shared/` `visual.ts` and `names.ts` (with tests), `lib/roundView.test.ts`, `src/components/ItemFace.tsx`, `src/game/icons.ts`, `src/game/iconCredits.ts` (the credits, shown in Settings), and `src/admin/ClueList.tsx`.

**Existing files touched (additive or behind a branch; the word path keeps its current behavior):**

| Phase | File | Change |
|---|---|---|
| 1 | `package.json` | `svgo` devDependency; `visual:*` and `content:*-visual` scripts |
| 2 | `lib/types.ts`, `netlify/functions/_shared/types.ts` | `PuzzleDoc.kind?`, `generatorSeed?`; `VisualItemDoc` |
| 2 | `lib/db.ts`, `netlify/functions/_shared/db.ts` | `visualItems` collection handle |
| 3 | `content-engine/scheduling/placement.ts` | family map includes visual rules; visual family spacing |
| 3 | `content-engine/scripts/schedulePuzzles.ts` | visual single-queue path |
| 4a | `lib/api.ts`, `netlify/functions/_shared/api.ts`, `src/api/types.ts` | `kind?`, `clueIds?` |
| 4a | `lib/roundView.ts`, `netlify/functions/_shared/roundView.ts` | visual name lookup |
| 4a | `api/get-round.ts`, `netlify/functions/get-round.ts` | pass `kind` / `clueIds` through |
| 4a | `api/scheduled-generate-puzzles.ts`, `netlify/functions/admin-generate-batch.ts`, `content-engine/scripts/queuePuzzles.ts`, `api/admin.ts` | kind-aware generation; copy `kind` + `generatorSeed` |
| 4a | `netlify/functions/admin-approve.ts` (+ `api/admin.ts` approve) | refuse an already-used visual rule |
| 4a | `netlify/functions/admin-edit-puzzle.ts`, `admin-ai-review.ts` (+ `api/admin.ts`) | refuse visual puzzles |
| 4a | `lib/` + `_shared/` `adminPuzzleDetail.ts`, `puzzleStats.ts`, `adminApi.ts`, `types.ts` (`DecoyResult.negated?`); `api/archive.ts`, `netlify/functions/archive.ts`; `src/admin/types.ts`; `netlify/functions/admin-buffer-health.ts` (+ `api/admin.ts`) | visual names, `kind`, visual buffer + runway |
| 4b | `src/game/useGame.ts`, `src/game/types.ts` | `kind`, `clueIds` |
| 4b | `SlipCard.tsx`, `ClueDeck.tsx`, `TrayBin.tsx`, `RevealScreen.tsx`, `PlayScreen.tsx`, `SettingsModal.tsx` | render via `ItemFace`; credits link |
| 4b | `vite.config.ts`, `netlify.toml` | icon runtime-cache rule; CSP + `nosniff` on `/icons/visual/*` |
| 4c | `PuzzleReviewCard.tsx`, `PuzzleCardBody.tsx`, `GenerateBatchPanel.tsx`, `adminClient.ts`, `BufferHealthPanel.tsx` | icons, kind badge, selector, runway (`LivePuzzleStats.tsx` needs nothing: captions are resolved server-side) |
| after approval | `planning.md`, `build-plan.md`, `CLAUDE.md` | pointer lines; architecture note once Phase 4 lands |

Both copies of `check-swipe.ts` are deliberately absent (§2.2).

---

## Appendix A — Icon-library measurements

Measured 2026-09-30 from each library's published metadata (jsDelivr): `@tabler/icons` `icons.json`, `lucide-static` `tags.json`, `@phosphor-icons/core@2.1.1` file listing, `openmoji` `data/openmoji.json`.

| Library | License | Total icons | Hits in a 145-object everyday probe* | Rough count of real-object icons** |
|---|---|---|---|---|
| **OpenMoji** | CC BY-SA 4.0 | 4,495 (incl. skin-tone variants, flags, extras) | **~113 (78%)** | ~440 in-scope groups |
| Tabler | MIT | 5,166 | 82 (57%) | ~300 |
| Phosphor | MIT | 1,512 | 71 (49%) | ~240 |
| Lucide | ISC | 1,857 | 67 (46%) | ~230 |

\* Exact-name probe: anchor, guitar, butter, kettle, candle, sponge, … OpenMoji matches against multi-word annotations, so its figure is slightly generous. In none of the four: ice-cube (exact name; OpenMoji has 🧊 as "ice"), kettle, toaster, rake, surfboard, marble, comb, sink, match, vase, grater, rolling-pin.
\*\* Icon base names that are nouns in the project's own word bank, minus an abstract/UI stop list. This is a noisy upper bound; read it as an order of magnitude.

Lucide, Phosphor and Tabler are UI icon sets that lean toward devices and office/tech objects, and are thin on the kitchen, tool, household and nature objects that physical rules need. OpenMoji's emoji objects are the culturally recognized archetypes the anti-ambiguity rule asks for, drawn to one style guide, and the whole set needs a single attribution line. Hence D4.

Sample OpenMoji black files inspected: `2693` anchor, `1F9C8` butter, `1F3B8` guitar, `1F9CA` ice. All are stroke-only, `fill="none"`, `stroke="#000"`, `stroke-width` 2 (ice: 2.069), `viewBox="0 0 72 72"`.
