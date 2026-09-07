# Rule Expansion & Year-One Longevity — Implementation Plan

Goal: run daily puzzles for a year without the game feeling repetitive, and cut
the review burden by generating fewer bad puzzles in the first place.

Every figure below was measured against the live taxonomy, the 15,044-word bank
and the real `puzzles` collection. Commands are in [Appendix A](#appendix-a--how-the-numbers-were-measured).

---

## The situation, in numbers

**Capacity is not the problem.**

```
1 year          = 313 medium days + 52 spicy days
medium capacity = 127 eligible rules x 6.1 reuses (60-day spacing) = 762 slots
spicy capacity  =  88 eligible rules x 6.1                         = 528 slots
```

You could run a year today. Two things stop it feeling good:

**1. The taxonomy is one idea wearing many hats.** Medium-eligible rules by
template:

```
ends-with 38 | starts-with 35 | category 24 | hand-written 19 | word-length 8 | part-of-speech 3
```

**73 of 127 are "look at the letters at one end of the word."**

**2. Reviewer time is being spent almost entirely on those.** Rejection rate by
template, across every puzzle ever generated:

| template | created | rejected | rate |
|---|---|---|---|
| starts-with | 26 | 23 | **88%** |
| part-of-speech | 6 | 5 | 83% |
| ends-with | 35 | 28 | **80%** |
| category | 37 | 17 | 46% |
| hand-written | 9 | 3 | 33% |
| hidden-word | 4 | 1 | **25%** |

`starts-with` + `ends-with` account for **51 of 79 total rejections**. That is
the review burden, and it is generated on purpose by rules rated as if they were
average.

---

## The finding that reframes everything

**Your best template is locked out of six days a week.**

`hidden-word` has the lowest rejection rate of anything (25%) and is rated
`aha: 4`. All 25 of its rules sit at subtlety 4–5, so they are **spicy-only** —
they can only ever appear on Saturdays. Meanwhile `ends-with` (80% rejected) is
rated `aha: 3` and fills medium days all week.

The ratings do not match the evidence. Fixing that is free — no new content, no
new data, no new code beyond edited numbers.

**A second consequence:** `MAX_LEXICAL_PER_WEEK` caps on the
lexical/semantic *family*, but family is the wrong axis. `hidden-word` is
lexical and excellent; `starts-with` is lexical and poor. The cap currently
penalises both equally, which is why promoting `hidden-word` into the medium
window would immediately collide with it. **The cap should key on quality
(`aha`), not family.**

---

# Phase 1 — Re-rate what already exists

No new data. Highest value per line changed in the whole plan, and it directly
reduces review load.

| rule set | now | change to | why |
|---|---|---|---|
| `starts-with` (35) | `aha: 2` | **`aha: 1`** | 88% rejected — becomes rare filler via `pickTrueRule`'s `aha / (1 + rejectCount)` weight |
| `ends-with` (38) | `aha: 3` | **`aha: 1`** | 80% rejected |
| `part-of-speech` (3) | `aha: 3` | **`aha: 1`** | 83% rejected |
| `hidden-word` (25) | subtlety 4–5 | **subtlety 3** | 25% rejected, the best material you have; subtlety 3 is medium- *and* spicy-eligible |
| semantic rules rated 4–5 (9) | subtlety 4–5 | **subtlety 3** where fair | grows medium-eligible semantic supply from 27 toward the 35 the cap needs |

**Effect:** medium-eligible quality rules roughly double, the two worst
templates stop dominating, and the semantic shortfall closes without tagging a
single new word.

**Files:** `content-engine/rules/generatedRules.ts` (template `aha` defaults),
`content-engine/rules/ruleParams.ts` is generated — do not hand-edit; ratings
live with the factories.

**Risk:** demoting 73 of 127 medium rules to filler could starve the pool. It
should not — Phase 1 simultaneously *adds* 25 hidden-word rules to medium — but
verify with a 40-puzzle batch before committing, and check the scheduler summary
for skipped dates.

**Tests:** assert no template is rated above `aha: 2` while its historical
rejection rate exceeds ~70%; assert medium-eligible count stays above the
scheduler's needs.

---

# Phase 2 — Cap on quality, not on family

`content-engine/scheduling/placement.ts` currently throttles
`family === 'lexical-structural'`. Replace that axis with `aha`:

```ts
/**
 * Cap the FILLER, not the family. Rejection data says family is the wrong
 * axis: hidden-word is lexical and the best template there is (25% rejected),
 * while starts-with is lexical and the worst (88%). Rating already encodes
 * that difference — the cap should read it rather than a structural label.
 */
const MAX_LOW_AHA_PER_WEEK = 2
const LOW_AHA_THRESHOLD = 2  // aha <= 2 is filler
```

`isLexicalRule` becomes `isFillerRule(ruleId)`, reading `aha ?? 3`.

**Why 2 rather than 3:** after Phase 1 the good-rule pool is much deeper, so the
cap can be tighter than the current soft-breaching 3. Re-derive from the
sustainable-rate formula in `placement.ts` once Phase 1 lands — do not guess it.

**Keep:** the soft-cap behaviour. An empty calendar day is still the worst
outcome (planning.md §9.2), so `selectForDate` should still place a filler
puzzle over leaving a gap, and still report it.

**Files:** `content-engine/scheduling/placement.ts`, `placement.test.ts`
(the existing 90-day simulation becomes the check that this actually improves
the mix).

---

# Phase 3 — The sound family

A genuinely new axis. Every rule today is **spelling** or **meaning**; none is
**sound**. This is the expansion that makes a year feel varied rather than
longer.

## Verified before planning

`cmu-pronouncing-dictionary` (135,155 entries) against the word bank:

```
coverage: 14,669 / 14,964 words = 98.0%
```

| family | measured | verdict |
|---|---|---|
| syllable count | 1 syl 3,172 · 3 syl 3,431 · 4 syl 1,326 · 5 syl 273 | **4 rules.** 2-syllable is 43% of the bank — too broad, excluded |
| has silent letters | 835 words (≥3 more letters than phonemes) | **1 rule.** Strong aha: *cheese, journey, bouquet, scissors* |
| is a homophone | 640 words, 309 pairs | **1 rule.** *great/grate, peace/piece, throne/thrown, pear/pair* |
| rhymes with X | 96 param values clear the coverage floor | **~20–30, curated.** See below |
| starts-with-sound | 33 clear the floor | **rejected — see below** |
| ends-with-sound | 28 clear the floor | **rejected — see below** |

## What I am deliberately NOT building

**`starts-with-sound` and `ends-with-sound` (61 rules).** They clear every
mechanical check, and they are exactly the puzzle you just said you have too
much of — "which letter is at the end", with an extra layer of confusion because
the sound and the spelling disagree. Adding 61 of them would undo Phase 1.
The coverage floor cannot tell a boring rule from an interesting one; that
judgment is the point of this section.

**Most `rhyme` values.** The largest groups (`-IY` 1,565 words, `-ER` 1,202,
`-IHNG` 1,047) are just "ends in -y / -er / -ing" wearing a phonetic costume.
Take the *tighter* groups, where the rhyme is a real observation rather than a
suffix. Set a ceiling well below the generic 35% — something like 400 words —
and hand-check the survivors.

**Realistic total: ~30 rules**, all on an axis the game has never used. Not 163.

## The architectural decision that matters

**Phonetics must be precomputed into the word bank, not looked up at runtime.**

`RULES` is imported by Netlify Functions (`scheduled-generate-puzzles`,
`admin-ai-review`, the validator). A rule whose `evaluate()` calls into a
135k-entry dictionary would drag that dictionary into every function bundle.

Instead, follow what `features.ts` already does for letters: add a `phonetics`
block to `Word`, populated at bank-build time.

```ts
// content-engine/words/types.ts
export interface Phonetics {
  /** ARPAbet phonemes, stress digits stripped. Empty when CMUdict has no entry (2% of the bank). */
  phonemes: string[]
  syllables: number
  /** Last vowel phoneme onward — the rhyme key. */
  rhyme: string | null
}
```

`cmu-pronouncing-dictionary` stays a **devDependency**: it is a build-time input
to the bank exactly like WordNet and SUBTLEXus already are, and never ships.

**Every sound rule must handle the 2% with no pronunciation.** Treat a missing
entry as "does not match" — never as a coincidental match, or those words become
silent wrong answers.

**Files:** `content-engine/words/types.ts`, `features.ts` (or a new
`phonetics.ts`), `content-engine/scripts/expandWordBank.ts` (regenerates
`bulkSeedWords.ts` with the new block), `content-engine/rules/generatedRules.ts`
(the new factories), `scripts/buildRuleParams.ts` (sweep rhyme/syllable params).

**Tests:** known pronunciations (`cheese` has silent letters, `great`/`grate`
are homophones, `banana` is 3 syllables); a word absent from CMUdict is OUT for
every sound rule; no sound rule exceeds the breadth cap.

---

# Phase 4 — Cheap filler from data you already compute

`LetterFeatures` computes these on all 15,044 words and **no rule reads them**:
`vcPattern`, `consonantCount`, `firstBeforeLastAlpha`, `subsequenceHits`
(only `ace` is used).

Worth ~10–20 rules for near-zero effort, but rate them **`aha: 2`** on arrival —
they are structural observations, the same class as the templates Phase 1 just
demoted. They exist to pad the filler slots, not to carry a week.

Also: two categories sit just under the promotion floor — `shape` (19/25) and
`jewelry` (18/25). Tagging ~7 words each promotes both automatically via
`buildRuleParams`.

---

# Phase 5 — Review throughput

Generation and scheduling are automated; **review is the only human step and the
thing most likely to end this project quietly.** planning.md locks the
human-approve stage, so the goal is fewer decisions and faster ones — never
removing the gate.

- **Phases 1–3 are themselves the biggest win.** If `starts-with` and
  `ends-with` stop filling the queue at an 80–88% rejection rate, most of the
  reviewing simply stops existing.
- **Bulk actions in the admin list.** Reviewing 30 in a sitting is sustainable;
  one a day is not. Keyboard shortcuts (approve / reject / next) turn a
  click-and-scroll into a keystroke.
- **Sort the pending queue by expected quality** (`aha`, historical rejection
  rate for that rule) so the obvious approvals come first and attention lands on
  the genuinely marginal ones.
- **Watch the reject rate per template after Phase 1** — `resolveRejectCounts`
  already collects this. If a newly-promoted template starts rejecting above
  ~50%, its rating was wrong and should move again. The data is the feedback
  loop; this plan is just its first iteration.

---

# Verification

After each phase:

```bash
npm run typecheck:content-engine && npm run typecheck:netlify-functions && npx tsc --noEmit
npx vitest run
npm run lint
```

After Phase 1 and again after Phase 3:

```bash
npm run content:build-rule-params   # re-sweep; new params promote automatically
npm run content:generate -- 40      # then read content-engine/output/candidates.md
```

Confirm by inspection: the mix is no longer dominated by starts-with/ends-with,
`hidden-word` appears on medium days, and no puzzle shows "Live decoys: none".

**The honest measure of success is the rejection rate**, not the rule count. Run
a real review session after Phase 1 and compare against the 80–88% baseline
above. If it has not moved, the ratings are still wrong and more rules will not
help.

---

# Appendix A — how the numbers were measured

| figure | method |
|---|---|
| 762 / 528 slot capacity | eligible rule counts × `365 / RULE_SPACING_DAYS` |
| rejection rates by template | every doc in `puzzles`, grouped by `templateId`, counting `status: 'rejected'` (n=119) |
| `aha` distribution | direct count over `RULES` |
| CMUdict coverage 98.0% | `dictionary[spelling]` over the non-blocked bank |
| syllable / rhyme / homophone counts | phoneme parsing, filtered by the same floor (25) and ceiling (35%) `buildRuleParams` uses |

**Caveat, stated plainly:** the rejection rates rest on 119 puzzles total, and
`word-length` (100%) and `hidden-word` (25%) have samples of 2 and 4. The
`starts-with` and `ends-with` figures (26 and 35) are solid enough to act on;
the small ones are directional. Re-check after the next review session.
