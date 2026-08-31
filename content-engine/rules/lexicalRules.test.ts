import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank'
import { buildLetterFeatures } from '../words/features'
import { CONTAINS_LETTER_TARGETS, LEXICAL_RULES } from './lexicalRules'
import { subtletyRangeFor } from '../generator/difficulty'
import { RULES } from './index'
import type { Word } from '../words/types'

function wordFor(spelling: string): Word {
  const bank = buildWordBank()
  const found = bank.find((w) => w.spelling === spelling)
  if (found) return found
  // Allow testing spellings not in the seed bank (e.g. "word", "plan" as
  // generic negative controls) by building a one-off Word on the fly.
  return {
    id: spelling,
    spelling,
    length: spelling.length,
    features: buildLetterFeatures(spelling),
    frequencyScore: 0.5,
    partOfSpeech: 'other',
    properNoun: false,
    tags: [],
    safety: { blocked: false, needsReview: false },
  }
}

function ruleById(id: string) {
  const rule = LEXICAL_RULES.find((r) => r.id === id)
  if (!rule) throw new Error(`Unknown rule id: ${id}`)
  return rule
}

describe('registry sanity', () => {
  // Whole-taxonomy check (lexical + semantic combined) — per-family rule
  // content is covered by lexicalRules's own describe.each below and by
  // semanticRules.test.ts; this just guards against cross-family id
  // collisions and other registry-level regressions.
  // No exact count: most of the taxonomy is now generated from
  // coverage-checked parameters (rules/ruleParams.ts), so the total moves with
  // the word bank by design. A floor still catches an accidental collapse.
  it('has a healthy number of rules with unique ids and valid subtlety/aha ratings', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(60)
    const ids = new Set(RULES.map((r) => r.id))
    expect(ids.size, 'duplicate rule ids').toBe(RULES.length)
    for (const rule of RULES) {
      expect(rule.subtlety).toBeGreaterThanOrEqual(1)
      expect(rule.subtlety).toBeLessThanOrEqual(5)
      expect(rule.aha ?? 3).toBeGreaterThanOrEqual(1)
      expect(rule.aha ?? 3).toBeLessThanOrEqual(5)
      expect(rule.descriptionTemplate.length).toBeGreaterThan(0)
    }
  })

  // Regression guard: 10 of the previous 29 rules were rated subtlety 1,
  // which sits outside BOTH tier windows (medium [2,3], spicy [3,5]) — they
  // could never be drawn and existed only as decoy material. Nothing caught
  // it because no test related rule ratings to tier eligibility.
  it('has no rule stranded outside every tier window', () => {
    const windows = (['medium', 'spicy'] as const).map(subtletyRangeFor)
    for (const rule of RULES) {
      const reachable = windows.some(([min, max]) => rule.subtlety >= min && rule.subtlety <= max)
      expect(reachable, `rule "${rule.id}" (subtlety ${rule.subtlety}) is unreachable by any tier`).toBe(true)
    }
  })

  // Regression guard: `no-adjacent-vowels` matched 73% of the bank, which
  // made it a surviving decoy on nearly every puzzle and permanently ate a
  // decoy slot. A rule matching most of the bank isn't a rule, it's a
  // background condition.
  it('has no rule matching more than half the word bank', () => {
    const bank = buildWordBank()
    for (const rule of RULES) {
      const share = bank.filter((w) => rule.evaluate(w)).length / bank.length
      expect(share, `rule "${rule.id}" matches ${(share * 100).toFixed(0)}% of the bank`).toBeLessThan(0.5)
    }
  })
})

describe.each([
  ['doubled-letter', ['bubble', 'letter', 'spoon'], ['word', 'plan', 'cat']],
  ['same-start-end', ['level', 'radar', 'noon'], ['word', 'plan', 'cat']],
  ['contains-q', ['quiet', 'unique', 'mosque'], ['word', 'plan', 'cat']],
  ['contains-v', ['level', 'civic', 'oval'], ['word', 'plan', 'cat']],
  ['contains-f', ['follow', 'coffee', 'funny'], ['word', 'plan', 'cat']],
  ['contains-w', ['follow', 'arrow', 'pillow'], ['plan', 'cat', 'dog']],
  ['contains-y', ['dizzy', 'puppy', 'happy'], ['word', 'plan', 'cat']],
  ['contains-k', ['kitten', 'quick', 'pickle'], ['word', 'plan', 'cat']],
  ['contains-g', ['missing', 'agenda', 'gang'], ['word', 'plan', 'cat']],
  ['contains-b', ['bubble', 'rabbit', 'butter'], ['word', 'plan', 'cat']],
  ['contains-j', ['jump', 'major', 'enjoy'], ['word', 'plan', 'cat']],
  ['contains-x', ['box', 'expect', 'mixed'], ['word', 'plan', 'cat']],
  ['contains-z', ['dizzy', 'zone', 'crazy'], ['word', 'plan', 'cat']],
  ['starts-with-vowel', ['apple', 'otter', 'umbrella'], ['cat', 'dog', 'plan']],
  ['exactly-two-vowels', ['apple', 'hello'], ['dog', 'beautiful']],
  ['adjacent-vowels', ['quiet', 'bead', 'ocean'], ['cat', 'plan', 'dog']],
  ['third-letter-vowel', ['piano', 'poetic', 'react'], ['cabin', 'table', 'basket']],
  [
    'subsequence-ace',
    ['space', 'advice', 'distance', 'peace', 'trace'],
    ['cafe', 'ceramic', 'cat', 'plan'],
  ],
  ['palindrome', ['level', 'radar', 'noon', 'kayak'], ['word', 'plan', 'cat']],
  ['alphabetical-order-run', ['accent', 'fox', 'deer', 'first'], ['word', 'plan', 'cat']],
  ['has-anagram', ['quiet', 'item', 'ocean'], ['word', 'plan', 'bubble']],
])('rule: %s', (id, inWords, outWords) => {
  const rule = ruleById(id as string)

  it.each(inWords as string[])('marks "%s" as IN', (spelling) => {
    expect(rule.evaluate(wordFor(spelling))).toBe(true)
  })

  it.each(outWords as string[])('marks "%s" as OUT', (spelling) => {
    expect(rule.evaluate(wordFor(spelling))).toBe(false)
  })
})

// Regression guard: if the word bank ever shrinks, these parameterized
// rules should fail loudly here rather than silently ship a degenerate
// puzzle (too few IN words to draft a clue set / pool) — same lesson
// semanticRules.test.ts's coverage guard was written for (build-plan.md
// Phase 10.5 §2 Step 5).
describe('contains-letter coverage floor', () => {
  const bank = buildWordBank()

  it.each(CONTAINS_LETTER_TARGETS)('letter "%s" still has at least 15 matching words', (letter) => {
    const count = bank.filter((w) => w.spelling.includes(letter)).length
    expect(count).toBeGreaterThanOrEqual(15)
  })
})

// Regression guard: category tags were reviewed one category at a time, so
// `category:bird` was not a subset of `category:animal` — 21 of 22 birds were
// not tagged as animals, making "Is an Animal" puzzles mark eagles as OUT.
describe('category hierarchy', () => {
  const bank = buildWordBank()

  it('every bird is also an animal', () => {
    const birds = bank.filter((w) => w.tags.includes('category:bird'))
    expect(birds.length).toBeGreaterThan(0)
    for (const bird of birds) {
      expect(bird.tags, `"${bird.spelling}" is a bird but not an animal`).toContain('category:animal')
    }
  })
})

// Same regression-guard rationale as the coverage-floor blocks above, for
// the three new rule families added in Phase 10.6 item 1 (build-plan.md).
describe('new lexical family coverage floor', () => {
  const bank = buildWordBank()

  it('palindrome still has at least 15 matching words', () => {
    expect(bank.filter((w) => w.features.isPalindrome).length).toBeGreaterThanOrEqual(15)
  })

  it('alphabetical-order-run still has at least 15 matching words', () => {
    expect(
      bank.filter((w) => w.spelling === w.features.anagramSignature).length
    ).toBeGreaterThanOrEqual(15)
  })

  it('has-anagram still has at least 15 matching words', () => {
    expect(bank.filter((w) => w.tags.includes('lexical:has-anagram')).length).toBeGreaterThanOrEqual(
      15
    )
  })
})

// prime-length has its own table since the expected label depends on length, not a fixed word set.
describe('rule: prime-length', () => {
  const rule = ruleById('prime-length')

  it.each([
    ['cat', true], // 3
    ['plane', true], // 5
    ['picture', true], // 7
    ['word', false], // 4
    ['plan', false], // 4
    ['mistaken', false], // 8
  ])('"%s" -> %s', (spelling, expected) => {
    expect(rule.evaluate(wordFor(spelling as string))).toBe(expected)
  })
})
