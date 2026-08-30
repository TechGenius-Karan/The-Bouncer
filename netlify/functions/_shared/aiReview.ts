import { GoogleGenAI, Type } from '@google/genai'
import { parseAiReviewAction, type AiReviewAction } from '../../../content-engine/generator/aiReviewAction'
import type { AdminPuzzleDetail } from './adminApi'

// ai-feedback-plan.md §4/§7.4: Gemini's free tier (no card, indefinite) is
// the pick — this feature's realistic volume (single digits to low tens of
// reviews/day) is nowhere near its daily cap. Confirmed directly against
// Google's own docs (Aug 2026): gemini-3.5-flash is free-tier, 15 RPM /
// 1,500 RPD — better limits than 2.5 Flash. Re-verify against
// https://ai.google.dev/gemini-api/docs/models before changing this again;
// the model lineup moves fast.
const MODEL = 'gemini-3.5-flash'
const TIMEOUT_MS = 10_000

// A loose, flat schema (not a true discriminated union — Gemini's JSON
// Schema subset doesn't make that worth the complexity here) that nudges
// the model toward the right shape. It is NOT the safety mechanism —
// parseAiReviewAction's defensive validation (§9) is; this just improves
// the odds of getting a clean response on the first try.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: {
      type: Type.STRING,
      enum: ['swap-word', 'redraft-puzzle', 'adjust-difficulty', 'retire-rule', 'agree-reject'],
    },
    rationale: { type: Type.STRING, description: 'One short sentence explaining the choice.' },
    badWordId: { type: Type.STRING, description: 'Only for swap-word: the id of the one bad word.' },
    newSubtlety: { type: Type.INTEGER, description: 'Only for adjust-difficulty: a better 1-5 rating.' },
  },
  required: ['action', 'rationale'],
}

export interface AiReviewInput {
  puzzle: AdminPuzzleDetail
  reason: string
  /** §5's few-shot library — recent (reason -> action -> outcome) examples, formatted as prose. Optional; omitted until aiReviews has real history to draw from. */
  fewShotExamples?: string
}

export interface AiReviewResult {
  decision: AiReviewAction
  /** Full raw model text — audit/debugging only, logged to AiReviewDoc, never shown to the reviewer. */
  rawResponse: string
}

function buildPrompt({ puzzle, reason, fewShotExamples }: AiReviewInput): string {
  const clueLines = puzzle.clues.map((c) => `  - "${c.word}" (${c.label}, id: ${c.wordId})`).join('\n')
  const guestLines = puzzle.guests
    .map((g) => `  - "${g.word}" (${g.trueLabel}${g.isTrap ? `, trap: ${g.trapType}` : ''}, id: ${g.wordId})`)
    .join('\n')
  const decoyLines =
    puzzle.liveDecoys.length > 0
      ? puzzle.liveDecoys.map((d) => `  - ${d.ruleName} (subtlety ${d.subtlety})`).join('\n')
      : '  (none)'

  return `You are reviewing a rejected puzzle from "The Bouncer," a daily word-sorting game. Players see
IN/OUT clue words for a hidden rule, then sort a pool of guest words against that same rule with
immediate feedback and 3 lives.

THE PUZZLE'S RULE: "${puzzle.ruleName}" (${puzzle.difficultyTier} tier) — ${puzzle.ruleDescription}

CLUES (shown to the player before sorting):
${clueLines}

POOL (sorted by the player):
${guestLines}

OTHER RULES THAT STILL FIT THE CLUES ALONE ("live decoys" — expected variety, not automatically a problem):
${decoyLines}

THE REVIEWER REJECTED THIS PUZZLE AND WROTE:
"${reason}"
${fewShotExamples ? `\nPAST EXAMPLES OF SIMILAR DECISIONS:\n${fewShotExamples}\n` : ''}
Decide exactly ONE action:
- swap-word: only ONE specific word is the problem (a proper name, something ambiguous or awkward) — the rule/concept itself is fine. Set badWordId to that word's id from the lists above.
- redraft-puzzle: the rule is fine but THIS instance's draft is weak (bad traps, an unlucky clue set) — a fresh draft for the same rule would fix it.
- adjust-difficulty: the rule itself is sound but miscalibrated (too easy to guess by elimination, or surprisingly hard for its tier). Set newSubtlety to a better 1-5 rating.
- retire-rule: the rule fundamentally doesn't work — ambiguous by nature, boring, or the reasoning makes clear no recalibration fixes it.
- agree-reject: the reviewer gave no usable reasoning, or nothing here is worth fixing.

Respond with the action and one short sentence of rationale.`
}

/**
 * Calls Gemini to decide a bounded remediation action for a rejected
 * puzzle. Never throws and never hangs indefinitely — any API error,
 * timeout, missing key, or malformed response resolves to a safe
 * `agree-reject` (§9), so a reviewer's click always resolves to something.
 */
export async function getAiReviewDecision(input: AiReviewInput): Promise<AiReviewResult> {
  const wordIds = new Set([
    ...input.puzzle.clues.map((c) => c.wordId),
    ...input.puzzle.guests.map((g) => g.wordId),
  ])

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      decision: { action: 'agree-reject', rationale: 'AI review unavailable — GEMINI_API_KEY is not configured' },
      rawResponse: '',
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: buildPrompt(input),
        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI review timed out')), TIMEOUT_MS)
      }),
    ])

    const text = response.text ?? ''
    if (!text) {
      return { decision: { action: 'agree-reject', rationale: 'AI review unavailable — empty response' }, rawResponse: '' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return {
        decision: { action: 'agree-reject', rationale: 'AI review unavailable — response was not valid JSON' },
        rawResponse: text,
      }
    }

    return { decision: parseAiReviewAction(parsed, { wordIds }), rawResponse: text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { decision: { action: 'agree-reject', rationale: `AI review unavailable — ${message}` }, rawResponse: '' }
  }
}
