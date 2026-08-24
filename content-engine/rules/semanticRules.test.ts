import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank'
import { buildLetterFeatures } from '../words/features'
import { SEMANTIC_RULES } from './semanticRules'
import type { Word } from '../words/types'

function wordFor(spelling: string): Word {
  const bank = buildWordBank()
  const found = bank.find((w) => w.spelling === spelling)
  if (found) return found
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
  const rule = SEMANTIC_RULES.find((r) => r.id === id)
  if (!rule) throw new Error(`Unknown rule id: ${id}`)
  return rule
}

describe('registry sanity', () => {
  it('has exactly 7 rules with unique ids and valid subtlety ratings', () => {
    expect(SEMANTIC_RULES).toHaveLength(7)
    const ids = new Set(SEMANTIC_RULES.map((r) => r.id))
    expect(ids.size).toBe(7)
    for (const rule of SEMANTIC_RULES) {
      expect(rule.subtlety).toBeGreaterThanOrEqual(1)
      expect(rule.subtlety).toBeLessThanOrEqual(5)
      expect(rule.descriptionTemplate.length).toBeGreaterThan(0)
      expect(rule.family).toBe('semantic-knowledge')
    }
  })

  // Regression guard for the word-count problem found while planning Step 5:
  // a rule outside medium's [2,3] subtlety window is only ever picked if the
  // tier's eligible-rule filter comes up empty, which it won't given how many
  // lexical rules exist — so a rule rated outside [2,3] here is effectively
  // dead code today (none of these are rated for spicy's [4,5] either).
  it("every rule is rated within medium tier's eligible [2,3] subtlety window", () => {
    for (const rule of SEMANTIC_RULES) {
      expect(rule.subtlety).toBeGreaterThanOrEqual(2)
      expect(rule.subtlety).toBeLessThanOrEqual(3)
    }
  })

  // Regression guard for the other problem found while planning Step 5: a
  // category with fewer than clueCountIn (3) matching words can never draft
  // a clue set, and fewer than ~6-7 leaves no spare words for a non-degenerate
  // guest pool. See build-plan.md Phase 10.5 §2 Step 5's word-count analysis.
  it('every category has enough tagged words for a healthy clue set + guest pool', () => {
    const bank = buildWordBank()
    for (const rule of SEMANTIC_RULES) {
      const matchCount = bank.filter((w) => rule.evaluate(w)).length
      expect(matchCount).toBeGreaterThanOrEqual(6)
    }
  })
})

describe.each([
  ['category-animal', ['kitten', 'puppy', 'dog', 'otter', 'dolphin'], ['apple', 'car', 'hammer']],
  ['category-fruit', ['apple', 'orange', 'banana', 'mango'], ['dog', 'hammer', 'car']],
  ['category-vehicle', ['rocket', 'car', 'train', 'bicycle'], ['apple', 'dog', 'hammer']],
  ['category-building', ['mosque', 'castle', 'library', 'barn'], ['dog', 'apple', 'car']],
  ['category-bird', ['eagle', 'penguin', 'sparrow', 'falcon'], ['dog', 'car', 'apple']],
  ['category-tool', ['square', 'hammer', 'needle', 'wrench'], ['dog', 'apple', 'car']],
  ['category-body-part', ['brain', 'face', 'elbow', 'shoulder'], ['dog', 'apple', 'car']],
])('rule: %s', (id, inWords, outWords) => {
  const rule = ruleById(id as string)

  it.each(inWords as string[])('marks "%s" as IN', (spelling) => {
    expect(rule.evaluate(wordFor(spelling))).toBe(true)
  })

  it.each(outWords as string[])('marks "%s" as OUT', (spelling) => {
    expect(rule.evaluate(wordFor(spelling))).toBe(false)
  })

  it('marks a word with no tags at all as OUT', () => {
    expect(rule.evaluate(wordFor('word'))).toBe(false)
  })
})
