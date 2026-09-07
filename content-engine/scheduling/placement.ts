import { RULES } from '../rules'

// The pure half of content-engine/scripts/schedulePuzzles.ts: everything that
// decides WHICH approved puzzle may go on a given date, with no Mongo and no
// I/O. Split out so the spacing and cap rules are unit-testable — the script
// itself calls main() at import time, so it can't be loaded from a test.
// Same testable-core / thin-wrapper split as repairWord and aiReviewDispatch.

/** Don't put the same rule within this many days of itself. */
export const RULE_SPACING_DAYS = 60

/** Same template family ("ends with X") — spaced more tightly, a softer kind of sameness. */
export const TEMPLATE_SPACING_DAYS = 6

/**
 * Templates whose members don't actually feel alike, with their own spacing.
 *
 * The default assumes "same template = same puzzle to a player". That holds for
 * `ends-with-g` versus `ends-with-m` — identical mechanic, different letter. It
 * is plainly false for `category-bird` versus `category-vehicle`, which share
 * nothing but an implementation detail.
 *
 * Getting this wrong is expensive, and it has bitten twice. Both times a
 * template held most of the good rules and the default spacing throttled it
 * below what the calendar needed:
 *
 *   category     33 quality rules, but 6-day spacing allowed only ~1.2/week
 *   hidden-word  25 quality rules, same problem
 *
 * `hidden-word` gets 3 rather than category's 2 because the mechanic — hunt for
 * a word inside a word — is more recognisable on repetition than "these all
 * name a bird" versus "these all name a tool", even though the targets differ.
 */
export const TEMPLATE_SPACING_OVERRIDES: Record<string, number> = {
  category: 2,
  'hidden-word': 3,
}

export function templateSpacingFor(templateId: string): number {
  return TEMPLATE_SPACING_OVERRIDES[templateId] ?? TEMPLATE_SPACING_DAYS
}

/**
 * A rule at or below this `aha` is filler: technically valid, rarely enjoyed.
 *
 * The ratings are not guesses — they were set from the rejection record. The
 * templates sitting at 1 are the ones reviewers threw away 80-88% of the time.
 */
export const FILLER_AHA_THRESHOLD = 2

/**
 * Cap on filler puzzles per rolling week.
 *
 * This used to cap the *lexical* family, which was the wrong axis and actively
 * harmful. Family says nothing about quality: `hidden-word` is lexical and the
 * best-reviewed template there is (25% rejected), while `starts-with` is
 * lexical and the worst (88%). Capping by family throttled both equally, so
 * promoting the good template into the weekday pool would have run it straight
 * into a cap meant for the bad one. `aha` already encodes the difference; the
 * scheduler should read that instead of a structural label.
 *
 * Two, derived rather than picked. Weekly supply of quality medium rules, under
 * BOTH the rule cooldown and template spacing:
 *
 *   category     33 rules -> min(3.9 cooldown, 3.5 spacing) = 3.5/week
 *   hidden-word  25 rules -> min(2.9 cooldown, 2.3 spacing) = 2.3/week
 *   hand-written 14 rules -> 1.6/week   (untemplated, so no spacing limit)
 *                                       total ~7.4/week
 *
 * Six medium days a week need filling, so filler is not strictly needed at all
 * and this could be 1 — or 0. It is 2 for slack: that arithmetic assumes a
 * perfectly stocked approved pool, and the real pool is only ever whatever got
 * reviewed. Drop it to 1 once a few months of scheduling runs report no cap
 * breaches.
 */
export const MAX_FILLER_PER_WEEK = 2

/**
 * Rolling, not calendar weeks: a Monday reset would happily allow the cap on
 * Fri-Sun and the cap again on Mon-Tue, which is double in five days.
 */
export const FILLER_WINDOW_DAYS = 7

export interface Placement {
  date: string
  ruleId: string
  templateId?: string
  isFiller: boolean
}

/** The bits of a puzzle that placement cares about — keeps this free of PuzzleDoc/Mongo types. */
export interface PlaceablePuzzle {
  ruleId: string
  templateId?: string
}

const AHA_BY_RULE_ID = new Map(RULES.map((rule) => [rule.id, rule.aha ?? 3]))

/**
 * A rule id no longer in the taxonomy (an older puzzle, a renamed rule) counts
 * as non-filler. The cap exists to hold filler back, and guessing "filler" for
 * an unknown id would restrict the calendar on no evidence — risking empty days
 * for nothing.
 */
export function isFillerRule(ruleId: string): boolean {
  const aha = AHA_BY_RULE_ID.get(ruleId)
  return aha !== undefined && aha <= FILLER_AHA_THRESHOLD
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
}

/** True when this puzzle's rule and template family are far enough from every date already placed. */
export function isFreshFor(
  date: string,
  puzzle: PlaceablePuzzle,
  placements: Placement[]
): boolean {
  return !placements.some((p) => {
    const gap = daysBetween(date, p.date)
    if (p.ruleId === puzzle.ruleId && gap < RULE_SPACING_DAYS) return true
    return (
      puzzle.templateId !== undefined &&
      p.templateId === puzzle.templateId &&
      gap < templateSpacingFor(puzzle.templateId)
    )
  })
}

/**
 * Whether a filler puzzle can go on this date without making some 7-day span
 * hold more than MAX_FILLER_PER_WEEK.
 *
 * Counts the trailing window (the six days before `date`) rather than a
 * symmetric one. The scheduler places dates in increasing order, so trailing is
 * what actually bounds any 7 consecutive days; a ±6-day check would really span
 * 13 days and roughly halve the effective cap.
 */
export function fillerCapAllows(
  date: string,
  puzzle: PlaceablePuzzle,
  placements: Placement[]
): boolean {
  if (!isFillerRule(puzzle.ruleId)) return true
  const recent = placements.filter(
    (p) => p.isFiller && p.date < date && daysBetween(date, p.date) < FILLER_WINDOW_DAYS
  )
  return recent.length < MAX_FILLER_PER_WEEK
}

export interface Selection {
  /** Index into the queue, or -1 when the queue is empty. */
  index: number
  /** Placed despite the filler cap because nothing else was left. */
  overCap: boolean
  /** Placed despite rule/template spacing because the whole queue was in cooldown. */
  repeat: boolean
}

/**
 * Which queued puzzle should take this date.
 *
 * Three tiers of preference, each a fallback rather than a rejection. An empty
 * calendar day is the worst outcome available — planning.md §9.2 locks "never
 * let the buffer run to zero" — so a repetitive puzzle always beats no puzzle.
 * The flags let the caller say out loud which compromise it made, instead of
 * a starving schedule looking exactly like a healthy one.
 */
export function selectForDate(
  date: string,
  queue: PlaceablePuzzle[],
  placements: Placement[]
): Selection {
  if (queue.length === 0) return { index: -1, overCap: false, repeat: false }

  const ideal = queue.findIndex(
    (p) => isFreshFor(date, p, placements) && fillerCapAllows(date, p, placements)
  )
  if (ideal !== -1) return { index: ideal, overCap: false, repeat: false }

  const fresh = queue.findIndex((p) => isFreshFor(date, p, placements))
  if (fresh !== -1) return { index: fresh, overCap: true, repeat: false }

  // Whole queue is in cooldown — take the head, the long-standing behaviour.
  return { index: 0, overCap: !fillerCapAllows(date, queue[0], placements), repeat: true }
}
