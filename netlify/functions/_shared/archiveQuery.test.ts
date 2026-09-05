import { describe, expect, it } from 'vitest'
import { pastPuzzleFilter } from './archiveQuery'

describe('pastPuzzleFilter', () => {
  it('restricts to finished puzzles dated before today', () => {
    expect(pastPuzzleFilter('2026-09-05')).toEqual({
      status: { $in: ['scheduled', 'live'] },
      date: { $ne: null, $lt: '2026-09-05' },
    })
  })

  // The bug this file exists for. The first version returned a flat object and
  // callers narrowed it by spreading — `{ ...filter, date: requested }` — which
  // silently replaced the cut-off, serving today's and every future puzzle
  // with its answers. Nesting under $and makes a caller's condition additive.
  it('keeps the cut-off when a caller narrows by the same field', () => {
    const filter = pastPuzzleFilter('2026-09-05', { date: '2026-09-05' })
    expect(filter).toEqual({
      $and: [
        { status: { $in: ['scheduled', 'live'] }, date: { $ne: null, $lt: '2026-09-05' } },
        { date: '2026-09-05' },
      ],
    })
    // The guard survives: no top-level `date` for the caller's value to win.
    expect(Object.keys(filter)).toEqual(['$and'])
  })

  it('cannot be widened by an extra condition', () => {
    const filter = pastPuzzleFilter('2026-09-05', { date: { $gt: '2026-09-01' } })
    const [guard] = filter.$and as Record<string, unknown>[]
    expect(guard.date).toEqual({ $ne: null, $lt: '2026-09-05' })
  })

  it('never admits an unreviewed puzzle, whatever the caller asks for', () => {
    const filter = pastPuzzleFilter('2026-09-05', { status: 'pending_approval' })
    const [guard] = filter.$and as Record<string, unknown>[]
    expect(guard.status).toEqual({ $in: ['scheduled', 'live'] })
  })
})
