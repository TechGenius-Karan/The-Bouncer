import { describe, expect, it } from 'vitest'
import { addDaysToDateString, isValidPuzzleDateString, resolvePuzzleDateString } from './puzzleDate'

describe('resolvePuzzleDateString', () => {
  it('resolves the exact UTC midnight boundary correctly', () => {
    expect(resolvePuzzleDateString(new Date('2026-08-08T23:59:59.999Z'))).toBe('2026-08-08')
    expect(resolvePuzzleDateString(new Date('2026-08-09T00:00:00.000Z'))).toBe('2026-08-09')
  })

  it('is unaffected by the time-of-day component away from the boundary', () => {
    expect(resolvePuzzleDateString(new Date('2026-08-08T00:00:00.000Z'))).toBe('2026-08-08')
    expect(resolvePuzzleDateString(new Date('2026-08-08T12:00:00.000Z'))).toBe('2026-08-08')
  })

  it('defaults to the current instant when called with no argument', () => {
    expect(resolvePuzzleDateString()).toBe(new Date().toISOString().slice(0, 10))
  })
})

describe('addDaysToDateString', () => {
  it('adds days within a month', () => {
    expect(addDaysToDateString('2026-08-08', 2)).toBe('2026-08-10')
  })

  it('rolls over a month boundary', () => {
    expect(addDaysToDateString('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('supports negative offsets', () => {
    expect(addDaysToDateString('2026-08-08', -1)).toBe('2026-08-07')
  })
})

describe('isValidPuzzleDateString', () => {
  it('accepts well-formed dates', () => {
    expect(isValidPuzzleDateString('2026-08-08')).toBe(true)
  })

  it('rejects malformed or out-of-range input', () => {
    expect(isValidPuzzleDateString('2026-8-8')).toBe(false)
    expect(isValidPuzzleDateString('not-a-date')).toBe(false)
    expect(isValidPuzzleDateString('2026-13-45')).toBe(false)
    expect(isValidPuzzleDateString('')).toBe(false)
  })
})
