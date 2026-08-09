import { beforeEach, describe, expect, it } from 'vitest'
import { loadHistory, recordResult, type PlayHistoryEntry } from './playHistory'

// This Node runtime exposes globalThis.localStorage as a non-functional
// object (calling .setItem throws) unless special flags are set. Both this
// module's and resultStorage.ts's try/catch-everything pattern would
// silently swallow that error and no-op — so without this stub, a test
// wouldn't crash, it would just silently fail to persist anything and
// every assertion would run against an always-empty store.
function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  } as Storage
}

const entryFor = (date: string, overrides: Partial<PlayHistoryEntry> = {}): PlayHistoryEntry => ({
  date,
  puzzleNumber: 1,
  score: 5,
  poolSize: 6,
  endedEarly: false,
  ...overrides,
})

describe('playHistory', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('starts empty', () => {
    expect(loadHistory()).toEqual([])
  })

  it('records an entry', () => {
    recordResult(entryFor('2026-08-08'))
    expect(loadHistory()).toEqual([entryFor('2026-08-08')])
  })

  it('accumulates entries for different dates', () => {
    recordResult(entryFor('2026-08-08', { score: 5 }))
    recordResult(entryFor('2026-08-09', { score: 6, puzzleNumber: 2 }))
    expect(loadHistory()).toHaveLength(2)
  })

  it('upserts by date — replays a duplicate fetch without duplicating the entry', () => {
    recordResult(entryFor('2026-08-08', { score: 5 }))
    recordResult(entryFor('2026-08-08', { score: 5 })) // e.g. app reloaded, same completed round fetched again
    const history = loadHistory()
    expect(history).toHaveLength(1)
    expect(history[0].score).toBe(5)
  })

  it('replaces the existing entry for a date rather than appending', () => {
    recordResult(entryFor('2026-08-08', { score: 3, endedEarly: true }))
    recordResult(entryFor('2026-08-08', { score: 6, endedEarly: false }))
    const history = loadHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toEqual(entryFor('2026-08-08', { score: 6, endedEarly: false }))
  })

  it('gracefully returns an empty array if storage is corrupted', () => {
    localStorage.setItem('bouncer:history', 'not valid json')
    expect(loadHistory()).toEqual([])
  })
})
