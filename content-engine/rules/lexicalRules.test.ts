import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank'
import { buildLetterFeatures } from '../words/features'
import { CONTAINS_LETTER_TARGETS, LEXICAL_RULES } from './lexicalRules'
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
  it('has exactly 29 rules with unique ids and valid subtlety ratings', () => {
    expect(RULES).toHaveLength(29)
    const ids = new Set(RULES.map((r) => r.id))
    expect(ids.size).toBe(29)
    for (const rule of RULES) {
      expect(rule.subtlety).toBeGreaterThanOrEqual(1)
      expect(rule.subtlety).toBeLessThanOrEqual(5)
      expect(rule.descriptionTemplate.length).toBeGreaterThan(0)
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
  ['starts-with-vowel', ['apple', 'otter', 'umbrella'], ['cat', 'dog', 'plan']],
  ['exactly-two-vowels', ['apple', 'hello'], ['dog', 'beautiful']],
  ['no-adjacent-vowels', ['cat', 'plan', 'dog'], ['quiet', 'bead', 'ocean']],
  ['hidden-number', ['money', 'honest', 'network', 'canine', 'often'], ['cat', 'plan', 'bubble']],
  ['hidden-one', ['money', 'honest', 'stone'], ['cat', 'plan', 'bubble']],
  ['hidden-ten', ['kitten', 'tent', 'often'], ['cat', 'plan', 'bubble']],
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

describe('hidden-word-target coverage floor', () => {
  const bank = buildWordBank()

  it.each(['one', 'ten'])('target "%s" still has at least 15 matching words', (target) => {
    const count = bank.filter((w) => w.spelling.includes(target)).length
    expect(count).toBeGreaterThanOrEqual(15)
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
