import { describe, expect, it } from 'vitest'
import { RULES } from '../rules/index.js'
import type { Rule } from '../rules/types.js'
import { buildWordBank } from '../words/wordBank.js'
import { MEDIUM_KNOBS } from './difficulty.js'
import { draftClueSet } from './draftClueSet.js'

const wordBank = buildWordBank()
const bySpelling = new Map(wordBank.map((w) => [w.spelling, w]))

// Regression guard for the bug that prompted the generator redesign: a real
// shipped puzzle had all three "hides a number" IN clues hiding "one"
// (`done, telephone, money`), which teaches the player a narrower rule than
// the one the pool is graded against.
describe('draftClueSet variant spread', () => {
  const variantRules = RULES.filter((r) => r.variantOf)

  it('has at least one rule with variants to exercise', () => {
    expect(variantRules.length).toBeGreaterThan(0)
  })

  it.each(variantRules.map((r) => [r.id, r] as [string, Rule]))(
    '"%s" draws IN clues spanning more than one variant',
    (_id, rule) => {
      // Repeated because the pick is randomized — one lucky draw proves nothing.
      for (let run = 0; run < 20; run++) {
        const clues = draftClueSet(rule, wordBank, MEDIUM_KNOBS)
        const variants = new Set(
          clues
            .filter((c) => c.label === 'IN')
            .map((c) => rule.variantOf!(bySpelling.get(c.wordId)!))
        )
        expect(variants.size).toBeGreaterThan(1)
      }
    }
  )

  // The variant-spreading path used to bucket the raw pool, skipping the
  // commonness and proper-noun bar that the plain path applies — so it bought
  // diversity with whatever matched. The first "starts with a K sound" puzzle
  // drew `caprice, krishna, quietly`.
  it.each(variantRules.map((r) => [r.id, r] as [string, Rule]))(
    '"%s" spans variants without resorting to proper nouns',
    (_id, rule) => {
      for (let run = 0; run < 20; run++) {
        const names = draftClueSet(rule, wordBank, MEDIUM_KNOBS)
          .map((c) => bySpelling.get(c.wordId)!)
          .filter((w) => w.properNoun)
          .map((w) => w.spelling)
        expect(names, `proper nouns used as clues`).toEqual([])
      }
    }
  )
})
