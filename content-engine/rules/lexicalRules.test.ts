import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank'
import { buildLetterFeatures } from '../words/features'
import { LEXICAL_RULES } from './lexicalRules'
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
  it('has exactly 17 rules with unique ids and valid subtlety ratings', () => {
    expect(RULES).toHaveLength(17)
    const ids = new Set(RULES.map((r) => r.id))
    expect(ids.size).toBe(17)
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
  ['starts-with-vowel', ['apple', 'otter', 'umbrella'], ['cat', 'dog', 'plan']],
  ['exactly-two-vowels', ['apple', 'hello'], ['dog', 'beautiful']],
  ['no-adjacent-vowels', ['cat', 'plan', 'dog'], ['quiet', 'bead', 'ocean']],
  ['hidden-number', ['money', 'honest', 'network', 'canine', 'often'], ['cat', 'plan', 'bubble']],
  ['third-letter-vowel', ['piano', 'poetic', 'react'], ['cabin', 'table', 'basket']],
  [
    'subsequence-ace',
    ['space', 'advice', 'distance', 'peace', 'trace'],
    ['cafe', 'ceramic', 'cat', 'plan'],
  ],
])('rule: %s', (id, inWords, outWords) => {
  const rule = ruleById(id as string)

  it.each(inWords as string[])('marks "%s" as IN', (spelling) => {
    expect(rule.evaluate(wordFor(spelling))).toBe(true)
  })

  it.each(outWords as string[])('marks "%s" as OUT', (spelling) => {
    expect(rule.evaluate(wordFor(spelling))).toBe(false)
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
