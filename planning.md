# The Bouncer — Game Design & Technical Planning Doc

> **Status:** Living document. Working title only — see [§10 Open Questions](#10-open-questions--future-ideas) for naming.
> **How to read this doc:** 🔒 = locked decision, do not change without discussion. 💡 = suggested default, change freely. Everything else is neutral framing/explanation.

---

## Table of Contents
1. [Overview & One-Line Pitch](#1-overview--one-line-pitch)
2. [Design Pillars](#2-design-pillars--core-philosophy)
3. [Game Loop & Rules](#3-game-loop--rules)
4. [Difficulty Model & Weekly Calendar](#4-difficulty-model--weekly-calendar)
5. [UI/UX Theme & Screen Flow](#5-uiux-theme--screen-by-screen-flow)
6. [Scoring, Streaks, Sharing, Leaderboards](#6-scoring-streaks-sharing-leaderboards-aggregate-stats)
7. [Rules & Word-Selection Engine](#7-rules--word-selection-engine)
8. [Tech Stack & Architecture](#8-tech-stack--architecture)
9. [Content Operations](#9-content-operations)
10. [Open Questions & Future Ideas](#10-open-questions--future-ideas)

---

## 1. Overview & One-Line Pitch

🔒 **The Bouncer** is a daily word puzzle where players infer a single hidden rule from example evidence, then apply that inferred rule to sort a fresh batch of words — with zero feedback until they commit.

**One-liner:** *"Wordle for pattern-detectives — figure out who gets in, before you find out why."*

**What it is not:**
- Not Connections (no partitioning a fixed set into groups you're told exist).
- Not a deduction puzzle with progressive feedback (no Wordle-style per-guess signal).
- Not a trivia game — most rules are structural/lexical, not "do you know this fact."

The player's task, every day, is genuinely scientific-method-shaped: observe examples → form a hypothesis → test it one guest at a time, with each guess confirmed immediately and a limited margin for error. That's the whole game, and its simplicity is the point.

---

## 2. Design Pillars / Core Philosophy

> **Revised 2026-08-08:** superseded the original single-blind-submission, no-lives model. The player now gets immediate feedback per guest and plays under a 3-life limit — see §3 for the current flow. Pillars 1–3 below reflect this revision; the original all-at-once model is no longer current behavior.

🔒 These are locked and should resolve any future design debate:

1. **Induction, not deduction.** The player forms a theory from the fixed clue evidence, then tests and refines it as they go — each swipe's result is a new, real data point they can reason with, not just the original clues. This is still induction (updating a hypothesis as new evidence arrives is standard inductive reasoning), just sequential rather than one-shot; it is not a "guess the password" deduction game.
2. **Many small commitments, real stakes.** Each swipe is one-shot and no-retry for that specific guest — once attempted, it resolves and can't be re-attempted. But mistakes carry a running cost: 3 wrong swipes and the day's puzzle ends early (see §3.3). This is a deliberate departure from a fully-forgiving model — without a real cost to being wrong, a player could swipe every guest one direction, read the auto-corrections as a free answer key, and finish every day with a perfect board without ever actually reasoning about the rule. The life limit keeps the inference honest.
3. **Score, not pass/fail — but not consequence-free either.** There's still no big binary "YOU LOSE" screen, and the player always gets a score and share card, even on an early lives-out ending. But running out of lives is a real, meaningful outcome — the player doesn't get to see or attempt the rest of the pool. It's closer to Wordle's "you get one board, and it can end before you've seen everything" than a purely forgiving model, and the doc should be honest about that rather than glossing over it.
4. **The rule is the product.** Everything in content design (§7) serves making rules that are fair, inferable, and satisfying to have "gotten" — even when you didn't clear the whole pool.
5. **Chill, not cutthroat.** 💡 Suggested framing: competitive difficulty (hard puzzles, real stakes) paired with a soft, friendly tone — difficulty lives in the puzzle content and the life limit, not in punishing UI/copy. This applies with extra force to the lives-out ending specifically (see §5.2) — it should read as calm and matter-of-fact, not alarming.

---

## 3. Game Loop & Rules

🔒 Full flow, locked:

### 3.1 Setup phase — "the evidence"
- Player is shown pre-sorted example guests: a small set already marked **IN**, a small set already marked **OUT**.
- 💡 Suggested default: **3 IN + 3 OUT** (6 total clues). Tunable per-puzzle by the generator (see §7.4 difficulty knobs) — a given day could ship with 2+2 or 4+3 if that serves the rule better.
- These are shown as fixed, labeled, non-interactive — they are evidence only, never touched by the player.

### 3.2 Sorting phase — "the pool"
- A pool of new word-guests is shown, **all visible at once** (no progressive reveal, no timer pressure to see them, no one-at-a-time card stack) — the player needs to see the whole pool to reason about it, so this stays locked regardless of the interaction change below.
- 💡 Suggested default: **6 guests** in the pool. Tunable (see §7.4).
- The player picks **any** unresolved guest from the visible pool, in any order they choose, and swipes it toward IN or OUT.
- That swipe is checked immediately and the guest resolves on the spot:
  - **Correct** — the card stays put, confirmed.
  - **Incorrect** — the card visibly shows wrong, then auto-corrects into the other bin (e.g., swiping "ice" to IN when it's actually OUT shows wrong and auto-moves it to OUT).
- Each guest gets **exactly one swipe attempt** — once resolved (correct or auto-corrected), it's no longer interactive. There is no rearranging or re-attempting a guest after its one swipe.

### 3.3 Lives
- 🔒 The player has **3 lives** per puzzle, resetting daily with the new puzzle.
- A wrong swipe costs one life, in addition to auto-correcting the card (§3.2).
- 🔒 On the **3rd wrong swipe, the round ends immediately** — even if guests remain unattempted in the pool. This exists specifically to make blind brute-forcing costly: without it, a player could swipe every guest one direction and read the auto-corrections off as a free answer key, finishing every day perfectly without ever reasoning about the rule.
- This directly supersedes the original locked "no feedback prior to submission" and "no lives" rules — those no longer describe current behavior.

### 3.4 Completion
- There is no explicit "lock it in" action anymore. The round ends automatically, whichever happens first:
  - Every guest in the pool has been resolved (with 0–2 wrong swipes used), or
  - The 3rd wrong swipe happens and lives hit 0.
- Reveal triggers immediately on either ending.

### 3.5 Reveal phase
On completion, all at once:
- The rule is revealed **in plain text** (e.g., "IN: the word contains a doubled letter").
- Every guest in the pool is shown in one of three states against the true rule: **correct on the player's swipe**, **wrong then auto-corrected**, or — if the round ended early via lives-out — **not reached** (still shown with its true label, for learning, but not counted toward score).
- Score is shown (e.g., **5/6** — see §6.1 for exactly how this is counted under the new mechanic).
- 🔒 No bonus, badge, or scoring credit for having *named* the rule — that mechanic is fully cut. The game never asks the player to state the rule; it only ever asks them to sort.
- Spoiler-safe share card is generated (see §6.2) and streak is updated.

### 3.6 Non-negotiables recap
- Immediate feedback on every swipe, one swipe per guest with no retry, auto-correction on a wrong swipe, a 3-life cap that ends the round early on the 3rd mistake, automatic completion (no manual submit), no rule-naming credit, one puzzle per day.

---

## 4. Difficulty Model & Weekly Calendar

🔒 **Target:** average score ~4–5 out of 6 (score = correct-on-first-swipe count, per §6.1). Most players should *not* get a perfect score. "Medium" = medium-hard.

At this target, a typical engaged player misses only 1–2 guests, well under the 3-life cap (§3.3) — hitting 0 lives is expected to be rare for someone actually reasoning about the rule, and mostly catches players who are guessing near-randomly or brute-forcing. The life cap is a brute-force deterrent, not a trap tuned for normal play.

🔒 **Calendar:** one special hard day per week — **Spicy Saturday** (subtler rule, more ambiguous words). Every other day is medium (still meaningfully challenging, not a warm-up day).

💡 Suggested default weekly shape (change freely):

| Day | Difficulty | Notes |
|---|---|---|
| Mon–Fri | Medium | Standard mix of difficulty levers (§7.3) |
| Sat | **Spicy** | Subtler rule tier + higher ambiguous-guest count |
| Sun | Medium | 💡 Could alternatively be "gentle medium" as a weekly cooldown — open question, see §10 |

Difficulty is *not* implemented as separate game mechanics (no timer, no lives-based hard mode) — it's entirely a content property of the puzzle itself, produced by the generator's knobs (§7.4). This keeps the app simple and puts all difficulty tuning in one controllable place (the content pipeline), which matters a lot for iteration speed post-launch.

🔒 **Difficulty priority order** (from the spec, locked):
1. **Subtle/abstract rules** — highest-priority lever. A rule like "second letter is a vowel" is harder than "starts with the letter S."
2. **Tricky words that plausibly fit a decoy rule** — the PRIMARY ambiguity lever. This is where most of the actual difficulty engineering happens (see §7.2, the core craft section).
3. **Near-miss decoy examples in the clues** — secondary lever; used to nudge players toward a wrong hypothesis during the evidence phase itself.

---

## 5. UI/UX Theme & Screen-by-Screen Flow

### 5.1 Theme direction

🔒 **New direction, locked:** light, colorful, simple, chill, friendly. Soft, approachable, roomy, rounded, playful but uncluttered — the feel of an everyday daily game (think: the emotional register of Wordle/Duolingo-adjacent daily games, not a puzzle-box or escape-room aesthetic).

🔒 **Explicitly deprecated:** the earlier prototype's dark/nightclub aesthetic (deep aubergine + brass + velvet-rope motif). Do not carry this into art direction, copy, or iconography. Avoid leaning on bouncer/nightclub/velvet-rope visual or verbal theming generally — "The Bouncer" is a provisional working title, not a creative brief for the visuals.

💡 Suggested fresh signature moment (replace the velvet-rope idea): **a card that snaps satisfyingly into a bin** when placed — tactile, tray/inbox-like rather than club-door-like. Two soft rounded bins/trays (IN and OUT) sit side by side or stacked; swiping or tapping a guest card sends it home with a small snap/settle animation (subtle haptic on mobile). This gives the game a distinct physical "feel" without requiring any nightclub metaphor. Alternative directions to consider later: a mail-sorting motif (two trays), a garden motif (two beds — "keep" and "compost"), or fully abstract (two colored zones, no metaphor at all). Pick one and commit — mixing metaphors would undercut the "simple" pillar.

This moment now carries more weight under the live-feedback loop (§3.2–3.3): a correct swipe is a confident, satisfying snap into the chosen bin; a wrong swipe is a visible "nope" beat, then the card sliding/bouncing into the *other* bin, paired with a life lost. To be clear on the interaction itself: "swipe" means a gesture applied to whichever card the player has selected from the fully-visible pool — not a sequential, one-card-at-a-time stack (that would reintroduce the low-context problem the "all visible at once" rule in §3.2 exists to avoid).

💡 Suggested visual language:
- **Palette:** a small set of soft, high-contrast-enough-for-accessibility pastel/mid-tone colors; one warm "IN" color, one cool-but-not-alarming "OUT" color (avoid pure red/green only pairing — colorblind-safe pairing needed, e.g. teal/orange or blue/amber rather than red/green, or always pair color with an icon/shape).
- **Typography:** a friendly rounded sans-serif for headlines, a clean legible sans for word cards (word legibility matters more than personality here — the words themselves are the puzzle content).
- **Motion:** snappy, short (150–250ms) easing; nothing that delays the player from sorting quickly.
- **Density:** generous whitespace/padding; this is a "spend 90 seconds, feel good" game, not a data-dense utility.

### 5.2 Screen-by-screen flow

💡 Suggested default flow (structure, not final copy/visuals):

1. **Start / Home screen**
   - Today's date, puzzle number (e.g., "#142"), current streak, a single primary CTA ("Play today's puzzle").
   - If already played today: shows today's result summary + share card instead of replay (standard daily-game pattern — prevents retry-farming for a better score).
   - Secondary entries: streak/stats, leaderboard, settings, how-to-play.

2. **How to play (first-time / on-demand)**
   - Short, visual, 3–4 steps: "Some guests are already sorted," "Figure out why," "Swipe each new guest IN or OUT — you'll find out right away," "3 wrong swipes and the day ends, so make them count."
   - State the 3-life limit plainly upfront — players need to know the stakes going in, not discover them mid-round.

3. **Evidence screen (clues)**
   - IN examples and OUT examples clearly, persistently visible — likely as two labeled zones at the top or side, non-interactive, visually "locked" (e.g., slightly recessed/pinned styling to signal "you can't touch these").
   - Transition control to move to sorting (or the evidence stays visible/pinned throughout sorting — 💡 recommended, since re-reading the clues while sorting is core to the inference task and hiding them would hurt, not help, difficulty).

4. **Sorting screen**
   - Evidence zones (pinned, from step 3) + the new guest pool, all guests visible at once, + two target zones (IN / OUT) matching the evidence zones' styling so the visual mapping is obvious.
   - A visible **lives indicator** (e.g., 3 small pips/hearts) that loses one on each wrong swipe.
   - Player swipes (or drags/taps, per platform — same interaction options as before) any unresolved guest toward IN or OUT; it resolves immediately with a right/wrong signal, per §3.2–3.3. Resolved guests become non-interactive and visually settle into their bin.
   - 💡 Open default (not locked): whether to also show a running "3/5 so far" correct tally alongside the lives indicator, or keep it to just the lives count — flagged in §10.
   - The screen itself ends automatically per §3.4 (all guests resolved, or lives hit 0) — no separate submit control.

5. **Reveal screen**
   - Rule stated in plain text at the top.
   - Guest pool re-shown with each guest in one of three states: correct-on-swipe, wrong-then-corrected, or (if the round ended early via lives-out) not-reached — each showing its true IN/OUT status so the player can see *why*.
   - Score (e.g., 5/6), streak update, and the share card generation.
   - If the round ended via lives-out, the tone should read calm and matter-of-fact ("Out of guesses for today — here's how it went"), not punishing, per pillar 5 (§2).
   - CTA to share, and a soft nudge toward tomorrow ("Come back tomorrow for puzzle #143").

6. **Share card (generated, spoiler-safe)**
   - See §6.2 for exact content rules.

7. **Stats / Leaderboard screens**
   - Personal stats: streak, average score, score distribution history, puzzles played.
   - Leaderboard: see §6.4 for what's actually rankable given the score-not-pass/fail model.

---

## 6. Scoring, Streaks, Sharing, Leaderboards, Aggregate Stats

### 6.1 Scoring

🔒 Score = number of guests placed correctly out of the pool size (e.g., 5/6) — specifically, correct **on the player's one swipe attempt for that guest** (§3.2–3.3). Incorrect-then-auto-corrected swipes don't count toward the score even though the guest ends up in the right bin, and guests never reached because lives ran out (§3.3) don't count as correct either. No partial credit beyond correct-count; no time bonus; no rule-naming bonus.

### 6.2 Sharing

🔒 Spoiler-safe share card, locked requirements:
- Squares representing each guest's outcome, in guest order, now with **three states**: correct-on-swipe (green), wrong-then-corrected (red), and not-reached-due-to-lives-out (grey/neutral, only appears on an early-ended round) — colorblind-safe equivalents per the §5.1 palette note.
- Score (e.g., "5/6").
- Streak.
- 🔒 The actual rule text must **never** appear on the share card — friends who haven't played yet must still be able to play unspoiled.
- 💡 Suggested additions: puzzle number/date, and a link back to the game. Format as a compact text block (Wordle-style emoji grid) for easy paste into chat apps, plus an image-card version for platforms that render images (stories, etc.) — 💡 build the text version first since it's far cheaper and covers most sharing surfaces (iMessage, WhatsApp, Twitter/X text).

### 6.3 Streaks

💡 Suggested default: a streak increments on any day played (regardless of score, and regardless of whether the round completed the full pool or ended early via lives-out per §3.3–3.4 — "did you play" is the only sensible streak condition), and resets on a missed day. 💡 Consider a "streak freeze"/grace mechanic later (common in this genre) — flag as a post-launch retention lever, not core.

### 6.4 Leaderboards

🔒 Backend must support a leaderboard (locked in spec as a required light-backend feature). 💡 Suggested shape, since raw score alone (out of 6) will have huge ties: a **friends/social leaderboard** (compare with people you know, ranked by streak length + cumulative or rolling-average score) is likely more meaningful than a global leaderboard, where a 6-guest score range creates massive ties among potentially millions of players. 💡 Suggested default: ship a friends-code/share-based leaderboard first (low infra cost, high relevance), consider global leaderboard only as a future nice-to-have, likely ranked by streak with score-average as tiebreaker.

### 6.5 Aggregate stats

🔒 Backend must support anonymized aggregate stats (e.g., "X% of players cracked today's rule"). 💡 Suggested default definition of "cracked": a perfect run — 6/6 correct on first swipe, i.e., never lost a life (§3.3, §6.1) — shown as a daily percentage once the player has finished their own puzzle (avoids leaking difficulty signal before they've committed). This is a meaningful, non-trivial bar under the live-feedback model: it specifically means a true zero-mistake clear, not just "eventually got everything right" (which the auto-correct mechanic makes true of nearly every completed round). Additional 💡 aggregate stat ideas: average score today, per-guest "% who got this one right" (this is a nice piece of retrospective texture on the reveal screen — shows which specific guest was the most-missed "gotcha").

---

## 7. RULES & WORD-SELECTION ENGINE

This is the core logic of the entire game. Everything else in the app is presentation around what this section produces: a valid, fair, appropriately-difficulty-calibrated **(rule, clue set, guest pool)** triple for a given day.

### 7.1 Starter Rule Taxonomy

Rules split into two families. Both families need to be representable in the word bank (§7.5) with enough structured metadata that candidate words can be mechanically tested against a rule.

#### 7.1.1 Lexical / structural rules
Rules that can be checked purely from a word's spelling/orthography — no external knowledge needed. These are the easiest to generate and validate programmatically, and should form the backbone of the rule set.

- **Doubled letter:** contains a repeated adjacent letter (e.g., *bubble, letter, spoon*).
- **Same start/end letter:** first and last letter match (e.g., *canoe, adenoid, level*).
- **Contains a specific letter (or letter avoiding a specific letter):** e.g., "contains a Q" or, more subtly, "contains no vowel other than E."
- **Letter-count / length patterns:** exactly N letters; even vs. odd length; length is prime; etc.
- **Vowel/consonant patterns:** starts with a vowel; contains exactly two vowels; no two vowels are adjacent; vowels and consonants strictly alternate.
- **Hidden smaller word:** contains a specific short word as a substring (e.g., contains "AT": *cat, plateau, chateau*) — or more subtly, contains a hidden number, color, or body part as a substring (e.g., "ONE" in *money, honest, prone*).
- **Alphabetical properties:** letters appear in alphabetical order somewhere in the word; first letter comes before last letter alphabetically; contains a letter that is also a Roman numeral (C, D, I, L, M, V, X).
- **Positional letter rules:** third letter is a vowel; second-to-last letter is a consonant.
- **Anagram/rearrangement properties:** letters can be rearranged into another valid word; contains all the letters of a shorter fixed word in order (not necessarily adjacent) — subsequence rules.
- **Symmetry:** the word (or its first half) is a palindrome-like shape; word reversed contains a real word.

#### 7.1.2 Semantic / knowledge rules
Rules that require knowing what a word *means* or *refers to*, not just how it's spelled. These are riskier (need a well-tagged word bank, risk of cultural/regional ambiguity) but add welcome variety and a different "aha" feeling than the lexical rules.

- **Category membership:** all IN words are, e.g., fruits, tools, weather phenomena, dances, units of measurement.
- **Shared property of the referent:** things that are typically cold; things you'd find in a kitchen; things that can be "broken" (a promise, a record, a bone, a leg — idiomatic breakability); animals that lay eggs.
- **Compound/collocation potential:** words that can follow "sun-" (sunrise, sunflower, sunburn) or precede "-storm" (brainstorm, snowstorm) to form a real compound — this sits between lexical and semantic since it's checkable against a dictionary but requires "does this compound exist" knowledge, not spelling alone.
- **Register/usage:** words that are also common first names; words that are also verbs *and* nouns; words borrowed from another specific language.
- **Number/measurement association:** words that describe or contain an implied quantity (dozen, couple, pair are not just lexical here — they're about meaning).

💡 Suggested default weighting for launch: skew content mix toward lexical/structural rules (~70%) early on, since they're cheaper to generate and validate with high confidence (§7.3), and expand semantic rule coverage over time as the tagged word bank (§7.5) matures and the validator's category data gets more reliable.

### 7.2 Ambiguity Engineering — the core craft

This is the primary difficulty lever (locked priority #2, but in practice the one that separates a good puzzle from a mediocre one — subtlety alone (#1) makes a rule *hard to see*, but ambiguity engineering makes a rule *hard to hold onto once you think you've seen it*, which is where the real "genuinely challenging" feel comes from).

**The mechanism:** every candidate puzzle has one *true rule* (T). The generator must also consider the space of *plausible decoy rules* — other simple, guessable rules (D1, D2, D3…) that a reasonable player might hypothesize from the clue set alone. A puzzle gets meaningfully harder when the generator can find guest words for the pool that:

- **Satisfy T but violate D** (a "true-rule word that looks wrong") — e.g., true rule is "contains a doubled letter," decoy is "starts and ends with same letter"; a guest like *"wheel"* fits T (double E) but would be wrongly excluded by a player following D if *wheel* doesn't also satisfy D. More powerfully: a guest that satisfies T while being a word type the player doesn't expect to be an IN (e.g., visually "boring" words are correct, visually "distinctive" words are wrong — subvert whatever surface pattern the clue set accidentally suggests).
- **Satisfy D but violate T** (a "decoy-rule word that looks right") — a guest that *would* be IN under the decoy hypothesis but is actually OUT under the true rule. This is the single most valuable kind of trick word: it actively punishes players who latched onto D instead of T. E.g., true rule "contains a doubled letter," a plausible decoy from the clues might be "is a long word (7+ letters)"; a guest like *"beautiful"* is long (fits D) but has no doubled letter (fails T) — a player anchored on "long words are IN" places it wrong.
- **Satisfy both T and D** — still useful as a "safe" guest that doesn't discriminate between hypotheses; useful for padding the pool so not every single guest is a trap (an all-traps pool feels unfair/gotcha-y rather than clever — see §7.3 tuning).

**How decoys get identified in practice:** for a candidate true rule T and a candidate clue set, run every *other* rule in the taxonomy (§7.1) against the same clue set. Any rule D≠T that also perfectly separates the IN/OUT clues is a live decoy — it is exactly as well-supported by the evidence as T is, from the player's vantage point, until the guest pool is chosen specifically to break the tie. The generator should keep the top few "still alive after the clues" decoys and *specifically* pick guest-pool words that kill each surviving decoy (satisfy T, violate D) while a minority of guests remain deliberately decoy-compatible-but-wrong (satisfy D, violate T) as the actual traps.

**Trap density is a knob**, not a fixed ratio — see §7.4.

💡 Suggested default: for a medium-difficulty pool of 6, aim for **1–2 "decoy trap" guests** (satisfy a live decoy, violate T) and **1 "T-but-looks-wrong" guest**, with the remainder being cleaner true-rule-consistent examples. For Spicy Saturday, 💡 push toward **2–3 trap guests** out of 6 and/or use a *subtler* true rule where the surviving-decoy list stays large even after the clue set is shown.

Under the live-feedback, 3-life model (§3.2–3.3), falling for a trap now costs more than a lower score — it uses up one of only 3 lives and risks ending the round before the pool is finished. This raises the real stakes of a trap without changing how traps are constructed; the mechanism above is unchanged.

### 7.3 Uniqueness Validation

A candidate puzzle is only valid if **exactly one rule from the rule taxonomy cleanly separates IN from OUT across every shown item** — both the clue set and the full guest pool, evaluated against their *actual* answer key (i.e., including the pool, since the pool's true labels are also fixed even though the player doesn't see them until reveal).

**Why this must include the pool, not just the clues:** the clues alone will almost always be under-determined (with only 3+3 examples, many rules fit by coincidence). That's expected and fine — that's exactly what creates decoys in §7.2. But once the *pool's* correct answers are factored in, if any decoy rule D still perfectly matches the true IN/OUT labels across all 12 items (6 clues + 6 pool guests), then D is not actually a decoy — it's a **second valid rule**, and the puzzle is broken: a player who inferred D instead of T would score 6/6 "for the wrong reason," and worse, there's no way to tell from the outside which rule was "intended," which undermines the plain-text reveal (locked requirement in §3.5) — the reveal would show rule T, but a player following D validly got everything right and would rightly feel cheated by which rule got named.

**Validator algorithm (conceptual, not final code):**
1. Fix the candidate puzzle: true rule T, clue set C (IN_c, OUT_c), pool P with true labels.
2. For every rule R in the taxonomy (R ≠ T), evaluate R against every word in C ∪ P using the word bank's structured features (§7.5).
3. If R's IN/OUT partition of C ∪ P exactly matches T's partition → **reject or repair**: R is a second valid rule, not a decoy. The puzzle is unfair as-is.
4. If R's partition matches T's partition on C alone but diverges somewhere in P → R is a legitimate **decoy** (this is the desired, difficulty-adding case, not a bug) — keep, and note it for the ambiguity-engineering step (§7.2) as a "live decoy that P already resolves."
5. Puzzle passes validation only when step 3 finds zero surviving full-matches across the *entire* rule taxonomy being checked.

**Repair vs. reject:** 💡 suggested default — when step 3 finds a colliding rule R, prefer **repair** first: swap out the specific guest(s) whose labels are collision-causing for alternate words from the word bank that keep T's partition intact while breaking R's, then re-run validation. Only fall back to **reject** (discard the whole candidate, generate a fresh one) if repair can't find a suitable replacement word within some bounded number of attempts. This keeps the generator's yield rate reasonable (see §9) rather than throwing away a mostly-good candidate over one bad guest.

**Coverage caveat, stated plainly:** this validator can only check uniqueness *against the rules the taxonomy actually knows about*. It cannot prove global uniqueness against every conceivable rule in English — that's an open-ended space. 💡 This is an acceptable, standard limitation for this genre (Connections has the same issue in practice) but it means the taxonomy itself (§7.1) is a living asset that should grow over time specifically by *adding rules the validator got blindsided by* — see §9's feedback loop.

### 7.4 Difficulty Knobs

The generator should expose these as explicit, tunable parameters per puzzle (not hardcoded), so difficulty calibration is a content-config problem, not a code-change problem:

| Knob | What it controls | Medium default 💡 | Spicy Saturday default 💡 |
|---|---|---|---|
| **Rule subtlety rating** | A tagged difficulty score per rule in the taxonomy (§7.1), e.g. 1–5, based on playtested/estimated "time to notice" | 2–3 | 4–5 |
| **Number of ambiguous/trap guests** | Count of pool guests specifically chosen per §7.2 to satisfy a decoy-but-not-T, or T-but-not-decoy | 1–2 of 6 | 2–3 of 6 |
| **Near-miss decoy strength in clues** | How close an OUT clue is to satisfying T (or an IN clue to satisfying a decoy) — e.g., an OUT example that fails T by only one letter/property | moderate | high |
| **Guest pool size** | Total new guests to sort | 6 (tunable) | 6, or 💡 consider 7 for extra load |
| **Clue set size (IN/OUT split)** | Number of pre-sorted examples shown | 3 + 3 (tunable) | 💡 consider 2 + 2 or 3 + 2, i.e. *less* evidence, which independently raises difficulty |
| **Surviving-decoy count post-clues** | How many taxonomy rules still fit after only the clues are shown (before the pool resolves them) | 2–3 live decoys | 4+ live decoys |

Each knob should be independently loggable per generated puzzle (see §8.2 data model) so that post-launch, actual player score distributions can be correlated back to knob settings — this is the feedback loop that lets the difficulty target (~4–5/6 average) actually get tuned empirically rather than guessed once and left alone.

💡 One added coherence constraint from the 3-life cap (§3.3): trap-guest density (row above) should stay mindful of the life ceiling, so a reasonably-engaged-but-imperfect player isn't routinely cut off before reaching most of the pool. In practice this means never pushing trap density meaningfully past 3 out of 6, even on Spicy Saturday — the current 2–3 default already respects this, but it's worth stating explicitly so future knob tuning doesn't drift past it.

### 7.5 Word Bank Requirements

To generate candidates and run the §7.3 validator, every word in the bank needs structured metadata, not just a spelling. Minimum viable schema:

- **Spelling** (canonical form) and **length**.
- **Letter-level features**, precomputable for every word: letter frequency map, doubled-letter flag, first/last letter, vowel positions, vowel/consonant pattern string (e.g., CVCCV), alphabetical-order-run flag, substring index (for hidden-smaller-word rules — precompute which short words/fragments appear as substrings), anagram signature (sorted-letter key, for anagram-adjacent rules).
- **Frequency/commonness score** — critical for fairness; obscure words make rules feel unfair regardless of how clean the logic is. 💡 Suggested default: source from an existing word-frequency corpus (e.g., a standard English frequency list) and set a minimum commonness threshold for anything used as a clue or guest (clues should arguably have a *higher* bar than trap guests, since players anchor hardest on the clues).
- **Category/property tags**, for semantic rules (§7.1.2): a flexible tag system (e.g., `category:fruit`, `property:cold`, `property:kitchen-item`) — this is the part of the word bank that needs the most ongoing human curation, since it can't be fully derived automatically the way letter features can.
- **Part of speech** — needed both for some semantic rules directly and as a sanity filter (avoid mixing wildly different parts of speech in a pool unless that's the point).
- **Content safety flags** — exclude slurs, and 💡 flag words needing sensitivity review (e.g., words with strong negative valence) for human review before they can be used at all, not just before going live.

💡 Suggested sourcing approach: bootstrap letter-level features entirely programmatically (cheap, deterministic, no human effort) from any standard English word list; bootstrap category/property tags from an existing lexical database (e.g., WordNet-style hypernym/category data) as a first pass, then let the human approval step (§9) flag and backfill missing/wrong tags over time rather than trying to hand-tag the whole bank upfront.

### 7.6 Rule Generation Sketch (how §7.1–§7.5 fit together end to end)

1. **Pick a target difficulty tier** for the day (medium or Spicy) → pulls the knob defaults from §7.4.
2. **Select a candidate rule T** from the taxonomy, filtered to the target subtlety rating.
3. **Draft a clue set**: pull IN/OUT candidate words from the word bank matching T (and not-T), weighted toward common words, sized per the clue-set-size knob.
4. **Run the decoy scan** (§7.2 mechanism): find which other taxonomy rules also fit the clue set as drafted. If too few or too many decoys survive relative to the target subtlety, adjust the clue set (swap a clue) and re-scan.
5. **Draft the guest pool**: fill with a mix of clean T-consistent words, trap guests targeting the surviving decoys, and (if the subtlety knob calls for it) one or two T-but-looks-wrong guests, per §7.2's suggested ratios.
6. **Run full uniqueness validation** (§7.3) across clues + pool against the entire taxonomy. Repair (swap offending word) or reject per §7.3's rule.
7. **Emit candidate puzzle** with all knob values logged, into the human approval queue (§9).

---

## 8. Tech Stack & Architecture

💡 The whole stack in this section is a recommended default — reasonable, boring, and swappable; nothing here is locked by the spec. The spec explicitly delegates this choice, so treat it as a starting proposal to revise as the team's actual skills/preferences come in.

### 8.1 Overview & rationale

The core constraint shaping this stack: **small team, Wordle-style daily game, needs streaks + leaderboards, and needs a genuinely separate offline content pipeline (generator + validator + human approval tool) that isn't part of the live player-facing app.** That last part matters — this is not a simple static daily-word-reveal site; it has real backend needs (accounts optional, streak state, leaderboards, aggregate stats) *and* a real content-authoring tool need, so it's worth being honest that this is a bit more than a single static site, but still doesn't need enterprise infrastructure.

**Recommended stack:**

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Vite + React** | The game loop (§3, §5) is a client-heavy, drag-and-drop, animation-driven single-page app with almost no SEO/content-marketing surface — Next.js's headline advantages (SSR/SSG, image optimization tuned for content pages) don't buy much here. A Vite SPA is simpler to reason about, faster to iterate in, and this is the team's existing comfort zone. A PWA wrapper (installable, works offline for the day's puzzle) still covers "app-like" needs without a native app build. |
| Styling | **Tailwind CSS** + a small custom design-token layer | Fast to hit the "light, colorful, simple, rounded, roomy" brief (§5.1) without fighting a heavy component library's opinions; a thin token layer (colors, radii, spacing scale) keeps the "signature moment" (card-snap animation, IN/OUT bins) consistent as a small design system rather than one-off CSS. |
| Animation | **Framer Motion** (or CSS transitions for the simplest cases) | Needed for the card-snap/drag-and-drop feel that's explicitly called out as the new signature moment (§5.1) — Framer Motion pairs well with React and handles both the drag gesture and the settle animation. |
| Backend API | **A thin Node/Express-shaped API, deployed as Netlify Functions** | The client can't talk to the database directly: §8.4's per-guest check flow means a guest's true label must never reach the browser until the player actually swipes it, and the 3-life count (§3.3) must be tracked server-side so it can't be bypassed — something server-side has to serve the puzzle (labels stripped), check each swipe, enforce the life count, and update streaks. Netlify Functions (Lambda-based) cover this without standing up or managing a dedicated always-on server. |
| Hosting / serverless | **Netlify** | Deploys the Vite static build and the Netlify Functions API together from one repo with zero-ops git-push deploys and preview builds per branch — the same workflow the team already uses for other projects. Vercel's edge over Netlify is mostly Next.js-specific integration (ISR, Next-tuned image optimization), which is moot once Next.js is out of the picture; there's no material technical gap left, so defaulting to the already-familiar platform is the pragmatic call. 💡 If the admin approval tool (§8.5) or generator ever outgrow short-lived serverless functions (e.g., need a long-running process), Render or Railway are reasonable alternatives for a small persistent Express server — but start with Netlify Functions to keep infra minimal and on one platform. |
| Database | **MongoDB** (💡 via MongoDB Atlas's managed free/small-team tier) | The puzzle data model (§8.2) is naturally document-shaped, not relationally normalized: a puzzle *owns* its clue set and guest pool outright, never shared or joined across puzzles — a natural fit for embedding clues/guests as arrays in one `puzzles` document. Leaderboard ranking (streak, tiebreak by score) is well within Mongo's aggregation pipeline. Atlas is also simple to stand up for a small team, and matches the team's existing familiarity. |
| Auth | **Anonymous-first, optional accounts** (💡 Clerk, or a simple email-magic-link + JWT flow) | See §8.3 — most players should never need to sign up; auth exists only to sync streaks across devices and enable the social leaderboard. Picked to be DB-agnostic rather than coupled to a specific database vendor. |
| Admin/approval tool | **A protected route/section inside the same Vite React app**, calling the same backend API with an internal-auth check | See §8.5 — doesn't need its own framework or separate app; an auth-gated `/admin` section is enough at this team size. |
| Offline generator/validator | **A standalone Node/TypeScript script (or small CLI)**, sharing the rule-taxonomy/word-bank code as a library with the main app where practical | See §8.5 — runs offline/on a schedule, writes candidate puzzles into MongoDB for the approval queue; does not need to be a deployed service, just a script a human (or a cron job) runs. |

💡 **Alternative worth flagging:** if the team is more comfortable in a different ecosystem for the generator specifically (e.g., Python, since word/NLP tooling is often more mature there), that piece is a good candidate to be a *different* language than the frontend/API, since it's a fully offline batch job with no shared runtime requirement with the live app — it only needs to be able to write into the same MongoDB database. Don't over-index on "one language for everything" if the team's NLP/word-list tooling is stronger elsewhere.

💡 **Future nice-to-have this trade-off affects:** if a future "shareable result page with a rich link-preview" feature (§6.2) ever wants server-rendered Open Graph tags for a single share-result URL, that's achievable with one dedicated serverless function generating the OG image/meta tags on the fly — it doesn't require adopting full Next.js/SSR, just a small addition when/if that's actually wanted.

### 8.2 Data model (conceptual)

💡 Sketch, not a final schema. Modeled as MongoDB collections, favoring embedding over joins where a relationship is owned outright (a puzzle's clues/guests belong to it and nothing else) and references where a relationship is shared/many-to-many (a user has many results, but a result doesn't belong exclusively to one user in a way that'd justify embedding):

- **`words`** — `_id`, spelling, length, letterFeatures (embedded doc: doubled-letter flag, vowel pattern, substrings, etc.), frequencyScore, partOfSpeech, tags (array), safetyFlags.
- **`rules`** — `_id`, name, descriptionTemplate (for the plain-text reveal), family (lexical/semantic), subtletyRating, evaluatorRef (which function/logic checks a word against this rule).
- **`puzzles`** — `_id`, date (or seed, for delivery — see below), ruleId, difficultyTier (medium/spicy), knobValues (embedded doc, per §7.4), status (draft/pending_approval/approved/scheduled/live), createdBy (generator run id), and two embedded arrays owned entirely by this puzzle:
  - `clues: [{ wordId, label (IN/OUT), displayOrder }]`
  - `guests: [{ wordId, trueLabel (IN/OUT — hidden until reveal), displayOrder, isTrap (bool, for internal analytics per §7.4's feedback loop) }]`
  
  Because `guests[].trueLabel` lives inside the same document the client needs the rest of, the API layer (§8.4) must explicitly strip `trueLabel` (and `isTrap`) from every unresolved guest before sending puzzle data to the client, only ever revealing a given guest's true label in the response to that specific guest's swipe — this is the one field in the whole schema that needs deliberate, careful handling to avoid an accidental leak.
- **`results`** — `_id`, userId (nullable for anon), puzzleId, placements (embedded doc: guestId → player's attempted label, populated incrementally as the player swipes — see §8.4 — rather than written all at once), score, livesRemaining, endedEarly (bool, true if the round ended via lives-out per §3.3 rather than full completion), submittedAt.
- **`users`** — `_id`, optional auth identity (email/provider id), and embedded streak fields (currentStreak, longestStreak, lastPlayedDate) directly on the user document — combined into one collection rather than a separate `streaks` collection, since the anonymous-first model (§8.3) means most "users" are just anonymous device records and a streak is inherently 1:1 with a user, not a separate owned entity.
- **Leaderboard entries** — not a stored collection by default; computed on read via an aggregation pipeline over `users` (+ `results` if score-based tiebreaks need it), scoped to friend groups (see §6.4). 💡 If read load ever makes on-the-fly aggregation too slow, introduce a periodically-materialized `leaderboardCache` collection later — don't build it upfront.

**"Daily puzzle delivery via a shared seed"** (locked requirement from spec): 💡 suggested interpretation — each `puzzles` document has a deterministic `seed`/`puzzleNumber` tied to a calendar date (UTC-normalized, 💡 or normalized to a configurable "puzzle day" cutoff if the team wants a non-UTC reset time, common in this genre). The frontend requests "today's puzzle" by date, the backend resolves date → puzzle via the seed, and this same seed can be used to guarantee every player worldwide gets the *same* puzzle content, which is what makes shared results comparable (core to the share-card/social loop in §6.2). This mechanism is DB-agnostic and unaffected by the Mongo/Postgres choice.

### 8.3 Anonymous play + optional accounts

💡 Suggested default flow:
- **No login required to play.** A device-local identifier (e.g., a UUID in local storage, or a signed anonymous session cookie) tracks streak + history for that device/browser, so the core loop works with zero signup friction — this matters a lot for a daily game where the whole point is a frictionless every-day habit.
- **Optional account creation** (💡 simplest: email magic link, or a plug-and-play provider like Clerk) is offered specifically to (a) sync streak/history across devices, and (b) enable the social/friends leaderboard (§6.4), which inherently needs a persistent identity to compare against friends over time.
- On account creation, merge the anonymous device history into the new account (standard pattern — don't lose the player's existing streak when they "upgrade" to an account).

### 8.4 How daily puzzles are stored and served

- Puzzles are generated and approved **ahead of time** into a queue (§9) — the live app never generates a puzzle on demand; it only ever reads an already-approved `puzzles` document for the requested date.
- 💡 Suggested serving pattern: a Netlify Function resolves "today's puzzle" from MongoDB and returns the clue set + guest pool (**without** true labels for any guest — only clue labels are ever sent upfront, since sending hidden labels client-side would let a player inspect network traffic to cheat; see §8.2's note on stripping `guests[].trueLabel`).
- Under the live-feedback, 3-life model (§3.2–3.3), scoring can no longer happen in one bulk "submit" call — each swipe needs its own server-checked round trip. 💡 Suggested pattern: a **per-guest check endpoint**. The client sends `{puzzleId, guestId, attemptedLabel}` for the single guest just swiped; the server compares it against that guest's true label, records the attempt into `results.placements`, and — critically — decrements a **server-tracked** lives counter on a miss (server-authoritative, so the 3-life limit can't be bypassed by client-side manipulation). The response returns `{correct, trueLabel, livesRemaining}` for **just that guest** — it must never include the labels of any other unresolved guest in the same response, which is what actually keeps the game honest (not just UI-hidden). If `livesRemaining` hits 0, or every guest has been resolved, the same response signals round-complete so the client triggers reveal (§3.4–3.5). This means roughly one function call per swipe (up to 6 per puzzle, fewer if lives run out early) — trivial load for serverless functions at this game's scale.
- A minor, accepted limitation worth noting rather than over-engineering against: a technically inclined player could in principle call this endpoint via devtools for a guest they haven't visually swiped yet, effectively probing ahead. This is a small risk in the same category most similar daily games accept (e.g., reading an answer out of page source) and doesn't warrant added complexity to defend against.

### 8.5 How the generator/validator and the human-approval admin tool fit in

These are two genuinely separate concerns from the live app, and should be built/run that way:

- **Generator + validator (§7.6, §7.3):** an offline batch process (script/CLI), run on a schedule or manually by content ops, that reads the word bank and rule taxonomy, produces candidate `puzzles` documents with `status = pending_approval`, and writes them directly to the same MongoDB database the live app reads from (via the Mongo driver or Mongoose). It has no user-facing surface at all.
- **Human approval tool:** a small internal, auth-gated screen (💡 simplest: a protected route/section inside the same Vite React app, restricted to internal team accounts, calling the backend API with an internal-auth check, rather than a separate app) that lists `pending_approval` puzzles, lets a reviewer see the full puzzle (clues, pool, true labels, the rule, and — 💡 useful addition — which decoy rules the validator found as "live" per §7.2/§7.3, so the reviewer can sanity-check the intended difficulty at a glance) and either approve (→ `status = approved`, enters the scheduling queue) or reject (→ back to generator, or discarded) each one. See §9 for the full pipeline and buffer requirement.

---

## 9. Content Operations

🔒 Pipeline shape is locked: **generate → validate → human-approve → schedule**, and a buffer of approved puzzles must be kept queued ahead of the live date at all times (locked requirement — never let the approved-and-scheduled buffer run down to zero, since that would either delay a day's puzzle or force an unapproved one live).

### 9.1 Pipeline stages

1. **Generate** — the offline generator (§7.6, §8.5) produces candidate puzzles at a target difficulty tier, tunable via the knobs in §7.4. Runs in batches (💡 e.g., generate N candidates per run, since not all candidates will survive validation or approval).
2. **Validate** — every candidate automatically passes through the uniqueness validator (§7.3) before a human ever sees it. Puzzles that fail validation and can't be repaired are discarded automatically — humans should never have to manually reject a puzzle for being logically broken; the validator's job is to make sure only *fairness/quality* judgment calls reach a human, not *correctness* ones.
3. **Human-approve** — a reviewer works the `pending_approval` queue (§8.5's admin tool). 💡 Suggested reviewer checklist per puzzle:
   - Is the rule actually fun/fair, not just technically unique? (Validator guarantees uniqueness, not *taste*.)
   - Are all words genuinely common enough that an average player would recognize them? (Word bank frequency score is a signal, not a guarantee — a reviewer's gut check matters here.)
   - Any content-safety concern the automated flags might've missed (cultural sensitivity, unintended offensive reading of a word combination, etc.)?
   - Does the actual difficulty *feel* right for its assigned tier (medium vs. Spicy)? Reviewer can see the knob values and live-decoy count as a guide, but this is ultimately a judgment call.
   - Approve → puzzle enters the scheduling queue with `status = approved`. Reject → sent back with a reason tag (💡 useful for tuning the generator over time — see §9.3).
4. **Schedule** — approved puzzles are assigned to a specific future date (the "seed," §8.2), maintaining the required forward buffer (💡 suggested minimum buffer: **2–4 weeks** of approved-and-scheduled puzzles at all times, as a starting target — adjust based on actual reviewer throughput once the team has real cadence data). Spicy Saturday slots specifically need spicy-tier approved puzzles scheduled against them — 💡 the scheduler should flag if the Spicy buffer specifically runs low, since spicy-tier puzzles are harder to generate/approve and could bottleneck independently of the medium buffer.

### 9.2 Buffer health

💡 Suggested operational default: track buffer health as a simple dashboard number ("X days of approved medium puzzles remaining," "X weeks of approved Spicy puzzles remaining") inside the admin tool, with the generator run cadence tuned to keep both comfortably ahead of the approval team's actual throughput — this is a small-team-ops problem more than an engineering one, but the admin tool should surface it clearly so it's never a surprise.

### 9.3 Feedback loop (post-launch tuning)

💡 Suggested addition, not in the original spec but a natural extension of §7.3's "coverage caveat" and §7.4's knob logging: once puzzles go live, actual player score distributions (average score, % perfect, per-guest miss rate — all already needed for aggregate stats per §6.5) should feed back into content ops:
- If a puzzle's actual average score is far from the ~4–5/6 target, that's a signal about whether its assigned difficulty tier and knob values were well-calibrated — useful for tuning future generation runs.
- If players' *wrong* placements cluster heavily around one specific decoy rule the validator didn't know about (visible from aggregate miss patterns, or from qualitative feedback/complaints), that's a signal to **add that rule to the taxonomy** (§7.1) so the validator can check against it going forward — this is how the taxonomy grows and the "coverage caveat" limitation in §7.3 gets steadily narrowed over time, rather than staying a fixed blind spot.

---

## 10. Open Questions & Future Ideas

Not locked, not yet default — flagged for future discussion.

- **Naming:** "The Bouncer" is explicitly provisional, and the spec asks that visual/copy design not lean on nightclub/bouncer theming. Worth revisiting once the actual signature moment (§5.1, "card snaps into a bin") is prototyped — a rename might follow naturally from whatever metaphor wins (e.g., something sorting/tray/inbox-flavored) rather than being decided in the abstract.
- **Image-based themed weeks:** spec explicitly calls this a future option, not core. Would need a parallel "image bank" with analogous structured metadata to §7.5 (visual properties instead of letter properties) — worth a dedicated planning pass later rather than folding into the word-based engine now.
- **Sunday difficulty:** should Sunday be plain medium, or a deliberately "gentle medium" cooldown day after Spicy Saturday? Currently defaulted to plain medium (§4) — open to a softer treatment if early player data suggests fatigue.
- **Streak grace/freeze mechanic:** flagged in §6.3 as a likely post-launch retention feature, not core to launch.
- **Global vs. friends-only leaderboard:** §6.4 defaults to friends-first due to tie-density concerns with a max score of 6; revisit if the pool size knob (§7.4) ever changes in a way that widens the score range, or if global leaderboard demand shows up post-launch.
- **Puzzle pool size beyond launch:** the 3+3 clues / 6 guests defaults are explicitly tunable (§3.1, §3.2) — once real difficulty data comes in (§9.3), consider whether a slightly larger pool (e.g., 7–8 guests) better supports the "genuinely challenging" target without overloading the "roomy, uncluttered" UI pillar (§2, §5.1). Any change here has a UI cost, so treat it as a joint design+content decision, not content-only.
- **Non-English localization:** not addressed anywhere above; lexical rules in particular (letter-based) are English-specific by nature. Flag as a significant future scope item if localization is ever considered — likely requires largely separate rule taxonomies per language, not a translation layer.
- **Puzzle-day reset time:** defaulted to UTC in §8.2 with a note that a configurable non-UTC cutoff is common in this genre (e.g., local midnight) — worth deciding deliberately once the target audience's geographic spread is clearer, since it affects both "same puzzle for everyone" fairness and daily-habit timing.
- **Live running tally during play:** §5.2 flags whether the sorting screen should show a running "3/5 so far" correct count alongside the lives indicator, or just the lives count on its own — an easy default to flip once it's actually been played.
- **Tighter life count for Spicy Saturday:** §4 flags whether Spicy Saturday should reduce the life count below 3 (e.g., 2) as an additional difficulty lever, on top of its existing higher trap-guest density — not decided, worth testing once there's real play data.
- **Trap-order sensitivity:** since players choose their own swipe order under the live-feedback model, a trap guest is naturally more effective early in a round (before the player has accumulated real evidence from other swipes) than late. Worth studying with real play data (§9.3) whether trap-guest placement/order needs any generator-side awareness of this, or whether it washes out across enough plays to not matter.
