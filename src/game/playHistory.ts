// Phase 7 (build-plan.md / planning.md §8.3): device-local play history —
// no accounts, no server-side user state, just a per-day log kept in
// localStorage. One entry per calendar date; upserted, never appended, so
// re-fetching an already-completed round (e.g. reloading the app) can't
// duplicate the same day's entry.

const KEY = 'bouncer:history'

export interface PlayHistoryEntry {
  date: string
  puzzleNumber: number
  score: number
  poolSize: number
  endedEarly: boolean
}

export function loadHistory(): PlayHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PlayHistoryEntry[]) : []
  } catch {
    return []
  }
}

export function recordResult(entry: PlayHistoryEntry): void {
  try {
    const history = loadHistory().filter((e) => e.date !== entry.date)
    history.push(entry)
    localStorage.setItem(KEY, JSON.stringify(history))
  } catch {
    // Storage unavailable (private browsing, etc.) — the round still
    // played fine, it just won't show up in local history.
  }
}
