import { describe, expect, it } from 'vitest'
import { NOUN_CREDITS } from '../../src/game/iconCredits.js'
import { ITEMS } from './items.js'

// The credits screen lives in src/ and can't import the item bank, so this
// keeps its hand-kept list honest (planning-visual-pivot.md §5.2).
describe('icon credits', () => {
  it('names the creator of every Noun Project icon, and nothing else', () => {
    const expected = ITEMS.flatMap((item) =>
      item.icon.set === 'noun'
        ? [{ itemId: item.id, creator: item.icon.creator, url: item.icon.url }]
        : []
    )
    expect(NOUN_CREDITS).toEqual(expected)
  })
})
