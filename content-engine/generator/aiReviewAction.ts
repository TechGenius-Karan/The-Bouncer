// ai-feedback-plan.md §6/§9: the bounded action schema an AI review must
// resolve to, plus defensive parsing — a model's raw JSON response is never
// trusted directly (§9's "defensive parsing, always"). Any malformed shape,
// unknown action, or reference to data that doesn't actually exist in this
// puzzle (e.g. a badWordId that isn't one of its own words) falls back to
// `agree-reject`, the same as a plain human reject with no AI involved.

export type AiReviewActionType = 'swap-word' | 'redraft-puzzle' | 'adjust-difficulty' | 'retire-rule' | 'agree-reject'

export type AiReviewAction =
  | { action: 'swap-word'; badWordId: string; rationale: string }
  | { action: 'redraft-puzzle'; rationale: string }
  | { action: 'adjust-difficulty'; newSubtlety: 1 | 2 | 3 | 4 | 5; rationale: string }
  | { action: 'retire-rule'; rationale: string }
  | { action: 'agree-reject'; rationale: string }

export interface ParseContext {
  /** Every clue/guest wordId in the puzzle under review — swap-word's badWordId must be one of these. */
  wordIds: Set<string>
}

const KNOWN_ACTIONS = new Set<AiReviewActionType>([
  'swap-word',
  'redraft-puzzle',
  'adjust-difficulty',
  'retire-rule',
  'agree-reject',
])

function fallback(reason: string): AiReviewAction {
  return { action: 'agree-reject', rationale: `AI review unavailable — ${reason}` }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidSubtlety(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5
}

/**
 * Validates an untrusted parsed-JSON value (a model's raw response) against
 * the bounded action schema. Never throws — any problem resolves to a safe
 * `agree-reject` fallback rather than propagating a malformed shape further.
 */
export function parseAiReviewAction(raw: unknown, context: ParseContext): AiReviewAction {
  if (typeof raw !== 'object' || raw === null) return fallback('response was not a JSON object')

  const obj = raw as Record<string, unknown>
  if (!KNOWN_ACTIONS.has(obj.action as AiReviewActionType)) {
    return fallback(`unrecognized action "${String(obj.action)}"`)
  }
  if (!isNonEmptyString(obj.rationale)) return fallback('missing rationale')
  const rationale = obj.rationale

  switch (obj.action as AiReviewActionType) {
    case 'swap-word': {
      if (!isNonEmptyString(obj.badWordId)) return fallback('swap-word missing badWordId')
      if (!context.wordIds.has(obj.badWordId)) {
        return fallback(`swap-word referenced "${obj.badWordId}", which isn't a word in this puzzle`)
      }
      return { action: 'swap-word', badWordId: obj.badWordId, rationale }
    }
    case 'adjust-difficulty': {
      if (!isValidSubtlety(obj.newSubtlety)) return fallback('adjust-difficulty missing a valid newSubtlety (1-5)')
      return { action: 'adjust-difficulty', newSubtlety: obj.newSubtlety, rationale }
    }
    case 'redraft-puzzle':
      return { action: 'redraft-puzzle', rationale }
    case 'retire-rule':
      return { action: 'retire-rule', rationale }
    case 'agree-reject':
      return { action: 'agree-reject', rationale }
  }
}
