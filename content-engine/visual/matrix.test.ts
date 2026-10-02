import { describe, expect, it } from 'vitest'
import { ITEMS } from './items.js'
import { buildMatrix, validateTagTable } from './matrix.js'
import { VISUAL_RULES } from './rules.js'
import { TAG_FILES } from './tags/index.js'

describe('buildMatrix', () => {
  const matrix = buildMatrix(
    { 'visual-floats': { yes: 'cork ice-cube', no: 'anchor', unsure: 'bottle' } },
    { 'visual-floats': { no: 'ice-cube', yes: 'anchor' }, 'visual-round': { yes: 'coin' } }
  )

  it('reads yes as true and no as false', () => {
    expect(matrix.valueOf('cork', 'visual-floats')).toBe(true)
    expect(matrix.valueOf('anchor', 'visual-round')).toBe(null)
  })

  it('lets an override win over the AI answer, in either direction', () => {
    expect(matrix.valueOf('ice-cube', 'visual-floats')).toBe(false)
    expect(matrix.valueOf('anchor', 'visual-floats')).toBe(true)
  })

  it('reads an override for a rule the AI never drafted', () => {
    expect(matrix.valueOf('coin', 'visual-round')).toBe(true)
  })

  it('reads unsure and untagged both as null, but keeps them apart for reports', () => {
    expect(matrix.valueOf('bottle', 'visual-floats')).toBe(null)
    expect(matrix.valueOf('kite', 'visual-floats')).toBe(null)
    expect(matrix.cellOf('bottle', 'visual-floats')).toBe('unsure')
    expect(matrix.cellOf('kite', 'visual-floats')).toBeUndefined()
  })
})

describe('validateTagTable', () => {
  const rules = new Set(['visual-floats'])
  const items = new Set(['cork', 'anchor'])

  it('accepts a sound table', () => {
    expect(
      validateTagTable({ 'visual-floats': { yes: 'cork', no: 'anchor' } }, rules, items)
    ).toEqual([])
  })

  it('reports an unknown rule, an unknown item and an item in two lists', () => {
    expect(
      validateTagTable(
        {
          'visual-sinks': {},
          'visual-floats': { yes: 'cork anchor', no: 'anchor cork-board' },
        },
        rules,
        items
      )
    ).toEqual([
      'visual-sinks: no such rule in this family',
      'visual-floats: "anchor" is listed more than once',
      'visual-floats: unknown item "cork-board"',
    ])
  })
})

// This is also what keeps rule and item ids permanent: renaming either one
// leaves a tag pointing at an id that no longer exists.
describe('committed tag files', () => {
  const itemIds = new Set(ITEMS.map((i) => i.id))

  it.each(Object.entries(TAG_FILES))(
    '%s: every rule and item exists, each listed once',
    (family, files) => {
      const ruleIds = new Set(VISUAL_RULES.filter((r) => r.family === family).map((r) => r.id))
      expect(validateTagTable(files.ai, ruleIds, itemIds)).toEqual([])
      expect(validateTagTable(files.overrides, ruleIds, itemIds)).toEqual([])
    }
  )
})
