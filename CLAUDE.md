# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"The Bouncer" is a daily word puzzle game (Wordle-style): the player is shown pre-sorted example words (IN/OUT), infers the hidden rule, then sorts a fresh pool of guest words one swipe at a time with immediate feedback and a 3-life limit. Full design spec lives in `planning.md`; build sequencing/phase history lives in `build-plan.md`. Both are worth reading before large changes — `planning.md` in particular locks a lot of exact game-mechanic and data-handling decisions (🔒 markers) that should not be casually changed.

## Commands

```
npm run dev                          # Vite dev server (frontend only, no API)
npm run dev:functions                # netlify dev — frontend + Netlify Functions + local API together
npm run build                        # tsc typecheck + vite build
npm run lint                         # eslint src, --max-warnings 0
npm run format                       # prettier --write src/**/*.{ts,tsx,css}
npm test                             # vitest run (all suites: src, content-engine, netlify/functions)
npm run test:watch                   # vitest watch mode
npx vitest run path/to/file.test.ts  # run a single test file
npm run typecheck:content-engine     # tsc --noEmit against tsconfig.content-engine.json
npm run typecheck:netlify-functions  # tsc --noEmit against tsconfig.netlify-functions.json
```

Content pipeline scripts (see Architecture below):
```
npm run content:print-rules     # dump the rule taxonomy + IN/OUT split for a sample word list
npm run content:generate        # run the generator/validator, write candidates to content-engine/output/
npm run content:seed-db         # one-time: load word bank + rule taxonomy into MongoDB
npm run content:queue-puzzles   # write generated candidates into MongoDB as pending_approval
npm run content:schedule        # assign approved puzzles to future calendar dates
```

There are three separate TypeScript projects (`tsconfig.json` for `src/`, `tsconfig.content-engine.json` for `content-engine/`, `tsconfig.netlify-functions.json` for `netlify/functions/`) — each is a standalone Node/browser target and does not import across the others' boundaries (see "Duplicated API contract" below). `npm run build` only typechecks `src/`; run the other two typecheck scripts explicitly when touching `content-engine/` or `netlify/functions/`.

Vitest is a single config (`vitest.config.ts`, `environment: 'node'`) covering all three trees (`content-engine/**/*.test.ts`, `netlify/functions/**/*.test.ts`, `src/**/*.test.ts`) — no separate per-project test runner.

## Architecture

Three independently-typed trees, each a different concern, glued together only by MongoDB documents and a versioned HTTP contract:

### `src/` — player-facing app (Vite + React SPA, deployed as the Netlify static build)
- `src/game/useGame.ts` is the core state machine: fetches the round (`getRound`), tracks card state through `loading → play → done`, and sends one `checkSwipe` call per swipe. Lives, correctness, and the true label of each guest are **server-authoritative** — this hook only renders what the server returns, it never computes correct/wrong locally.
- `src/api/client.ts` / `src/api/types.ts` — thin fetch wrapper and the frontend's copy of the wire types.
- `src/admin/` — a separate protected screen (same SPA, gated by `AdminApp.tsx` + an `x-admin-token` header) for the human puzzle-approval workflow and operational dashboards (buffer health, batch/puzzle stats). Not part of the player-facing flow.
- `src/game/resultStorage.ts` / `playHistory.ts` — device-local persistence only (localStorage), no account system exists.

### `content-engine/` — offline batch tooling, not shipped to players
Implements planning.md §7 end to end. Run via the `content:*` npm scripts (tsx), never imported by `src/` or `netlify/functions/`.
- `words/` — the word bank: schema (`types.ts`), programmatically-derived letter features (`features.ts`), and the seed word list.
- `rules/` — the rule taxonomy: each rule is an evaluator function (word → boolean) plus metadata (subtlety rating, description template). Only the lexical/structural family (`lexicalRules.ts`) is implemented; semantic/knowledge rules are a deferred phase (see `rules/index.ts`).
- `generator/orchestrator.ts` is the pipeline entry point: pick a rule → draft a clue set → `decoyScan.ts` finds which *other* taxonomy rules also fit the drafted clues (the "live decoys" that create ambiguity) → `trapSelection.ts` deliberately picks guest-pool words that satisfy-decoy-violate-true-rule (and vice versa) → `validator.ts` runs full uniqueness validation across clues + pool against the *entire* taxonomy, repairing or rejecting collisions. `difficulty.ts` resolves the tunable knobs (subtlety range, trap count, clue-set size) per difficulty tier (medium vs. Spicy Saturday).
- Output candidates are `status: 'pending_approval'` documents, written to `content-engine/output/` or MongoDB depending on which script is run.

### `netlify/functions/` — the backend (Netlify Functions, Node)
- `_shared/db.ts` — MongoDB connection, cached across warm serverless invocations (`words`, `rules`, `puzzles`, `results` collections).
- `_shared/api.ts` — the wire contract types (`GetRoundResponse`, `CheckSwipeResponse`, etc.) for the two player-facing endpoints.
- `get-round.ts` / `check-swipe.ts` — the player-facing API. **The single most security-sensitive boundary in the codebase**: an unresolved guest's `trueLabel` must never be sent to the client before that guest is actually swiped (see the field-level comments in `_shared/api.ts` and `PuzzleDoc.guests[].trueLabel` handling) — lives are decremented and correctness is decided server-side per swipe, never trusted from the client.
- `admin-*.ts` — the approval-queue and operational-dashboard endpoints, gated by `_shared/adminAuth.ts` (a single shared access code compared with `timingSafeEqual`, no individual reviewer accounts).
- `scheduled-generate-puzzles.ts` — the scheduled/cron entry point that keeps the puzzle buffer topped up.
- `puzzleDate.ts` resolves "today's puzzle" from a UTC calendar date; `puzzleStats.ts` / `roundView.ts` / `adminPuzzleDetail.ts` compute reveal/stat views server-side.

### Duplicated API contract, deliberately
`src/api/types.ts` and `netlify/functions/_shared/api.ts` define matching-but-separately-maintained copies of the wire types. This is intentional (see the comment atop `_shared/api.ts`): the frontend and the functions are separate deployable/typed units with separate `tsconfig`s, so the API boundary is treated as a serialization boundary worth a little duplication rather than a shared-import seam. When changing a request/response shape, update both files.

### Netlify wiring
`netlify.toml` maps `/api/*` → `/.netlify/functions/:splat` and serves the SPA for everything else. `npm run dev:functions` (netlify dev) is required to exercise real API calls locally — `npm run dev` (plain Vite) serves the frontend only, with no backend.

### PWA / service worker
`vite.config.ts` configures `vite-plugin-pwa` with `registerType: 'prompt'` (never `autoUpdate`) specifically so a new deploy doesn't yank a player out of an in-progress round — `App.tsx` only turns `needRefresh` into a visible banner between rounds. `get-round` is cached `NetworkFirst` for a brief offline-friendly read; `check-swipe` is explicitly `NetworkOnly` since the 3-life count must stay server-authoritative and is never safe to answer from cache.

## Conventions

- No semicolons, single quotes, 100-char print width (Prettier, `.prettierrc`) — run `npm run format` rather than hand-matching style.
- ESLint runs with `--max-warnings 0`; `content-engine/**` and `netlify/functions/**` are treated as Node (not browser) in `.eslintrc.cjs` overrides.
- Comments in this codebase are used sparingly and specifically to record *why* (a locked design decision, a non-obvious ordering constraint, a security-relevant boundary) — follow that pattern rather than narrating what code does.
- `planning.md`'s 🔒 markers indicate locked game-design decisions (3 lives, server-authoritative correctness, no rule-naming credit, spoiler-safe share cards, etc.) — treat these as constraints, not defaults to optimize away.

## Git workflow

- After a few steps of meaningful, working progress (a coherent chunk landed and verified — not mid-edit, not broken), proactively suggest committing rather than letting changes pile up uncommitted. Suggest it; don't just commit unprompted — this repo still follows the standard commit-only-when-the-user-asks rule.
- Commit messages should be brief (a short one-line summary; a body only if genuinely needed) and must never include a `Co-Authored-By: Claude` trailer or a `Claude-Session` link.
