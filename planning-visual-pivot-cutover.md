# Visual Pivot — Content Build-out and Cutover Runbook

> **For agentic workers:** this is an operations runbook, not a code plan. Most steps are content work, human review, and settings changes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the pilot (165 items, 51 rules) to a 400-day runway, merge the pivot to `main`, run the production pilot, then switch daily puzzles from words to things, with a no-deploy rollback.

**Spec:** [`planning-visual-pivot.md`](planning-visual-pivot.md) §5.6 (rollout and rollback), D1 (full cutover), D12 (copy pass), D13 (pilot), D14 (runway 400). It comes after Phases 1–4: [phase 1](planning-visual-pivot-phase1.md), [2](planning-visual-pivot-phase2.md), [3](planning-visual-pivot-phase3.md), [4a](planning-visual-pivot-phase4.md), [4b/4c](planning-visual-pivot-phase4-ui.md).

## Constraints

- **Netlify bills 15 credits per production deploy.** Branch pushes and deploy previews are free. This runbook needs exactly **two** production deploys:
  1. The squash-merge of the pivot (Part B).
  2. The cutover, which ships the copy pass and picks up `PUZZLE_KIND` (Part D).

  A Netlify environment-variable change only takes effect on the next deploy, so set it *before* the deploy that needs it, never as a deploy of its own.
- **Nothing skips the human.** Every visual puzzle is approved by a reviewer before it is scheduled (spec §1).
- **Never rename or delete an item or rule id.** Retire a rule (`retired: true`), and block an item (`blocked: true`).

---

## Part A — Content build-out (on the pivot branch, offline)

Do this in batches of about 100 items or 100 rules, re-running the checks after each. Commit each batch; push freely, since pushes cost nothing.

- [ ] **A1. Items, 165 → ~600** (spec §5.1)
  1. Run `npm run visual:candidates` and pick from `content-engine/output/openmoji-candidates.tsv`:
     - globally familiar things only
     - one clear name each (an India-heavy audience: pick "torch" or "flashlight" and stay consistent)
     - no lookalikes at card size
  2. Add each item to `content-engine/visual/items.ts`. For a gap OpenMoji can't fill:
     - download the free Noun Project icon to `content-engine/visual/icons/noun/<id>.svg`
     - delete its embedded "Created by …" text and fix the `viewBox`
     - add the item as `{ set: 'noun', creator, url }`
     - add the matching line to `src/game/iconCredits.ts` (`content-engine/visual/credits.test.ts` fails until you do)
  3. Run `npm run visual:fetch-icons && npm run visual:icons`, then review the contact sheet (Phase 1 Task 6's checklist). Fix captions; block icons that fail.
- [ ] **A2. Rules, 51 → ~500** (spec §4.1)
  - Add atomic rules family by family to `content-engine/visual/rules.ts`. Each rule needs a reveal sentence and, only where the family's guidance isn't enough, a `basis`.
  - Aim for each new rule to clear ≥20 yes and ≥20 no on the bank as it stands.
- [ ] **A3. Tag** (spec §4.3)
  - Run `npm run visual:tag`. About 9,000 calls at full size, resumable. On a quota stop, run it again later.
  - Then review overrides as in Phase 2 Task 7 Step 4: every rule's yes-list against the contact sheet, and every shape rule.
- [ ] **A4. Report until it is clean.** Run `npm run visual:report` and repeat A2–A3 until:
  - usable rules **≥ 400** (the runway)
  - near-duplicates: **none** (retire or split each pair)
  - families over ⅓ of usable rules: **none**
- [ ] **A5. Re-check the yield.** Run `npm run content:generate-visual`, expecting ≥75%. Read 20 boards from `content-engine/output/visual-candidates.md`.
- [ ] **A6. Full checks.** `npm test && npm run lint && npm run typecheck:content-engine && npm run typecheck:netlify-functions && npm run typecheck:vercel-functions && npm run build`.

## Part B — Merge the pivot (production deploy 1 of 2)

Wait until the Netlify credits reset (around 2026-10-08), and until Phases 1–4 are done and Part A is in.

- [ ] **B1.** Confirm `PUZZLE_KIND` is **unset** on Vercel and Netlify, so production behaves exactly as today (spec §5.6 step 1).
- [ ] **B2.** Mark PR #1 ready, retitle it "Visual pivot", and **squash-merge** it. That's one commit on `main`, one Netlify deploy and one Vercel deploy.
- [ ] **B3.** Check the live site:
  - today's word puzzle plays
  - `/admin` buffer health shows the same numbers as before
  - `https://<site>/icons/visual/anchor.svg` loads, with the `Content-Security-Policy` header from `netlify.toml`
- [ ] **B4.** Run `npm run content:seed-visual` against Atlas, in case it wasn't run after Part A's final batch.

## Part C — Production pilot (D13, no deploy)

- [ ] **C1.** In `/admin`, use **Generate batch → Visual**. The request carries `kind`, so `PUZZLE_KIND` isn't needed. Review the candidates: approve the good ones and reject the rest with a reason.
- [ ] **C2.** Run `PUZZLE_KIND=visual npm run content:schedule -- 1 2030-01-01` locally (it writes to Atlas). Then, on any deploy preview (free), open `/?asOf=2030-01-01` and play it through: the Phase 4 UI hand-check list.
- [ ] **C3.** Unschedule the 2030 puzzle in `/admin/schedule`. It goes back to pending, which frees its rule.

## Part D — Cutover (production deploy 2 of 2)

- [ ] **D1. Copy pass (D12).** On a new branch from `main`, rewrite the word-game wording. Each of these says "word puzzle", "words" or "word":
  - `index.html`: `<title>`; the `description`, `og:title`, `twitter:title` meta tags; the JSON-LD `genre` and `description`; the `<noscript>` text (lines ~20–140)
  - `vite.config.ts`: the manifest `description` ("The Bouncer — daily word puzzle")
  - `src/components/HomeScreen.tsx`: "6 words. 1 rule."
  - `src/components/HowToPlayModal.tsx`: "which words are IN", "Swipe a word"
  - `src/components/LoadingDoor.tsx`: the demo words `TUXEDO / VELVET / SNEAKER` and "Six words · one rule"

  Bouncer and door copy is welcome (see the theming memory). The wording is the owner's call; open the PR and check it on its free deploy preview.
- [ ] **D2.** Find the last scheduled word date: `/admin/schedule`, or Atlas `puzzles.find({ status: 'scheduled', kind: { $ne: 'visual' } }).sort({ date: -1 }).limit(1)`. Visual days start the day after.
- [ ] **D3.** Generate and approve enough visual puzzles to cover at least 28 days from that date (C1, repeated). Then run `PUZZLE_KIND=visual npm run content:schedule -- 28 <first free date>`.
- [ ] **D4.** Set `PUZZLE_KIND=visual` in all three places:
  - Vercel project settings, which apply on the next Vercel deploy
  - Netlify site settings, which apply on the next Netlify deploy
  - the local `.env`
- [ ] **D5.** Squash-merge the copy-pass PR. That one deploy ships the new copy *and* picks up `PUZZLE_KIND` on both platforms.

  The frontend (icons, `ItemFace`, credits) has been live since Part B, which spec §5.6 step 3 requires before the first visual date.
- [ ] **D6.** Watch the first visual morning:
  - the cron's log line at 06:00 UTC
  - the buffer-health tiles ("Visual buffer", "Rule runway")
  - a real round on a phone

  Word puzzles that were approved but never scheduled stay parked in the database (D1).

## Rollback (no code deploy)

1. In `/admin/schedule`, unschedule the upcoming visual days, and schedule parked word puzzles in their place: `npm run content:schedule` with `PUZZLE_KIND` unset.
2. Unset `PUZZLE_KIND` on Vercel, Netlify and in `.env`. Netlify picks that up on its next deploy (a redeploy click: 15 credits). Until then only the admin defaults and buffer view lag. Serving is unaffected, because what plays is whatever is scheduled.

## After cutover

- [ ] Add the pointer lines the spec promised:
  - `planning.md` §1/§4/§7: "superseded for content by `planning-visual-pivot.md`"
  - a phase entry in `build-plan.md`
  - an architecture note in `CLAUDE.md` covering the `kind` switch, `content-engine/visual/`, `resolveNames`, and that `PUZZLE_KIND` lives in three places
- [ ] Runway below 60 (the amber tile) means it's time to write and tag the next batch of rules (spec §4.7).
