// Phase 5 (build-plan.md / planning.md §8.2, §10): the single source of
// truth for "what UTC calendar day is it" — the daily reset happens at
// midnight UTC, the same instant worldwide, so every player's puzzle stays
// directly comparable.

const DATE_STRING_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Today's (or `now`'s) UTC calendar date as "YYYY-MM-DD". */
export function resolvePuzzleDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Adds `days` (may be negative) to a "YYYY-MM-DD" string, returning another "YYYY-MM-DD" string. */
export function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return resolvePuzzleDateString(date)
}

/** Guards against malformed or out-of-range "YYYY-MM-DD" input (e.g. a hand-typed `?asOf=`). */
export function isValidPuzzleDateString(value: string): boolean {
  if (!DATE_STRING_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime())
}
