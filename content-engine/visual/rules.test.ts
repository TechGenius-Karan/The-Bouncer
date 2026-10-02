import { describe, expect, it } from 'vitest'
import { RULES } from '../rules/index.js'
import { VISUAL_RULES } from './rules.js'
import { FAMILIES } from './types.js'

describe('VISUAL_RULES', () => {
  it('ids are unique, visual-prefixed kebab slugs', () => {
    const ids = VISUAL_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^visual-[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  it('no word rule id could clash with a visual one in the shared rules collection', () => {
    expect(RULES.filter((r) => r.id.startsWith('visual-'))).toEqual([])
  })

  it('every family has at least one rule', () => {
    const used = new Set(VISUAL_RULES.map((r) => r.family))
    expect(FAMILIES.filter((f) => !used.has(f))).toEqual([])
  })

  it('every reveal is one plain sentence', () => {
    for (const rule of VISUAL_RULES) expect(rule.reveal).toMatch(/^[A-Z][^.!?]*\.$/)
  })
})
