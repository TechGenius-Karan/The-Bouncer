import { GoogleGenAI, Type } from '@google/genai'
import { parseAiReviewAction, type AiReviewAction } from '../../../content-engine/generator/aiReviewAction'
import type { AdminPuzzleDetail } from './adminApi'

// ai-feedback-plan.md §4/§7.4: Gemini's free tier (no card) is the pick. The
// model lineup shifted fast under us (all empirical, 2026-08-30): 3.5-flash's
// free tier is only 20 req/DAY (live 429: "limit: 20") and slow; 2.5-flash is
// now 404 for new accounts ("no longer available to new users"); Google's own
// error steers new users to 3.6-flash, which is what we use. Re-verify quotas
// at https://ai.google.dev/gemini-api/docs/rate-limits before assuming.
// A *-flash-lite model, deliberately, after measuring the alternatives on the
// real review prompt (2026-08-31):
//   gemini-3.6-flash      17-25s per call, and a 20-request/DAY free quota
//   gemini-3.5-flash      slower still, also 20/day
//   gemini-3.5-flash-lite ~1s, far larger free quota
// The 20/day cap is the important one — published third-party figures claim
// 1,500/day for these models, but the API's own 429 says
// "quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit: 20".
// A reviewer working through a queue exhausts that in one sitting, and the
// full-size calls were also brushing the timeout. This is bounded
// word-selection from a supplied menu, not open-ended reasoning, so a lite
// model is the right fit as well as the affordable one.
// Override with GEMINI_MODEL to try another without a code change.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
// Netlify sync functions hard-cap at 26s, so this can't usefully go higher —
// the fix for a slow model is a faster model, not a longer wait.
const TIMEOUT_MS = 20_000

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

/** A menu word plus, where the rule has variants, why it matches ("listening" -> "ten"). */
export interface MenuWord {
  word: string
  variant?: string
}

export interface AiReviewInput {
  puzzle: AdminPuzzleDetail
  reason: string
  /** rewrite-puzzle menu: real bank words that satisfy the rule. The AI may only author IN clues/guests from this list. */
  inWordMenu: MenuWord[]
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

  // Annotate each IN word with *why* it matches. Without this the model was
  // handed a bare list like "listening, ninety, everyone" and asked to honor
  // "vary which number is hidden" — it had no way to know which number each
  // word hid, so it couldn't act on the feedback however well it understood it.
  const hasVariants = inWordMenu.some((m) => m.variant)
  const inMenuText = inWordMenu
    .map((m) => (m.variant ? `${m.word} (${m.variant})` : m.word))
    .join(', ')
  const variantCounts = new Map<string, number>()
  for (const m of inWordMenu) {
    if (m.variant) variantCounts.set(m.variant, (variantCounts.get(m.variant) ?? 0) + 1)
  }
  const variantSummary = [...variantCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${v} (${n} words)`)
    .join(', ')

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
The reviewer has asked you to REFINE this puzzle. They have a separate button for
throwing it away, so they have already decided it is worth saving — your job is to
improve it, not to judge whether it deserves to exist.

Decide exactly ONE action:
- swap-word: only ONE specific word is the problem (a proper name, something ambiguous or awkward) — the rule/concept itself is fine. Set badWordId to that word's id from the lists above.
- rewrite-puzzle: the word choices need to change to address the feedback. YOU pick the words — see the rewrite instructions below. This is usually the right answer.
- adjust-difficulty: the rule is sound but miscalibrated for its tier. Set newSubtlety to a better 1-5 rating. Note this does NOT change the puzzle, so only use it when the feedback is purely about difficulty.
- agree-reject: use ONLY when the feedback is impossible to act on. The puzzle is kept either way — say plainly in your rationale what you could not do and why.

CHANGE AS LITTLE AS POSSIBLE. If the reviewer objects to one specific thing, fix
that and keep every other word exactly as it is. Do not reshuffle words the
feedback did not mention — a reviewer who asked for one change and got a
completely different puzzle cannot tell whether you understood them.

If the reviewer asks for a SPECIFIC word that does not appear in the menus below,
you cannot use it — the word is not in the game's word bank and any answer
containing it will be discarded. Do not silently substitute a different word as if
you had complied: name the missing word in your rationale so the reviewer knows
why their request could not be met, and make only the rest of the change.

REWRITE-PUZZLE INSTRUCTIONS (only if you choose that action):
Give the puzzle's FULL word list as it should end up — including every word you are
keeping unchanged, which should be most of them. Choose ONLY from the current puzzle's
own words (listed above) and the menus below; any word from neither is not in the game's
word bank and will cause your whole answer to be discarded.
- clues: EXACTLY ${clueCountIn} words labeled "IN" and EXACTLY ${clueCountOut} labeled "OUT".
- guests: EXACTLY ${poolSize} words, a genuine mix of IN and OUT (never all one side).
- IN words (satisfy the rule — use for IN clues/guests)${hasVariants ? ', each shown with WHY it matches in brackets' : ''}: ${inMenuText}
- OUT words (do NOT satisfy the rule — use for OUT clues/guests): ${outWordMenu.join(', ')}
- No word may appear more than once across clues and guests.
- Write ONLY the word itself in your answer, never the bracketed reason.${
    hasVariants
      ? `\n- This rule matches for several different reasons — available: ${variantSummary}. Unless the reviewer asked for something else, spread the IN clues across DIFFERENT reasons rather than picking several words that match for the same one.`
      : ''
  }

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
