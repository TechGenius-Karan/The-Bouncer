import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICON_OUTPUT_DIR, rawIconPath, strokeScaleFor } from './iconSources.js'
import { ITEMS } from './items.js'
import { normalizeSvg } from './normalize.js'

// Ties the committed icons to the pipeline: an item without an icon, an icon
// without an item, or an output that no longer matches what the normalizer
// produces (STROKE_SCALE changed, a raw file edited) all fail here.
describe('committed icons', () => {
  it('the pilot bank is loaded', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(150)
  })

  it('every item has its raw source file', () => {
    expect(ITEMS.filter((item) => !existsSync(rawIconPath(item))).map((i) => i.id)).toEqual([])
  })

  it('every item has an output identical to what the normalizer produces now', () => {
    const stale = ITEMS.filter((item) => {
      const out = join(ICON_OUTPUT_DIR, `${item.id}.svg`)
      if (!existsSync(out)) return true
      const result = normalizeSvg(readFileSync(rawIconPath(item), 'utf8'), strokeScaleFor(item))
      return !result.ok || readFileSync(out, 'utf8') !== result.svg
    })
    expect(stale.map((i) => i.id)).toEqual([])
  })

  it('there is no output file without an item', () => {
    const expected = new Set(ITEMS.map((i) => `${i.id}.svg`))
    const files = existsSync(ICON_OUTPUT_DIR) ? readdirSync(ICON_OUTPUT_DIR) : []
    expect(files.filter((f) => !expected.has(f))).toEqual([])
  })
})
