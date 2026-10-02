import { describe, expect, it } from 'vitest'
import { buildMatrix, type TagTable } from './matrix.js'
import { buildMatrixReport, compareRules, countRule } from './report.js'
import type { Family, Item, VisualRule } from './types.js'

// 100 numbered items: i0 … i99.
const ITEMS: Item[] = Array.from({ length: 100 }, (_, n) => ({
  id: `i${n}`,
  name: `item ${n}`,
  group: 'thing',
  icon: { set: 'openmoji', hex: '2693' },
}))
const ids = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, n) => `i${from + n}`).join(' ')

const rule = (id: string, family: Family = 'physical', extra: Partial<VisualRule> = {}) => ({
  id,
  family,
  reveal: 'It is a thing.',
  ...extra,
})

describe('countRule', () => {
  it('counts each answer, keeps unsure apart from untagged, and ignores blocked items', () => {
    const items = [...ITEMS.slice(0, 50), { ...ITEMS[50], blocked: true }]
    const matrix = buildMatrix(
      { 'visual-a': { yes: ids(0, 20), no: ids(20, 40), unsure: `${ids(40, 45)} i50` } },
      {}
    )
    expect(countRule(rule('visual-a'), items, matrix)).toEqual({
      ruleId: 'visual-a',
      family: 'physical',
      yes: 20,
      no: 20,
      unsure: 5,
      untagged: 5,
      eligible: true,
    })
  })

  it('needs 20 definite answers on each side, and is never eligible once retired', () => {
    const matrix = buildMatrix(
      {
        'visual-a': { yes: ids(0, 19), no: ids(19, 100) },
        'visual-b': { yes: ids(0, 50), no: ids(50, 100) },
      },
      {}
    )
    expect(countRule(rule('visual-a'), ITEMS, matrix).eligible).toBe(false)
    expect(countRule(rule('visual-b'), ITEMS, matrix).eligible).toBe(true)
    expect(countRule(rule('visual-b', 'physical', { retired: true }), ITEMS, matrix).eligible).toBe(
      false
    )
  })
})

describe('compareRules', () => {
  const compare = (a: TagTable[string], b: TagTable[string]) =>
    compareRules(
      rule('visual-a'),
      rule('visual-b'),
      ITEMS,
      buildMatrix({ 'visual-a': a, 'visual-b': b }, {})
    )

  it('does not call two unrelated sparse rules alike just because both are mostly no', () => {
    const result = compare(
      { yes: ids(0, 5), no: ids(5, 100) },
      { yes: ids(5, 10), no: `${ids(0, 5)} ${ids(10, 100)}` }
    )
    expect(result.same).toBe(0)
  })

  it('does not call two unrelated dense rules alike just because both are mostly yes', () => {
    const result = compare(
      { yes: ids(0, 95), no: ids(95, 100) },
      { yes: `${ids(0, 90)} ${ids(95, 100)}`, no: ids(90, 95) }
    )
    expect(result.same).toBe(0)
  })

  it('scores the same idea with a few differences high', () => {
    const result = compare(
      { yes: ids(0, 20), no: ids(20, 100) },
      { yes: `${ids(0, 18)} ${ids(20, 22)}`, no: `${ids(18, 20)} ${ids(22, 100)}` }
    )
    expect(result.same).toBeCloseTo(18 / 22)
  })

  it('scores a rule against its inverse as opposite', () => {
    const result = compare(
      { yes: ids(0, 40), no: ids(40, 100) },
      { yes: ids(40, 100), no: ids(0, 40) }
    )
    expect(result.opposite).toBe(1)
    expect(result.same).toBe(0)
  })

  it('only counts items both rules answer definitely', () => {
    expect(compare({ yes: ids(0, 50) }, { yes: ids(25, 100) }).shared).toBe(25)
  })
})

describe('buildMatrixReport', () => {
  const half = { yes: ids(0, 50), no: ids(50, 100) }
  const inverse = { yes: ids(50, 100), no: ids(0, 50) }
  const other = {
    yes: ids(0, 100)
      .split(' ')
      .filter((_, n) => n % 2 === 0)
      .join(' '),
    no: ids(0, 100)
      .split(' ')
      .filter((_, n) => n % 2 === 1)
      .join(' '),
  }

  it('flags near-duplicates in both directions, skipping retired rules', () => {
    const rules = [
      rule('visual-a'),
      rule('visual-b'),
      rule('visual-c'),
      rule('visual-d', 'physical', { retired: true }),
    ]
    const matrix = buildMatrix(
      { 'visual-a': half, 'visual-b': inverse, 'visual-c': other, 'visual-d': half },
      {}
    )
    const report = buildMatrixReport(rules, ITEMS, matrix)
    expect(report.nearDuplicates).toEqual([
      { a: 'visual-a', b: 'visual-b', inverted: true, similarity: 1, shared: 100 },
    ])
    expect(report.eligibleCount).toBe(3)
  })

  it('flags a family holding more than a third of the eligible rules', () => {
    const rules = [rule('visual-a', 'shape'), rule('visual-b', 'shape'), rule('visual-c', 'senses')]
    const matrix = buildMatrix({ 'visual-a': half, 'visual-b': other, 'visual-c': half }, {})
    expect(buildMatrixReport(rules, ITEMS, matrix).oversizeFamilies).toEqual([
      { family: 'shape', eligible: 2, share: 2 / 3 },
    ])
  })
})
