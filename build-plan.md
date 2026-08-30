# The Bouncer — Phased Implementation & Build Order

> **Companion to [planning.md](planning.md).** That document defines *what* we're building and *why* (design, rules engine, tech stack). This document defines *when* we build each piece and *in what order*, so we can build and review incrementally instead of trying to stand the whole thing up at once.
> **How to read this doc:** 🔒 = directly inherited from a locked decision in planning.md, not up for debate here. 💡 = a suggested default for *this* build plan specifically (sequencing, scope-per-phase, tooling choices not yet decided in planning.md) — change freely. Each phase ends with a **Review checkpoint** — a concrete thing to look at together before moving on, so we're never hurrying past a stage without actually seeing it work.

---

## Table of Contents
- [How this plan is organized](#how-this-plan-is-organized)
- [Stage A — Prove the core loop](#stage-a--prove-the-core-loop)
  - [Phase 0: Project scaffolding](#phase-0-project-scaffolding)
  - [Phase 1: Playable core loop, hardcoded puzzle](#phase-1-playable-core-loop-hardcoded-puzzle)
- [Stage B — Build the content engine](#stage-b--build-the-content-engine)
  - [Phase 2: Word bank & rule taxonomy](#phase-2-word-bank--rule-taxonomy)
  - [Phase 3: Puzzle generator & uniqueness validator](#phase-3-puzzle-generator--uniqueness-validator)
- [Stage C — Go live end-to-end](#stage-c--go-live-end-to-end)
  - [Phase 4: Backend API & MongoDB integration](#phase-4-backend-api--mongodb-integration)
  - [Phase 5: Daily puzzle delivery](#phase-5-daily-puzzle-delivery)
  - [Phase 6: Human approval admin tool](#phase-6-human-approval-admin-tool)
- [Stage D — Local history & sharing](#stage-d--local-history--sharing)
  - [Phase 7: Local play history & sharing](#phase-7-local-play-history--sharing)
- [Stage E — Operational readiness](#stage-e--operational-readiness)
  - [Phase 8: Content operations buffer](#phase-8-content-operations-buffer)
- [Stage F — Polish & launch](#stage-f--polish--launch)
  - [Phase 9: Visual polish, theming, accessibility, PWA](#phase-9-visual-polish-theming-accessibility-pwa)
  - [Phase 10: QA, playtesting, difficulty calibration](#phase-10-qa-playtesting-difficulty-calibration)
  - [Phase 10.5: Pre-launch refinement](#phase-105-pre-launch-refinement)
  - [Phase 10.6: Puzzle variety at scale & reject-feedback loop](#phase-106-puzzle-variety-at-scale--reject-feedback-loop)
  - [Phase 11: Launch prep & deployment](#phase-11-launch-prep--deployment)
- [Open tooling decisions not yet locked](#open-tooling-decisions-not-yet-locked)

---

## How this plan is organized

Six stages, each containing one or more phases. The guiding sequencing principle: **de-risk the least-proven part of the game first, cheaply, before investing in the surrounding machinery.**

The core swipe/live-feedback/3-lives loop (planning.md [§3](planning.md#3-game-loop--rules)) is a genuinely new mechanic with no reference implementation to copy — how it *feels* to play is the single biggest unknown in this whole project. So Stage A builds a throwaway-quality, hardcoded, front-end-only prototype of just that loop before anything else exists. Everything after Stage A (the content engine, the backend, sharing) is comparatively well-specified, lower-risk engineering — worth sequencing *after* we've confirmed the core loop is actually fun, not before.

Each phase lists a **Review checkpoint** — treat this as a natural pause point to actually play/inspect what's been built together before starting the next phase, rather than plan mode-ing through all twelve phases back to back.

### Where things will live

The repo root is organized to mirror the stages above, so each stage's code lands in its own top-level folder rather than getting mixed into the player-facing app:

- **`src/`** — the player-facing web app (Stage A). Exists today.
- **`content-engine/`** — Stage B's word bank, rule taxonomy, puzzle generator, and uniqueness validator (planning.md [§7](planning.md#7-rules--word-selection-engine)). This is offline/headless tooling a human runs to produce puzzles, not code that ships to players, so it lives as a sibling to `src/` rather than inside it. Doesn't exist yet — created when Phase 2 starts.
- **`netlify/functions/`** — Stage C's backend (today's-puzzle fetch, per-guest check endpoint, per planning.md [§8.4](planning.md#84-how-daily-puzzles-are-stored-and-served)), matching Netlify's own convention for serverless functions. `netlify.toml` will need a `functions = "netlify/functions"` line added at that point. Doesn't exist yet — created when Phase 4 starts.

No placeholder folders are scaffolded ahead of time for `content-engine/` or `netlify/functions/` — they get created when their phase actually begins.

---

## Stage A — Prove the core loop

### Phase 0: Project scaffolding

**Goal:** an empty-but-deployable skeleton, nothing game-specific yet.

- Initialize the repo: Vite + React (💡 with TypeScript — the rule-evaluator/data-model work in Stage B benefits a lot from typed word/rule/puzzle shapes; flag this as a default to confirm, not yet locked in planning.md).
- Install and configure Tailwind CSS, plus a minimal design-token layer (colors, radii, spacing) per planning.md [§5.1](planning.md#51-theme-direction) — placeholder values are fine here, real palette comes in Phase 9.
- Install Framer Motion (used starting Phase 1 for the card-snap interaction).
- Basic repo hygiene: linting/formatting config, a `.gitignore`, folder structure (e.g., `src/game`, `src/content`, `src/api` as placeholders for where Stage B/C work will land).
- Connect the repo to Netlify and confirm a static deploy works end to end (just the Vite default page is fine) — proves the deploy pipeline before we depend on it later.

**Review checkpoint:** a boring blank page, deployed and reachable at a Netlify URL. Nothing to play yet — this phase is purely "does the machine turn on."

### Phase 1: Playable core loop, hardcoded puzzle

**Goal:** the actual game feel, playable in a browser, with one or two hardcoded puzzles baked directly into the frontend — no backend, no database, no content pipeline yet.

This is the highest-priority phase in the whole plan: everything else assumes this loop is right. Build it, play it, and be willing to tune the *feel* (timing, animation weight, exact lives-out tone) before moving on.

- Hardcode 1–2 full puzzle objects directly in frontend code (rule description, clue set, guest pool with true labels) — good candidates: pick genuinely tricky examples from planning.md [§7.1](planning.md#71-starter-rule-taxonomy)/[§7.2](planning.md#72-ambiguity-engineering--the-core-craft) so the prototype is testing real difficulty, not a trivial rule.
- Build the evidence screen: pinned, non-interactive IN/OUT clue zones (planning.md [§3.1](planning.md#31-setup-phase--the-evidence)).
- Build the sorting screen: full guest pool visible at once, swipe/drag/tap interaction per guest, immediate correct/incorrect resolution, auto-correct animation into the opposite bin on a miss (planning.md [§3.2](planning.md#32-sorting-phase--the-pool)).
- 🔒 Implement the 3-life system exactly as specified in planning.md [§3.3](planning.md#33-lives): wrong swipe costs a life, 3rd wrong swipe ends the round immediately regardless of remaining guests. (Client-side only for now — server-authoritative enforcement isn't needed until Phase 4, but the *rule* must be right here since we're judging feel.)
- Build the reveal screen: rule text, three-state guest breakdown (correct / wrong-then-corrected / not-reached), score (planning.md [§3.5](planning.md#35-reveal-phase)).
- Implement the signature "card snaps into a bin" moment (planning.md [§5.1](planning.md#51-theme-direction)) — this is worth real iteration time here since it's the game's core tactile identity.
- Skip for this phase (deliberately deferred, not forgotten): sharing, accounts, real content generation, backend calls of any kind.

**Review checkpoint:** play both hardcoded puzzles start to finish, including deliberately losing all 3 lives on one of them, and confirm: the swipe interaction feels good, the wrong-answer auto-correct reads clearly (not confusing), the lives-out ending feels calm rather than punishing (planning.md pillar 5, [§2](planning.md#2-design-pillars--core-philosophy)), and the reveal is satisfying even on an incomplete round. Don't move to Stage B until this genuinely feels right — this is the one phase worth being slow about.

---

## Stage B — Build the content engine

Everything in this stage is offline, headless logic — no UI. It can run entirely against local test data or a temporary local JSON store before MongoDB is wired up in Stage C; there's no need to stand up the real database just to develop and test the rule/generator logic.

### Phase 2: Word bank & rule taxonomy

**Goal:** the data layer that everything in [§7](planning.md#7-rules--word-selection-engine) depends on.

- Define the `words` schema per planning.md [§7.5](planning.md#75-word-bank-requirements): spelling, length, letter features, frequency score, part of speech, tags, safety flags.
- Source an initial English word list + frequency corpus; write the script that bootstraps letter-level features programmatically (doubled-letter flag, vowel pattern, substrings, anagram signature, etc.) — this part is fully mechanical, no human curation needed.
- Implement a first slice of the rule taxonomy ([§7.1](planning.md#71-starter-rule-taxonomy)) as code: each rule = an evaluator function (word → boolean) plus metadata (name, description template, family, subtlety rating). 💡 Suggested starting scope: 8–10 lexical/structural rules first (cheapest to implement and validate with confidence, per [§7.1.2](planning.md#712-semantic--knowledge-rules)'s own weighting guidance) before touching semantic/knowledge rules, which need category/property tags that are more human-curation-heavy.
- Unit-test each rule evaluator against known words — confirm each evaluator correctly matches the taxonomy's own worked examples from [§7.1](planning.md#71-starter-rule-taxonomy).

**Review checkpoint:** run each rule evaluator against a sample word list and eyeball the IN/OUT split for a handful of rules — confirm they match intuition before building anything on top of them.

### Phase 3: Puzzle generator & uniqueness validator

**Goal:** the automated candidate-puzzle pipeline from planning.md [§7.6](planning.md#76-rule-generation-sketch-how-71771-fit-together-end-to-end), built incrementally rather than all at once — this is the most algorithmically involved piece in the project.

Suggested build order *within* this phase (each step should work and be testable before adding the next):
1. **Naive generation:** pick a rule, draft a clue set and guest pool that satisfy it, with no decoy-awareness at all. Confirm this alone produces structurally valid (if potentially unfair) puzzles.
2. **Decoy scan:** implement the "run every other rule against the clue set" check from [§7.2](planning.md#72-ambiguity-engineering--the-core-craft) — identify which other taxonomy rules also fit the drafted clues.
3. **Trap-guest selection:** use the decoy scan's output to deliberately choose guest-pool words that satisfy-T-violate-decoy and satisfy-decoy-violate-T, per [§7.2](planning.md#72-ambiguity-engineering--the-core-craft)'s ratios.
4. **Uniqueness validator:** implement the full algorithm from [§7.3](planning.md#73-uniqueness-validation) — reject or repair any candidate where a second rule perfectly matches the true IN/OUT partition across clues + pool.
5. **Difficulty knobs:** wire up the tunable parameters from [§7.4](planning.md#74-difficulty-knobs) (subtlety rating, trap count, clue set size, etc.) so medium vs. Spicy Saturday puzzles can actually be requested with different settings.
- Output candidate puzzles as local JSON/objects with `status: "pending_approval"` for now — writing them into real MongoDB comes in Phase 4.

**Review checkpoint:** generate a batch of ~20 candidates across both difficulty tiers and manually read through several of them — do the medium ones feel medium-hard, do the Spicy ones feel meaningfully harder, does the validator correctly reject a puzzle you deliberately sabotage with a colliding decoy rule?

---

## Stage C — Go live end-to-end

### Phase 4: Backend API & MongoDB integration

**Goal:** connect Phase 1's frontend loop to a real backend and database for the first time, replacing hardcoded puzzle data with a real fetched-and-checked puzzle.

- Stand up MongoDB Atlas (free/small tier per planning.md [§8.1](planning.md#81-overview--rationale)), implement the collections from [§8.2](planning.md#82-data-model-conceptual) (`words`, `rules`, `puzzles`, `results`).
- Write a one-time migration/seed script that loads Phase 2's word bank and rule taxonomy into MongoDB, and writes a handful of Phase 3-generated candidate puzzles in as `approved` (manually, bypassing the not-yet-built admin tool) so there's real data to fetch.
- Implement the Netlify Functions from [§8.4](planning.md#84-how-daily-puzzles-are-stored-and-served): fetch-today's-puzzle (labels stripped) and the per-guest check-swipe endpoint (server-authoritative lives tracking, returns `{correct, trueLabel, livesRemaining}` for just the swiped guest).
- Swap Phase 1's hardcoded puzzle object for a real fetch call, and swap the client-side lives logic for real server round trips per swipe.

**Review checkpoint:** play a puzzle that's actually being served from MongoDB through a real serverless function, confirm the network tab never leaks an unswipe guest's true label, and confirm the lives count can't be reset by refreshing the page mid-round (i.e., it's actually server-tracked, not just client state).

### Phase 5: Daily puzzle delivery

**Goal:** real date-based puzzle scheduling, not just "whichever puzzle happens to be in the database."

- Implement the seed/date resolution logic from [§8.2](planning.md#82-data-model-conceptual) (`puzzleNumber`/date → puzzle lookup).
- Implement the `puzzles.status` lifecycle (draft → pending_approval → approved → scheduled → live) and the logic that resolves "today's puzzle" only from `scheduled`/`live` documents.
- Manually schedule a short run of approved puzzles across a few consecutive dates (direct script/DB writes are fine here — the admin UI comes next phase) and confirm the app serves the correct one each day, including a rollover test (does tomorrow's puzzle become "today's" at the right cutoff, per the UTC-vs-local-time open question in planning.md [§10](planning.md#10-open-questions--future-ideas)).

**Review checkpoint:** confirm a small multi-day sequence of puzzles delivers correctly and in order, including the day-rollover behavior.

### Phase 6: Human approval admin tool

**Goal:** replace the manual DB-writes from Phases 4–5 with the real internal tool from [§8.5](planning.md#85-how-the-generatorvalidator-and-the-human-approval-admin-tool-fit-in), so the content pipeline can actually run without hand-editing the database.

- Build a protected route/section inside the same Vite app (internal-auth gated).
- List the `pending_approval` queue; show each candidate's full detail (clues, pool, true labels, rule, and the live-decoy list the validator found, per [§9.1](planning.md#91-pipeline-stages)'s reviewer checklist).
- Approve → status transition + scheduling into a future date; Reject → back to generator with a reason tag.

**Review checkpoint:** run a batch of Phase 3-generated candidates all the way through: generate → land in the queue → review and approve/reject through the actual UI → confirm approved ones become schedulable without touching the database directly.

---

## Stage D — Local history & sharing

> **Revised 2026-08-08:** planning.md cut streaks and leaderboards entirely, and demoted accounts to optional/low-priority (§6, §8.3) — sharing results for fun replaces the social loop leaderboards would have provided. This collapses what was two phases into one, much lighter phase.

### Phase 7: Local play history & sharing

- Device-local play history (planning.md [§8.3](planning.md#83-anonymous-play--optional-accounts)) — past scores/puzzles played, stored client-side, zero signup. No account system, no server-side user state, unless a real need for cross-device sync shows up later (flagged as an open scope call in [§8.3](planning.md#83-anonymous-play--optional-accounts), not built by default).
- Spoiler-safe share card per [§6.2](planning.md#62-sharing) — build the text/emoji-grid version first (three-state squares: correct/wrong-then-corrected/not-reached), image-card version later.
- The single aggregate stat per [§6.3](planning.md#63-aggregate-stats) — "% of players who cracked it" (perfect, zero-mistake run) — server-computed and shown after the player finishes their own puzzle.

**Review checkpoint:** play a few days in a row and confirm local history persists across sessions; share a real result to a chat app and confirm it renders correctly and reveals nothing about the rule; confirm the "% cracked" figure only appears after finishing today's puzzle.

---

## Stage E — Operational readiness

### Phase 8: Content operations buffer

**Goal:** turn the Stage B/C pipeline into an actual sustained operational habit, not just a one-off test run.

- Establish a real generation cadence (batch-generate on a schedule) and track buffer health per [§9.2](planning.md#92-buffer-health) (target 2–4 weeks of approved puzzles ahead at all times, per [§9.1](planning.md#91-pipeline-stages)).
- Expand the rule taxonomy and word bank tag coverage based on real reviewer feedback (the [§9.3](planning.md#93-feedback-loop-post-launch-tuning) feedback loop) — this phase never really "ends," it's the first cycle of an ongoing process. Note this loop now tracks average score and per-guest miss rate purely as internal calibration signals, separate from the single public "% cracked" stat (§6.3).

**Review checkpoint:** confirm the buffer dashboard shows a healthy multi-week runway for both medium and Spicy Saturday puzzles before considering a real launch.

---

## Stage F — Polish & launch

### Phase 9: Visual polish, theming, accessibility, PWA

- Full palette/typography/motion pass per [§5.1](planning.md#51-theme-direction) (replacing Phase 0's placeholder tokens), colorblind-safe IN/OUT color validation.
- Responsive/mobile pass across the full screen flow ([§5.2](planning.md#52-screen-by-screen-flow)).
- PWA manifest + offline caching for the current day's puzzle.

### Phase 10: QA, playtesting, difficulty calibration

- Internal playtesting against the ~4–5/6 target ([§4](planning.md#4-difficulty-model--weekly-calendar)), tune generator knobs based on real first-swipe accuracy data.
- Specifically sanity-check the 3-life cap doesn't feel punishing at the intended difficulty (per pillar 5) and rarely triggers for genuinely engaged play, per the note added to [§4](planning.md#4-difficulty-model--weekly-calendar).

### Phase 10.5: Pre-launch refinement

> **Added 2026-08-12**, after playing the real content produced in Phase 10. Four gaps surfaced from actual use that are worth addressing before Phase 11 — none of these are built yet; this section is the plan for each, to be picked up and executed as its own mini-phase.

**1. UI/UX refresh (front page + "you are the bouncer" copy)**

Two skills are installed for this (`skills-lock.json`): `.claude/skills/ui-ux-pro-max/SKILL.md` (a research/recommendation tool — run `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system` for palette/typography/motion recommendations against the detected stack) and `.claude/skills/ui-styling/SKILL.md` (a build-focused companion that assumes shadcn/ui + Tailwind — this project has no shadcn, so treat its shadcn-specific guidance as non-applicable and lean on its general Tailwind/visual guidance instead).

🔒 [§5.1](planning.md#51-theme-direction)'s "light, colorful, simple, chill, friendly" mood and its rejection of the old dark/velvet-rope aesthetic **stays locked** — the refresh explores multiple visual directions via `ui-ux-pro-max` but must land within that mood, not outside it. What *is* being knowingly revisited: the **copy/conceptual layer**. "The Bouncer" currently doesn't make the player's role clear (reads like something that bounces, not someone who judges). The fix is primarily textual — reinforce that the player *is* the bouncer, deciding what's let in vs. turned away (e.g. reveal-screen phrasing like "You bounced WALNUT" / "You let CHINA in") — not a return to literal club/velvet-rope visuals. Recommended order: (a) copy pass on `HomeScreen.tsx`/`RevealScreen.tsx` first, needs no design tool; (b) visual pass via `ui-ux-pro-max` scoped to `HomeScreen.tsx`'s hero treatment and `tailwind.config.ts` token refinement, not a `PlayScreen`/`SlipCard`/`TrayBin` interaction rebuild. Claude Design (`mcp__claude-design`) is optional and lower-leverage here since layout structure isn't changing much — worth it only if comparing several hero directions side by side before writing real code.

**2. Semantic/meaning-based puzzle rules + external dictionary sourcing**

The `Rule`/`Word` interfaces are already family-agnostic (`RuleFamily = 'lexical-structural' | 'semantic-knowledge'` in `content-engine/rules/types.ts`), and the generator pipeline (`decoyScan.ts`/`trapSelection.ts`/`validator.ts`) iterates generically over `Rule[]` — a working semantic rule needs **zero changes** to that pipeline. The real gap is data: every word's `tags: []` is empty, and no dictionary/API is wired in, exactly matching what [§7.1.2](planning.md#712-semantic--knowledge-rules)/[§7.5](planning.md#75-word-bank-requirements) already anticipated ("bootstrap category/property tags from an existing lexical database... then let human approval flag/backfill... rather than hand-tagging upfront").

**Data sources (decided 2026-08-13, after checking current availability):**
- [Datamuse API](https://www.datamuse.com/api/) — free, no key, 100k requests/day through Jan 2027. `rel_trg` (triggers/co-occurrence) and `ml` (means-like) relations for **property** rules (e.g. "things that are cold," "kitchen items"). Called directly via native `fetch` — no new dependency.
- A WordNet package (candidate: `natural`, which bundles WordNet lookup and is pure JS — safer than packages needing native builds, especially on Windows) — runs offline, no rate limits. Its hypernym/synset structure fits **category-membership** rules (e.g. "is a fruit," "is a tool"). `content-engine`-only devDependency, never shipped to players.

**Step-by-step execution plan** — work through in order, one step (or small group) at a time; don't jump ahead. Status tracked with checkboxes below so this survives across sessions:

- [x] **Step 1 — Prove the data sources work.** Done 2026-08-13. Datamuse's `ml`/`rel_trg` gave clean property associations. WordNet (via `natural`) returned real synonyms/glosses/hypernyms. **Correction found:** Datamuse's `rel_spc` ("kinds of X") is *not* usable for category-membership — it blends in unrelated figurative senses for broad/polysemous words (e.g. "fruit" → consequence, product, aftermath; "tool" → agency, implement). Category rules use WordNet's own hypernym pointers instead, filtered to noun senses (WordNet's sense ordering isn't reliable either — "screwdriver"'s first listed sense was the cocktail, not the tool, reinforcing why Step 4's human review stays a real step and not a rubber stamp).
- [x] **Step 2 — Build the reusable wrapper.** Done 2026-08-13. `content-engine/words/dictionarySources.ts` — `fetchDatamuseRelations(word, relation)` and `fetchWordnetHypernyms(word)` (noun-sense-only, resolves hypernym pointers to actual words, carries the source sense's gloss along for reviewer context in Step 4). Both fail soft (catch + `console.warn`, return `[]`) so one bad word can't kill a batch run. Covered by `dictionarySources.test.ts` (mocks `fetch` and `natural`, no live network calls in tests). Typecheck, full test suite (141/141), lint, and prettier all clean.
- [x] **Step 3 — Batch-tag the word bank.** Done 2026-08-23. `content-engine/words/tagSuggestion.ts` (testable core: `suggestCategoryTag`/`suggestPropertyTag`) + `content-engine/scripts/tagWords.ts` (thin CLI wrapper, `npm run content:tag-words`) — mirrors the `generator/batch.ts` vs `scripts/generateBatch.ts` split so the matching logic is unit-tested and the script isn't. Tested against the real word bank (205 words, not 246 — that was a line-count approximation from before). Output: `content-engine/output/suggestedTags.{json,md}`.
  - **Course-correction found mid-step:** the first real run returned only 9 matches total, including 0 for `category:animal` despite the bank clearly having otter/eagle/rabbit/dolphin/etc. Root cause: a single WordNet hyponym level only reaches intermediate abstractions ("vertebrate") for broad categories, not common instances ("dog") several levels further down. Added `fetchWordnetHyponymsDeep` (depth-capped recursive BFS, cycle-protected, tested) and switched `suggestCategoryTag` to use it — re-run produced 38 matches with real signal (dog/cat/kitten/puppy/oyster → animal; eagle/penguin → bird; apple/orange → fruit; mosque/castle/palace/library → building; brain/face → body-part).
  - **Known remaining noise**, left for Step 4 rather than chased further: a few WordNet-obscure-sense false positives (`gang`/`cat` under tool/vehicle, `queen` under animal via the "queen bee" sense) and botanically-technically-correct-but-unintuitive matches (`coffee`/`acorn` under fruit). This is exactly the judgment call Step 4 exists for.
  - **Known perf issue, not fixed:** the deep hyponym walk is slow (multiple minutes) for very broad category roots like "animal", since WordNet's hyponym tree fans out combinatorially going *down*. It completes, so not a blocker, but the correct fix if this gets re-run often is to flip direction — walk *up* from each of the ~205 words (bounded, cheap) and check which target categories appear in each word's own ancestor chain, rather than expanding *down* from the category root. Flagged for later, not done, since Step 3's output was already usable without it.
- [x] **Step 4 — Human review.** Done 2026-08-23. A generated file plus a plain conversational walkthrough was enough at this volume — no dedicated review UI needed. Reviewed all 38 suggested matches (7 category tags, 3 property tags with matches, 3 with none) tag by tag. Kept 17: `category:animal` (kitten, puppy, dog), `category:bird` (eagle, penguin), `category:building` (mosque, castle, palace, library), `category:fruit` (apple, orange), `category:tool` (square, stamp, float), `category:vehicle` (rocket), `category:body-part` (brain, face). Dropped everything else — the documented `gang`/`cat`/`queen`/`coffee`/`acorn` false positives, plus newly-found ones from the review itself: **all 3 property-tag matches** (sixteen/proud/dinner — all loose Datamuse `rel_trg` idiom associations, not real properties, e.g. "sweet sixteen" not sixteen-is-sweet), `opera`/`engine` (component/borderline building & vehicle senses), the rest of the noisy body-part list (`pump`/`quick`/`middle`/`area`/`pocket`/`brush`/`float`-as-body-part), and — found by applying the same "is this the dominant real-world sense?" test the review settled on — **`temple`** (matched both building and body-part, but its clearest, most specific sense is a place of worship/landmark, not either broad bucket; dropped rather than forced into a vague fit — candidate for a future, more specific tag) and **`bridge`** (matched body-part via the nose-bridge sense, but its dominant sense is the structure, same reasoning as temple). One loose end worth a look whenever semantic rules get written: `float` is tagged `category:tool` but its seed `partOfSpeech` is `'verb'`, not `'noun'` — the tag is right (a "float" tool exists), just flagging the mismatch in case rule-writing logic ever assumes tags and partOfSpeech agree. Plumbing added to apply the result: `SeedWord.tags?: string[]` (`content-engine/words/types.ts`), the `w()` helper in `seedWords.ts` takes an optional 4th `tags` arg, and `buildWordBank()` now does `tags: seed.tags ?? []` instead of a hardcoded `[]`. Verified: typecheck clean, full test suite 130/130, and a scratch script confirmed the built word bank's tagged words match the reviewed set exactly.
- [x] **Step 5 — Write the first semantic rules.** Done 2026-08-24. Category-membership only, not "mixing category and property" as originally scoped — zero property tags survived Step 4 review (all were idiom false positives), so property rules have no usable data yet and are deferred, not attempted here.
  - **Blocker found before writing any rule code:** the 17 words that survived Step 4 review weren't enough to actually generate a puzzle. Medium-tier knobs need `clueCountIn: 3` matching words just to draft a clue set, plus spare words for a non-degenerate `poolSize: 6` guest pool. 4 of the 7 categories (bird/fruit/body-part/vehicle) had only 1-2 matching words — below the clue-draft floor, so those rules could never fire at all — and the other 3 (building/animal/tool) had 0-1 words spare, which would force an almost-all-OUT guest pool (a giveaway puzzle, not a real sort). Raised with the user; decision was to expand the word bank before writing rules, not ship dead/degenerate rules.
  - **Word bank expanded 205 → 233 words.** 6 words already in the bank were correctly-but-unautomatically-taggable animal/tool words the depth-capped WordNet walk missed (`otter`/`dolphin`/`hamster`/`giraffe` → animal, `needle`/`ladder` → tool) — tagged for free. 28 new hand-picked words added across the 7 categories, each checked for an unambiguous dominant sense (same "is this really the word's primary reading?" test the review used to drop `temple`/`bridge` — e.g. skipped "cinema" for `category:building` since, like the already-dropped `opera`, its dominant sense is the art form, not the building). Every category now has 7-8 matching words: animal 7, bird 7, building 8, fruit 7, tool 8, vehicle 7, body-part 7.
  - **`content-engine/rules/semanticRules.ts`** — 7 rules (`category-animal`, `category-fruit`, `category-vehicle`, `category-building`, `category-bird`, `category-tool`, `category-body-part`), same `Rule` shape as `lexicalRules.ts`, `evaluate: (word) => word.tags.includes('category:x')`. Subtlety rated 2 (animal/fruit/vehicle/building) or 3 (bird/tool/body-part — categories with more visually/conceptually varied members, a beat slower to spot the shared theme) — deliberately kept inside medium tier's `[2,3]` eligible window rather than lexical's full `[1,5]` spread, since a subtlety-1 or -4/5 rating here would put a rule outside *both* tiers' eligible-rule filter and make it dead code, the same problem as the word-count one, just via a different knob. Not yet wired into `RULES` (Step 6) — tested standalone against `SEMANTIC_RULES` directly.
  - **`content-engine/rules/semanticRules.test.ts`** — per-rule IN/OUT table (mirrors `lexicalRules.test.ts`'s `describe.each` pattern) plus two regression guards written specifically to catch the two problems found above if they ever regress: every rule's subtlety falls in `[2,3]`, and every category still has ≥6 matching words in the live word bank (not just at write-time). 60/60 passing.
  - Verified: `typecheck:content-engine` clean, full suite 211/211, lint clean, prettier clean.
  - **Known loose end, not addressed:** `float` is tagged `category:tool` but its seed `partOfSpeech` is `'verb'` (flagged during Step 4, still unresolved) — doesn't block anything since `evaluate` only reads `.tags`, but worth a look if any future rule-writing logic assumes tags and partOfSpeech agree.
- [x] **Step 6 — Wire in.** Done 2026-08-24. `RULES = [...LEXICAL_RULES, ...SEMANTIC_RULES]` in `content-engine/rules/index.ts` — taxonomy is now 17 rules (10 lexical + 7 semantic). Updated `lexicalRules.test.ts`'s whole-taxonomy "registry sanity" test (10 → 17; it checks `RULES` from `index.ts`, not just `LEXICAL_RULES`, so it now also guards against cross-family id collisions between the lexical and semantic files). Verified: typecheck clean, full suite 211/211, lint/prettier clean.
- [x] **Step 7 — Difficulty mix.** Done 2026-08-24. Added `KnobValues.semanticRuleWeight` (`content-engine/generator/types.ts`) — probability of drafting a semantic-family true rule over a lexical one when both are eligible for the tier. Set to `0.3` for both `MEDIUM_KNOBS` and `SPICY_KNOBS` (`difficulty.ts`), matching §7.1's suggested ~70/30 launch mix. Only a knob for the *split*, not per-rule weighting — the build-plan line's "lever for deprioritizing specific lexical rules" is a future use of this same mechanism, not built now.
  - **Wiring:** extracted the family-aware rule-selection logic out of `orchestrator.ts`'s inline closure into its own tested module, `content-engine/generator/ruleSelection.ts` (`eligibleRulesByFamily`, `pickTrueRule`) — mirrors the codebase's existing testable-core-vs-thin-wrapper pattern (e.g. `tagSuggestion.ts`, `lookup.ts`) rather than leaving weighted-selection logic only indirectly exercised by `orchestrator.test.ts`'s randomized runs. `pickTrueRule` rolls the weight fresh per attempt (so a string of failed draft attempts doesn't get stuck retrying one family), falls back to whichever family is actually eligible if the roll picks an empty one, and falls back to the full taxonomy — ignoring subtlety — only if neither family has anything in range (same last-resort behavior the plain subtlety filter had before this knob existed).
  - **Currently a no-op for spicy**, by design, not a bug: spicy's `[4,5]` subtlety window has zero eligible semantic rules today (all 7 are rated 2-3, see Step 5) — noted in a code comment on `difficulty.ts` so it isn't mistaken for dead code later; it activates automatically whenever a semantic rule is ever rated 4+.
  - **`content-engine/generator/ruleSelection.test.ts`** (new) — deterministic coverage of `pickTrueRule` using weight `0`/`1` boundaries (`Math.random()` is always in `[0,1)`, so these are deterministic without mocking): always-semantic at weight 1, always-lexical at weight 0, falls back correctly when one family is empty regardless of weight, falls back to the full rule set when neither family is eligible. Also added a `semanticRuleWeight` default-value check to `difficulty.test.ts`.
  - Verified: typecheck clean, full suite 219/219 (211 + 8 new), lint/prettier clean. `orchestrator.test.ts`'s existing randomized medium/spicy runs also passed unchanged, confirming semantic rules can genuinely produce valid, decoy-scanned, guest-pooled candidates end to end through the real generator pipeline — not just in isolation.
- [x] **Step 8 — Validate.** Done 2026-08-24. `npm run content:generate -- 40` produced 40/40 candidates (no shortfall warning), mixed across both tiers via `generateBatchCore`'s tier-cycling. Full `content-engine/generator` suite (validator + decoy-scan among it) still 34/34 against the expanded 17-rule taxonomy; full repo suite 219/219.
  - **5 of the 40 candidates used a semantic rule** (body-part, vehicle, tool, fruit ×2) — roughly matches the ~15% expected from 50% medium-tier share × 30% semantic weight. All 5 spicy-tier candidates in the batch were lexical, as expected (no semantic rule is rated 4-5 yet, see Step 5/7).
  - **Eyeballed all 5 semantic candidates by hand** — every clue and pool word checked against real-world category membership: all correct, no misclassifications, no duplicate words within a puzzle. One (`Is a Tool`, #13) had a live lexical decoy ("Third Letter is a Vowel") and built genuinely correct traps around it — `ocean` as a decoy-trap (not a tool, satisfies the decoy) and `hammer` as a t-but-looks-wrong trap (is a tool, violates the decoy) — confirming the cross-family trap-selection mechanism works, not just same-family.
  - **4 of the 5 had no live decoys**, i.e. no traps, just a clean sort. Checked whether that's semantic-specific: 26 of all 40 candidates (65%, lexical + semantic combined) had no live decoys, so this is a pre-existing generator/taxonomy-size characteristic, not something Step 5-7 introduced — not addressed, out of scope for this step.
  - `content-engine/output/candidates.{json,md}` are git-ignored dev artifacts (per `.gitignore`), left on disk as the normal `content:generate` workflow output, not committed.

**3. Admin: un-schedule a puzzle without deleting it**

`PuzzleStatus` is `'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'live'`; `get-round.ts` serves any puzzle whose status is `scheduled` or `live` for today. Decision: only `scheduled` puzzles can be pulled — `live` (today's, already being played) is out of scope, to avoid stranding a player mid-round.

Plan: (a) `netlify/functions/admin-unschedule.ts` — same shape as `admin-approve.ts`/`admin-reject.ts` (`requireAdmin` → `updateOne({_id, status:'scheduled'}, {$set:{status:'pending_approval', date:null}})`, 409 if not matched). Goes back to `pending_approval`, not `approved` — pulling a puzzle usually means something needs a fresh look, so it re-enters the real review queue rather than silently rejoining the next auto-schedule run. (b) `netlify/functions/admin-list-scheduled.ts` — `requireAdmin`-gated GET listing `status:{$in:['scheduled','live']}` sorted by date (includes `live` in the view only, not as an actionable row). (c) shared types in `_shared/adminApi.ts` + `src/admin/types.ts` mirror. (d) frontend `src/admin/SchedulePanel.tsx` — upcoming-puzzle rows with a "Pull from schedule" action on `scheduled` rows only, wired into `AdminApp.tsx` alongside the existing stacked sections (`BufferHealthPanel`/`LivePuzzleStats`/`BatchStats`), same no-router convention.

**4. Deployment/performance discussion + real loading states**

Current stack (Netlify static hosting + Netlify Functions + MongoDB, Mongo client cached across warm invocations in `_shared/db.ts`) shows nothing that structurally requires switching platforms. The slowness noticed during development is most likely `netlify dev`'s local proxy/cold-start overhead, not representative of Netlify's production Function infra. Options to weigh at Phase 11, cheapest first: (a) cache/edge-ify `get-round` specifically (puzzle content is static all day, very cache-friendly) while keeping `check-swipe` exactly `NetworkOnly` per the server-authoritative-lives lock; (b) confirm the MongoDB Atlas region is colocated with the Netlify Functions region — often the single biggest latency lever in this kind of setup; (c) only consider switching hosting platforms (Vercel/Cloudflare/Render) if (a)/(b) don't resolve *production* latency, since that's a much bigger lift (different function runtime, redirect/SPA config rebuilt from scratch). Separately, add a lightweight skeleton for the currently plain-text loading states (`PlayScreen.tsx`'s `phase:'loading'`, `AdminApp.tsx`'s initial fetch) — small, interstitial-only, doesn't conflict with keeping the rest of the interface stable.

### Phase 10.6: Puzzle variety at scale & reject-feedback loop

> Added 2026-08-24, from a brainstorm session — motivated by wanting enough distinct-feeling puzzles to run at least a month without repeats (eventually longer, Connections-style), plus a better answer than "just discard" for what a human reviewer's rejection reason should actually *do*. Nothing in this phase is built yet — this is the plan from the brainstorm, to be picked up as its own mini-phase, same as 10.5's items were.

**1. Rule taxonomy breadth & parameterization**

Today's taxonomy is 17 rules (10 lexical + 7 semantic, per §2 above), and every one of them is a single fixed instance of what's often a parameterizable pattern — `contains-q` is hardcoded to the letter Q, `subsequence-ace` is hardcoded to A-C-E, even though `words/features.ts` already computes hits against *multiple* targets (`hiddenWordHits: string[]`, `subsequenceHits: string[]`) that aren't fully exploited by the rule layer yet. That's real, already-built headroom, not something to build from scratch.

Three levers, decided to pursue the first two in parallel rather than picking one:
- **Parameterize what exists** (cheapest): turn single-instance rules into families across a curated target list, the same pattern §2's semantic rules already use (each category/property term is its own rule off one evaluator shape).
- **New rule families**: genuinely new rule *kinds* not yet built — anagram/rearrangement, palindrome/symmetry, alphabetical-order-run. `LetterFeatures.firstBeforeLastAlpha` and `.anagramSignature` are already computed and sitting unused.
- **Grow the semantic term list further** — the natural continuation of §2's tagging pipeline, more categories once the process has run a few more times; properties are on hold until the idiom-noise problem (§2 Step 4's finding — Datamuse `rel_trg` matches like "sweet sixteen" aren't real properties) has an answer, not before.

Plan:
- [x] Parameterize `contains-letter` across a curated set of interesting letters. Done 2026-08-24. The word bank had also grown further in the meantime (233 → 417, via other work) — checked real coverage first rather than guessing a letter list: `q, v, f, w, y, k, g, b` all clear a 15-match floor and became `contains-${letter}` rules via a small factory (`CONTAINS_LETTER_TARGETS.map(containsLetterRule)` in `content-engine/rules/lexicalRules.ts`, replacing the old single hardcoded `contains-q`). `j` (2 matches), `x` (8), `z` (6) don't clear the floor yet — skipped, not silently shipped as degenerate rules; unlocked later only by growing the word bank further, not more code.
  - **Correction to this plan's original wording:** `HIDDEN_WORD_TARGETS` in `fixedLists.ts` turned out to already hold 5 targets (`one, two, six, ten, nine`), not one — but `SUBSEQUENCE_TARGETS` genuinely only has `ace`, nothing spare to wire up. Checked real coverage for all 5 hidden-word targets: `one` (21 matches) and `ten` (17) clear the floor and became standalone rules (`hidden-one`, `hidden-ten`, alongside the existing unchanged `hidden-number`, which still matches any of the 5 — deliberately left as-is and not renamed, since the overlap between a broad and a narrow version of the same concept is fine and arguably adds variety, not a collision risk). `two` (4), `six` (3), `nine` (4) don't clear the floor — left bundled inside `hidden-number` rather than split out.
  - Taxonomy is now 26 rules (19 lexical + 7 semantic, up from 17). Added a coverage-floor regression guard to `lexicalRules.test.ts` (mirrors semanticRules.test.ts's pattern) so a shrinking word bank fails loudly instead of silently degrading a rule.
  - Verified: typecheck clean, full suite 283/283, lint/prettier clean, and `npm run content:generate -- 30` produced 30/30 with no shortfall warning. Hand-checked one generated `Hidden "One"` puzzle in detail — clues and pool all correctly labeled, and the pool's decoy traps (`nine` as a `Hidden Number`-decoy trap, `oyster` as an `Exactly Two Vowels`-decoy trap) confirm the new rules participate correctly in cross-rule ambiguity engineering, not just in isolation.
  - **Not done, left for a follow-up pass:** subsequence-target expansion (beyond `ace`) needs genuinely new target curation with coverage-checking, not just wiring — closer in effort to "new rule family" than "parameterize existing," so it's deferred rather than bundled into this step.
- [x] Design and implement a first batch of new lexical rule families (anagram, palindrome/symmetry, alphabetical-order-run). Done 2026-08-30. Checked real word-bank coverage before writing any rule, same discipline as the letter/hidden-word parameterization: palindrome 23 matches, alphabetical-order-run 120, anagram-partner 451 words across 218 groups — all comfortably clear the 15-match floor.
  - **Palindrome** — new `LetterFeatures.isPalindrome` (spelling reversed equals itself), computed in `features.ts` alongside the rest. Subtlety 3.
  - **Letters in Alphabetical Order** (the "alphabetical-order-run" family) — reuses the already-computed-but-previously-unused `anagramSignature` field directly: a word's letters are already in order exactly when sorting them changes nothing, i.e. `spelling === anagramSignature`. No new feature needed. Subtlety 4.
  - **Has an Anagram** — the one genuinely new mechanism: unlike every other feature, whether a word has an anagram partner can't be determined from its own spelling alone, it needs the whole bank. Added a small post-process pass in `buildWordBank()` (`content-engine/words/wordBank.ts`) that groups all words by `anagramSignature` after building them and tags any word in a group of 2+ with `lexical:has-anagram` — reuses the existing `tags: string[]` field rather than widening the `Word`/`LetterFeatures` shape for a bank-wide-only fact. Subtlety 5 (hardest to spot — the property isn't visible by inspecting the word alone, the way palindrome/alphabetical-order are).
  - Taxonomy is now 29 rules (22 lexical + 7 semantic, up from 26). Added a `new lexical family coverage floor` regression guard to `lexicalRules.test.ts` (same >=15 pattern as the other coverage guards) plus per-rule IN/OUT rows.
  - Verified: typecheck clean, full suite 306/306 (283 + 23 new), lint clean. `npm run content:generate -- 30` produced 30/30 with no shortfall warning. Hand-checked all three new rule types in the real output — `waste`/`sweat`, `least`/`steal`, `dare`/`dear` confirmed as genuine anagram pairs (not just signature-matching coincidences); a Palindrome puzzle correctly produced a "Same Start/End Letter" live decoy, which is the expected relationship (every palindrome is trivially same-start-end too), not a bug.
- [ ] Continue growing the semantic category term list (reuse §2's `tagWords.ts` → human review → `semanticRules.ts` rhythm as-is); revisit properties only once idiom-noise has a real fix.
- [ ] Add a scheduling cooldown: track recently-used rule IDs (and families) and exclude/deprioritize them for N days when a batch is scheduled — this matters independent of taxonomy size, since bad spacing can make even real variety feel repetitive.

**1a. Word bank expansion — the real bottleneck underneath all of the above**

This surfaced while brainstorming a new hybrid rule type (a lexical *mechanism* — hidden substring — searching for a semantically curated *target list*, e.g. an animal name hidden inside another word). Testing it against the then-417-word bank found almost nothing: 0 real hits for 5 of 7 categories, only 2 for body-part (`handle`→hand, `surface`→face). The user supplied real counter-examples the tooling should have found — `legacy`, `handle`, `heading`, `heard`, `ladyfinger` — and correctly diagnosed why it didn't: those words simply weren't *in* the bank. **Correction worth keeping in mind going forward: hidden-word discovery isn't an AI/comprehension problem at all — it's pure substring search, already built, and runs free the moment a word exists in the bank.** AI only earns its place on the *meaning* side (category tagging), which already has a working, free pipeline (§2's Datamuse+WordNet). The user explicitly chose to skip LLM-assisted tagging for now (extra setup/burden) and instead fix the actual bottleneck: word bank size.

Source evaluation (2026-08-29), tested against the user's exact example words rather than trusted from a package description:
- ❌ `wordlist-js` — described as "word-game safe," but even its largest ("All") tier had only 2,556 words and was missing basics like `spoon`/`fork`/`handle`. Rejected, uninstalled.
- ✅ **`subtlex-word-frequencies`** — 74,286 words with real usage counts (SUBTLEXus, an American English subtitle corpus). Found 8 of the user's 9 example words with sensible frequency counts. Adopted.

Plan, executed 2026-08-29–30, target 5,000 total words:
- [x] `content-engine/scripts/expandWordBank.ts` (`npm run content:expand-word-bank`) — loads `subtlex-word-frequencies`, filters to alphabetic-only, length 3–12, not already in `SEED_WORDS`, not profane (`bad-words`, new devDependency), takes the top `5000 - SEED_WORDS.length` by usage count, tags each with a part of speech, writes `content-engine/words/bulkSeedWords.ts` (auto-generated, `BULK_SEED_WORDS: SeedWord[]`, explicitly marked do-not-hand-edit).
- [x] **Part-of-speech tagging** via a new `fetchWordnetPartOfSpeech(word)` in `dictionarySources.ts` — majority vote across a word's WordNet senses (not just the first, per §2 Step 1's sense-order finding), falls back to `'other'`. Reuses the same WordNet plumbing already built for category tagging rather than wiring up `natural`'s separate Brill POS tagger, which needs sentence context to be useful and would have been a second tagging subsystem for no real benefit.
- [x] **Bug found on the first real run, fixed before shipping it:** the top of the frequency-ranked list was dominated by grammatical stopwords (`you`, `the`, `that`, `and`, `what`...) — useless as puzzle content. POS-tagging them as `'other'` after the fact wasn't enough; fixed by excluding them from *selection* up front, using `natural`'s bundled English stopword list (`natural/lib/natural/util/stopwords.js` — not part of its public export map, so it needed one small ambient `.d.ts` declaration, but no new dependency). Re-ran; verified the fix by re-inspecting the output.
- [x] `content-engine/words/wordBank.ts` now concatenates `SEED_WORDS` (hand-curated, carries Phase 10.5 §2's human-reviewed category tags) with `BULK_SEED_WORDS` (corpus-sourced, no tags yet) — kept as two files, not merged into one, specifically so the hand-reviewed tags can never be accidentally clobbered by re-running the bulk-generation script.
- [x] Verified: typecheck clean, full suite 283/283, lint/prettier clean. `npm run content:generate -- 20` produced 20/20 in 3.5s — no performance regression from a word bank ~12x larger. Hand-checked several generated puzzles (`Is an Animal`, `Hidden "Ten"`) — correct labels, working decoy traps, ambiguity engineering unaffected by the larger pool.
- **Proper names/casual contractions in the word bank** (`scott`, `brian`, `hank`, `don`, `gotta`, etc. — subtitle-corpus artifacts, not caught by any mechanical filter): **decided 2026-08-30, no fix needed.** They're fine to keep — proper nouns can validly be OUT words, or even IN words when a rule genuinely fits them (e.g. `brian` legitimately satisfies "has-anagram" — it anagrams to `brain`). The human reviewer is the backstop for anything that reads oddly at review time, same as any other borderline word; not worth mechanical filtering.
- [x] **Re-tagged the full 5,000-word bank.** Done 2026-08-30. `npm run content:tag-words` re-run against the expanded bank produced 379 raw suggestions (up from 38) — far too many to review one-by-one in conversation like Step 4 did, so this pass applied the same "is this the word's clearest, most common sense" discipline directly rather than narrating every individual call, and presented the curated result for a final look rather than 379 sequential judgment calls. `body-part` was the noisiest (111 raw → 46 kept); `property:round` came back with zero usable matches (every hit was "a round of boxing," not "round-shaped") — the idiom-noise problem from Step 4 isn't specific to the smaller bank. `property:kitchen` was the one clean surprise: 11 of 13 solid.
  - New file `content-engine/words/tagOverrides.ts` (`TAG_OVERRIDES: Record<string, string[]>`) holds the reviewed result — kept separate from `bulkSeedWords.ts` (machine-generated, no tags of its own) specifically so re-running the expansion script can never clobber reviewed tags. `wordBank.ts` unions a word's own tags with any override via `Set`, so re-applying an already-present tag is harmless.
  - Result, counted directly from the built word bank rather than estimated: `category:animal` 33, `bird` 22, `building` 36, `fruit` 20, `tool` 27, `vehicle` 33, `body-part` 47 (the biggest single jump — was the noisiest raw suggestion list too), plus the first property tag, `property:kitchen` (11 words). Existing `semanticRules.ts` evaluators (`word.tags.includes('category:x')`) needed **zero changes** — same tag strings, so richer word lists flow through automatically.
  - Verified: typecheck clean, full suite 283/283, lint/prettier clean. `npm run content:generate -- 30` produced 30/30 in ~2.8s — 10 of 30 candidates (33%, up from ~15% before the bigger bank) used a semantic rule. Hand-checked an `Is a Body Part` candidate: `arm/face/mouth/foot/liver/chest/chin` all correctly IN, `agents/proper/marshall/ash/anything` correctly OUT — the previously-flagged proper-name issue (`marshall`) recurred but didn't cause a mislabel, just an aesthetic wrinkle already on record.
- [x] **Hidden-category-word discovery, revisited at scale.** Done 2026-08-30. Re-ran the earlier discovery approach (Context §1a above) against the now-5,000-word bank instead of the original 417 — hit counts went from 0-2 per category to real, usable numbers once a trivial-inflection filter was added (`content-engine/scripts/discoverHiddenCategoryWords.ts`, `npm run content:discover-hidden-category-words`, output at `content-engine/output/hiddenCategoryWords.md`). Without that filter, results were dominated by plain plurals (`dogs`←dog, `cars`←car) — not a real "hidden" coincidence, just grammar; filtering out `target + {s, es, ed, ing, er, y, ly, less, ful}` cut the noise a lot while keeping genuine unrelated-word coincidences (`car`→`carpet`/`career`, `crow`→`crowd`/`crown`). Confirmed the user's own example: `legacy` now shows up as a `category:body-part` hit (`leg` at the start) exactly as predicted, alongside others like `million`/`billion`→`lion`, `struck`→`truck`, `pearl`/`appear`→`pear`. Deliberately left as a read-only discovery tool, not wired into any rule or tag yet, and not test-covered — this stayed lower-priority per the user's own framing ("wouldn't worry about this too much"), so effort matched that: real enough to prove the idea works at scale, not polished into a full pipeline. Next decision, whenever revisited: pick one position (start or end, not both) per category deliberately and turn a few of the cleanest hits into an actual rule — per the earlier design conversation, position shouldn't be mechanically multiplied per category.

**2. Reject-feedback loop — taxonomy signal, not per-puzzle repair**

The brainstorm's key finding: most rejections are about the whole rule/concept being weak, not a single bad word. That means neither a structured "flag this word" UI nor an LLM "fix this puzzle" step targets the actual problem — both operate at the wrong layer, and an LLM asked to rescue a bad *concept* from vague feedback is being asked to invent a new rule, not edit one, with no reliable way to verify it actually got better short of another full review pass.

Decision: **no puzzle-level repair loop for whole-concept rejects.** A reject reason becomes a signal that feeds back into the *taxonomy* (which rule templates keep failing), not an instruction to patch that one instance — this is the concrete version of the feedback loop [§9.3](planning.md#93-feedback-loop-post-launch-tuning) already gestured at.

Plan:
- [x] Extend the existing reject-reason tag (§9.1's reviewer checklist) into a per-rule-ID counter (times rejected, with reason) that persists past a single puzzle's lifecycle rather than being logged and forgotten. Done 2026-08-30. `netlify/functions/_shared/rejectStats.ts::resolveRejectCounts()` — derived by aggregating the existing `puzzles` collection directly (`$match: {status:'rejected', createdAt: {$gte: cutoff}}`, `$group` by `ruleId`) rather than a new collection or counter field, since every rejected `PuzzleDoc` already carries both. 30-day lookback window, so old rejects age out rather than permanently penalizing a rule.
- [x] Next-batch soft-avoidance: a whole-concept reject deprioritizes that same rule ID in the very next generation batch, rather than waiting for a human to notice a pattern by eye. Done 2026-08-30. New `pickTrueRule(pool, rejectCounts)` in `content-engine/generator/ruleSelection.ts` — reuses the already-existing `pickWeighted` helper (`random.ts`) rather than writing a new weighted-pick from scratch, with inverse-count weighting (`1/(1+count)`, so each recent reject roughly halves a rule's share without zeroing it out — a heavily-rejected rule can still be drawn if the batch has nothing else fresh to offer). Threaded through `generateCandidate`/`generateBatchCore` as an optional `rejectCounts: Map<string, number>` param (defaults to empty, fully backward-compatible), wired into all three real generation call sites: `admin-generate-batch.ts`, `scheduled-generate-puzzles.ts` (the nightly cron), and `content-engine/scripts/queuePuzzles.ts` (the manual CLI).
- [x] Threshold-based flagging: once a rule's reject count crosses some threshold, surface it for a human to review the *template* — retire it, narrow its difficulty range, or rework it. Done 2026-08-30. `resolveRuleRejectStats()` (same file) joins the counts with rule names and flags `rejectCount >= REJECT_FLAG_THRESHOLD` (3, within the same 30-day window). New admin endpoint `admin-rule-reject-stats.ts` + `src/admin/RuleRejectStatsPanel.tsx` (renders nothing when there's no recent reject activity, rather than an empty table) wired into `AdminApp.tsx` alongside the existing buffer-health panel.
- [x] Keep the cheap word-level repair path for the minority case where a rejection genuinely is about one specific word — reuses the existing validator repair mechanism ([§7.3](planning.md#73-uniqueness-validation)), just human-triggered instead of collision-triggered. Auto-re-queues straight to `pending_approval`, no extra confirm step (decided in the brainstorm — same trust level as any other candidate). Done 2026-08-30. New pure, tested module `content-engine/generator/repairWord.ts` (house convention: testable core + thin wrapper) — swaps one flagged word for a same-rule/same-label replacement from the word bank, then re-runs the existing `validateAndRepair` to confirm the whole puzzle is still uniquely valid; falls back to a normal reject if no replacement keeps it valid. `netlify/functions/admin-repair-word.ts` is the thin Mongo/HTTP wrapper. Reviewer-facing: `PuzzleReviewCard.tsx` gained a "which word is the problem?" dropdown (default "whole puzzle / rule concept" = a normal reject) populated from the puzzle's own clues/pool; picking a specific word and submitting calls the repair path instead. **Known simplification, flagged in code (`ponytail:` comment) rather than silently accepted:** a replaced trap guest loses its trap role (`isTrap`/`trapType` reset) instead of searching for a replacement that preserves it — `PuzzleGuestDoc` doesn't persist which rule made a guest a decoy (the same documented gap `puzzleStats.ts` already notes for live-play miss attribution), so reconstructing that role here isn't cheap. Upgrade path noted in the code: thread the originating decoy rule id onto `PuzzleGuestDoc` at generation time.
- [ ] Optional/stretch, not core: LLM-based summarization of reject-reason patterns across many puzzles for a human to read ("category rules get rejected 3x more than lexical ones") — pattern-spotting over text, not generative puzzle editing. Only worth building once there's enough reject history to summarize. Not built — deliberately deferred, matches its own "optional/stretch" framing.

**Verification (2026-08-30):** typecheck clean across all three trees (`content-engine`, `netlify-functions`, and `src` via `npx tsc --noEmit`), full suite 317/317 (added `ruleSelection.test.ts` coverage for `pickTrueRule` — a single-item pool ignores reject counts, a heavily-rejected rule is deprioritized but not eliminated over 300 draws with a generous margin against flakiness — plus a new `repairWord.test.ts` covering a guest swap, a clue swap, trap-role reset, and both "no valid replacement" and "badWordId not in this puzzle" cases), lint clean, a real `content:generate -- 20` batch still produces 20/20 candidates, and a full production `npm run build` succeeds with the new admin components. Also spot-checked the new Mongo aggregation against the real database directly (read-only) — `resolveRejectCounts`/`resolveRuleRejectStats` run without error and correctly return empty results, since the reject-feedback loop is brand new and no puzzle has been rejected yet. **Not verified:** a live click-through of the new admin panel/word-repair dropdown — the local admin screen is credential-gated and entering the access code through browser automation is a prohibited action regardless of source, so this needs a manual check by whoever reviews it next.

### Phase 11: Launch prep & deployment

- Production Netlify deploy, environment/secrets audit, domain setup, basic error monitoring.
- Final launch checklist against every 🔒 locked requirement in planning.md, to confirm nothing was dropped along the way.

---

## Open tooling decisions not yet locked

These aren't blocking — reasonable defaults are proposed inline above — but worth confirming early since they're cheap to decide now and annoying to change later:

- **TypeScript vs. plain JS** for the frontend/backend (💡 leaning TypeScript, given the amount of structured data — words, rules, puzzles — flowing through the system).
- **Testing framework** for the rule-evaluator and validator unit tests in Stage B (💡 Vitest pairs naturally with a Vite project).
- **Whether the generator/validator (Stage B) stays in the same TypeScript codebase** as the frontend/API, or becomes a separate package/language — planning.md [§8.1](planning.md#81-overview--rationale) already flags this as an open option (e.g., Python if NLP tooling favors it) but no decision is needed until Stage B actually starts.
