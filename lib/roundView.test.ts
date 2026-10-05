import { describe, expect, it, vi } from 'vitest'

// db.ts throws at import without MONGODB_URI, so the collections are faked:
// just enough of find({ _id: { $in } }).toArray() for the name lookups.
vi.mock('./db.js', () => {
  const collection = <T extends { _id: string }>(docs: T[]) => ({
    find: (filter: { _id: { $in: string[] } }) => ({
      toArray: async () => docs.filter((d) => filter._id.$in.includes(d._id)),
    }),
  })
  return {
    getCollections: async () => ({
      words: collection([{ _id: 'anchor', spelling: 'anchor-word' }]),
      visualItems: collection([
        { _id: 'anchor', name: 'anchor' },
        { _id: 'ice-cube', name: 'ice cube' },
        { _id: 'stick-of-butter', name: 'stick of butter' },
      ]),
    }),
  }
})

import { buildPool, resolveClueWords } from './roundView.js'
import type { PuzzleDoc, ResultDoc } from './types.js'

const puzzle = {
  kind: 'visual',
  clues: [
    { wordId: 'anchor', label: 'IN', displayOrder: 0 },
    { wordId: 'ice-cube', label: 'OUT', displayOrder: 1 },
  ],
  guests: [
    { wordId: 'stick-of-butter', trueLabel: 'OUT', displayOrder: 0, isTrap: false, trapType: null },
    { wordId: 'ice-cube', trueLabel: 'IN', displayOrder: 1, isTrap: true, trapType: 'decoy' },
  ],
} as unknown as PuzzleDoc

const result = (roundComplete: boolean) =>
  ({
    roundComplete,
    placements: [{ wordId: 'ice-cube', attemptedLabel: 'OUT', correct: false }],
  }) as unknown as ResultDoc

describe('roundView for a visual puzzle (planning-visual-pivot.md §5.3)', () => {
  it('captions clues with item names', async () => {
    expect(await resolveClueWords(puzzle)).toEqual({ in: ['anchor'], out: ['ice cube'] })
  })

  it('keeps every true label hidden mid-round, apart from what the swipe already showed', async () => {
    expect(await buildPool(puzzle, result(false))).toEqual([
      { wordId: 'stick-of-butter', word: 'stick of butter' },
      { wordId: 'ice-cube', word: 'ice cube', attempted: { label: 'OUT', correct: false } },
    ])
  })

  it('reveals every item, swiped or not, once the round is over', async () => {
    const pool = await buildPool(puzzle, result(true))
    expect(pool.map((p) => [p.word, p.trueLabel])).toEqual([
      ['stick of butter', 'OUT'],
      ['ice cube', 'IN'],
    ])
  })

  it('still reads spellings for a word puzzle', async () => {
    const word = { ...puzzle, kind: undefined } as PuzzleDoc
    expect((await resolveClueWords(word)).in).toEqual(['anchor-word'])
  })
})
