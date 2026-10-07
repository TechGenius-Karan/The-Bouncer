import { describe, expect, it } from 'vitest'
import { isCandidate, openMojiSvgUrl, type OpenMojiEntry } from './openmoji.js'

const entry = (overrides: Partial<OpenMojiEntry>): OpenMojiEntry => ({
  hexcode: '1F9C8',
  annotation: 'butter',
  group: 'food-drink',
  subgroups: 'food-prepared',
  skintone: '',
  ...overrides,
})

describe('openMojiSvgUrl', () => {
  it('points at the black line set of the pinned release', () => {
    expect(openMojiSvgUrl('1F9C8')).toBe(
      'https://cdn.jsdelivr.net/npm/openmoji@17.0.0/black/svg/1F9C8.svg'
    )
  })
})

describe('isCandidate', () => {
  it('keeps every subgroup of the whole-group scopes', () => {
    expect(isCandidate(entry({}))).toBe(true)
    expect(isCandidate(entry({ group: 'objects', subgroups: 'tool' }))).toBe(true)
    expect(isCandidate(entry({ group: 'animals-nature', subgroups: 'animal-marine' }))).toBe(true)
  })

  it('keeps only the picked subgroups of mixed groups', () => {
    expect(isCandidate(entry({ group: 'travel-places', subgroups: 'transport-ground' }))).toBe(true)
    // The umbrella lives here; the suns and clouds are dropped by hand.
    expect(isCandidate(entry({ group: 'travel-places', subgroups: 'sky-weather' }))).toBe(true)
    expect(isCandidate(entry({ group: 'travel-places', subgroups: 'place-building' }))).toBe(false)
    expect(isCandidate(entry({ group: 'activities', subgroups: 'sport' }))).toBe(true)
  })

  it('drops people, symbols and flags', () => {
    expect(isCandidate(entry({ group: 'people-body', subgroups: 'person' }))).toBe(false)
    expect(isCandidate(entry({ group: 'symbols', subgroups: 'arrow' }))).toBe(false)
    expect(isCandidate(entry({ group: 'flags', subgroups: 'country-flag' }))).toBe(false)
  })

  it('drops skin-tone variants and multi-codepoint sequences', () => {
    expect(isCandidate(entry({ skintone: '1F3FB' }))).toBe(false)
    expect(isCandidate(entry({ hexcode: '1F43B-200D-2744-FE0F' }))).toBe(false)
  })
})
