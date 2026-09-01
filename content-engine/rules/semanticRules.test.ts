import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank'
import { buildLetterFeatures } from '../words/features'
import { RULES } from './index'
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
    properNoun: false,
    tags: [],
    safety: { blocked: false, needsReview: false },
  }
}

const CATEGORY_RULES = RULES.filter((r) => r.templateId === 'category')

function ruleById(id: string) {
  const rule = CATEGORY_RULES.find((r) => r.id === id)
  if (!rule) throw new Error(`Unknown rule id: ${id}`)
  return rule
}

// Category rules are now generated from tag coverage (generatedRules.ts)
// rather than hand-written, so the count moves with the word bank by design.
describe('registry sanity', () => {
  it('has category rules with unique ids and valid ratings', () => {
    expect(CATEGORY_RULES.length).toBeGreaterThanOrEqual(7)
    const ids = new Set(CATEGORY_RULES.map((r) => r.id))
    expect(ids.size).toBe(CATEGORY_RULES.length)
    for (const rule of CATEGORY_RULES) {
      expect(rule.subtlety).toBeGreaterThanOrEqual(1)
      expect(rule.subtlety).toBeLessThanOrEqual(5)
      expect(rule.descriptionTemplate.length).toBeGreaterThan(0)
      expect(rule.family).toBe('semantic-knowledge')
    }
  })

  // A category with fewer than clueCountIn (3) matching words can never draft
  // a clue set, and fewer than ~6-7 leaves no spare words for a non-degenerate
  // guest pool. buildRuleParams enforces a floor of 25 before a category
  // becomes a rule at all; this asserts the promotion actually held.
  it('every category rule has enough tagged words for a healthy clue set + guest pool', () => {
    const bank = buildWordBank()
    for (const rule of CATEGORY_RULES) {
      const matchCount = bank.filter((w) => rule.evaluate(w)).length
      expect(matchCount, `category rule "${rule.id}" only matches ${matchCount} words`).toBeGreaterThanOrEqual(25)
    }
  })
})

// Which categories become rules is data-driven — a category is promoted only
// once its tag coverage clears buildRuleParams' floor — so these rows are
// filtered to whatever is currently promoted rather than hardcoding a set that
// breaks whenever coverage shifts. The assertions themselves are the point:
// each promoted category must actually classify real words correctly.
const CATEGORY_EXPECTATIONS: [string, string[], string[]][] = [
  ['category-animal', ['kitten', 'puppy', 'dog', 'otter', 'dolphin'], ['apple', 'car', 'hammer']],
  ['category-fruit', ['apple', 'orange', 'banana', 'mango'], ['dog', 'hammer', 'car']],
  ['category-vehicle', ['rocket', 'car', 'train', 'bicycle'], ['apple', 'dog', 'hammer']],
  ['category-building', ['mosque', 'castle', 'library', 'barn'], ['dog', 'apple', 'car']],
  ['category-bird', ['eagle', 'penguin', 'sparrow', 'falcon'], ['dog', 'car', 'apple']],
  ['category-tool', ['square', 'hammer', 'needle', 'wrench'], ['dog', 'apple', 'car']],
  ['category-body-part', ['brain', 'face', 'elbow', 'shoulder'], ['dog', 'apple', 'car']],
]

const promoted = new Set(CATEGORY_RULES.map((r) => r.id))
const activeExpectations = CATEGORY_EXPECTATIONS.filter(([id]) => promoted.has(id))

it('has expectations covering several promoted categories', () => {
  expect(activeExpectations.length).toBeGreaterThanOrEqual(5)
})

describe.each(activeExpectations)('rule: %s', (id, inWords, outWords) => {
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
