import { GoogleGenAI, Type } from '@google/genai'
import { parseAiReviewAction, type AiReviewAction } from '../../../content-engine/generator/aiReviewAction'
import type { AdminPuzzleDetail } from './adminApi'

// ai-feedback-plan.md §4/§7.4: Gemini's free tier (no card) is the pick. The
// model lineup shifted fast under us (all empirical, 2026-08-30): 3.5-flash's
// free tier is only 20 req/DAY (live 429: "limit: 20") and slow; 2.5-flash is
// now 404 for new accounts ("no longer available to new users"); Google's own
// error steers new users to 3.6-flash, which is what we use. Re-verify quotas
// at https://ai.google.dev/gemini-api/docs/rate-limits before assuming.
const MODEL = 'gemini-3.6-flash'
// Generous margin: a Netlify sync function caps at 26s. 3.6-flash returns a
// structured call in ~5s in practice, so this is headroom, not the norm.
// (Tried thinkingBudget:0 to shave latency — 3.6-flash rejects it with a 400,
// and its default thinking is already fast enough, so no thinkingConfig.)
const TIMEOUT_MS = 25_000

// A loose, flat schema (not a true discriminated union — Gemini's JSON
// Schema subset doesn't make that worth the complexity here) that nudges
// the model toward the right shape. It is NOT the safety mechanism —
// parseAiReviewAction's defensive validation (§9) is; this just improves
// the odds of getting a clean response on the first try.
const AUTHORED_WORD_ITEM = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING },
    label: { type: Type.STRING, enum: ['IN', 'OUT'] },
  },
  required: ['word', 'label'],
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: {
      type: Type.STRING,
      enum: ['swap-word', 'rewrite-puzzle', 'adjust-difficulty', 'agree-reject'],
    },
    rationale: { type: Type.STRING, description: 'One short sentence explaining the choice.' },
    badWordId: { type: Type.STRING, description: 'Only for swap-word: the id of the one bad word.' },
    newSubtlety: { type: Type.INTEGER, description: 'Only for adjust-difficulty: a better 1-5 rating.' },
    clues: { type: Type.ARRAY, description: 'Only for rewrite-puzzle: the authored clue words.', items: AUTHORED_WORD_ITEM },
    guests: { type: Type.ARRAY, description: 'Only for rewrite-puzzle: the authored guest words.', items: AUTHORED_WORD_ITEM },
  },
  required: ['action', 'rationale'],
}

export interface AiReviewInput {
  puzzle: AdminPuzzleDetail
  reason: string
  /** rewrite-puzzle menu: real bank words that satisfy the rule (spellings only). The AI may only author IN clues/guests from this list. */
  inWordMenu: string[]
  /** rewrite-puzzle menu: real bank words that do NOT satisfy the rule. */
  outWordMenu: string[]
  /** §5's few-shot library — recent (reason -> action -> outcome) examples, formatted as prose. Optional; omitted until aiReviews has real history to draw from. */
  fewShotExamples?: string
}

export interface AiReviewResult {
  decision: AiReviewAction
  /** Full raw model text — audit/debugging only, logged to AiReviewDoc, never shown to the reviewer. */
  rawResponse: string
}

function buildPrompt({ puzzle, reason, inWordMenu, outWordMenu, fewShotExamples }: AiReviewInput): string {
  const clueLines = puzzle.clues.map((c) => `  - "${c.word}" (${c.label}, id: ${c.wordId})`).join('\n')
  const guestLines = puzzle.guests
    .map((g) => `  - "${g.word}" (${g.trueLabel}${g.isTrap ? `, trap: ${g.trapType}` : ''}, id: ${g.wordId})`)
    .join('\n')
  const decoyLines =
    puzzle.liveDecoys.length > 0
      ? puzzle.liveDecoys.map((d) => `  - ${d.ruleName} (subtlety ${d.subtlety})`).join('\n')
      : '  (none)'
  const { clueCountIn, clueCountOut, poolSize } = puzzle.knobValues

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
- rewrite-puzzle: the rule is fine but the WORD CHOICES need to change to address the reviewer's feedback (e.g. more variety, better/harder examples). YOU pick the replacement words — see the rewrite instructions below. Prefer this over agree-reject whenever the feedback is about which words appear.
- adjust-difficulty: the rule itself is sound but miscalibrated (too easy to guess by elimination, or surprisingly hard for its tier). Set newSubtlety to a better 1-5 rating.
- agree-reject: the reviewer gave no usable reasoning, or nothing here is worth fixing.

REWRITE-PUZZLE INSTRUCTIONS (only if you choose that action):
Author a brand-new set of words that directly addresses the reviewer's feedback, choosing ONLY from
the menus below (do not invent words — words not in these menus will be rejected).
- clues: EXACTLY ${clueCountIn} words labeled "IN" and EXACTLY ${clueCountOut} labeled "OUT".
- guests: EXACTLY ${poolSize} words, a genuine mix of IN and OUT (never all one side).
- IN words (satisfy the rule — use for IN clues/guests): ${inWordMenu.join(', ')}
- OUT words (do NOT satisfy the rule — use for OUT clues/guests): ${outWordMenu.join(', ')}
- No word may appear more than once across clues and guests.

Respond with the action and one short sentence of rationale (plus clues/guests only for rewrite-puzzle).`
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
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
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
