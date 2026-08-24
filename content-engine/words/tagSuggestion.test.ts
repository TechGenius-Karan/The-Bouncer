import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./dictionarySources', () => ({
  fetchWordnetHyponymsDeep: vi.fn(),
  fetchDatamuseRelations: vi.fn(),
}))

import { fetchDatamuseRelations, fetchWordnetHyponymsDeep } from './dictionarySources'
import { suggestCategoryTag, suggestPropertyTag } from './tagSuggestion'

const mockFetchWordnetHyponyms = vi.mocked(fetchWordnetHyponymsDeep)
const mockFetchDatamuseRelations = vi.mocked(fetchDatamuseRelations)

describe('suggestCategoryTag', () => {
  beforeEach(() => {
    mockFetchWordnetHyponyms.mockReset()
  })

  it('matches seed spellings against WordNet hyponyms, case-insensitively', async () => {
    mockFetchWordnetHyponyms.mockResolvedValue([
      { word: 'mango', senseGloss: 'a tropical fruit' },
      { word: 'edible fruit', senseGloss: 'a tropical fruit' },
    ])

    const result = await suggestCategoryTag('fruit', ['Mango', 'onion', 'apple'])

    expect(result).toEqual({ tag: 'category:fruit', matchedWords: ['Mango'] })
  })

  it('slugs multi-word target terms in the tag name', async () => {
    mockFetchWordnetHyponyms.mockResolvedValue([])

    const result = await suggestCategoryTag('body part', ['hand'])

    expect(result.tag).toBe('category:body-part')
  })

  it('returns no matches when nothing in the bank overlaps', async () => {
    mockFetchWordnetHyponyms.mockResolvedValue([{ word: 'trumpet', senseGloss: '' }])

    const result = await suggestCategoryTag('musical instrument', ['onion', 'apple'])

    expect(result.matchedWords).toEqual([])
  })
})

describe('suggestPropertyTag', () => {
  beforeEach(() => {
    mockFetchDatamuseRelations.mockReset()
  })

  it('unions ml and rel_trg results and matches case-insensitively', async () => {
    mockFetchDatamuseRelations.mockImplementation(async (_word, relation) => {
      if (relation === 'ml') return [{ word: 'frost' }, { word: 'snow' }]
      return [{ word: 'Winter' }]
    })

    const result = await suggestPropertyTag('cold', ['Frost', 'winter', 'summer'])

    expect(result.tag).toBe('property:cold')
    expect(result.matchedWords.sort()).toEqual(['Frost', 'winter'])
  })

  it('deduplicates a word appearing in both relations', async () => {
    mockFetchDatamuseRelations.mockResolvedValue([{ word: 'kitchen' }])

    const result = await suggestPropertyTag('kitchen', ['kitchen'])

    expect(result.matchedWords).toEqual(['kitchen'])
  })
})
