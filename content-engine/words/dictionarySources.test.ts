import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLookup, mockGet } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockGet: vi.fn(),
}))

vi.mock('natural', () => {
  class MockWordNet {
    lookup(...args: unknown[]) {
      return (mockLookup as (...a: unknown[]) => unknown)(...args)
    }
    get(...args: unknown[]) {
      return (mockGet as (...a: unknown[]) => unknown)(...args)
    }
  }
  return { default: { WordNet: MockWordNet } }
})

import {
  fetchDatamuseRelations,
  fetchWordnetHypernyms,
  fetchWordnetHyponyms,
  fetchWordnetHyponymsDeep,
} from './dictionarySources'

describe('fetchDatamuseRelations', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns parsed results on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ word: 'snow', score: 100 }],
    }) as unknown as typeof fetch

    const result = await fetchDatamuseRelations('ice', 'ml')

    expect(result).toEqual([{ word: 'snow', score: 100 }])
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('ml=ice'))
  })

  it('returns an empty array on a non-ok response instead of throwing', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    const result = await fetchDatamuseRelations('ice', 'ml')

    expect(result).toEqual([])
  })

  it('returns an empty array when fetch itself throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const result = await fetchDatamuseRelations('ice', 'rel_trg')

    expect(result).toEqual([])
  })
})

describe('fetchWordnetHypernyms', () => {
  beforeEach(() => {
    mockLookup.mockReset()
    mockGet.mockReset()
  })

  it('resolves noun-sense hypernyms to their words, skipping non-noun senses', async () => {
    mockLookup.mockImplementation((_word: string, cb: (results: unknown[]) => void) => {
      cb([
        {
          pos: 'n',
          synonyms: ['mango'],
          gloss: 'large oval tropical fruit',
          ptrs: [{ pointerSymbol: '@', synsetOffset: 123, pos: 'n' }],
        },
        {
          // verb sense — should be filtered out entirely, per Step 1's finding
          pos: 'v',
          synonyms: ['mango'],
          gloss: 'an unrelated verb sense',
          ptrs: [{ pointerSymbol: '@', synsetOffset: 999, pos: 'v' }],
        },
      ])
    })
    mockGet.mockImplementation((_offset: number, _pos: string, cb: (result: unknown) => void) => {
      cb({ synonyms: ['edible_fruit', 'produce'], gloss: '', pos: 'n', ptrs: [] })
    })

    const result = await fetchWordnetHypernyms('mango')

    expect(result).toEqual([
      { word: 'edible fruit', senseGloss: 'large oval tropical fruit' },
      { word: 'produce', senseGloss: 'large oval tropical fruit' },
    ])
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('returns an empty array when lookup throws', async () => {
    mockLookup.mockImplementation(() => {
      throw new Error('index file missing')
    })

    const result = await fetchWordnetHypernyms('xyzzy')

    expect(result).toEqual([])
  })

  it('skips a hypernym pointer that fails to resolve, without losing the rest', async () => {
    mockLookup.mockImplementation((_word: string, cb: (results: unknown[]) => void) => {
      cb([
        {
          pos: 'n',
          synonyms: ['hammer'],
          gloss: 'a hand tool',
          ptrs: [
            { pointerSymbol: '@', synsetOffset: 1, pos: 'n' },
            { pointerSymbol: '@', synsetOffset: 2, pos: 'n' },
          ],
        },
      ])
    })
    mockGet
      .mockImplementationOnce(() => {
        throw new Error('bad offset')
      })
      .mockImplementationOnce((_offset: number, _pos: string, cb: (result: unknown) => void) => {
        cb({ synonyms: ['tool'], gloss: '', pos: 'n', ptrs: [] })
      })

    const result = await fetchWordnetHypernyms('hammer')

    expect(result).toEqual([{ word: 'tool', senseGloss: 'a hand tool' }])
  })
})

describe('fetchWordnetHyponyms', () => {
  beforeEach(() => {
    mockLookup.mockReset()
    mockGet.mockReset()
  })

  it('resolves noun-sense hyponyms (category members), ignoring hypernym pointers on the same sense', async () => {
    mockLookup.mockImplementation((_word: string, cb: (results: unknown[]) => void) => {
      cb([
        {
          pos: 'n',
          synonyms: ['fruit'],
          gloss: 'the ripened reproductive body of a seed plant',
          ptrs: [
            { pointerSymbol: '~', synsetOffset: 10, pos: 'n' },
            { pointerSymbol: '@', synsetOffset: 20, pos: 'n' }, // hypernym — should be ignored here
          ],
        },
      ])
    })
    mockGet.mockImplementation((_offset: number, _pos: string, cb: (result: unknown) => void) => {
      cb({ synonyms: ['mango'], gloss: '', pos: 'n', ptrs: [] })
    })

    const result = await fetchWordnetHyponyms('fruit')

    expect(result).toEqual([
      { word: 'mango', senseGloss: 'the ripened reproductive body of a seed plant' },
    ])
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith(10, 'n', expect.any(Function))
  })

  it('returns an empty array when lookup throws', async () => {
    mockLookup.mockImplementation(() => {
      throw new Error('index file missing')
    })

    const result = await fetchWordnetHyponyms('xyzzy')

    expect(result).toEqual([])
  })
})

describe('fetchWordnetHyponymsDeep', () => {
  beforeEach(() => {
    mockLookup.mockReset()
    mockGet.mockReset()
  })

  function mockChainTaxonomy() {
    // animal -> vertebrate -> mammal -> dog (each one hyponym level deeper)
    mockLookup.mockImplementation((_word: string, cb: (results: unknown[]) => void) => {
      cb([
        {
          pos: 'n',
          synonyms: ['animal'],
          gloss: 'a living organism',
          ptrs: [{ pointerSymbol: '~', synsetOffset: 100, pos: 'n' }],
        },
      ])
    })
    mockGet.mockImplementation((offset: number, _pos: string, cb: (result: unknown) => void) => {
      const bySynset: Record<number, unknown> = {
        100: {
          synonyms: ['vertebrate'],
          gloss: '',
          pos: 'n',
          ptrs: [{ pointerSymbol: '~', synsetOffset: 200, pos: 'n' }],
        },
        200: {
          synonyms: ['mammal'],
          gloss: '',
          pos: 'n',
          ptrs: [{ pointerSymbol: '~', synsetOffset: 300, pos: 'n' }],
        },
        300: { synonyms: ['dog'], gloss: '', pos: 'n', ptrs: [] },
      }
      cb(bySynset[offset])
    })
  }

  it('walks multiple hyponym levels, not just the first', async () => {
    mockChainTaxonomy()

    const result = await fetchWordnetHyponymsDeep('animal', 4)

    expect(result.map((r) => r.word).sort()).toEqual(['dog', 'mammal', 'vertebrate'])
    // every result carries the *original* word's sense gloss, not an intermediate one
    expect(result.every((r) => r.senseGloss === 'a living organism')).toBe(true)
  })

  it('respects the depth cap', async () => {
    mockChainTaxonomy()

    const result = await fetchWordnetHyponymsDeep('animal', 2)

    expect(result.map((r) => r.word).sort()).toEqual(['mammal', 'vertebrate'])
  })

  it('does not loop forever on a cyclic hyponym pointer', async () => {
    mockLookup.mockImplementation((_word: string, cb: (results: unknown[]) => void) => {
      cb([
        {
          pos: 'n',
          synonyms: ['loop'],
          gloss: '',
          ptrs: [{ pointerSymbol: '~', synsetOffset: 1, pos: 'n' }],
        },
      ])
    })
    mockGet.mockImplementation((_offset: number, _pos: string, cb: (result: unknown) => void) => {
      // synset 1's own hyponym pointer points right back at itself
      cb({
        synonyms: ['self'],
        gloss: '',
        pos: 'n',
        ptrs: [{ pointerSymbol: '~', synsetOffset: 1, pos: 'n' }],
      })
    })

    const result = await fetchWordnetHyponymsDeep('loop', 10)

    expect(result).toEqual([{ word: 'self', senseGloss: '' }])
  })
})
