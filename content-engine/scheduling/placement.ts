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
 * The default assumes "same template = same puzzle to a player". That holds
 * for `ends-with-g` versus `ends-with-m` — identical mechanic, different
 * letter. It is plainly false for `category-bird` versus `category-vehicle`,
 * which share nothing but an implementation detail.
 *
 * Leaving them lumped together had a real cost. 24 of the 27 medium-eligible
 * semantic rules are `category`, so a 6-day spacing capped semantic puzzles at
 * about two per six days, while lexical rules spread across four templates got
 * roughly four. The heuristic was quietly pushing the calendar toward exactly
 * the letter-spotting puzzles MAX_LEXICAL_PER_WEEK exists to hold back. At 2
 * days apart a category puzzle can land every other day, which is what the
 * lexical cap needs on the other side of the ledger.
 */
export const TEMPLATE_SPACING_OVERRIDES: Record<string, number> = {
  category: 2,
}

export function templateSpacingFor(templateId: string): number {
  return TEMPLATE_SPACING_OVERRIDES[templateId] ?? TEMPLATE_SPACING_DAYS
}

/**
 * Most days should turn on knowing a thing, not on spotting a letter.
 *
 * 79% of the taxonomy is lexical (starts-with, ends-with, hidden-word), so left
 * alone the calendar drifts that way too. This caps how many land close
 * together.
 *
 * Three, not two, and the difference is supply rather than taste.
 *
 * The sustainable semantic rate is (number of semantic rules) /
 * RULE_SPACING_DAYS, since each rule is usable once per that window. With 27
 * medium-eligible semantic rules that is 27/60 = 0.45/day ≈ 3.2 per week. A
 * 2/week lexical cap would need 5 semantic a week and simply cannot be fed;
 * even this 3 needs 4 and so runs slightly ahead of supply.
 *
 * Deliberately left slightly ahead rather than lowered to a comfortable 4.
 * The cap is a soft target — selectForDate places a lexical puzzle rather than
 * leave a day empty — so overshooting costs a warning, not a gap, and the
 * warning is the signal that the taxonomy needs more semantic rules. Setting
 * it to 4 would silence the warning by abandoning the goal.
 *
 * Roughly 35 medium-eligible semantic rules would hold 3/week cleanly (8 more
 * than today). Tagging words in near-threshold categories gets there:
 * buildRuleParams promotes a category to a rule automatically once its
 * coverage clears the floor.
 */
export const MAX_LEXICAL_PER_WEEK = 3

/**
 * Rolling, not calendar weeks: a Monday reset would happily allow three on
 * Fri-Sun and three more on Mon-Tue, which is six in five days.
 */
export const LEXICAL_WINDOW_DAYS = 7

export interface Placement {
  date: string
  ruleId: string
  templateId?: string
  isLexical: boolean
}

/** The bits of a puzzle that placement cares about — keeps this free of PuzzleDoc/Mongo types. */
export interface PlaceablePuzzle {
  ruleId: string
  templateId?: string
}

const FAMILY_BY_RULE_ID = new Map(RULES.map((rule) => [rule.id, rule.family]))

/**
 * A rule id that's no longer in the taxonomy (an older puzzle, a renamed rule)
 * counts as non-lexical. The cap exists to hold lexical puzzles back, and
 * guessing "lexical" for an unknown id would restrict the schedule on no
 * evidence — risking empty days for nothing.
 */
export function isLexicalRule(ruleId: string): boolean {
  return FAMILY_BY_RULE_ID.get(ruleId) === 'lexical-structural'
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
 * Whether a lexical puzzle can go on this date without making some 7-day span
 * hold more than MAX_LEXICAL_PER_WEEK.
 *
 * Counts the trailing window (the six days before `date`) rather than a
 * symmetric one. The scheduler places dates in increasing order, so trailing is
 * what actually bounds any 7 consecutive days; a ±6-day check would really span
 * 13 days and roughly halve the effective cap.
 */
export function lexicalCapAllows(
  date: string,
  puzzle: PlaceablePuzzle,
  placements: Placement[]
): boolean {
  if (!isLexicalRule(puzzle.ruleId)) return true
  const recent = placements.filter(
    (p) => p.isLexical && p.date < date && daysBetween(date, p.date) < LEXICAL_WINDOW_DAYS
  )
  return recent.length < MAX_LEXICAL_PER_WEEK
}

export interface Selection {
  /** Index into the queue, or -1 when the queue is empty. */
  index: number
  /** Placed despite the lexical cap because nothing else was left. */
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
    (p) => isFreshFor(date, p, placements) && lexicalCapAllows(date, p, placements)
  )
  if (ideal !== -1) return { index: ideal, overCap: false, repeat: false }

  const fresh = queue.findIndex((p) => isFreshFor(date, p, placements))
  if (fresh !== -1) return { index: fresh, overCap: true, repeat: false }

  // Whole queue is in cooldown — take the head, the long-standing behaviour.
  return { index: 0, overCap: !lexicalCapAllows(date, queue[0], placements), repeat: true }
}
