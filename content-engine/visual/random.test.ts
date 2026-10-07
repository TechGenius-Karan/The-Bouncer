import { describe, expect, it } from 'vitest'
import { batchSeed, mulberry32, pick, pickWeighted, shuffle } from './random.js'

describe('mulberry32', () => {
  it('repeats exactly for the same seed and differs for another', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const c = mulberry32(43)
    const seqA = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(seqA)
    expect([c(), c(), c()]).not.toEqual(seqA)
  })

  it('stays in [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('helpers', () => {
  it('shuffle keeps every item and does not touch its input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, mulberry32(1))
    expect(input).toEqual([1, 2, 3, 4, 5])
    expect(out.slice().sort()).toEqual(input)
  })

  it('pick returns undefined for an empty list', () => {
    expect(pick([], mulberry32(1))).toBeUndefined()
  })

  it('pickWeighted follows the weights', () => {
    const rng = mulberry32(3)
    let heavy = 0
    for (let i = 0; i < 2000; i++)
      if (pickWeighted(['a', 'b'], (x) => (x === 'a' ? 9 : 1), rng) === 'a') heavy++
    expect(heavy).toBeGreaterThan(1700)
    expect(heavy).toBeLessThan(1900)
  })

  it('batchSeed is stable per date and index', () => {
    expect(batchSeed('2026-10-02', 3)).toBe(20261002003)
  })
})
