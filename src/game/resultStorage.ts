// Phase 4 has exactly one active puzzle in the whole system, so a single
// fixed key is enough — Phase 5's real per-date scheduling will need this
// keyed by puzzle/date instead.
const KEY = 'bouncer:resultId'

export function loadResultId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveResultId(resultId: string): void {
  try {
    localStorage.setItem(KEY, resultId)
  } catch {
    // Storage unavailable (private browsing, etc.) — resuming across a
    // refresh just won't work; the round still plays fine in-session.
  }
}
