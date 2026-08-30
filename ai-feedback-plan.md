# AI-Assisted Reject Review — Plan

> **Companion to [planning.md](planning.md) and [build-plan.md](build-plan.md).** This document plans one subsystem: what happens when a human reviewer rejects a pending puzzle. It supersedes part of `build-plan.md` Phase 10.6 item 2's original design (the word-picker dropdown in `PuzzleReviewCard.tsx`) based on real usage feedback — see [§0](#0-why-this-supersedes-part-of-phase-106-item-2) below. Everything else Phase 10.6 item 2 already built (the reject counter, soft-avoidance, threshold-flagging panel) is **reused, not replaced** — this plan builds on top of it.
>
> **How to read this doc:** 🔒 = decided directly by the user for this feature (confirmed 2026-08-30, via explicit questions asked before writing this plan) — not up for casual re-litigation. 💡 = a suggested default I'm proposing — change freely. Like `build-plan.md`, this is a living plan: check off steps as they're built, correct course inline when reality disagrees with the plan (see `build-plan.md`'s own history of course-corrections for the expected pattern).

---

## Table of contents

- [0. Why this supersedes part of Phase 10.6 item 2](#0-why-this-supersedes-part-of-phase-106-item-2)
- [1. What the reviewer actually gets](#1-what-the-reviewer-actually-gets)
- [2. Locked decisions](#2-locked-decisions)
- [3. High-level flow](#3-high-level-flow)
- [4. Which AI, and why](#4-which-ai-and-why)
- [5. "Training" — what it actually means here](#5-training--what-it-actually-means-here)
- [6. The bounded action set](#6-the-bounded-action-set)
- [7. Backend design](#7-backend-design)
- [8. Frontend UI/UX](#8-frontend-uiux)
- [9. Safety, guardrails, and failure modes](#9-safety-guardrails-and-failure-modes)
- [10. Testing strategy](#10-testing-strategy)
- [11. Build order](#11-build-order)
- [12. Open risks and things to watch](#12-open-risks-and-things-to-watch)

---

## 0. Why this supersedes part of Phase 10.6 item 2

`build-plan.md` Phase 10.6 item 2 shipped a word-picker dropdown in `PuzzleReviewCard.tsx`: the reviewer could flag one specific clue/pool word as the problem, and the system would swap it for a replacement and re-validate. Real usage surfaced the actual problem: **it's almost never one word.** It's the rule/concept itself — too easy to guess by elimination, the traps don't work, the difficulty is off, the whole idea is stale. A word-swap tool doesn't touch any of that.

This plan replaces *how the reviewer expresses what's wrong* (free-text reasoning instead of picking a word from a dropdown) and *what happens in response* (an AI reads the reasoning and takes a bounded, appropriate action — not just "log the reason and move on"). It keeps the word-swap mechanism (`content-engine/generator/repairWord.ts`) as one of the actions available, since it's still correct for the rare case where a single word genuinely is the issue — the AI just decides when that's true instead of asking the reviewer to pre-diagnose it via a dropdown.

It also keeps everything else Phase 10.6 item 2 built:
- `netlify/functions/_shared/rejectStats.ts` (`resolveRejectCounts`, `resolveRuleRejectStats`) — still the source of the reject-count-per-rule-id signal.
- The soft-avoidance weighting in `content-engine/generator/ruleSelection.ts::pickTrueRule` — still runs on every batch.
- `src/admin/RuleRejectStatsPanel.tsx` — still shows which rules are chronically rejected. This plan adds a manual "retire" control to it (§8).

This is a deliberate reversal of an earlier decision in this same project's history (documented in `build-plan.md`'s reject-feedback-loop rationale): "no puzzle-level repair loop for whole-concept rejects... an LLM asked to rescue a bad concept from vague feedback is being asked to invent a new rule, not edit one, with no reliable way to verify it actually got better." That objection is answered here by **never trusting the AI's output directly** — every action it takes still runs through the existing deterministic `validateAndRepair` pipeline before anything is shown to a human again (§9), and the result always re-enters `pending_approval` for a second human look, never auto-schedules. The AI proposes; the validator and the human still gate everything that matters.

---

## 1. What the reviewer actually gets

Today: type a reason, click Reject, puzzle dies, reason sits unused in `rejectionReason`.

After this plan: type a reason (or nothing — see §6's `agree-reject` fallback), click one button, and one of five things happens automatically, chosen by the AI reading the puzzle's actual content plus the reviewer's words:
- A single bad word gets swapped and the puzzle comes right back for a second look.
- The whole clue/pool draft gets thrown out and redrawn from scratch for the same rule, and comes back for a second look.
- The rule's difficulty gets recalibrated (live, no deploy) so future puzzles from it land differently — this instance is rejected, since it was built under the old calibration.
- The rule gets retired outright (live, no deploy) — this instance is rejected, and the rule stops being drafted at all.
- The AI agrees it's just bad with no fix worth attempting — normal reject, same as today.

Plus a direct "Retire this rule" button that skips AI entirely, for when the reviewer already knows (§8).

---

## 2. Locked decisions

Confirmed with the user before writing this plan (2026-08-30):

- 🔒 **Provider**: prefer a genuinely free tier if one is capable of the task; otherwise prioritize getting the feature working well over saving money. See §4 for the actual pick.
- 🔒 **"Training" = prompt engineering only.** No fine-tuning pipeline, no labeled dataset collection infrastructure. See §5.
- 🔒 **Autonomy**: the AI reads the reviewer's reasoning and independently decides + executes what it judges the appropriate remediation to be (not limited to word swaps). Whatever it produces always re-enters `pending_approval` — it never auto-approves or auto-schedules.
- 🔒 **Rule retirement is a live toggle**, not a code change: new fields on the existing `rules` Mongo collection that the generator reads at runtime, so a rule can be turned off (or have its difficulty recalibrated) without a deploy.

---

## 3. High-level flow

```
Reviewer types reasoning, clicks "Reject" on PuzzleReviewCard
                    │
                    ▼
        POST /api/admin-ai-review
        { puzzleId, reason }
                    │
                    ▼
   Look up the pending PuzzleDoc + its RuleDoc (incl. any live override)
                    │
                    ▼
   Build a prompt: rule taxonomy context, this puzzle's actual clues/
   pool/liveDecoys, the reviewer's free-text reason, a few-shot library
   of past (reason → action → human outcome) triples pulled from the
   aiReviews collection (§5) — then call the model, forcing a
   structured JSON response constrained to the bounded action schema (§6)
                    │
                    ▼
        Validate the response shape defensively
     (never trust a raw LLM response as-is — §9)
                    │
        ┌───────────┼────────────┬─────────────┬──────────────┐
        ▼           ▼            ▼             ▼              ▼
   swap-word   redraft-puzzle  adjust-       retire-rule   agree-reject
   (reuse         (reuse        difficulty   (disable the   (normal
   repairWord.ts) generateCandidate         rule live in    reject,
                  with a singleton           Mongo, no       same as
                  rules=[effectiveRule]      deploy)         today)
                  array — see §7.3)
        │           │            │             │              │
        ▼           ▼            ▼             ▼              ▼
   Puzzle stays  Puzzle stays  This instance  This instance  This instance
   pending_      pending_      → rejected;    → rejected;    → rejected
   approval,     approval,     future batches future batches
   word swapped  freshly       see the new    never draft
                 redrafted     subtlety       this rule again
                    │
                    ▼
   Log the whole exchange to aiReviews (§7.2) — puzzleId, reason,
   action taken, AI's own rationale, raw response — both for audit
   and as tomorrow's few-shot example
                    │
                    ▼
   Response back to the frontend: { action, rationale, ... } —
   PuzzleReviewCard shows "AI's take: <rationale>" (§8)
```

---

## 4. Which AI, and why

Checked current (August 2026) free-tier terms directly rather than assuming — these change over time, so re-verify before actually wiring a provider in if this plan sits for a while before being built.

| Provider | Free tier? | Relevant limits | Notes |
|---|---|---|---|
| **Google Gemini 3.5 Flash** (💡 recommended — updated 2026-08-30, see note below) | Yes, indefinite, no card | 15 RPM / 1,500 requests per day, 1.0M token context | Strong structured-output support (`responseSchema`), capable general reasoning, Google's own SDK |
| Groq (Llama 3.3 70B / GPT-OSS-120B / etc.) | Yes, indefinite, no card | 30 RPM / 6,000 TPM / 14,400 requests per day | Fastest inference, most generous free daily cap by far, hosts strong open-weight models |
| Anthropic Claude Haiku 4.5 | No lasting free tier (small one-time signup credit only) | Pay-per-use: ~$1/$5 per million input/output tokens | Excellent structured reasoning and tool-use support; effectively pennies per review at this feature's volume even without a free tier |
| OpenAI | No lasting free tier | Comparable pay-per-use pricing to Claude Haiku | No particular advantage over Claude here |

**Pick: Gemini's free tier**, with Groq as the documented fallback if Gemini's daily cap or terms ever become a problem, and Claude Haiku 4.5 as a cheap paid escalation path if either free tier's reasoning quality proves insufficient in practice.

**Model correction (2026-08-30):** this section originally named `gemini-2.5-flash` — the newest model confirmed against Google's own docs at the time this plan was first written. The user asked to double-check whether a newer Flash model had since reached the free tier; it had — `gemini-3.5-flash` is confirmed (Google's own docs) on the free tier with *better* limits (15 RPM/1,500 RPD vs. 2.5 Flash's 10 RPM/250 RPD). Implemented with `gemini-3.5-flash` from the start rather than shipping the stale name and fixing it later. This exact kind of drift is expected to keep happening — re-verify against [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) periodically, not just once.

Reasoning: this feature fires only when a reviewer clicks reject — at the batch sizes already in use (`content:generate -- 20/30`), that's realistically single digits to low tens of calls per day, nowhere close to 250/day. Gemini 2.5 Flash's reasoning quality is well past what's needed to read a short puzzle + a sentence of human feedback and pick one of five bounded actions with a rationale — this is a constrained decision task, not open-ended generation. No cost is expected at this feature's real volume for the foreseeable future.

**One caveat worth knowing, not a blocker**: Gemini's free tier terms allow Google to use free-tier prompts/responses to improve their products. The data sent here is puzzle word lists and a reviewer's internal opinion about puzzle quality — not user data, not secrets — so this is a low-stakes trade-off, but it's the user's call whether it matters. The mitigation, if it ever does, is trivial: switch to Gemini's paid tier (same API, same code, different billing, no free-tier data-use clause) or to Groq.

**Implementation note**: build the AI-calling code behind one small interface (§7.4) so switching providers later is a config change, not a rewrite.

---

## 5. "Training" — what it actually means here

No fine-tuning. No labeled dataset pipeline. That would need a real volume of historical (reason → good outcome) pairs to be worth doing at all, and there are currently zero logged rejections in the live database (confirmed directly while building Phase 10.6 item 2) — there's nothing to fine-tune on yet, and by the time there were enough examples to matter, prompt engineering would likely already be doing the job fine.

Instead, "training" here means two things, both pure prompt engineering:

1. **A well-built system prompt**, written once and iterated on by hand: the rule taxonomy (ids, names, descriptions, families, subtlety ratings — this already exists as data, `content-engine/rules/index.ts`), the bounded action schema (§6) with clear guidance on when each action applies, and a couple of hand-written example (reason → action) pairs covering the obvious cases ("too easy to guess" → `adjust-difficulty` or `retire-rule` depending on severity; "this specific word is weird" → `swap-word`; "the traps don't work" → `redraft-puzzle`).

2. **A growing few-shot library sourced from real outcomes** — every AI review gets logged to a new `aiReviews` collection (§7.2), including a `humanOutcome` field filled in later once the reviewer acts on the re-surfaced puzzle (approved it, rejected it again, or triggered another repair). Periodically (💡 manually at first — literally read the aiReviews collection occasionally and hand-pick the clearest few examples into the system prompt; automate the selection later only if this becomes a real chore), pull the clearest wins and misses into the system prompt as few-shot examples. This is in-context learning, not model training — no infrastructure beyond "a MongoDB collection and occasionally editing a prompt string" — but it's the mechanism that lets the system actually improve from real experience over time, which is what "training" was really asking for.

---

## 6. The bounded action set

The AI is never given freeform code execution or an open-ended "do whatever you think is best." It picks exactly one of five actions, each mapped to existing or small new code, and its raw response is validated against this schema before anything happens (§9). This is what makes "the AI can act on its own" safe rather than a wildcard.

```ts
type AiReviewAction =
  | { action: 'swap-word'; badWordId: string; rationale: string }
  | { action: 'redraft-puzzle'; rationale: string }
  | { action: 'adjust-difficulty'; newSubtlety: 1 | 2 | 3 | 4 | 5; rationale: string }
  | { action: 'retire-rule'; rationale: string }
  | { action: 'agree-reject'; rationale: string }
```

| Action | When the AI should pick it | Execution |
|---|---|---|
| `swap-word` | The reasoning points at one specific word (a proper name, an awkward choice, a spelling that reads oddly) while the rule/concept is otherwise fine | Reuses `content-engine/generator/repairWord.ts::repairWord()` exactly as built in Phase 10.6 item 2 — no new logic |
| `redraft-puzzle` | The rule is fine but *this instance's* draft is weak — bad/missing traps, an unlucky clue set, nothing structurally wrong with the concept | `generateCandidate(tier, wordBank, [effectiveRule])` — a singleton `rules` array forces that one rule without any new generator code (§7.3) |
| `adjust-difficulty` | The rule itself is sound but miscalibrated — too easy to guess by elimination, or (less common) surprisingly hard for its tier | Writes `RuleDoc.subtletyOverride` (§7.1); this puzzle instance is rejected, future generations use the new subtlety |
| `retire-rule` | The rule fundamentally doesn't work — ambiguous by nature, boring, or the reasoning makes clear no amount of recalibration fixes it | Writes `RuleDoc.disabled = true` (§7.1); this instance is rejected, the rule never gets drafted again until manually re-enabled |
| `agree-reject` | The reviewer gave no usable reasoning, or genuinely nothing here is fixable/worth fixing | Falls straight through to today's plain reject — no different from before this feature existed |

---

## 7. Backend design

### 7.1 Schema additions

`netlify/functions/_shared/types.ts`, extending the existing `RuleDoc`:

```ts
export interface RuleDoc {
  _id: string
  name: string
  descriptionTemplate: string
  family: string
  subtlety: number
  /** Live override (this plan) — excludes the rule from generation without a code deploy. Reinstate by unsetting. */
  disabled?: boolean
  /** Live override — replaces the rule's static subtlety for eligibility-window purposes when generating. The rule's evaluate() logic itself never changes; only which difficulty tier draws it. */
  subtletyOverride?: number
}
```

New collection, `aiReviews` (added to `getCollections()` in `_shared/db.ts` alongside the existing four):

```ts
export interface AiReviewDoc {
  _id?: ObjectId
  puzzleId: string
  ruleId: string
  reviewerReason: string
  aiAction: AiReviewAction['action']
  aiRationale: string
  /** Full raw model response — debugging and audit, not shown to the reviewer. */
  aiRawResponse: string
  /** Set for swap-word/redraft-puzzle (the puzzle survives under the same _id); null for the other three actions. */
  resultingPuzzleId: string | null
  createdAt: Date
  /** Filled in later once a human acts on the re-surfaced puzzle (or confirms a rejected/retired one was right) — the few-shot feedback signal from §5. */
  humanOutcome: 'approved' | 'rejected-again' | 'repaired-again' | null
}
```

### 7.2 `content-engine/rules/ruleOverrides.ts` (new, pure, testable)

```ts
export interface RuleOverride {
  ruleId: string
  disabled?: boolean
  subtletyOverride?: number
}

/** Merges live Mongo-sourced overrides onto the static RULES array before a generation run. Disabled rules are dropped entirely; a subtletyOverride replaces .subtlety for eligibility filtering only. */
export function applyRuleOverrides(baseRules: Rule[], overrides: RuleOverride[]): Rule[] {
  const overrideById = new Map(overrides.map((o) => [o.ruleId, o]))
  return baseRules
    .filter((r) => !overrideById.get(r.id)?.disabled)
    .map((r) => {
      const o = overrideById.get(r.id)
      return o?.subtletyOverride ? { ...r, subtlety: o.subtletyOverride as Subtlety } : r
    })
}
```

Wired into the same three generation call sites already touched by Phase 10.6 item 2's `resolveRejectCounts` (`admin-generate-batch.ts`, `scheduled-generate-puzzles.ts`, `content-engine/scripts/queuePuzzles.ts`): fetch `RuleDoc[]` from Mongo, map the ones with `disabled`/`subtletyOverride` set into `RuleOverride[]`, call `applyRuleOverrides(RULES, overrides)`, and pass *that* effective rule array into `generateBatchCore` instead of the raw `RULES` import. Small, mechanical, same pattern as the existing wiring.

### 7.3 Redrafting a specific rule needs zero new generator code

`generateCandidate(tier, wordBank, rules, ...)` already picks a rule from whatever `rules` array it's given via family-eligibility + `pickTrueRule`. Passing a **singleton array** (`[effectiveRule]`) makes that selection trivial — there's only one rule, so it's the one drafted, with no new `forceRuleId` parameter or branch needed anywhere in `orchestrator.ts`. `redraft-puzzle`'s execution is exactly:

```ts
const candidate = generateCandidate(doc.difficultyTier, wordBank, [effectiveRule])
```

then overwrite the existing `PuzzleDoc`'s `clues`/`guests`/`liveDecoys` with the fresh draft (same `_id`, stays `pending_approval`).

### 7.4 `netlify/functions/_shared/aiReview.ts` — the model-calling module

Provider-agnostic on purpose, so switching Gemini → Groq → Claude later (§4) is a config/small-module change, not a rewrite:

```ts
export interface AiReviewInput {
  puzzle: AdminPuzzleDetail
  reason: string
  ruleTaxonomySummary: string   // short id/name/description/subtlety list, built once from RULES
  fewShotExamples: string       // pulled from recent aiReviews docs with a known humanOutcome
}

export async function getAiReviewDecision(input: AiReviewInput): Promise<AiReviewAction> {
  // 1. Build the system + user prompt (taxonomy context, this puzzle's actual
  //    clues/pool/liveDecoys, the reviewer's reason, few-shot examples).
  // 2. Call the provider with a JSON-schema-constrained response (Gemini's
  //    responseSchema, or equivalent) matching the AiReviewAction union.
  // 3. Parse + validate defensively (§9) — never trust the raw response.
  // 4. On any failure (timeout, malformed response, API error): return
  //    { action: 'agree-reject', rationale: 'AI review unavailable — <error>' }
  //    rather than letting the request hang or crash the endpoint.
}
```

### 7.5 `netlify/functions/admin-ai-review.ts` (new endpoint, replaces the default reject path)

Thin wrapper, same shape as every other `admin-*.ts` function:

1. `requireAdmin`.
2. Parse `{ puzzleId, reason }`, find the `pending_approval` doc (404/409 pattern matching `admin-reject.ts`).
3. Fetch the current `RuleDoc` (including any existing override) for context.
4. Call `getAiReviewDecision(...)`.
5. Dispatch on `decision.action` (§6's table) — call `repairWord()`, `generateCandidate([effectiveRule])`, or write a `RuleDoc` override, then update the `PuzzleDoc` accordingly.
6. Insert one `AiReviewDoc` into `aiReviews` regardless of branch.
7. Return `{ ok: true, action, rationale, stillPending: boolean }` to the frontend.

### 7.6 `netlify/functions/admin-rule-override.ts` (new endpoint, human-direct path)

Small, separate endpoint so a reviewer can retire/reinstate or recalibrate a rule **without going through AI at all** — the explicit "reviewer can straight-up just reject the entire rule/concept" path from the original request. `requireAdmin` → `{ ruleId, disabled?, subtletyOverride? }` → upsert onto the `rules` collection. Reused by both the manual "Retire this rule" button (§8) and internally by `admin-ai-review.ts`'s `retire-rule`/`adjust-difficulty` branches (no duplicated Mongo-write logic).

---

## 8. Frontend UI/UX

### `PuzzleReviewCard.tsx` — simplified from Phase 10.6 item 2's version

Remove the word-picker dropdown entirely (the AI now infers word-vs-concept itself from the puzzle data + reasoning — no need to make the reviewer pre-diagnose it). Three actions:

1. **Approve** — unchanged.
2. **Reject** — a single free-text reason input (as it was originally, before the dropdown), now calling `POST /api/admin-ai-review` instead of `admin-reject`. Reason is still required (empty reasoning has nothing for the AI to act on beyond `agree-reject`, and `admin-reject.ts` itself stays as a distinct thin path only for a future "reject with truly no reasoning at all, don't even bother calling AI" case — 💡 optionally exposed as a small "skip AI, just reject" link for a reviewer in a hurry who already knows there's nothing to salvage).
3. **Retire this rule** — a new, separate, low-emphasis button (confirmation dialog: "Retire '<rule name>' — it will stop being generated until manually reinstated. Continue?") calling `admin-rule-override.ts` directly, no AI involved. This is the direct rule-kill path from the original request.

After a Reject click resolves, show the AI's rationale in a dismissible banner at the top of the admin screen (💡 in `AdminApp.tsx`, not the card itself — the card's own puzzle list reloads right after the action, same pattern the word-repair path already established, so a banner on the card itself would flash and vanish before the reviewer can read it):

> "AI redrafted this puzzle — clues and pool were rebuilt for the same rule. *Rationale: the two decoy traps here were both bird names, which made the pattern too guessable.*"

### `RuleRejectStatsPanel.tsx` — gains a manual override control

Each row already shows rule name, reject count, and a "Review template" badge past the threshold. Add:
- A **Retire / Reinstate** toggle button per row, calling the same `admin-rule-override.ts` from §7.6.
- A **current subtlety** display, editable inline (a small number input + save), for the manual `adjust-difficulty` path without invoking AI.
- Rows for rules with an active `disabled` or `subtletyOverride` get a visible marker (e.g. a small "OVERRIDDEN" tag) so it's obvious at a glance which rules are running under a live-tuned configuration rather than their original code-defined values — this matters because it's easy to forget a live override exists months later when reading the rule's source file and wondering why its real-world behavior doesn't match.

---

## 9. Safety, guardrails, and failure modes

- **The AI never writes directly to a puzzle without going back through the real validator.** `swap-word` reuses `repairWord.ts`, which calls `validateAndRepair` before accepting any change. `redraft-puzzle` reuses `generateCandidate`, which already only returns validator-passed candidates. There's no code path where an AI-authored puzzle skips uniqueness validation.
- **Nothing the AI does can ship a puzzle to players directly.** `swap-word`/`redraft-puzzle` land back in `pending_approval` (a second human look is still required before `approved`/`scheduled`). `adjust-difficulty`/`retire-rule`/`agree-reject` only ever change the *taxonomy* or reject the current instance — never approve or schedule anything.
- **Defensive parsing, always.** The model's response is JSON-schema-constrained at the API level (§7.4), but that's a request, not a guarantee — validate the parsed shape against the `AiReviewAction` union in code before trusting any field (right `action` string, `badWordId` actually present in the puzzle, `newSubtlety` in `1..5`, etc.). Any validation failure or API error/timeout falls back to `agree-reject` with the failure reason as the rationale — the reviewer's click always resolves to *something*, never a hung request or an unhandled exception.
- **Every override is reversible.** `disabled`/`subtletyOverride` are plain Mongo fields — reinstating a retired rule or reverting a difficulty change is a one-line update, not a code rollback.
- **Cost/rate ceiling is a non-issue at this feature's volume** (§4), but the `aiReview.ts` module should still have a hard timeout (💡 8–10s) so a slow/hanging API call can't leave an admin request open indefinitely.
- **Audit trail is mandatory, not optional** — every `aiReviews` insert (§7.1) happens regardless of which branch executes, specifically so a reviewer can later ask "why did the AI do that?" and get a real answer, and so §5's few-shot library has real material to grow from.

---

## 10. Testing strategy

Matching this codebase's existing convention (pure/testable-core modules get real unit tests; Mongo-touching `_shared/*.ts` glue does not — see `puzzleStats.ts`, `rejectStats.ts`, neither of which has a dedicated test file):

- **`ruleOverrides.ts::applyRuleOverrides`** — fully pure, fully tested: disabling drops a rule, an override replaces subtlety, an untouched rule passes through unchanged, both together on different rules at once.
- **`aiReview.ts`** — the actual provider call is not unit-tested directly (no live API calls in CI, matching how this repo never mocks `fetch`/`natural` calls into a full E2E test either — see `dictionarySources.test.ts`'s mocking approach for the pattern to reuse: mock the provider SDK call, not the whole module). What *is* tested: the response-validation function in isolation — feed it well-formed and deliberately malformed model outputs, confirm it accepts the former and falls back to `agree-reject` on the latter.
- **`admin-ai-review.ts`'s dispatch logic** — 💡 worth extracting the "given a validated `AiReviewAction`, do the right thing" switch into its own small pure-ish function (taking the decision + the doc + the word bank/rules, returning what to write) separate from the HTTP/Mongo glue, exactly like `repairWord.ts` was extracted from `admin-repair-word.ts` in Phase 10.6 item 2 — same house convention, and it means the five-way branch is unit-testable without touching Mongo at all.
- **Manual QA before rollout**: hand-write 5–8 realistic reviewer reasons against real pending puzzles (one per action type) and confirm the AI's chosen action matches intuition before this goes live for real review sessions — this is a judgment-quality check no automated test can substitute for, the same way Phase 10.5/10.6's tag-curation work always ended in a human sanity pass.

---

## 11. Build order

Mirroring `build-plan.md`'s phase style — build and verify each piece before the next depends on it:

1. ✅ **Schema + manual override plumbing, no AI yet.** Done 2026-08-30. `RuleDoc.disabled`/`subtletyOverride` fields (`netlify/functions/_shared/types.ts`); `content-engine/rules/ruleOverrides.ts::applyRuleOverrides` (pure, 6 tests) + `netlify/functions/_shared/ruleOverrides.ts::resolveRuleOverrides` (the Mongo-fetch half); wired into all three generation call sites (`admin-generate-batch.ts`, `scheduled-generate-puzzles.ts`, `content-engine/scripts/queuePuzzles.ts`) via a new optional `rules` param threaded through `generateBatchCore`/`generateCandidate`, defaulting to the full static `RULES` so nothing changes when no override exists; `admin-rule-override.ts` endpoint (independently-optional `disabled`/`subtletyOverride` fields, `null` clears an override); `RuleRejectStatsPanel.tsx` widened from "rules with a recent reject" to *every* rule in the taxonomy (via `resolveRuleRejectStats` now listing all `RuleDoc`s, not just ones with reject history) with an inline subtlety editor, a Retire/Reinstate button per row, and an "Overridden" tag. This alone already delivers the "reviewer can straight-up just reject the entire rule/concept" half of the original request, independent of AI.
   - **Bug fixed along the way**: `seedDatabase.ts` upserted rules via `replaceOne`, which would have silently wiped any live `disabled`/`subtletyOverride` the next time someone re-ran `npm run content:seed-db` after a taxonomy change — the exact scenario this feature exists for. Switched to `updateOne` + `$set` (only the code-defined fields), so overrides survive a re-seed.
   - **Verified**: typecheck clean across all three trees, full suite 323/323 (306 + a hidden-in-summary miscount aside, actually 317 -> 323, +6 new), lint clean, a real `content:generate -- 20` batch still works, full production build succeeds. Also ran a controlled, fully-reversible round-trip directly against the real database (set `disabled`+`subtletyOverride` on a real rule, confirmed `resolveRuleOverrides`/`applyRuleOverrides`/`resolveRuleRejectStats` all reflect it correctly, then reverted) rather than trusting the code from types alone.
   - **Operational gap found, not fixed (a data-write decision, not code)**: the live `rules` collection currently has only 17 documents — it hasn't been re-seeded since this project's rule taxonomy grew to 29 (the letter/hidden-word parameterization and the palindrome/alphabetical-order/anagram families, both added earlier this session). `RuleRejectStatsPanel` will only show/control those 17 until `npm run content:seed-db` is run against the real database. Left for the user to run deliberately rather than doing it myself mid-implementation.
2. ✅ **`aiReviews` collection + `aiReview.ts` module, backend only.** Done 2026-08-30. `AiReviewDoc` schema + wired into `getCollections()` (`netlify/functions/_shared/db.ts`). `content-engine/generator/aiReviewAction.ts` — the bounded 5-action type plus `parseAiReviewAction()`, defensively validating any raw model response (unknown action, a `badWordId` not actually in the puzzle, an out-of-range subtlety all fall back to `agree-reject`); fully unit-tested (12 cases, every well-formed action plus every malformed-input path), no live API needed for these tests. `netlify/functions/_shared/aiReview.ts::getAiReviewDecision` — builds the prompt (rule, clues, pool, live decoys, the reviewer's reason), calls Gemini with a JSON-schema-constrained response, 10s timeout, falls back to a safe `agree-reject` on any error/timeout/missing key. New `npm run content:test-ai-review` CLI script (mirrors `queuePuzzles.ts`'s pattern) for exactly this step's "manually exercise before wiring an endpoint" requirement.
   - **Verified against real Gemini calls, all 5 actions**, using real pending puzzles from the live database and deliberately varied reviewer reasons: a difficulty complaint correctly produced `adjust-difficulty` (3 different puzzles), an explicit "everything else is fine, just swap this one word" correctly produced `swap-word` with the *exact real wordId* from the puzzle (not hallucinated), a "the concept is fundamentally broken" reason correctly produced `retire-rule`, a "traps are weak, redraft it" reason correctly produced `redraft-puzzle`, and a non-substantive reason correctly produced `agree-reject`. Every response was well-formed JSON matching the schema on the first try — no malformed-response fallbacks triggered in real testing (only in the dedicated unit tests, which construct malformed input directly).
   - **Known cosmetic issue, not fixed:** the CLI test script prints a harmless `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` from libuv after printing correct results, on `process.exit(0)` racing the Gemini SDK's HTTP client cleanup — a known Node/Windows exit-timing quirk. Doesn't affect correctness and can't occur in the real `admin-ai-review.ts` endpoint (a Netlify Function never calls `process.exit()`), so left alone rather than engineered around for a manual dev-only script.
3. ✅ **`admin-ai-review.ts` endpoint.** Done 2026-08-30. `content-engine/generator/aiReviewDispatch.ts::planAiReviewDispatch` — the pure, Mongo-free five-way branch (7 unit tests): swap-word/redraft-puzzle re-run the real validator via `repairWord`/`generateCandidate` and only survive if it passes (falling back to reject otherwise), while adjust-difficulty/retire-rule reject the instance and carry a taxonomy override, and agree-reject is a plain reject. `admin-ai-review.ts` is the thin Mongo/HTTP wrapper: find pending doc → `getAiReviewDecision` → `planAiReviewDispatch` → apply the rule override (if any) + update-or-reject the puzzle → log one `AiReviewDoc`. The rule-override Mongo write was extracted into `_shared/ruleOverrides.ts::writeRuleOverride` and `admin-rule-override.ts` refactored onto it, so both the manual and AI paths share one write (§7.6). Wire types (`AdminAiReviewRequest`/`Response`) added to both `_shared/adminApi.ts` and `src/admin/types.ts`, plus the `aiReview()` client function.
   - **Verified**: typecheck clean (all three trees), full suite 341/341 (334 + 7), lint clean. Also ran a real end-to-end dry-run against the live database (decision + dispatch plan, no writes) across three real pending puzzles with varied reasons — adjust-difficulty produced correct `{ruleId, subtletyOverride}` overrides, and redraft-puzzle actually regenerated a fresh, valid Hidden Number puzzle (new clues + guests, all correctly labeled) for the same rule. The DB-write half is trivial `updateOne` calls of the same shape already used across the admin functions, and `writeRuleOverride`'s round-trip was already verified live in phase 1.
   - **Observed (model judgment, not a code issue)**: given "the concept is fundamentally broken, no fix will help" on an easy category rule, the AI chose `adjust-difficulty` rather than `retire-rule` — it latched onto the rule being too easy over the "broken" framing. The reviewer sees the rationale and has the direct "Retire this rule" button (phase 4 / phase 1's panel) to override when they disagree — exactly why the human stays the final gate.
4. **Frontend**: simplify `PuzzleReviewCard.tsx` (drop the dropdown, add the Retire button), add the AI-rationale banner to `AdminApp.tsx`.
5. **Live for real review sessions.** Let the `aiReviews` collection accumulate real (reason → action → outcome) data — this is what feeds §5's few-shot library growth. Revisit the system prompt by hand after the first few dozen real reviews.

---

## 12. Open risks and things to watch

- **Gemini free-tier terms can change** (rate limits, data-use policy) — this plan already names Groq as a same-shape fallback specifically so this isn't a rewrite if it happens; re-check current terms before actually implementing step 2 of §11 if meaningful time has passed since this plan was written.
- **`redraft-puzzle` quality risk**: a fresh draft for the same rule might still not address what the reviewer actually meant (e.g. they wanted a *harder* version, not just a *different* one) — the human still reviews the result before it can ship, so this fails safe, but it's worth watching whether `redraft-puzzle` gets picked appropriately versus `adjust-difficulty` in practice, and tightening the prompt's guidance between the two if they get confused often.
- **`retire-rule` is a one-way-feeling action even though it's technically reversible** — a reviewer should be able to see, at a glance, which rules are currently disabled (the "OVERRIDDEN" tag in §8) so a retired rule doesn't just quietly vanish from the taxonomy without anyone remembering why.
- **Cost is currently a non-issue but isn't monitored** — if this feature's usage pattern ever changes drastically (e.g. review is automated/bulk rather than one-by-one), revisit whether the free tier still holds; no monitoring/alerting is planned for this at the current expected volume, since it would be over-engineering for a feature invoked by a single human clicking one button at a time.
