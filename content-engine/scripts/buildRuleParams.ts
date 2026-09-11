// Sweeps every candidate rule parameter, counts real coverage against the word
// bank, and writes the ones that clear the floor to rules/ruleParams.ts.
//
// Why generated rather than hand-maintained: the old `contains-letter` list
// excluded j/x/z citing coverage counts taken against a 417-word bank. Nobody
// re-ran them after the bank grew to 5,000 (j:96, x:78, z:41), so three usable
// rules sat dead for months. Re-running this after any word-bank change now
// promotes newly-viable parameters automatically and demotes ones that fell
// below the floor.
// Run with: npm run content:build-rule-params

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_IDS, categoryTag } from '../words/categories.js'
import { HIDDEN_WORD_GROUPS, HIDDEN_WORD_TARGETS } from '../words/fixedLists.js'
import type { Word } from '../words/types.js'
import { buildWordBank } from '../words/wordBank.js'
import {
  SURGERY_OPERATIONS,
  surgeryCategoryTag,
  type SurgeryOperation,
} from '../words/wordSurgery.js'

// A rule needs enough IN words to draft 3 clues plus pool guests without
// leaning on the same handful every time it's drawn.
const MIN_COVERAGE = 25
// Above this share of the bank a rule stops being a rule and becomes a
// background condition — it survives the clue stage on nearly every puzzle and
// permanently occupies a decoy slot (what `no-adjacent-vowels` did at 73%).
const MAX_COVERAGE_SHARE = 0.35

/**
 * Rhymes get a far tighter ceiling than everything else.
 *
 * The generic 35% ceiling passes rhyme groups like -IY (1,565 words), -ER
 * (1,202) and -IHNG (1,047) — which are not rhymes a player notices, they are
 * "ends in -y / -er / -ing" wearing a phonetic costume, and the taxonomy
 * already has ends-with rules for those. A rhyme is only interesting when the
 * set is small enough that hearing it is the insight.
 *
 * Lowered from 400 to 150, which drops exactly one group: EYSHAHN, 186 words of
 * information / situation / station / operation. That is "ends with -ation"
 * wearing a phonetic costume, the very thing this ceiling exists to catch, and
 * it was the only group between 150 and 400. EYT (142 — great, wait, late,
 * straight, eight) survives, and should: it is spelled five different ways,
 * which is what makes a rhyme worth hearing.
 */
const MAX_RHYME_COVERAGE = 150

/**
 * How much of an initial-sound group must be spelled *against* the majority for
 * the rule to be worth shipping — as a share, and as an absolute count.
 *
 * "Starts with a B sound" is a tautology of "starts with B" — every B-sound word
 * in the bank begins with the letter B — so it would add nothing but a
 * guaranteed live decoy on every B puzzle. The rule is only interesting where
 * the spelling disagrees with the sound often enough for a player to notice:
 * coffee / kitten / quiet, or gentle / jacket / giraffe.
 *
 * The absolute floor exists because the share alone is noise on a small group. Z
 * cleared 10% on three words out of 29 — `xerox`, `xenon`, `czar` — so a drawn
 * clue set would be all-z nearly every time and the rule would be "starts with
 * Z" wearing a costume, which is the exact thing this gate is here to reject.
 *
 * Three sounds qualify: K (c/k/q), JH (j/g), Y (y/u/e). S (6%:
 * spoon/civic/psychology) and F (5%: follow/phone) just miss on share, and are
 * the first two to let in if the sound family is ever given more room.
 */
const MIN_MINORITY_SPELLING_SHARE = 0.1
const MIN_MINORITY_SPELLING_WORDS = 10

/**
 * ARPAbet names a player would not recognise, mapped to something readable.
 * Vowels are excluded from initial-sound rules entirely — "starts with an AH
 * sound" is not a thing anyone can act on.
 */
const VOWEL_PHONEMES = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
])

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')
// Multi-letter starts/ends worth trying. Suffixes carry more signal than
// prefixes (English marks grammar at the end), so the list leans that way.
const PREFIX_CANDIDATES = [...ALPHABET, 'ch', 'sh', 'th', 'wh', 'st', 'pr', 'tr', 'br', 'cl', 'fl']
const SUFFIX_CANDIDATES = [
  ...ALPHABET,
  'ed',
  'er',
  'ly',
  'ng',
  'ion',
  'ing',
  'est',
  'ous',
  'ful',
  'ent',
  'ance',
  'ment',
  'ness',
  'able',
  'tion',
  'less',
]

interface Swept<T> {
  kept: T[]
  rejected: { param: T; count: number; reason: string }[]
}

function sweep<T>(
  candidates: readonly T[],
  bank: Word[],
  matches: (w: Word, p: T) => boolean,
  maxShare = MAX_COVERAGE_SHARE
): Swept<T> {
  const kept: T[] = []
  const rejected: { param: T; count: number; reason: string }[] = []
  for (const param of candidates) {
    const count = bank.filter((w) => matches(w, param)).length
    if (count < MIN_COVERAGE) rejected.push({ param, count, reason: 'too few' })
    else if (count / bank.length > maxShare) rejected.push({ param, count, reason: 'too broad' })
    else kept.push(param)
  }
  return { kept, rejected }
}

function report<T>(label: string, swept: Swept<T>, total: number): void {
  const tooFew = swept.rejected.filter((r) => r.reason === 'too few').length
  const tooBroad = swept.rejected.filter((r) => r.reason === 'too broad').length
  console.log(
    `  ${label}: kept ${swept.kept.length}/${total} (${tooFew} too few, ${tooBroad} too broad)`
  )
}

function main(): void {
  // Blocked words can never be drafted, so counting them would overstate a
  // parameter's real coverage and promote rules the generator can't fill.
  const bank = buildWordBank().filter((w) => !w.safety.blocked)
  console.log(
    `Word bank: ${bank.length} words. Coverage floor ${MIN_COVERAGE}, ceiling ${MAX_COVERAGE_SHARE * 100}%.\n`
  )

  const hiddenWords = sweep(HIDDEN_WORD_TARGETS, bank, (w, t) =>
    w.features.hiddenWordHits.includes(t)
  )
  const groupNames = Object.keys(HIDDEN_WORD_GROUPS) as (keyof typeof HIDDEN_WORD_GROUPS)[]
  const hiddenGroups = sweep(groupNames, bank, (w, g) => {
    const members = new Set<string>(HIDDEN_WORD_GROUPS[g])
    return w.features.hiddenWordHits.some((hit) => members.has(hit))
  })
  const startsWith = sweep(PREFIX_CANDIDATES, bank, (w, p) => w.spelling.startsWith(p))
  const endsWith = sweep(SUFFIX_CANDIDATES, bank, (w, s) => w.spelling.endsWith(s))
  const wordLengths = sweep([3, 4, 5, 6, 7, 8, 9, 10], bank, (w, n) => w.length === n)
  const categories = sweep(CATEGORY_IDS, bank, (w, c) => w.tags.includes(categoryTag(c)))

  // Sound rules. 2-syllable words are 43% of the bank and get rejected by the
  // standard ceiling, which is the right call — "has two syllables" describes
  // most of the language.
  const syllableCounts = sweep([1, 2, 3, 4, 5, 6], bank, (w, n) => w.phonetics?.syllables === n)
  const silentThresholds = sweep([2, 3, 4], bank, (w, n) => (w.phonetics?.silent ?? 0) >= n)
  const rhymeKeys = [
    ...new Set(bank.map((w) => w.phonetics?.rhyme).filter((r): r is string => Boolean(r))),
  ].sort()
  const rhymes = sweep(
    rhymeKeys,
    bank,
    (w, k) => w.phonetics?.rhyme === k,
    MAX_RHYME_COVERAGE / bank.length
  )
  // Each surviving key gets an anchor word for the reveal to name ("they all
  // rhyme with RAIN"). The most common non-proper-noun in the group, because
  // the anchor is only useful if the player already knows how it sounds.
  const rhymePairs = rhymes.kept.map((key) => {
    const members = bank
      .filter((w) => w.phonetics?.rhyme === key && !w.properNoun)
      .sort((a, b) => b.frequencyScore - a.frequencyScore)
    return [key, (members[0] ?? bank.find((w) => w.phonetics?.rhyme === key)!).spelling]
  })

  // Initial sound. Swept on coverage like everything else, then filtered again
  // on spelling disagreement — a sound spelled only one way is the letter rule
  // wearing a phonetic costume.
  const byFirstPhoneme = new Map<string, Word[]>()
  for (const w of bank) {
    const f = w.phonetics?.first
    if (!f || VOWEL_PHONEMES.has(f)) continue
    const group = byFirstPhoneme.get(f)
    if (group) group.push(w)
    else byFirstPhoneme.set(f, [w])
  }
  const initialSounds = sweep(
    [...byFirstPhoneme.keys()].sort(),
    bank,
    (w, p) => w.phonetics?.first === p
  )
  const soundsWithVariedSpelling = initialSounds.kept.filter((phoneme) => {
    const group = byFirstPhoneme.get(phoneme)!
    const byLetter = new Map<string, number>()
    for (const w of group) byLetter.set(w.spelling[0], (byLetter.get(w.spelling[0]) ?? 0) + 1)
    const minority = group.length - Math.max(...byLetter.values())
    return (
      minority / group.length >= MIN_MINORITY_SPELLING_SHARE &&
      minority >= MIN_MINORITY_SPELLING_WORDS
    )
  })

  // The lexical-semantic cross-product: every operation against every category.
  // Most cells are far too thin to ship, which is exactly why they are swept
  // rather than chosen — "reverse it and you get an animal" sounds great and the
  // bank has four such words.
  const surgeryPairs: [SurgeryOperation, string][] = SURGERY_OPERATIONS.flatMap((op) =>
    CATEGORY_IDS.map((c) => [op, c] as [SurgeryOperation, string])
  )
  const surgeryCategories = sweep(surgeryPairs, bank, (w, [op, c]) =>
    w.tags.includes(surgeryCategoryTag(op, c))
  )

  report('hidden-word', hiddenWords, HIDDEN_WORD_TARGETS.length)
  report('surgery x category', surgeryCategories, surgeryPairs.length)
  for (const [op, c] of surgeryCategories.kept) {
    const n = bank.filter((w) => w.tags.includes(surgeryCategoryTag(op, c))).length
    console.log(`      ${op}-into-${c}: ${n} words`)
  }
  console.log(
    `  initial-sound: kept ${soundsWithVariedSpelling.length}/${byFirstPhoneme.size} ` +
      `(${initialSounds.rejected.length} on coverage, ` +
      `${initialSounds.kept.length - soundsWithVariedSpelling.length} spelled only one way) ` +
      `-> ${soundsWithVariedSpelling.join(', ')}`
  )
  report('hidden-group', hiddenGroups, groupNames.length)
  report('starts-with', startsWith, PREFIX_CANDIDATES.length)
  report('ends-with', endsWith, SUFFIX_CANDIDATES.length)
  report('word-length', wordLengths, 8)
  report('category', categories, CATEGORY_IDS.length)
  report('syllable-count', syllableCounts, 6)
  report('silent-letters', silentThresholds, 3)
  report('rhyme', rhymes, rhymeKeys.length)

  const lines = [
    '// AUTO-GENERATED by content-engine/scripts/buildRuleParams.ts — do not hand-edit.',
    '// Every parameter here cleared a real coverage check against the word bank;',
    '// re-run `npm run content:build-rule-params` after changing the bank.',
    '',
    'export const RULE_PARAMS = {',
    `  hiddenWords: ${JSON.stringify(hiddenWords.kept)},`,
    `  hiddenGroups: ${JSON.stringify(hiddenGroups.kept)},`,
    `  startsWith: ${JSON.stringify(startsWith.kept)},`,
    `  endsWith: ${JSON.stringify(endsWith.kept)},`,
    `  wordLengths: ${JSON.stringify(wordLengths.kept)},`,
    `  categories: ${JSON.stringify(categories.kept)},`,
    `  syllableCounts: ${JSON.stringify(syllableCounts.kept)},`,
    // 3, chosen rather than swept. All of 2/3/4 clear the floor, but they are
    // the same idea at three strengths, so only one should ship. 2 is too loose
    // to feel like anything (nearly every word has a digraph); 4 leaves just
    // 107 words, which is a thin, repetitive pool. 3 gives ~835 with obvious
    // examples: cheese, bouquet, scissors, lighthouse. The sweep still runs so
    // a bank change that pushed 3 under the floor would show up in the report.
    `  silentThreshold: ${JSON.stringify(silentThresholds.kept.includes(3) ? 3 : (silentThresholds.kept[0] ?? 3))},`,
    `  rhymes: ${JSON.stringify(rhymePairs)},`,
    `  initialSounds: ${JSON.stringify(soundsWithVariedSpelling)},`,
    `  surgeryCategories: ${JSON.stringify(surgeryCategories.kept)},`,
    '} as const',
    '',
  ]
  writeFileSync(join(process.cwd(), 'content-engine', 'rules', 'ruleParams.ts'), lines.join('\n'))

  const total =
    hiddenWords.kept.length +
    hiddenGroups.kept.length +
    startsWith.kept.length +
    endsWith.kept.length +
    wordLengths.kept.length +
    categories.kept.length +
    syllableCounts.kept.length +
    rhymes.kept.length +
    soundsWithVariedSpelling.length +
    surgeryCategories.kept.length +
    1 // silent-letters, a single rule
  console.log(`\nWrote ${total} generated rules to content-engine/rules/ruleParams.ts`)
}

main()
