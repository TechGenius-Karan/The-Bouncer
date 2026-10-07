# Pipeline Upgrades — Implementation Plan

Five upgrades to the generation pipeline: pool composition, collision tolerance,
trap word quality, AI menu pre-validation, and scheduler family throttling.

Written against the code as it stands on `main` (168 rules, 15,044 words). Every
number below was measured, not estimated — the measurement commands are in
[Appendix A](#appendix-a--how-the-numbers-were-measured).

---

## Read this first: three premises need adjusting

The brief described five changes. Three of them describe behaviour the code
doesn't currently have, so implementing them literally would either be a no-op or
actively break the pipeline. Each is still a real problem worth fixing — the
*intent* holds in all three cases — but the mechanism has to change. Details are
in the relevant phase; the short version:

| # | As described | What the code actually does | Consequence |
|---|---|---|---|
| 2 | "Reject only if the collision is divergent across the 12 board words" | **Every** collision is already identical across the 12 board words, by construction | Implementing literally **disables the validator entirely** |
| 3 | "Relax the 0.6 frequency floor for decoy-traps" | Decoy-traps have **no floor at all**; 18% already land below 0.4 | No-op — there is nothing to relax |
| 1 | "Coin flip risks 6:0 / 0:6 splits" | Coin flip picks `targetIn ∈ {3,4}` — only 3:3 and 4:2 ever occur | Different bug than described; still a real one |

And one blocker:

| # | Issue |
|---|---|
| 5 | A 2/week lexical cap is **mathematically unsatisfiable** against current rule supply. Feasible floor today is 3/week. See [Phase 4](#phase-4--scheduler-family-throttling). |

---

## Phase ordering and dependencies

```
Phase 1  Pool composition + trap word quality      ── independent, ship first
Phase 2  Collision classification                   ── independent
Phase 3  AI menu pre-validation                     ── DEPENDS ON Phase 2
Phase 4  Scheduler family throttling                ── independent (supply caveat)
```

Phase 3 consumes the classifier Phase 2 introduces. Phases 1, 2 and 4 are
mutually independent and can land in any order.

---

# Phase 1 — Pool composition and trap word quality

Groups brief items **1** (weighted IN/OUT distribution) and **3** (trap word
frequency). Both live in the generator's word-selection layer, both are small,
and both are independently verifiable by generating a batch and counting.

## 1a. Weighted IN/OUT distribution

### What's actually happening

`content-engine/generator/trapSelection.ts:34`:

```ts
const half = Math.floor(knobs.poolSize / 2)   // 3
const targetIn = half + (Math.random() < 0.5 ? 0 : 1)   // 3 or 4
```

`targetIn` is only ever 3 or 4. Measured across 24 generated candidates: **15×
3:3, 9× 4:2, nothing else.** A 6:0 or 0:6 split cannot arise from this line.

There is a narrow path to a drifted split — pass 3's fallback flips the label
when `bestCandidate` returns nothing for the wanted side — but it requires the
bank to be exhausted for one side of a rule and did not occur in any measured
run.

So the stated risk isn't real. **A different one is:** the pool is *never
IN-minority*. Across every puzzle the game has ever generated, at least half the
guests are IN. A player who leans IN on an unclear card is playing a
positive-expectation strategy that has nothing to do with the rule — the same
class of exploit as the old fixed `IN,IN,IN,IN,OUT,OUT` ordering, just subtler.

Adding 2:4, 1:5 and 5:1 to the distribution is what removes that bias, and
excluding 6:0/0:6 is worth doing explicitly regardless, since it converts an
implicit invariant into an enforced one.

### Implementation

Replace the coin flip with a weighted table. Add to `trapSelection.ts`:

```ts
/**
 * IN-count distribution for a 6-guest pool. 6:0 and 0:6 are excluded outright —
 * a single-label pool teaches nothing and reads as broken.
 *
 * Centred on 3:3 so the pool is usually balanced, but the tails matter more than
 * they look: without 2:4/1:5 the pool is never IN-minority, and "lean IN when
 * unsure" becomes a positive-expectation strategy independent of the rule.
 */
const IN_COUNT_WEIGHTS: readonly (readonly [inCount: number, weight: number])[] = [
  [3, 50], // 3:3
  [4, 20], // 4:2
  [2, 20], // 2:4
  [5, 5],  // 5:1
  [1, 5],  // 1:5
]
```

Draw with the existing `pickWeighted` from `content-engine/generator/random.ts`
— it already does exactly this and assumes positive weights, which holds here:

```ts
const targetIn = pickWeighted([...IN_COUNT_WEIGHTS], ([, weight]) => weight)[0]
```

**Generalise beyond `poolSize === 6`.** The table is hardcoded to a 6-guest pool
but `knobs.poolSize` is a knob. Guard it: if `poolSize !== 6`, fall back to
`half + (coin flip)` and leave a comment saying the table needs extending. Both
current tiers use 6, so this costs nothing today and won't silently produce a
5-IN target for a 4-guest pool later.

### Edge cases

- **Trap passes run first and set their own labels.** Decoy-traps are always
  `OUT`, t-but-looks-wrong always `IN`. Medium allocates 1 of each, spicy 2+1. A
  `targetIn` of 1 with spicy's 2 forced-IN traps is unreachable — pass 3 simply
  adds no more INs and the pool lands at 2:4 rather than 1:5.
  **This is acceptable** (the distribution is a target, not a contract) but it
  must be documented, or a test asserting exact distribution shape will flake.
- **Thin rules.** A rule matching ~30 words can fail to fill 5 INs after clues
  consume 3. Pass 3's existing fallback handles it; the orchestrator's
  `guests.length < knobs.poolSize` check catches a genuinely short pool.
- **Interaction with the validator.** More extreme splits mean fewer distinct
  labels on the board, which *raises* collision probability — a 1:5 board is
  easier for a second rule to satisfy. Phases 1 and 2 push in opposite
  directions here; land Phase 2 first, or expect the repair rate to rise
  temporarily.

## 1b. Decoy-trap word quality

### What's actually happening

The 0.6 floor (`CLUE_FREQUENCY_FLOOR`, `draftClueSet.ts:9`) applies **only to
clues**, and already has a documented rationale — clues are the evidence the
whole inference rests on.

`trapSelection.ts`'s `bestCandidate` applies **no floor whatsoever**:

```ts
return pickWeighted(candidates, (w) => w.frequencyScore)
```

Measured over 61 selected decoy-traps:

| | value |
|---|---|
| below 0.6 | 39.3% |
| below 0.4 | **18.0%** |
| mean `frequencyScore` | 0.656 |
| bank mean | 0.513 |
| candidate pool below 0.6 | 58.3% |

So low-frequency words are already getting through. There is no floor to relax.

The real defect is the *opposite* of the brief's premise, and there are two of
them:

1. **No lower bound at all.** 18% of decoy-traps are below 0.4. That's where
   genuinely obscure words come from — and a trap the player has never seen isn't
   a trap, it's noise. This is an unnoticed gap, not a deliberate choice.
2. **Proportional weighting suppresses good mid-frequency traps.** A 0.45 word
   competes against a 0.9 word at half the odds *on commonness alone*, with its
   trap value counting for nothing. Selection mean (0.656) sits well above the
   pool mean, confirming the upward pull.

### Implementation

Replace "relax the floor" with **a quality band plus flat weighting inside it**,
which delivers the stated intent (good trap words stop losing) while closing the
floor gap:

```ts
/**
 * Decoy-traps are the highest-value guests in the pool, so they're selected on
 * trap value rather than commonness — but only within a band. Below this a word
 * is obscure rather than tricky, and an unrecognisable trap is noise, not
 * difficulty. Measured: 18% of decoy-traps were landing below this line, because
 * bestCandidate applied no floor at all.
 */
const TRAP_FREQUENCY_FLOOR = 0.4
```

Give `bestCandidate` a selection-mode parameter:

- **`'trap'`** — filter to `frequencyScore >= TRAP_FREQUENCY_FLOOR`, then pick
  **uniformly** (`pickRandom`, already in `random.ts`). Inside the band every
  word is recognisable, so trap value should decide, not commonness.
- **`'padding'`** — unchanged: `pickWeighted` by `frequencyScore`, no floor.
  Padding should stay boringly common; it isn't the puzzle.

Apply `'trap'` to pass 1 (decoy-traps) and pass 2 (t-but-looks-wrong) — pass 2
guests are equally load-bearing and equally deserve the band.

**Fallback:** if the band empties the candidate list, retry unfiltered rather
than returning `null`. A thin rule shouldn't lose its trap entirely; the
orchestrator would otherwise discard an otherwise-good candidate.

### Files touched — Phase 1

| File | Change |
|---|---|
| `content-engine/generator/trapSelection.ts` | `IN_COUNT_WEIGHTS`, `TRAP_FREQUENCY_FLOOR`, `bestCandidate` mode param |
| `content-engine/generator/trapSelection.test.ts` | New cases below |
| `content-engine/generator/random.ts` | None — reuse `pickWeighted` / `pickRandom` as-is |

### Testing — Phase 1

- **Distribution** — draw `targetIn` 10,000× against the table; assert each
  bucket within ±3% of nominal and that 0 and 6 never appear. Test the draw
  helper directly, not through `selectGuestPool`, so trap-label clamping doesn't
  make it flaky.
- **Never degenerate** — generate 200 candidates; assert every pool has ≥1 IN and
  ≥1 OUT. This is the real guarantee and it holds end-to-end.
- **Bias regression** — across 200 candidates assert IN-minority pools occur at
  >10%. Fails today (0%), passes after. This is the test that would have caught
  the original bug.
- **Trap floor** — assert no selected trap is below 0.4 when the band is
  non-empty; assert the unfiltered fallback still returns a word when it is.
- **Flat selection** — with a stubbed bank of two eligible traps at 0.45 and
  0.95, assert selection is ~50/50 over many draws, not ~32/68.
- **`poolSize` guard** — call with `poolSize: 4`; assert no crash and no
  out-of-range `targetIn`.

---

# Phase 2 — Isomorphic collision tolerance

Brief item **2**. The deepest change here, and the one whose specification needs
the most adjustment.

## Why the spec as written would disable the validator

`content-engine/generator/validator.ts` (not `orchestrator.ts` — the orchestrator
calls it) builds the board and finds collisions:

```ts
const items = [
  ...candidate.clues.map((c)  => ({ word, isIn: c.label === 'IN' })),
  ...candidate.guests.map((g) => ({ word, isIn: g.trueLabel === 'IN' })),
]
const collisions = allRules.filter((rule) =>
  rule.id !== trueRule.id && items.every((item) => rule.evaluate(item.word) === item.isIn)
)
```

The board labels are **derived from the true rule** — `draftClueSet` picks IN
clues by `rule.evaluate(w) === true`, and `selectGuestPool` sets every
`trueLabel` from `trueRule.evaluate`. So `trueRule.evaluate(w) === item.isIn`
holds for all 12 items *by construction*.

A collision is defined as `B.evaluate(w) === item.isIn` for all 12 items.
Therefore **B agrees with the true rule on all 12 words, always.** Comparing
their 12-word boolean patterns is a tautology — it is the definition of the
collision, restated.

Measured: **32 of 32 first-pass collisions are board-isomorphic.** Not 32 of 32
*sometimes* — necessarily, in every case, forever.

Under the literal spec every collision would be classified isomorphic, nothing
would ever be rejected, and the uniqueness validator (planning.md §7.3 🔒) would
be silently disabled.

## The collision pressure is real, though

| Metric | Value |
|---|---|
| First-pass boards generated | 187 |
| Boards with ≥1 collision | **28 (15.0%)** |
| Total collisions | 32 |

15% of boards currently pay a repair cycle, and this grows with the taxonomy. The
concern behind the request is correct — only the discriminator is wrong.

## The fix: measure divergence bank-wide, not board-wide

The board can't distinguish these rules. **The word bank can.** Two rules that
collide on 12 words are either genuinely near-equivalent, or they agree by
coincidence — and their bank-wide IN-set overlap separates the cases cleanly:

```
Jaccard bucket   count   character
>= 0.5             5     near-equivalent
0.2 – 0.5          7     related
0.05 – 0.2        18     coincidental
< 0.05             2     coincidental
```

**Near-equivalent** (accepting these is safe):

```
J=0.933  ends-with-ng   ~ ends-with-g      (1094/1172)
J=0.775  ends-with-ion  ~ ends-with-tion   (466/361)
J=0.659  ends-with-ed   ~ ends-with-d      (972/1474)
```

A player who inferred "ends with G" and is told "ends with NG" has essentially
the right idea. Rejecting this board is pure waste.

**Coincidental** (these must still be rejected):

```
J=0.012  starts-with-q  ~ third-letter-vowel   (61/4980)
J=0.046  ends-with-ful  ~ contains-f           (65/1403)
J=0.060  palindrome     ~ same-start-end       (43/712)
```

Inferring "third letter is a vowel" and being told "starts with Q" is exactly the
arbitrary reveal the validator exists to prevent.

**Containment is a third case, and Jaccard alone gets it wrong.**
`palindrome ⊂ same-start-end` — every palindrome has matching first and last
letters — yet J is only 0.060 because the sets are wildly different sizes. It
must be detected separately, by containment rather than overlap.

## Implementation

### New module: `content-engine/rules/ruleSimilarity.ts`

```ts
export type CollisionKind =
  | 'equivalent'   // near-identical IN-sets — accept, reveal the higher-aha rule
  | 'subsumption'  // one IN-set contains the other — accept, reveal the SPECIFIC rule
  | 'divergent'    // agree on this board by coincidence — reject and repair

/** Jaccard at or above this = the two rules are the same idea. Derived from the
 *  measured gap: real near-equivalents cluster >= 0.65, coincidences <= 0.42. */
const EQUIVALENCE_JACCARD = 0.6

/** Containment at or above this = one rule is a special case of the other.
 *  Not 1.0 — a handful of bank exceptions shouldn't demote a real subset. */
const SUBSUMPTION_CONTAINMENT = 0.95

export function classifyCollision(a: Rule, b: Rule, bank: Word[]): CollisionKind
```

**Reveal policy per kind:**

- `equivalent` — reveal the **higher `aha`** rule, per the brief. Tie-break on
  higher `subtlety`, then lexicographic rule id so the choice is deterministic
  and a regenerated puzzle doesn't flip reveal text.
- `subsumption` — reveal the **more specific** (smaller IN-set) rule, *overriding*
  `aha`. Revealing "same first and last letter" on a board of five palindromes
  describes the board less accurately than "palindrome" does, whatever the
  ratings say. Specificity beats `aha` here.
- `divergent` — unchanged: repair, then reject if unrepairable.

### Caching — this is a performance change, not a footnote

`classifyCollision` needs each rule's bank-wide IN-set. Computing one is a full
15,044-word scan; the validator can be called several times per candidate, inside
a 10-attempt retry loop, inside a batch of 40.

**Build a memoised `Map<ruleId, Set<wordId>>` once per process** and thread it
through. Measured cost of precomputing all 168: a few seconds, once. Computing
lazily per collision instead is fine too — only ~15% of boards collide at all —
but it **must** be memoised across candidates within a batch.

Naive implementation risk: 40 puzzles × 10 attempts × 5 repairs × 15,044 words is
~30M evaluations per batch, and `scheduled-generate-puzzles.ts` runs inside a
Netlify function. **Benchmark the batch path before and after.**

### Schema change: the reveal rule

`check-swipe.ts` currently resolves reveal text as:

```ts
const rule = await rules.findOne({ _id: puzzle.ruleId })
ruleText = rule?.descriptionTemplate ?? null
```

Accepting a collision means the reveal may name a *different* rule than
`ruleId` — so this needs a new optional field rather than overwriting `ruleId`
(which drives cooldown, scheduling spacing and reject stats, and must keep
pointing at the generating rule):

```ts
// PuzzleDoc
/** Set only when an accepted collision means a rule other than `ruleId`
 *  describes the board better. Reveal reads this; everything else reads ruleId. */
revealRuleId?: string
```

Touches: `netlify/functions/_shared/types.ts`, `check-swipe.ts`,
`_shared/adminPuzzleDetail.ts` (reviewers must see what players will see), and
`content-engine/generator/types.ts` for the candidate shape.

**Contract note:** `revealRuleId` is server-side only — it resolves to
`ruleText` before it ever reaches the client, so `_shared/api.ts` and
`src/api/types.ts` do **not** change. The admin contract
(`_shared/adminApi.ts` ↔ `src/admin/types.ts`) *does*, and per CLAUDE.md both
copies must be updated together.

### Files touched — Phase 2

| File | Change |
|---|---|
| `content-engine/rules/ruleSimilarity.ts` | **New** — classifier + IN-set cache |
| `content-engine/rules/ruleSimilarity.test.ts` | **New** |
| `content-engine/generator/validator.ts` | Classify before repairing; set reveal rule |
| `content-engine/generator/types.ts` | `revealRuleId` on `CandidatePuzzle` |
| `netlify/functions/_shared/types.ts` | `revealRuleId` on `PuzzleDoc` |
| `netlify/functions/check-swipe.ts` | Resolve reveal via `revealRuleId ?? ruleId` |
| `netlify/functions/_shared/adminPuzzleDetail.ts` | Surface reveal rule to reviewers |
| `netlify/functions/_shared/adminApi.ts` + `src/admin/types.ts` | Both sides of the admin contract |
| `content-engine/scripts/queuePuzzles.ts`, `netlify/functions/admin-generate-batch.ts`, `scheduled-generate-puzzles.ts` | Persist the new field |

### Risks — Phase 2

- **Silently disabling the validator.** The single biggest risk. A bug in
  `classifyCollision` that returns `'equivalent'` too readily degrades puzzle
  quality invisibly — every board still validates, they just get unfair.
  **Mitigation:** a test asserting the known-coincidental pairs above are
  classified `divergent`, and a metric logged per batch.
- **Threshold tuning on n=32.** 0.6 sits in a real measured gap (0.42 → 0.659)
  but 32 samples is thin. Make both constants exported and easy to re-tune; widen
  the sample before trusting them.
- **Performance.** See caching above. Benchmark, don't assume.
- **`aha` is optional** (`Rule.aha?: Subtlety`, defaults to 3). The comparison
  must use `?? 3`, or `undefined` propagates into the reveal choice.
- **Ratings weren't designed for this.** `aha` was introduced as a *selection
  weight*. Using it to pick reveal text is a new load-bearing role for a
  hand-assigned number.

### Testing — Phase 2

- Unit: each measured pair above lands in its expected bucket.
- Unit: `palindrome ~ same-start-end` classifies `subsumption`, and the reveal
  resolves to `palindrome` (the specific one) despite the low Jaccard.
- Unit: reveal choice is deterministic under tie (equal `aha` and `subtlety`).
- Integration: generate 200 candidates; assert the accepted-collision rate is
  non-zero (the feature engages) and that no accepted collision is `divergent`.
- Regression: existing `validator.test.ts` must pass unchanged — divergent
  collisions still repair and still reject.
- Benchmark: time `generateBatchCore(40)` before and after; record it.

---

# Phase 3 — AI menu pre-validation

Brief item **4**. **Depends on Phase 2** — "guaranteed to pass" is only definable
once `classifyCollision` exists.

## Current behaviour

`netlify/functions/admin-ai-review.ts:71-76` builds the menu by filtering the
bank on the rule alone:

```ts
const inWordMenu  = rule ? bank.filter((w) =>  rule.evaluate(w)) ... : []
const outWordMenu = rule ? bank.filter((w) => !rule.evaluate(w)) ... : []
```

Correct side, nothing more. The AI picks from it, then
`aiReviewDispatch.ts`'s `validateAuthoredPuzzle` runs the full uniqueness
validator — and a refine that took a reviewer's written feedback can fail at the
last step for reasons neither the reviewer nor the model can see. That's the
failure this phase removes.

## What "guaranteed to pass" can and cannot mean

It **cannot** mean per-word guarantees. Collision is a property of the whole
12-word board, not of any single word: word X may be safe with clue set A and
collide with clue set B. Filtering words individually cannot make an arbitrary
combination safe. Any implementation promising this is promising something
unachievable — and the `validateAuthoredPuzzle` backstop must stay regardless.

It **can** mean two genuinely useful things:

1. **Prune words that can never work.** Drop any word that is blocked, already on
   the board, or a proper noun where clues are concerned. Cheap, exact.
2. **Prune high-collision-risk words.** For each menu word, hold the current board
   fixed, substitute the word, and run the collision check. Words that introduce
   a `divergent` collision against the *current* board are dropped. Not a
   guarantee across every possible rewrite, but it removes the words most likely
   to fail, which is the practical win.

Then keep the backstop and be honest in the naming: `buildPreValidatedMenu`, not
`buildGuaranteedMenu`.

## Implementation

Extract a reusable checker from `validator.ts` — the collision scan is currently
inline:

```ts
// content-engine/generator/validator.ts
export function findCollisions(
  items: { word: Word; isIn: boolean }[],
  trueRule: Rule,
  allRules: Rule[],
): Rule[]
```

`validateAndRepair` uses it (no behaviour change), and the menu builder reuses it
rather than duplicating the logic — the same testable-core split the codebase
already uses for `repairWord`.

Add to `admin-ai-review.ts`:

```ts
/** Cap on words dry-run per menu. Each costs a scan across the taxonomy, and
 *  this runs inside a Netlify sync function against a 20s AI timeout. */
const MAX_MENU_DRY_RUNS = 200

/** Never ship a menu thinner than this — a starved menu fails refine worse than
 *  a slightly risky one, and the dispatch validator is still behind it. */
const MIN_MENU_SIZE = 12
```

Order matters for cost: shuffle → slice to `MAX_MENU_DRY_RUNS` → dry-run →
slice to `MENU_SIZE`. Dry-running the whole 15k bank inside a request is not
viable.

**If pruning drops the menu below `MIN_MENU_SIZE`, fall back to the unpruned
menu** and log it. A thin menu is the worse failure — it's what produced the
"rotator wasn't in the bank" complaint, where the model couldn't honour a direct
instruction because the word simply wasn't offered.

**Also surface *why* pruning happened.** The existing `MenuWord` already carries
`variant` for exactly this reason. If a reviewer asks for a word that was pruned,
the model should be able to say so rather than silently substituting — that was
the root cause of the earlier "AI ignored my instruction" reports.

### Files touched — Phase 3

| File | Change |
|---|---|
| `content-engine/generator/validator.ts` | Export `findCollisions` |
| `netlify/functions/admin-ai-review.ts` | Pre-validated menu construction |
| `netlify/functions/_shared/aiReview.ts` | Menu typing if `MenuWord` gains fields |
| `content-engine/generator/aiReviewDispatch.ts` | **No change** — backstop stays |

### Risks — Phase 3

- **Latency.** This adds compute to a path already bounded by a 20s AI timeout
  inside Netlify's 26s sync cap — the exact budget that caused the earlier refine
  timeouts. `MAX_MENU_DRY_RUNS` is the control; **measure the added latency
  before merging** and tune it down if needed.
- **Menu starvation.** Covered by `MIN_MENU_SIZE` + fallback.
- **False confidence.** The guarantee is partial. Do not weaken
  `validateAuthoredPuzzle` on the strength of it.

### Testing — Phase 3

- Unit: `findCollisions` extraction is behaviour-preserving (existing
  `validator.test.ts` green, unchanged).
- Unit: a word known to collide with a fixed board is pruned; a safe one survives.
- Unit: starvation triggers the unpruned fallback rather than an empty menu.
- Live: `npm run content:test-ai-review -- 3 "<feedback>"`, and specifically
  re-run the historical failure — *"Stop using words that hide only 'ten' or
  'one' — vary which number is hidden."*
- Latency: log menu-build duration; assert it stays within a few hundred ms.

---

# Phase 4 — Scheduler throttling for lexical rules

Brief item **5**. Independent of Phases 1–3, but gated on a supply problem.

## The supply arithmetic doesn't work

Measured taxonomy composition:

| | rules | share |
|---|---|---|
| lexical-structural | 132 | **79%** |
| semantic-knowledge | 36 | 21% |
| — medium-eligible (subtlety 2–3) | **27** | |
| — spicy-eligible (subtlety 3–5) | 26 | |

The brief cites 58% lexical; by `Rule.family` it is **79%**. (58% is roughly the
three named templates — `starts-with` + `ends-with` + `hidden-word` = 98/168 =
58% — so both numbers are real, but the family split is the one a family cap
acts on.)

Now apply the proposed cap against `schedulePuzzles.ts`'s existing
`RULE_SPACING_DAYS = 60`:

```
60-day window                        ≈ 60 days
minus Saturdays (spicy)              ≈ 51 medium days
lexical capped at 2/week             ≈ 17 lexical slots
semantic demand                      ≈ 34 medium days
distinct medium-eligible semantic     = 27 rules
```

Each rule may be used **once per 60 days**. Demand is 34; supply is 27.

**The cap cannot be satisfied.** The scheduler would exhaust the semantic pool
and skip dates — and `schedulePuzzles.ts` already skips a date with a warning
when the correct-tier pool is empty, so the observable failure is **gaps in the
calendar**, i.e. days with no puzzle.

Feasible cap today, solving for supply: lexical must cover ≥24 of 51 medium
days ≈ **3.3/week**.

## Recommendation

**Ship the throttle at 3/week now, make it a constant, and lower it to 2 once
semantic supply passes ~34 medium-eligible rules.** The mechanism is identical;
only the number changes, and the number is where the risk lives.

Growing supply is already tractable — `buildRuleParams.ts` promotes any category
clearing 25 tagged words, so tagging more words in near-threshold categories
converts directly into new semantic rules. Worth measuring which categories sit
just under the floor before picking the target.

**A generation-side quota is required alongside the scheduler cap.** The
scheduler can only draw from the approved pool. If generation keeps producing
79% lexical, a scheduler-side cap starves rather than rebalances — the correct
lever is `KnobValues.semanticRuleWeight` (already 0.5 medium / 0.3 spicy in
`difficulty.ts`), raised so the *approved pool* matches what the scheduler wants
to place. Capping only at schedule time is the failure mode to avoid.

## Implementation

`content-engine/scripts/schedulePuzzles.ts` already tracks `Placement[]` and
filters via `isFreshFor` — the cap belongs in the same predicate:

```ts
/** Max lexical-family puzzles per rolling 7-day window.
 *
 * 3, not 2, deliberately: only 27 medium-eligible semantic rules exist against
 * RULE_SPACING_DAYS = 60, and a 2/week cap needs ~34 — the scheduler would run
 * out of semantic puzzles and leave calendar gaps. Lower this to 2 once
 * medium-eligible semantic rules exceed ~34. */
const MAX_LEXICAL_PER_WEEK = 3

/** Rolling window, not calendar weeks — a Mon-Sun reset lets 3 land Fri-Sun and
 *  3 more Mon-Tue, which is 6 in five days and defeats the cap. */
const LEXICAL_WINDOW_DAYS = 7
```

`Placement` needs the family alongside `ruleId` / `templateId`. Resolve it from
`RULES` by `ruleId` at load time — `PuzzleDoc` stores `ruleId` and `templateId`
but not `family`, and adding a denormalised copy isn't worth it for a script that
already has the taxonomy in memory.

Then extend `isFreshFor` (or add a sibling predicate) to reject a candidate whose
placement would make lexical placements within ±`LEXICAL_WINDOW_DAYS` exceed the
cap. The existing "walk forward, skip the date with a loud warning" behaviour is
the right fallback and needs no change.

**Emit a summary at the end of the run** — placed per family, dates skipped, cap
hits. Without it, a starving scheduler looks like a working one until someone
notices the gaps.

### Files touched — Phase 4

| File | Change |
|---|---|
| `content-engine/scripts/schedulePuzzles.ts` | Cap constants, family on `Placement`, predicate, summary |
| `content-engine/generator/difficulty.ts` | Raise `semanticRuleWeight` (paired change) |
| `content-engine/generator/difficulty.test.ts` | Update weight expectations |

### Risks — Phase 4

- **Calendar gaps** — the headline risk, and the reason for 3 over 2. The
  end-of-run summary makes it visible immediately.
- **Cap without quota starves.** Land the `semanticRuleWeight` change together
  with the cap, not after.
- **Semantic ≠ higher quality.** The brief treats semantic as higher-value, which
  is right on average — but a well-built `hidden-word` puzzle beats a thin
  category puzzle. `aha` already encodes per-rule quality; the family cap is a
  blunter instrument layered on top. Watch reject rates by family after landing,
  and be willing to lean on `aha` instead.
- **Spicy is worse off than medium** (26 semantic eligible). If the cap applies to
  both tiers, verify Saturdays independently.

### Testing — Phase 4

- Unit: `isFreshFor` rejects a 4th lexical within 7 days, accepts the 3rd.
- Unit: rolling-window correctness — 3 placed Fri/Sat/Sun blocks Mon.
- Integration: schedule 90 days against a realistic approved pool; assert **zero
  skipped dates** and that lexical share falls to ≈43% (3 of 7).
- Supply guard: a test asserting medium-eligible semantic rule count ≥ the number
  the cap implies, failing loudly if the taxonomy shrinks below what the cap
  needs.
- Manual: run against the real approved pool and read the summary before
  committing dates.

---

# Cross-cutting

## Verification (run after every phase, per CLAUDE.md)

```bash
npm run typecheck:content-engine && npm run typecheck:netlify-functions && npx tsc --noEmit
npx vitest run
npm run lint
```

End-to-end after Phases 1–2:

```bash
npm run content:generate -- 40
```

Then read `content-engine/output/candidates.md` and confirm: IN-minority pools
appear, no pool is 6:0 or 0:6, no trap word below 0.4, accepted collisions are
annotated with their kind and reveal rule.

Admin flow after Phase 3 — `npm run dev:functions`, then refine a real puzzle
with written feedback and confirm it succeeds and respects the instruction.

## Sequencing note

Phase 1's wider splits raise collision probability; Phase 2 raises collision
tolerance. **Landing Phase 2 first** avoids a temporary spike in repair/reject
rate that would otherwise look like a Phase 1 regression.

## Locked decisions this plan touches

Per CLAUDE.md, `planning.md`'s 🔒 markers are constraints, not defaults:

- **§7.3 uniqueness validator** — Phase 2 relaxes it. This is a genuine change to
  a locked decision, narrowed to provably-near-equivalent rules, and it needs
  sign-off rather than being treated as an optimisation.
- **Server-authoritative correctness** — unaffected. `revealRuleId` resolves
  server-side; no client contract changes.
- **Reveal text** — Phase 2 can now show a rule other than the generating one.
  Reviewers must see the same text players will (`adminPuzzleDetail.ts`).

## Out of scope

Word bank expansion, new rule templates, and the untapped `LetterFeatures` fields
(`vcPattern`, `firstLetter`, `lastLetter`, `consonantCount`) — except where Phase
4's supply problem argues for growing semantic coverage, which is called out
there but not planned here.

---

# Appendix A — how the numbers were measured

All figures were produced against `main` at 15,044 words / 168 rules by driving
the real pipeline (`draftClueSet` → `scanDecoys` → `selectGuestPool`) directly
and inspecting the results, rather than by reading the code alone.

| Figure | Method | n |
|---|---|---|
| IN:OUT splits (3:3, 4:2 only) | `generateCandidate`, tally `trueLabel` | 24 |
| Collision rate 15.0%; 32/32 board-isomorphic | First-pass boards, pre-repair collision scan | 187 |
| Jaccard buckets and named pairs | Bank-wide IN-set overlap per colliding pair | 32 |
| Trap frequency (39.3% <0.6, 18.0% <0.4) | `trapType === 'decoy'` selections | 61 |
| Family split 79/21, eligibility 27/26 | Direct taxonomy count by `family` + subtlety window | 168 |

**Caveats:** the collision thresholds rest on n=32 and should be re-derived on a
larger sample before being treated as tuned. Split and trap figures are stable
(they reflect deterministic code paths). The 0.6/0.95 constants in Phase 2 are
starting points, deliberately exported for tuning.
