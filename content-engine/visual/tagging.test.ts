import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Cell } from './matrix.js'
import {
  buildRuleTaggingPrompt,
  consensus,
  itemsToTag,
  mergeRow,
  parseRuleTaggingResponse,
  renderAiTagFile,
} from './tagging.js'
import { TAG_FILES } from './tags/index.js'
import type { Item, VisualRule } from './types.js'

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  name: id.replace(/-/g, ' '),
  group: 'thing',
  icon: { set: 'openmoji', hex: '2693' },
  ...extra,
})

const floats: VisualRule = {
  id: 'visual-floats',
  family: 'physical',
  reveal: 'It floats in water.',
  basis: 'Hollow things count as their usual, closed state.',
}

describe('buildRuleTaggingPrompt', () => {
  it('carries the statement, both layers of guidance and every item by id', () => {
    const prompt = buildRuleTaggingPrompt(floats, [item('ice-cube'), item('anchor')])
    expect(prompt).toContain('"It floats in water."')
    expect(prompt).toContain('in its normal state and at its normal size.')
    expect(prompt).toContain('Hollow things count as their usual, closed state.')
    expect(prompt).toContain('ice-cube: ice cube (thing)')
    expect(prompt).toContain('anchor: anchor (thing)')
  })
})

describe('parseRuleTaggingResponse', () => {
  it('keeps valid answers and drops unknown ids, bad answers and junk', () => {
    const parsed = parseRuleTaggingResponse(
      [
        { id: 'ice-cube', answer: 'yes' },
        { id: 'anchor', answer: 'no' },
        { id: 'whale', answer: 'yes' },
        { id: 'cork', answer: 'maybe' },
        'cork',
        null,
      ],
      ['ice-cube', 'anchor', 'cork']
    )
    expect([...parsed]).toEqual([
      ['ice-cube', 'yes'],
      ['anchor', 'no'],
    ])
  })

  it('treats an id answered two different ways as unsure', () => {
    const parsed = parseRuleTaggingResponse(
      [
        { id: 'cork', answer: 'yes' },
        { id: 'cork', answer: 'no' },
      ],
      ['cork']
    )
    expect(parsed.get('cork')).toBe('unsure')
  })

  it('returns nothing for a response that is not an array', () => {
    expect(parseRuleTaggingResponse({ id: 'cork', answer: 'yes' }, ['cork']).size).toBe(0)
  })
})

describe('consensus', () => {
  const pass = (entries: [string, Cell][]) => new Map(entries)

  it('keeps unanimous answers and turns any disagreement or gap into unsure', () => {
    const cells = consensus(
      [
        pass([
          ['a', 'yes'],
          ['b', 'no'],
          ['c', 'yes'],
          ['d', 'no'],
        ]),
        pass([
          ['a', 'yes'],
          ['b', 'no'],
          ['c', 'no'],
          ['d', 'no'],
        ]),
        pass([
          ['a', 'yes'],
          ['b', 'no'],
          ['c', 'yes'],
        ]),
      ],
      ['a', 'b', 'c', 'd', 'e']
    )
    expect([...cells]).toEqual([
      ['a', 'yes'],
      ['b', 'no'],
      ['c', 'unsure'],
      ['d', 'unsure'],
    ])
  })
})

describe('itemsToTag', () => {
  it('skips blocked items and anything already answered by the AI or a human', () => {
    const todo = itemsToTag(
      'visual-floats',
      [
        item('cork'),
        item('anchor'),
        item('kite'),
        item('bottle', { blocked: true }),
        item('ice-cube'),
      ],
      { 'visual-floats': { yes: 'cork', unsure: 'kite' } },
      { 'visual-floats': { no: 'anchor' } }
    )
    expect(todo.map((i) => i.id)).toEqual(['ice-cube'])
  })
})

describe('mergeRow', () => {
  it('adds new answers to the existing row', () => {
    const row = mergeRow(
      { yes: 'cork' },
      new Map<string, Cell>([
        ['anchor', 'no'],
        ['kite', 'unsure'],
      ])
    )
    expect(row).toEqual({ yes: 'cork', no: 'anchor', unsure: 'kite' })
  })
})

describe('renderAiTagFile', () => {
  it('sorts rules and ids so a re-run only diffs what changed', () => {
    const source = renderAiTagFile({
      'visual-round': { yes: 'coin' },
      'visual-floats': { yes: 'ice-cube cork', no: 'anchor' },
    })
    expect(source).toContain(
      [
        "  'visual-floats': {",
        "    yes: 'cork ice-cube',",
        "    no: 'anchor',",
        "    unsure: '',",
        '  },',
        "  'visual-round': {",
      ].join('\n')
    )
  })

  // The AI files are generated, never hand-edited: each committed one must be
  // exactly what the renderer makes from its own table. A hand edit fails here.
  it.each(Object.entries(TAG_FILES))('%s.ai.ts is exactly the rendered output', (family, files) => {
    const committed = readFileSync(
      join(process.cwd(), 'content-engine', 'visual', 'tags', `${family}.ai.ts`),
      'utf8'
    ).replace(/\r\n/g, '\n')
    expect(renderAiTagFile(files.ai)).toBe(committed)
  })
})
