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

Plan: (a) a one-time `content-engine/scripts/tagWords.ts` script that fetches category/property candidates per word from an external source (e.g. Datamuse's relation queries, or a WordNet-backed package) and writes them as *suggested* tags, not ground truth; (b) review suggested tags through the same generate-then-human-review rhythm already used for puzzles, not auto-applied blindly; (c) once enough of the bank is tagged, add `content-engine/rules/semanticRules.ts` with a first batch of rules using the same interface/subtlety-rating shape as `lexicalRules.ts`; (d) use this to directly address the "prime number of letters"-style complaint — once semantic rules exist, `difficulty.ts`'s existing knob pattern controls the lexical/semantic mix (starting at [§7.1](planning.md#71-starter-rule-taxonomy)'s own suggested ~70/30 split) and lets specific lexical rules be deprioritized if playtesting keeps flagging them as too obscure or too easy to pass by chance.

**3. Admin: un-schedule a puzzle without deleting it**

`PuzzleStatus` is `'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'live'`; `get-round.ts` serves any puzzle whose status is `scheduled` or `live` for today. Decision: only `scheduled` puzzles can be pulled — `live` (today's, already being played) is out of scope, to avoid stranding a player mid-round.

Plan: (a) `netlify/functions/admin-unschedule.ts` — same shape as `admin-approve.ts`/`admin-reject.ts` (`requireAdmin` → `updateOne({_id, status:'scheduled'}, {$set:{status:'pending_approval', date:null}})`, 409 if not matched). Goes back to `pending_approval`, not `approved` — pulling a puzzle usually means something needs a fresh look, so it re-enters the real review queue rather than silently rejoining the next auto-schedule run. (b) `netlify/functions/admin-list-scheduled.ts` — `requireAdmin`-gated GET listing `status:{$in:['scheduled','live']}` sorted by date (includes `live` in the view only, not as an actionable row). (c) shared types in `_shared/adminApi.ts` + `src/admin/types.ts` mirror. (d) frontend `src/admin/SchedulePanel.tsx` — upcoming-puzzle rows with a "Pull from schedule" action on `scheduled` rows only, wired into `AdminApp.tsx` alongside the existing stacked sections (`BufferHealthPanel`/`LivePuzzleStats`/`BatchStats`), same no-router convention.

**4. Deployment/performance discussion + real loading states**

Current stack (Netlify static hosting + Netlify Functions + MongoDB, Mongo client cached across warm invocations in `_shared/db.ts`) shows nothing that structurally requires switching platforms. The slowness noticed during development is most likely `netlify dev`'s local proxy/cold-start overhead, not representative of Netlify's production Function infra. Options to weigh at Phase 11, cheapest first: (a) cache/edge-ify `get-round` specifically (puzzle content is static all day, very cache-friendly) while keeping `check-swipe` exactly `NetworkOnly` per the server-authoritative-lives lock; (b) confirm the MongoDB Atlas region is colocated with the Netlify Functions region — often the single biggest latency lever in this kind of setup; (c) only consider switching hosting platforms (Vercel/Cloudflare/Render) if (a)/(b) don't resolve *production* latency, since that's a much bigger lift (different function runtime, redirect/SPA config rebuilt from scratch). Separately, add a lightweight skeleton for the currently plain-text loading states (`PlayScreen.tsx`'s `phase:'loading'`, `AdminApp.tsx`'s initial fetch) — small, interstitial-only, doesn't conflict with keeping the rest of the interface stable.

### Phase 11: Launch prep & deployment

- Production Netlify deploy, environment/secrets audit, domain setup, basic error monitoring.
- Final launch checklist against every 🔒 locked requirement in planning.md, to confirm nothing was dropped along the way.

---

## Open tooling decisions not yet locked

These aren't blocking — reasonable defaults are proposed inline above — but worth confirming early since they're cheap to decide now and annoying to change later:

- **TypeScript vs. plain JS** for the frontend/backend (💡 leaning TypeScript, given the amount of structured data — words, rules, puzzles — flowing through the system).
- **Testing framework** for the rule-evaluator and validator unit tests in Stage B (💡 Vitest pairs naturally with a Vite project).
- **Whether the generator/validator (Stage B) stays in the same TypeScript codebase** as the frontend/API, or becomes a separate package/language — planning.md [§8.1](planning.md#81-overview--rationale) already flags this as an open option (e.g., Python if NLP tooling favors it) but no decision is needed until Stage B actually starts.
