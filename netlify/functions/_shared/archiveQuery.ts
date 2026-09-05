import type { Filter } from 'mongodb'
import type { PuzzleDoc } from './types'

// The archive's spoiler boundary, in one place.
//
// planning.md locks spoiler-safety, and the archive is the one feature that
// could break it quietly: it exists to publish answers, so getting the
// "which puzzles are finished" line wrong leaks today's solution to anyone who
// guesses a URL — and to Google, permanently.
//
// This is $and rather than a flat object because the first version WAS a flat
// object, and callers narrowed it by spreading:
//
//   { ...pastPuzzleFilter(today), date: requested }
//
// Object spread lets the later key win, so `date: requested` silently replaced
// `date: { $lt: today }` and the cut-off vanished. Today's and every future
// puzzle were served with their answers. Nesting the guard inside $and makes
// that impossible: an extra condition can only ever narrow the result, never
// replace the guard.

const FINISHED_STATUSES = ['scheduled', 'live'] as const

/**
 * Puzzles that have actually run: dated strictly before `today` (UTC).
 *
 * `extra` is ANDed on, so a caller can add conditions but can never widen
 * what's visible.
 */
export function pastPuzzleFilter(today: string, extra?: Filter<PuzzleDoc>): Filter<PuzzleDoc> {
  const guard: Filter<PuzzleDoc> = {
    status: { $in: [...FINISHED_STATUSES] },
    date: { $ne: null, $lt: today },
  }
  return extra ? { $and: [guard, extra] } : guard
}
