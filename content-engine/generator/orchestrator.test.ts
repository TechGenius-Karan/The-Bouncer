import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { resolveKnobs, subtletyRangeFor } from './difficulty'
import { buildRuleIndex } from './lookup'
import { generateCandidate } from './orchestrator'
import { validateAndRepair } from './validator'

const wordBank = buildWordBank()
const ruleIndex = buildRuleIndex(RULES)
const RUNS_PER_TIER = 5

describe.each(['medium', 'spicy'] as const)('generateCandidate(%s)', (tier) => {
  const knobs = resolveKnobs(tier)

  it('produces structurally valid, already-validated candidates', () => {
    for (let i = 0; i < RUNS_PER_TIER; i++) {
      const candidate = generateCandidate(tier, wordBank, RULES)
      expect(candidate, `generateCandidate(${tier}) returned null on run ${i}`).not.toBeNull()
      if (!candidate) continue

      expect(candidate.status).toBe('pending_approval')
      expect(candidate.difficultyTier).toBe(tier)
      expect(candidate.knobValues).toEqual(knobs)
      expect(RULES.some((r) => r.id === candidate.ruleId)).toBe(true)

      expect(candidate.clues.filter((c) => c.label === 'IN')).toHaveLength(knobs.clueCountIn)
      expect(candidate.clues.filter((c) => c.label === 'OUT')).toHaveLength(knobs.clueCountOut)
      expect(candidate.guests).toHaveLength(knobs.poolSize)

      const allIds = [...candidate.clues.map((c) => c.wordId), ...candidate.guests.map((g) => g.wordId)]
      expect(new Set(allIds).size).toBe(allIds.length) // no word reused across clues+pool

      // Round-trip: re-validating an emitted candidate should need zero further repairs.
      const before = JSON.stringify(candidate.guests)
      const result = validateAndRepair(candidate, RULES, ruleIndex, wordBank)
      expect(result.status).toBe('valid')
      expect(JSON.stringify(candidate.guests)).toBe(before)
    }
  })

  // Phase 10.6 item 2: rejectCounts is optional and softly deprioritizes,
  // never excludes, a rule — generation must still succeed even when every
  // eligible rule for this tier has been "recently rejected."
  it('still produces a valid candidate when every eligible rule has reject history', () => {
    const [min, max] = subtletyRangeFor(tier)
    const eligible = RULES.filter((r) => r.subtlety >= min && r.subtlety <= max)
    const rejectCounts = new Map(eligible.map((r) => [r.id, 10]))
    const candidate = generateCandidate(tier, wordBank, RULES, new Set(), new Set(), rejectCounts)
    expect(candidate).not.toBeNull()
  })
})
