# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"The Bouncer" is a daily word puzzle game (Wordle-style): the player is shown pre-sorted example words (IN/OUT), infers the hidden rule, then sorts a fresh pool of guest words one swipe at a time with immediate feedback and a 3-life limit. Full design spec lives in `planning.md`; build sequencing/phase history lives in `build-plan.md`. Both are worth reading before large changes — `planning.md` in particular locks a lot of exact game-mechanic and data-handling decisions (🔒 markers) that should not be casually changed.

## Commands

```
npm run dev                          # Vite dev server (frontend only, no API)
npm run dev:functions                # netlify dev — frontend + Netlify Functions + local API together
npm run build                        # tsc typecheck + vite build
npm run lint                         # eslint . (whole repo), --max-warnings 0
npm run format                       # prettier --write src/**/*.{ts,tsx,css}
npm test                             # vitest run (all suites: src, content-engine, netlify/functions, lib)
npm run test:watch                   # vitest watch mode
npx vitest run path/to/file.test.ts  # run a single test file
npm run typecheck:content-engine     # tsc --noEmit against tsconfig.content-engine.json
npm run typecheck:netlify-functions  # tsc --noEmit against tsconfig.netlify-functions.json
npm run typecheck:vercel-functions   # tsc --noEmit against tsconfig.vercel-functions.json (api/ + lib/)
```

Content pipeline scripts (see Architecture below):
```
npm run content:print-rules     # dump the rule taxonomy + IN/OUT split for a sample word list
npm run content:generate        # run the generator/validator, write candidates to content-engine/output/
npm run content:seed-db         # one-time: load word bank + rule taxonomy into MongoDB
npm run content:queue-puzzles   # write generated candidates into MongoDB as pending_approval
npm run content:schedule        # assign approved puzzles to future calendar dates
```

There are four separate TypeScript projects (`tsconfig.json` for `src/`, `tsconfig.content-engine.json` for `content-engine/`, `tsconfig.netlify-functions.json` for `netlify/functions/`, `tsconfig.vercel-functions.json` for `api/` + `lib/`) — each is a standalone Node/browser target and does not import across the others' boundaries (see "Duplicated API contract" below; `api/scheduled-generate-puzzles.ts` and `api/admin.ts` importing from `content-engine/` are the one deliberate exception, not a precedent for others). `npm run build` only typechecks `src/`; run the other typecheck scripts explicitly when touching `content-engine/`, `netlify/functions/`, or `api/`/`lib/`.

Vitest is a single config (`vitest.config.ts`, `environment: 'node'`) covering all four trees (`content-engine/**/*.test.ts`, `netlify/functions/**/*.test.ts`, `lib/**/*.test.ts`, `src/**/*.test.ts`) — no separate per-project test runner.

## Architecture

Four independently-typed trees, each a different concern, glued together only by MongoDB documents and a versioned HTTP contract. Two of them are backends deployed to two different platforms — see "Two backends, one player-facing domain" below before assuming a change to one takes effect everywhere.

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

### `netlify/functions/` — the Netlify-hosted backend (Node)
- `_shared/db.ts` — MongoDB connection, cached across warm serverless invocations (`words`, `rules`, `puzzles`, `results` collections).
- `_shared/api.ts` — the wire contract types (`GetRoundResponse`, `CheckSwipeResponse`, etc.), duplicated against `src/api/types.ts` (see below) — but also now against `lib/api.ts` on the Vercel side. Three copies, not two; keep all in sync.
- `admin-*.ts` (14 files) — the approval-queue and operational-dashboard endpoints, gated by `_shared/adminAuth.ts` (a single shared access code compared with `timingSafeEqual`, no individual reviewer accounts). **Live** — the admin panel (`src/admin/`) still calls these via relative `/api/admin-*` paths, resolved same-origin through `netlify.toml`'s redirect. Not performance-sensitive, deliberately left here rather than migrated.
- `archive.ts` / `sitemap.ts` / `log-error.ts` — **live**, server-rendered pages and error-reporting the browser reaches by direct navigation or same-origin fetch, not through the player-facing API client. Left here because a direct page navigation can't be redirected cross-origin the way a `fetch()` call can (see the Vercel section below).
- `get-round.ts` / `check-swipe.ts` / `get-crack-rate.ts` / `get-puzzle-meta.ts` — **dormant, not live**. Functionally identical copies of `api/*.ts` (below), still deployed by Netlify but never called — `src/api/client.ts` calls the Vercel URL directly for these four in production. Kept as an inert fallback path, not an active one; a fix here does nothing until the frontend is pointed back at Netlify for these routes.
- ~~`scheduled-generate-puzzles.ts`~~ — removed. Superseded by `api/scheduled-generate-puzzles.ts` (Vercel cron); having both fire on the same schedule meant duplicate puzzle-generation runs. If you ever see a reference to this file in an old comment, it means the Vercel cron, not this one.
- `puzzleDate.ts` resolves "today's puzzle" from a UTC calendar date; `puzzleStats.ts` / `roundView.ts` / `adminPuzzleDetail.ts` compute reveal/stat views server-side.

### `api/` + `lib/` — the Vercel-hosted backend (the actual player-facing hot path)
`get-round.ts`, `check-swipe.ts`, `get-crack-rate.ts`, `get-puzzle-meta.ts` — the endpoints a player's device hits mid-round — are deployed on **Vercel**, pinned to the `bom1` (Mumbai) region to sit next to the MongoDB Atlas cluster (also Mumbai). This exists because routing them through Netlify's Functions region (US-based, not configurable on the free plan) made `check-swipe` take 1–2.6s for an India-based player; direct-to-Vercel brings that to ~100–500ms. **The frontend's domain does not change** — the page is still served from and lives at the `netlify.app` domain; only these four `fetch()` calls go cross-origin to Vercel in the background (`src/api/client.ts`'s `API_BASE`, empty/relative in dev so `npm run dev:functions` still exercises a local backend, the live Vercel URL only in production builds).

- `lib/cors.ts` — the cross-origin gate: allowlists the Netlify origin explicitly (never a wildcard — `check-swipe` mutates per-player state) and answers the `OPTIONS` preflight browsers send before a cross-origin JSON `POST`. Every one of the four handlers above is wrapped in `withCors(...)`; nothing else in `api/` is (same-origin callers never trigger a preflight, so it'd be a no-op there).
- `lib/` is this tree's `_shared/`-equivalent, deliberately placed *outside* `/api` (not `api/_shared/`) — Vercel's plain (non-Next.js) `/api` convention has no documented underscore-exclusion rule, and getting that wrong turns a shared module into an accidental extra route.
- `api/admin.ts`, `api/archive.ts`, `api/sitemap.ts`, `api/log-error.ts` — deployed on Vercel but **not currently live**; nothing points a browser at them (the admin panel and archive/sitemap still resolve to Netlify's copies, see above). `api/admin.ts` specifically exists as a 14-endpoint-into-1 consolidation (dispatched by an `?action=` query param, with `vercel.json` rewrites preserving what would've been the original `/api/admin-*` paths) — a leftover from an earlier plan to fully migrate, kept in case that migration resumes rather than deleted.
- `api/scheduled-generate-puzzles.ts` — **live**, the one and only puzzle-generation cron (see `vercel.json`'s `crons` entry, 06:00 UTC daily). Authenticated via the `CRON_SECRET` env var, which Vercel automatically sends as `Authorization: Bearer $CRON_SECRET` on its own cron-triggered requests — this is the only thing standing between the endpoint and a public POST triggering paid Gemini calls, since (unlike every `admin-*` handler) it has no `requireAdmin` gate.

⚠️ **Node ESM requires explicit `.js` extensions on every relative import** in `api/`, `lib/`, and — since `api/scheduled-generate-puzzles.ts` and `api/admin.ts` both reach into it — `content-engine/`. `package.json` sets `"type": "module"`, and Vercel's Node builder doesn't paper over an omitted extension the way Netlify's esbuild bundling does. An extensionless `from '../lib/db'` typechecks fine and deploys clean, then 500s at runtime with `ERR_MODULE_NOT_FOUND`. Directory-index imports need the explicit `/index.js` (e.g. `content-engine/rules/index.ts` → `'../content-engine/rules/index.js'`). `netlify/functions/` and `src/` are unaffected — Netlify's bundler and Vite both resolve extensionless imports fine — so don't blanket-apply this to the whole repo.

⚠️ **Vercel's Hobby plan caps a deployment at 12 Serverless Functions** (`errorCode: exceeded_serverless_functions_per_deployment` — not documented on Vercel's public Limits page, only discoverable via `GET /v13/deployments/{id}` on a failed deploy). `api/` currently sits at 9. Adding a new top-level file costs one function; prefer adding a case to `api/admin.ts`'s dispatcher over a new file if you're touching admin-adjacent Vercel code.

### Duplicated API contract, deliberately
`src/api/types.ts`, `netlify/functions/_shared/api.ts`, and `lib/api.ts` define matching-but-separately-maintained copies of the wire types — three now, not two. This is intentional (see the comment atop `_shared/api.ts`/`lib/api.ts`): the frontend and each backend are separate deployable/typed units with separate `tsconfig`s, so the API boundary is treated as a serialization boundary worth duplication rather than a shared-import seam. When changing a request/response shape used by the four Vercel-hosted endpoints, update all three files.

### Netlify wiring
`netlify.toml` maps `/api/*` → `/.netlify/functions/:splat` and serves the SPA for everything else — this still governs the admin panel, archive/sitemap, and error reporting. `npm run dev:functions` (netlify dev) is required to exercise real API calls locally — `npm run dev` (plain Vite) serves the frontend only, with no backend. Note that locally this still hits the *Netlify* copies of get-round/check-swipe/etc. (relative paths, same as production dev builds) — there's no local equivalent of the cross-origin Vercel call short of running `vercel dev` separately.

### Vercel wiring
`vercel.json` pins `regions: ["bom1"]`, declares the daily generation cron, and rewrites `/archive`, `/archive/*`, `/sitemap.xml`, and every `/api/admin-*` path to their `api/` equivalents — none of which are actually reachable in practice today since nothing calls this deployment's domain for those paths (see "not currently live" above); the rewrites exist so those endpoints work correctly *if* migration resumes, without further vercel.json changes.

### PWA / service worker
`vite.config.ts` configures `vite-plugin-pwa` with `registerType: 'prompt'` (never `autoUpdate`) specifically so a new deploy doesn't yank a player out of an in-progress round — `App.tsx` only turns `needRefresh` into a visible banner between rounds. `get-round` is cached `NetworkFirst` for a brief offline-friendly read; `check-swipe` is explicitly `NetworkOnly` since the 3-life count must stay server-authoritative and is never safe to answer from cache. Both `urlPattern`s match on path only (`^https?:\/\/[^/]+\/api\/...`), not a fixed host, which is why they kept working unchanged once `get-round`/`check-swipe` started resolving to a different (Vercel) origin — don't tighten these to a specific hostname.

## Conventions

- No semicolons, single quotes, 100-char print width (Prettier, `.prettierrc`) — run `npm run format` rather than hand-matching style.
- ESLint runs with `--max-warnings 0`; `content-engine/**`, `netlify/functions/**`, `api/**`, and `lib/**` are treated as Node (not browser) in `.eslintrc.cjs` overrides.
- Comments in this codebase are used sparingly and specifically to record *why* (a locked design decision, a non-obvious ordering constraint, a security-relevant boundary) — follow that pattern rather than narrating what code does.
- `planning.md`'s 🔒 markers indicate locked game-design decisions (3 lives, server-authoritative correctness, no rule-naming credit, spoiler-safe share cards, etc.) — treat these as constraints, not defaults to optimize away.

## Git workflow

- After a few steps of meaningful, working progress (a coherent chunk landed and verified — not mid-edit, not broken), proactively suggest committing rather than letting changes pile up uncommitted. Suggest it; don't just commit unprompted — this repo still follows the standard commit-only-when-the-user-asks rule.
- Commit messages should be brief (a short one-line summary; a body only if genuinely needed) and must never include a `Co-Authored-By: Claude` trailer or a `Claude-Session` link.
