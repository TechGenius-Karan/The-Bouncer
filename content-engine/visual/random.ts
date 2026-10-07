// Seeded randomness for the visual generator, so a stored `generatorSeed`
// reproduces its board (planning-visual-pivot.md §4.6). The word engine's
// random.ts uses Math.random and stays as it is.

export type Rng = () => number

/** mulberry32: small, fast, and good enough for shuffling a puzzle. Returns values in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Undefined for an empty list, so callers have to handle running out. */
export function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  return items.length === 0 ? undefined : items[Math.floor(rng() * items.length)]
}

/** Picks with probability proportional to weight. Every weight must be > 0. */
export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= weightOf(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

/** §4.6: the run date plus an index, so re-running a day's batch reproduces it. */
export function batchSeed(date: string, index: number): number {
  return Number(date.replace(/-/g, '')) * 1000 + index
}
