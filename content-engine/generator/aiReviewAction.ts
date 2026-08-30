// ai-feedback-plan.md §6/§9 (revised: Option A, 2026-08-30): the bounded
// action schema an AI review must resolve to, plus defensive parsing — a
// model's raw JSON response is never trusted directly (§9's "defensive
// parsing, always"). Any malformed shape, unknown action, or reference to
// data that doesn't exist in this puzzle falls back to `agree-reject`.
//
// Option A replaced the old blind-re-roll `redraft-puzzle` with
// `rewrite-puzzle`: the AI now authors the actual replacement words (chosen
// from a menu of real, correctly-sided bank words it's given in the prompt),
// so it can honor specific content feedback ("vary which number is hidden")
// that a blind re-roll structurally could not. Its authored content is still
// gated server-side (words-in-bank, correct labels, counts, and the full
// uniqueness validator) in aiReviewDispatch — the AI proposes, the validator
// disposes.

export type AiReviewActionType = 'swap-word' | 'rewrite-puzzle' | 'adjust-difficulty' | 'retire-rule' | 'agree-reject'

export interface AiAuthoredWord {
  word: string
  label: 'IN' | 'OUT'
}

export type AiReviewAction =
  | { action: 'swap-word'; badWordId: string; rationale: string }
  | { action: 'rewrite-puzzle'; clues: AiAuthoredWord[]; guests: AiAuthoredWord[]; rationale: string }
  | { action: 'adjust-difficulty'; newSubtlety: 1 | 2 | 3 | 4 | 5; rationale: string }
  | { action: 'retire-rule'; rationale: string }
  | { action: 'agree-reject'; rationale: string }

export interface ParseContext {
  /** Every clue/guest wordId in the puzzle under review — swap-word's badWordId must be one of these. */
  wordIds: Set<string>
}

const KNOWN_ACTIONS = new Set<AiReviewActionType>([
  'swap-word',
  'rewrite-puzzle',
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

/** Shape-only validation of an authored word list — deeper checks (in-bank, labels, counts, uniqueness) happen in aiReviewDispatch. */
function parseAuthoredWords(raw: unknown): AiAuthoredWord[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: AiAuthoredWord[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const obj = item as Record<string, unknown>
    if (!isNonEmptyString(obj.word) || (obj.label !== 'IN' && obj.label !== 'OUT')) return null
    out.push({ word: obj.word, label: obj.label })
  }
  return out
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
    case 'rewrite-puzzle': {
      const clues = parseAuthoredWords(obj.clues)
      const guests = parseAuthoredWords(obj.guests)
      if (!clues) return fallback('rewrite-puzzle has a malformed or empty clues list')
      if (!guests) return fallback('rewrite-puzzle has a malformed or empty guests list')
      return { action: 'rewrite-puzzle', clues, guests, rationale }
    }
    case 'adjust-difficulty': {
      if (!isValidSubtlety(obj.newSubtlety)) return fallback('adjust-difficulty missing a valid newSubtlety (1-5)')
      return { action: 'adjust-difficulty', newSubtlety: obj.newSubtlety, rationale }
    }
    case 'retire-rule':
      return { action: 'retire-rule', rationale }
    case 'agree-reject':
      return { action: 'agree-reject', rationale }
  }
}
