import { describe, expect, it } from 'vitest'
import { generateVisualBatch, toVisualPuzzleDoc, visualRunway } from './batch.js'
import { buildMatrixReport } from './report.js'
import { VISUAL_RULES } from './rules.js'
import { ITEMS } from './items.js'
import { MATRIX } from './tags/index.js'
import { worldInput } from './testWorld.js'

describe('generateVisualBatch', () => {
  it('gives every candidate a different rule, skipping used and pending ones', () => {
    const batch = generateVisualBatch(
      5,
      worldInput({ usedRuleIds: new Set(['visual-t']), pendingRuleIds: new Set(['visual-t2']) }),
      '2026-11-01'
    )
    const ruleIds = batch.map((c) => c.ruleId)
    expect(batch.length).toBeGreaterThan(0)
    expect(new Set(ruleIds).size).toBe(ruleIds.length)
    expect(ruleIds).not.toContain('visual-t')
    expect(ruleIds).not.toContain('visual-t2')
  })

  it('stops at the requested count', () => {
    expect(generateVisualBatch(1, worldInput(), '2026-11-01')).toHaveLength(1)
  })

  it('reproduces the same batch for the same date', () => {
    expect(generateVisualBatch(3, worldInput(), '2026-11-01')).toEqual(
      generateVisualBatch(3, worldInput(), '2026-11-01')
    )
  })

  it('returns an empty batch once every rule is spent', () => {
    const spent = worldInput()
    spent.usedRuleIds = new Set(spent.rules.map((r) => r.id))
    expect(generateVisualBatch(3, spent, '2026-11-01')).toEqual([])
  })
})

describe('toVisualPuzzleDoc', () => {
  it('stores kind and generatorSeed, and leaves number and date for scheduling', () => {
    const [candidate] = generateVisualBatch(1, worldInput(), '2026-11-01')
    const createdAt = new Date('2026-11-01T06:00:00Z')
    expect(toVisualPuzzleDoc(candidate, createdAt)).toEqual({
      number: null,
      kind: 'visual',
      generatorSeed: candidate.generatorSeed,
      difficultyTier: 'medium',
      ruleId: candidate.ruleId,
      status: 'pending_approval',
      date: null,
      clues: candidate.clues,
      guests: candidate.guests,
      liveDecoys: candidate.liveDecoys,
      knobValues: candidate.knobValues,
      createdAt,
    })
  })
})

describe('visualRunway', () => {
  it('equals eligibleCount from buildMatrixReport and excludes unshippable rules', () => {
    const report = buildMatrixReport(VISUAL_RULES, ITEMS, MATRIX)
    expect(visualRunway(new Set())).toBe(report.eligibleCount)
  })

  it('lowers by exactly one when a shippable rule is used', () => {
    const report = buildMatrixReport(VISUAL_RULES, ITEMS, MATRIX)
    const shippableRuleId = report.counts.find(
      (c) => c.eligible && !report.unshippable.some((u) => u.ruleId === c.ruleId)
    )?.ruleId
    expect(report.eligibleCount).toBeGreaterThan(0)
    expect(visualRunway(new Set([shippableRuleId!]))).toBe(report.eligibleCount - 1)
  })
})
