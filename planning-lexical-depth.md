# Lexical Depth — making the puzzles feel different from each other

**Status:** approved. **Phases A and B shipped.** Phases C–E outstanding.

### Decisions taken on the §7 questions

1. **Sound is a seasoning, not the main course.** It gets a deliberately low
   mechanic weight and a trimmed rule list in Phase B — enough to make the game
   feel distinctive, not enough to become what the game is about.
2. **Keep `silent first letter`.** Implement it properly in Phase B rather than
   relying on the rough probe count.
3. **"Anagram" may be used in reveal text.** Players know the word.
4. **`part-of-speech` deleted.** Done in Phase A.

## 1. The feedback, and what it actually asks for

A play-tester liked the lexical puzzles and disliked the semantic ones. Told the
game was "Connections without the US references", he called that boring, and said
what he liked was letter- and word-play *inside* words. He named `exactly 3
syllables` as a good one — which is neither pure spelling nor pure meaning, but
sound.

He also said the good spicy puzzles keep being the same trick: a word hidden in a
word.

Both halves are correct, and the second one is measurable.

## 2. The measured diagnosis

Effective draw share per template, computed from the real taxonomy (265 rules)
using the actual selection weight in `pickTrueRule` (`aha / (1 + rejectCount)`,
summed per template):

```
=== spicy / lexical ===           === medium / lexical ===
  45.2%  rhyme          (73)        38.4%  rhyme          (73)
  30.5%  hidden-word    (37)        26.0%  hidden-word    (37)
  10.3%  hidden-group   (10)         9.1%  one-offs       (19)
   4.5%  one-offs        (7)         8.8%  hidden-group   (10)
   3.3%  ends-with      (16)         6.7%  ends-with      (38)
   2.5%  syllable-count  (4)         6.1%  starts-with    (35)
   2.1%  starts-with    (10)         2.1%  syllable-count  (4)
   0.8%  silent-letters  (1)         1.4%  word-length     (8)
   0.8%  homophone       (1)         0.7%  silent-letters  (1)
                                     0.7%  homophone       (1)
```

**86% of spicy lexical puzzles are either "they all rhyme" or "a word is hidden
inside".** On medium it is 73%. That is the whole complaint, in one number.

Two things cause it, and only one of them is the one we'd guess:

**(a) There are only seven high-`aha` lexical rules that aren't `hidden-*`.** Of
the 87 rules rated `aha` 4–5: 47 are hidden-word/hidden-group, 33 are `category`
(the semantic family the tester didn't like), and 7 are everything else —
`palindrome`, `has-anagram`, `same-start-end`, `subsequence-ace`,
`alphabetical-order-run`, `silent-letters`, `homophone`. Seven.

**(b) Rule *count* outweighs `aha`, and nothing currently corrects for that.**
`pickTrueRule` weights each rule individually, so a template with 73 rules at
`aha` 3 (219 weight) beats a template with 1 rule at `aha` 5 (5 weight) by 44×.
Adding great rules one at a time cannot move this. `rhyme` is the clearest case:
73 rules, and every one reveals with the identical sentence, *"The words all
rhyme with each other."* From the player's seat that is one puzzle played 73 ways
— arguably more repetitive than hidden-word, which at least names a different
target each time.

So the fix has to be structural, not a matter of writing more rules and hoping
they get drawn.

## 3. The core change: group rules by *mechanic*, not by template

`templateId` groups rules by how they're implemented. That is the wrong unit for
this problem. `hidden-word`, `hidden-group`, and the proposed "hides a word
backwards" are three templates and one single trick as far as a player is
concerned: *hunt for a word inside the word*. Template spacing would happily run
all three in one week.

Add one field to `Rule` — **required, not optional**: a rule declaring no
mechanic would form a bucket of one and win draws out of all proportion, and
requiring it makes the compiler catch that.

```ts
mechanic: 'word-inside' | 'sound' | 'letter-pattern' | 'word-surgery' | 'meaning'
```

Five values, assigned once per template:

| mechanic | today's rules | what the player does |
| --- | --- | --- |
| `word-inside` | hidden-word, hidden-group, subsequence-ace | hunt for a smaller word |
| `sound` | rhyme, syllable-count, homophone, silent-letters | say it out loud |
| `letter-pattern` | starts/ends-with, contains-letter, word-length, vowel rules, doubled-letter, alphabetical-order-run | look at the letters |
| `word-surgery` | palindrome, has-anagram | change the word and see what you get |
| `meaning` | category | know what it means |

Then two small mechanical uses of it:

1. **Two-step selection.** `pickTrueRule` picks a *mechanic* first (weighted by
   its rules' mean `aha`), then a rule within it (weighted as today). This makes
   the 73-rule rhyme family and the 1-rule palindrome family compete on merit
   instead of on headcount. Rule cooldown (`RULE_SPACING_DAYS = 60`) already
   stops a thin mechanic from repeating a specific rule.
2. **Mechanic spacing on the calendar**, alongside the existing rule and template
   spacing in `scheduling/placement.ts` — no mechanic twice within ~3 days. That
   machinery already exists and takes a third key.

*(Shipped. It took `word-inside` from 41% of spicy to 36% and `rhyme` from 45%
to 28% — the "roughly 20%" first written here was optimistic, because with only
four lexical mechanics carrying content the largest cannot fall much below a
third. See the Phase A table in §6 for the measured before/after.)*

**Also: name the rhyme.** `"The words all rhyme with each other."` → `"The words
all rhyme with RAIN."` One line in `rhymeRule`, picking the most frequent bank
word carrying that rhyme key. 73 rules stop reading as one.

## 4. New rule families

Every count below was measured against the real 14,964-word bank (blocked words
excluded). The coverage floor is 25 and the ceiling 35% of the bank; all of these
clear both. Examples are real matches.

### 4a. Lexical–phonetic hybrids — the tester's favourite axis

These need three more fields on the precomputed `Phonetics` record (stressed
syllable index, first phoneme, last phoneme). Same generated-file pipeline as
today; `npm run content:build-phonetics` regenerates it, CMUdict stays a
devDependency and never ships.

| rule | matches | examples | aha |
| --- | --- | --- | --- |
| **One syllable, six letters or more** | 478 | cheese, mosque, square, spring, bridge, wrench | 5 |
| **Starts with a K sound** (any spelling) | 1,353 | **c**attle, **k**itten, **c**offee, **qu**iet | 5 |
| **Starts with an S sound** | 1,684 | **s**poon, **c**ivic, **s**quare, **ps**ychology | 5 |
| **Ends with an S sound** | 1,020 | stats, chess, grass, spa**ce**, advi**ce** | 4 |
| **Ends with a Z sound** | 437 | chee**se**, squee**ze**, qui**z**, plier**s** | 4 |
| **Stress on the second syllable** | 3,124 | hello, aroma, agenda, museum, defend | 3 |
| **Stress on the third syllable** | 657 | kangaroo, pomegranate, understand, afternoon | 4 |
| **First sound is the last sound** | 512 | level, radar, noon, civic | 4 |
| **Silent first letter** | ~100\* | **k**nee, **g**nome, **w**rist, **h**onest, **p**sychology | 5 |

\* The 239 my probe returned includes false positives from a rough letter→sound
table; the honest implementation compares the first phoneme against that letter's
real possible realisations, and the true count will be lower. It still clears the
floor of 25 comfortably, but this is the one number in this document I would not
quote before implementing it.

The K-sound and S-sound rules are the sharpest thing here: *quiet, coffee,
kitten, chemistry* share a sound and share no letter. That is precisely "sound
and letter play inside the word", and nothing in the taxonomy can currently
express it.

`first sound is the last sound` needs one guard: exclude the schwa (`AH`), or it
groups *agenda* and *museum* on an unstressed vowel nobody hears. That is the
same mistake the rhyme key already had to fix.

### 4b. Word surgery — a genuinely new mechanic

These need bank-wide lookups (is the result also a word?), so they compute in
`wordBank.ts` as a post-pass and surface as tags. That pattern already exists for
`lexical:has-anagram`.

| rule | matches | examples | aha |
| --- | --- | --- | --- |
| **Reverse it and you get another word** | 62 | wolf/flow, deer/reed, keep/peek, live/evil, part/trap | 5 |
| **Remove the first letter, still a word** | 646 | (d)inner, (b)utter, (l)adder, (o)range | 4 |
| **Remove the last letter, still a word** | 1,190 | rabbi(t), plane(t), shove(l), hone(y) | 3 |
| **Two words stuck together** | 1,794† | lighthouse, cartwheel, birthday | 4 |

† Needs tightening — the naive split also admits kit+ten and mag+net. Gate on
both halves being ≥4 letters and reasonably frequent, and expect this to land
nearer 400–600.

### 4c. Word-inside, but a different trick

| rule | matches | examples | aha |
| --- | --- | --- | --- |
| **Hides a word spelled backwards** | 1,111 | **tab**le hides BAT, **tun**nel hides NUT, la**dder** hides RED | 5 |

Reuses `HIDDEN_WORD_TARGETS` and the existing group lists wholesale. Sits in the
`word-inside` mechanic, so mechanic spacing keeps it from compounding the
existing problem — it deepens the trick rather than repeating it.

### 4d. Letter patterns — cheap, and three of them read features we already compute and never use

`vcPattern`, `consonantCount` and `firstBeforeLastAlpha` are computed for every
word today and read by no rule.

| rule | matches | examples | aha |
| --- | --- | --- | --- |
| **Consonant and vowel alternate all the way through** | 1,067 | level, radar, aroma, civic, banana | 4 |
| **Every vowel in it is the same letter** | 1,307 | sp**oo**n, f**o**ll**o**w, l**e**tt**e**r, c**o**mm**o**n | 3 |
| **One letter appears three or more times** | 1,204 | banana, bubble, mirror, needle | 3 |
| **Four or more consonants in a row** | 189 | earthquake, lighthouse, cartwheel, lengthen | 4 |
| **Letters in reverse alphabetical order** | 82 | spoon, wolf, sled, tone | 4 |

The last one is a one-line mirror of the existing `alphabetical-order-run`.

Deliberately excluded: **QWERTY row/hand rules** (88 top-row words: puppy, quiet,
otter, trout). They're delightful and they're a trap — the player has no reason
to think about a keyboard, so the reveal lands as a gotcha rather than an "oh".
Worth revisiting as an occasional spicy once there's a way to signal it.

### 4e. Lexical–semantic hybrids: the cross-product

This is the differentiator, and the reason it belongs in this plan rather than a
later one. `hidden-group` — *"the word hides the name of an animal"* — is already
the highest-rated template in the taxonomy (`aha` 5). It is a hybrid: a **lexical
operation** (containment) applied to a **semantic target set** (animals).
Connections can express the target set; it cannot express the operation.

Generalise that into a cross-product: **operation × target set.**

```
operation:   hides · hides-backwards · reverses-into · behead-into ·
             anagram-of · rhymes-with · sounds-like
target set:  the 10 HIDDEN_WORD_GROUPS  ×  the 33 semantic categories
```

Every cell is a candidate rule. Most will be too thin to ship, which is fine:
that is exactly what `buildRuleParams.ts` already does — it sweeps candidates,
counts real coverage against the bank, keeps what clears the floor and drops the
rest. The cross-product is new *parameters*, not new machinery.

**I swept it against the real bank rather than assuming.** Results, floor 25:

| operation | viable cells | best cells | verdict |
| --- | --- | --- | --- |
| **behead-into** | 3 | animal 37 (**l**adder→adder, **j**owl→owl, **w**ant→ant), body-part 38 (**s**hip→hip, **p**ear→ear) | ship it |
| **curtail-into** | 4 | animal 36 (boa**t**→boa, bee**r**→bee, boar**d**→boar), food 36, profession 29 | ship it, with a guard — see below |
| **anagram-of** | 4 | animal 45 (throne→hornet, parrot→raptor, garden→gander), body-part 36 (bread→beard, lamp→palm) | ship it |
| **rhymes-with** | 45 | number 398 (can**oe**→two, gr**eat**→eight, can**ine**→nine), animal 698, body-part 612 | ship a few, prune hard |
| **homophone-of** | 33 | number 41 (won→one, great/wait→eight) | **don't trust this number** |
| **reverses-into** | **0** | — | **cut** |

Four things that changes:

- **`reverses-into` is dead.** Only 62 words in the whole bank reverse into
  another word at all, so no category cell survives the floor. Keep the plain
  "reverse it and you get another word" from §4b and drop the crossed version.
- **`curtail-into` needs the plural guard.** Its raw matches include hand**s**→hand
  and eye**s**→eye, which are inflections, not wordplay. `isHiddenIn` already
  solves exactly this problem with `TRIVIAL_SUFFIXES`; reuse it rather than
  writing a second version. Expect the real counts to land below the sweep's.
- **`rhymes-with` cells overlap heavily.** The big rhyme keys (`OW`, `IY`, `EY`)
  are hit by every target group, so "rhymes with a number" and "rhymes with an
  animal" will share most of their IN sets and collide as live decoys. That is
  the `ruleSimilarity` containment check's job, and it will prune this from 45
  cells to a handful. Don't ship 45.
- **`homophone-of` is over-counted by my probe**, which matched on rhyme key plus
  syllable count rather than on the full pronunciation. The true set for "sounds
  like a number" is roughly won/one, ate|great|wait/eight, for/four, to|too/two —
  likely under the floor. Implement it exactly and let the sweep decide.

Realistic yield is **15–25 solid cells**, not 40. That is still the single
biggest source of new high-`aha` material in this plan, and every one of them is
a shape Connections structurally cannot do.

## 5. External resources

**Already in the repo, still under-used — take these first.**

- **CMUdict** (`cmu-pronouncing-dictionary`, devDependency). We extract 4 facts
  from it; it carries stress digits and the full phoneme string, which is
  everything §4a needs. **No new dependency, no network call.**
- **The word bank itself.** Every rule in §4b is a set lookup against the 14,964
  spellings we already have.
- **WordNet** (via `natural`, already used for POS and hypernyms).
- **Datamuse.** Free, no key, 100k req/day through 1 Jan 2027. We use `ml` and
  `rel_trg`. Unused and directly relevant: **`rel_hom`** (homophones — validates
  the "sounds like a number" cell), **`rel_cns`** (consonant match), **`rel_gen`**
  (hyponyms, i.e. category membership), **`sp=`** wildcard spelling patterns, and
  **`md=r`** for Arpabet pronunciation as a cross-check on CMUdict's gaps (301
  bank words have no CMUdict entry).

**Not worth adding.**

- Bigger word lists (`dwyl/english-words`, 479k; `word-list`). The bank is
  deliberately 15k of *common* words — puzzle words have to be recognisable. A
  larger list makes rules match more obscure words, which is worse, not better.
- Morphological-segmentation datasets. §4b gets most of the value from bank
  membership alone, with no new data and no licence question.
- Paid APIs (WordsAPI and similar). Nothing here needs them.

## 6. Phases

Each phase ends green on all four typechecks, `npx vitest run`, and `npm run lint`.

**Phase A — mechanic axis — DONE**
`mechanic` is a *required* field on `Rule` (a rule that declared none would form
a bucket of one and win draws out of all proportion; the compiler now catches
that). Two-step `pickTrueRule`, mechanic spacing at 3 days in `placement.ts`,
rhyme anchors in the reveal, `part-of-speech` deleted.

Measured over 20,000 draws against the real taxonomy, lexical pool:

| | before | after |
| --- | --- | --- |
| spicy: rhyme | 45.2% | 27.6% |
| spicy: hidden-word | 30.5% | 26.1% |
| spicy: those two combined | **75.7%** | **53.7%** |
| spicy: largest *mechanic* | — | 35.6% (`word-inside`) |
| medium: largest mechanic | — | 32.6% (`word-inside`) |

The remaining concentration is a supply problem, not a weighting one: there are
only four lexical mechanics with real content in them, so the largest cannot go
much below a third. Phases B–D are what dilute it. **Retune `MECHANIC_WEIGHTS`
after each phase that adds a family.**

**Phase B — phonetic hybrids — DONE**

Five new rules, not the nine §4a listed, per the "sound is a seasoning" call:

| rule | matches | clue set from a real batch |
| --- | --- | --- |
| Starts with a "K" sound | 1,353 | — |
| Starts with a "J" sound | 225 | gym, jumping, gee |
| Starts with a "Y" sound | 93 | — |
| Silent first letter | **91** | wreck, heir, know |
| Long, but one syllable | 478 | proved, stoned, scowled |

`Phonetics` gained exactly two fields, `first` and `silentFirst`. **Stress index
and last phoneme were deliberately NOT added** — no shipped rule reads them, and
an unused precomputed field is the exact complaint the original audit made about
`vcPattern` and `consonantCount`. Add them with the rule that needs them.

Three gates decide which initial sounds get a rule, and they are the substance of
this phase:

- coverage floor 25 (19 of 23 consonant sounds pass)
- **minority spelling share ≥ 10%** — "starts with a B sound" is "starts with B"
  with extra steps, and would be a guaranteed live decoy on every B puzzle
- **minority spelling count ≥ 10 words** — Z cleared the share test on three
  words (`xerox`, `xenon`, `czar`), which is noise, not a pattern

`silent first letter` came in at **91 words**, confirming the ~100 estimate and
that the probe's 239 was noise. `SILENT_INITIALS` is a hardcoded closed list
(kn/gn/pn/mn/wr/ps plus silent H) — the data-driven version learns N as a normal
realisation of K from the bank's ~25 kn- words and finds nothing.

S (6%: spoon/civic/psychology) and F (5%: follow/phone) just missed the share
gate and are the first two to admit if sound is ever given more room.

**Two bugs this phase surfaced, both fixed:**

1. **Template size crowded out quality inside a mechanic.** Phase A stopped
   `rhyme` dominating all draws, but within the `sound` bucket its 73 rules left
   the three new rules sharing 2.8% — one puzzle every six weeks. `pickTrueRule`
   now damps template size by `sqrt` the same way it damps mechanic size. New
   rules went to **9.2–9.9%**, `rhyme` from 25.6% to 13.2%, and the aha-1 filler
   templates (starts-with/ends-with/word-length) from ~15–20% down to **6.6–7.5%**.
2. **`pickDiverseClueWords` bypassed the clue quality bar.** It bucketed the raw
   pool, skipping the commonness floor and proper-noun exclusion that
   `pickClueWords` applies — so it bought variant spread with whatever matched.
   The first K-sound puzzle drew `caprice, krishna, quietly` (frequency 0.10
   against a 0.6 floor, and a flagged proper noun). This affected **every**
   `variantOf` rule, `hidden-group` included, so the fix went in the shared
   helper rather than the new rules.

**Phase C — word surgery + letter patterns**
Post-pass tags in `wordBank.ts` for reverse/behead/curtail/compound; the §4b and
§4d rules. Test: each new tag's coverage clears the floor.

**Phase D — the cross-product**
`operation × target-set` parameter sweep in `buildRuleParams.ts` for the four
operations that survived the sweep (behead / curtail / anagram / rhymes-with),
plus homophone once implemented exactly; reveal-text templating per operation.
Test: every emitted cell clears the floor, and no cell duplicates an existing
rule's IN set — the `ruleSimilarity` containment check already exists and should
be reused here rather than rewritten.

**Phase E — verify against real output**

```
npm run content:build-rule-params
npm run content:generate -- 40
```

Read `content-engine/output/candidates.md` and confirm by inspection: no mechanic
runs more than about 1 in 3, `word-inside` is no longer the majority of spicy, and
the new families actually appear.

## 7. Still open

The four questions this section originally held are answered at the top of the
file. One new one, raised by the first batch generated after Phase A:

**Half of every medium batch is still semantic.** `MEDIUM_SEMANTIC_WEIGHT` is
0.5, so a 12-puzzle batch came out with six `The word names a ...` puzzles —
exactly the Connections-shaped material the play-tester called boring. Phase A
does not touch this: `pickFamily` splits lexical/semantic *before* the mechanic
step, so the mechanic weights only redistribute within the lexical half.

Lowering it is a one-number change in `generator/difficulty.ts`. It is left
alone deliberately, because it is a game-balance call rather than a variety bug,
and because semantic supply is already only ~1.3x the demand at 0.5 (the guard
in `placement.test.ts` asserts this). Dropping to 0.35 would put roughly two
semantic puzzles in a medium week instead of three. Say the word.
