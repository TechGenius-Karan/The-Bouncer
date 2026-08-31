import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import type { Rule } from '../rules/types'
import { buildWordBank } from '../words/wordBank'
import { MEDIUM_KNOBS } from './difficulty'
import { draftClueSet } from './draftClueSet'

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
})
