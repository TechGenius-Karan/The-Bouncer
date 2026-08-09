// A single fixed key is enough even with real per-date scheduling (Phase 5):
// the server checks that a resumed result's date matches today before
// trusting it (see get-round.ts), so a stale id from a previous day just
// falls through to a fresh fetch, and saveResultId below overwrites this
// key with the new one — no per-date key needed on the client.
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
