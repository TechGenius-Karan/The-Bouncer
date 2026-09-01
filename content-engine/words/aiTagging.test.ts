import { describe, expect, it } from 'vitest'
import { buildTaggingPrompt, parseTaggingResponse, toTagRecord } from './aiTagging'

const requested = ['eagle', 'hammer', 'sofa', 'running', 'plant', 'room', 'job', 'time', 'body']

describe('parseTaggingResponse', () => {
  it('accepts valid words with valid categories', () => {
    const result = parseTaggingResponse(
      [
        { word: 'eagle', categories: ['bird'] },
        { word: 'hammer', categories: ['tool'] },
      ],
      requested
    )
    expect(result).toEqual([
      { word: 'eagle', categories: ['bird'] },
      { word: 'hammer', categories: ['tool'] },
    ])
  })

  it('drops words that were never asked about', () => {
    // The model inventing extra words is a real failure mode; those must not
    // reach the word bank, where they'd become entries with no letter features.
    const result = parseTaggingResponse([{ word: 'penguin', categories: ['bird'] }], requested)
    expect(result).toEqual([])
  })

  it('drops categories that are not in the fixed list', () => {
    const result = parseTaggingResponse(
      [{ word: 'eagle', categories: ['bird', 'flying-thing', 'raptor'] }],
      requested
    )
    expect(result).toEqual([{ word: 'eagle', categories: ['bird'] }])
  })

  it('omits words the model returned with no categories', () => {
    const result = parseTaggingResponse([{ word: 'running', categories: [] }], requested)
    expect(result).toEqual([])
  })

  it('omits a word whose categories were all invalid', () => {
    const result = parseTaggingResponse([{ word: 'running', categories: ['activity'] }], requested)
    expect(result).toEqual([])
  })

  it('normalizes case and whitespace, and de-duplicates', () => {
    const result = parseTaggingResponse(
      [
        { word: '  Eagle ', categories: ['bird', 'bird'] },
        { word: 'eagle', categories: ['animal'] }, // duplicate word — first wins
      ],
      requested
    )
    expect(result).toEqual([{ word: 'eagle', categories: ['bird'] }])
  })

  // Observed model behaviour, not hypothetical: a dry run tagged "job" as a
  // profession, "time" as a time-period, "body" as a body-part and "game" as a
  // toy. Those make a puzzle trivially guessable at best and wrong at worst.
  it('drops self-referential tags — a plant is not an example of a plant', () => {
    expect(parseTaggingResponse([{ word: 'plant', categories: ['plant'] }], requested)).toEqual([])
    expect(parseTaggingResponse([{ word: 'room', categories: ['room'] }], requested)).toEqual([])
  })

  it('keeps a valid second category when only the self-referential one is dropped', () => {
    const result = parseTaggingResponse([{ word: 'plant', categories: ['plant', 'food'] }], requested)
    expect(result).toEqual([{ word: 'plant', categories: ['food'] }])
  })

  it('drops generic terms that name categories rather than belonging to them', () => {
    expect(parseTaggingResponse([{ word: 'job', categories: ['profession'] }], requested)).toEqual([])
    expect(parseTaggingResponse([{ word: 'time', categories: ['time-period'] }], requested)).toEqual([])
    expect(parseTaggingResponse([{ word: 'body', categories: ['body-part'] }], requested)).toEqual([])
  })

  it('returns an empty list for malformed shapes rather than throwing', () => {
    expect(parseTaggingResponse(null, requested)).toEqual([])
    expect(parseTaggingResponse('nonsense', requested)).toEqual([])
    expect(parseTaggingResponse([null, 42, 'x'], requested)).toEqual([])
    expect(parseTaggingResponse([{ word: 'eagle' }], requested)).toEqual([])
    expect(parseTaggingResponse([{ word: 'eagle', categories: 'bird' }], requested)).toEqual([])
  })
})

describe('toTagRecord', () => {
  it('prefixes category ids into full tags', () => {
    expect(toTagRecord([{ word: 'eagle', categories: ['bird', 'animal'] }])).toEqual({
      eagle: ['category:bird', 'category:animal'],
    })
  })
})

describe('buildTaggingPrompt', () => {
  it('includes every category definition and the requested words', () => {
    const prompt = buildTaggingPrompt(['eagle', 'hammer'])
    expect(prompt).toContain('bird:')
    expect(prompt).toContain('instrument:')
    expect(prompt).toContain('eagle, hammer')
    // The dominant-sense discipline is the whole point of the prompt.
    expect(prompt).toContain('DOMINANT')
  })
})
