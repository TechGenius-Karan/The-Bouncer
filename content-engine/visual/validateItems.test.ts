import { describe, expect, it } from 'vitest'
import { ITEMS } from './items.js'
import type { Item } from './types.js'
import { validateItems } from './validateItems.js'

const om = (id: string, name: string, hex: string): Item => ({
  id,
  name,
  group: 'thing',
  icon: { set: 'openmoji', hex },
})

describe('validateItems', () => {
  it('accepts a well-formed bank', () => {
    expect(
      validateItems([om('ice-cube', 'ice cube', '1F9CA'), om('anchor', 'anchor', '2693')])
    ).toEqual([])
  })

  it('rejects an id that is not a kebab-case slug', () => {
    expect(validateItems([om('Ice_Cube', 'ice cube', '1F9CA')])).toEqual([
      'Ice_Cube: id must be a kebab-case slug',
    ])
  })

  it('rejects duplicate ids and duplicate names', () => {
    const problems = validateItems([
      om('anchor', 'anchor', '2693'),
      om('anchor', 'boat anchor', '1F9CA'),
      om('ship-anchor', 'anchor', '26F5'),
    ])
    expect(problems).toContain('anchor: duplicate id')
    expect(problems).toContain('ship-anchor: duplicate name "anchor"')
  })

  it('rejects a caption that is not lowercase, trimmed and single-spaced', () => {
    expect(validateItems([om('ice-cube', 'Ice  cube ', '1F9CA')])).toEqual([
      'ice-cube: name must be non-empty, lowercase, trimmed and single-spaced',
    ])
  })

  it('rejects a malformed OpenMoji hexcode', () => {
    expect(validateItems([om('anchor', 'anchor', '2693.svg')])).toEqual([
      'anchor: "2693.svg" is not an OpenMoji hexcode',
    ])
  })

  // Two items on one icon can't be told apart on a card.
  it('rejects two items sharing one icon', () => {
    const items = [om('ice', 'ice', '1F9CA'), om('ice-cube', 'ice cube', '1F9CA')]
    expect(validateItems(items)).toEqual(['ice-cube: icon is already used by another item'])
  })

  it('requires a creator and a Noun Project page for the credits screen', () => {
    const noun: Item = {
      id: 'kettle',
      name: 'kettle',
      group: 'thing',
      icon: { set: 'noun', creator: ' ', url: 'https://example.com/kettle' },
    }
    expect(validateItems([noun])).toEqual([
      'kettle: a Noun Project icon needs its creator for the credits screen',
      'kettle: a Noun Project icon needs its https://thenounproject.com/ page',
    ])
  })

  it('passes for the real item bank', () => {
    expect(validateItems(ITEMS)).toEqual([])
  })
})
