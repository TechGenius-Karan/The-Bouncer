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

  // Ids are permanent (§3.5): a mismatch here means one was removed or renamed
  // instead of retired, which orphans its tags. Regenerate with
  // `npx vitest run content-engine/visual/rules.test.ts -u` only after
  // confirming the diff is purely additive.
  it('rule ids never change', () => {
    expect(VISUAL_RULES.map((r) => r.id)).toMatchInlineSnapshot(`
      [
        "visual-has-a-handle",
        "visual-has-legs",
        "visual-has-a-tail",
        "visual-has-wheels",
        "visual-has-a-lid",
        "visual-made-of-metal",
        "visual-made-of-wood",
        "visual-made-of-fabric",
        "visual-made-of-plastic",
        "visual-found-in-a-kitchen",
        "visual-found-in-a-bathroom",
        "visual-found-on-a-farm",
        "visual-found-in-the-sea",
        "visual-found-in-a-classroom",
        "visual-found-in-a-garden",
        "visual-found-outdoors",
        "visual-found-in-most-homes",
        "visual-gives-light",
        "visual-cuts",
        "visual-makes-music",
        "visual-holds-liquid",
        "visual-builds-or-fixes",
        "visual-is-a-tool",
        "visual-played-with",
        "visual-floats",
        "visual-breaks-if-dropped",
        "visual-conducts-electricity",
        "visual-sticks-to-a-magnet",
        "visual-melts-on-a-hot-day",
        "visual-burns-easily",
        "visual-needs-power",
        "visual-worn",
        "visual-ridden",
        "visual-used-in-one-hand",
        "visual-used-with-water",
        "visual-used-every-day",
        "visual-needs-two-hands",
        "visual-fits-in-a-pocket",
        "visual-heavier-than-a-person",
        "visual-bigger-than-a-car",
        "visual-lift-with-one-hand",
        "visual-shiny",
        "visual-soft",
        "visual-smells-strong",
        "visual-loud",
        "visual-hard",
        "visual-sweet",
        "visual-alive",
        "visual-is-an-animal",
        "visual-is-food",
        "visual-is-a-vehicle",
        "visual-is-a-plant",
        "visual-grows-on-a-plant",
        "visual-from-an-animal",
        "visual-has-feathers",
        "visual-made-by-people",
        "visual-moves-by-itself",
        "visual-round",
        "visual-long-and-thin",
        "visual-has-a-hole",
        "visual-has-a-sharp-point",
        "visual-has-straight-edges",
        "visual-used-in-sport",
        "visual-at-a-party",
        "visual-winter",
        "visual-at-the-beach",
      ]
    `)
  })
})
