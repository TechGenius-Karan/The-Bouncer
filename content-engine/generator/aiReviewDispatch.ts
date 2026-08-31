import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import type { AiAuthoredWord, AiReviewAction } from './aiReviewAction'
import { buildRuleIndex } from './lookup'
import { repairWord, type RepairWordInput } from './repairWord'
import type { CandidatePuzzle } from './types'
import { validateAndRepair } from './validator'

// ai-feedback-plan.md §7.5/§10: the pure, Mongo-free core of admin-ai-review.ts.
// Given a *validated* AiReviewAction (parseAiReviewAction already ran) plus the
// puzzle and taxonomy, it decides what should happen — reusing the existing
// repairWord/generateCandidate machinery and never touching the database — so
// the five-way branch is unit-testable in isolation, the same testable-core +
// thin-wrapper split repairWord.ts got from admin-repair-word.ts.

/** How the puzzle document itself should change. */
export type AiReviewPuzzleMutation =
  | {
      kind: 'update-content'
      clues: CandidatePuzzle['clues']
      guests: CandidatePuzzle['guests']
      liveDecoys: CandidatePuzzle['liveDecoys']
    }
  | { kind: 'reject' }

/** A live recalibration of the rule's difficulty, or null. */
export interface AiReviewRuleOverride {
  ruleId: string
  subtletyOverride: number
}

export interface AiReviewDispatchPlan {
  puzzleMutation: AiReviewPuzzleMutation
  ruleOverride: AiReviewRuleOverride | null
  /** True when the puzzle survives (content updated) and stays in pending_approval for a second human look. */
  stillPending: boolean
}

function reject(ruleOverride: AiReviewRuleOverride | null = null): AiReviewDispatchPlan {
  return { puzzleMutation: { kind: 'reject' }, ruleOverride, stillPending: false }
}

/**
 * Turns the AI's authored words (Option A's rewrite-puzzle) into a validated
 * puzzle, or null if it can't be trusted. The AI proposes words; the server
 * disposes: every word must exist in the bank, every clue must actually sit
 * on the side the AI claims (checked against the real rule, never the AI's
 * label), the counts must match the tier's knobs, guest true-labels are
 * recomputed from the rule (never trusted from the AI), the pool must be a
 * genuine mix (not an all-one-label giveaway), and the whole thing must pass
 * the same uniqueness validator every generated puzzle passes.
 */
function validateAuthoredPuzzle(
  puzzle: RepairWordInput,
  authoredClues: AiAuthoredWord[],
  authoredGuests: AiAuthoredWord[],
  rules: Rule[],
  wordBank: Word[]
): CandidatePuzzle | null {
  const rule = rules.find((r) => r.id === puzzle.ruleId)
  if (!rule) return null

  const wordById = new Map(wordBank.map((w) => [w.id, w]))
  const knobs = puzzle.knobValues

  const inClues = authoredClues.filter((c) => c.label === 'IN')
  const outClues = authoredClues.filter((c) => c.label === 'OUT')
  if (inClues.length !== knobs.clueCountIn || outClues.length !== knobs.clueCountOut) return null
  if (authoredGuests.length !== knobs.poolSize) return null

  // No word may appear twice across clues + guests.
  const allSpellings = [...authoredClues.map((c) => c.word), ...authoredGuests.map((g) => g.word)]
  if (new Set(allSpellings).size !== allSpellings.length) return null

  // Every clue word must be in the bank AND actually sit on the side the AI claims.
  for (const clue of authoredClues) {
    const word = wordById.get(clue.word)
    if (!word || word.safety.blocked) return null
    if (rule.evaluate(word) !== (clue.label === 'IN')) return null
  }

  // Guests: true label is recomputed from the rule, never trusted from the AI.
  const guestWords = authoredGuests.map((g) => wordById.get(g.word))
  if (guestWords.some((w) => !w || w.safety.blocked)) return null
  const guestLabels = guestWords.map((w) => (rule.evaluate(w!) ? 'IN' : 'OUT'))
  if (!guestLabels.includes('IN') || !guestLabels.includes('OUT')) return null // no all-one-side giveaway pool

  const candidate: CandidatePuzzle = {
    ruleId: puzzle.ruleId,
    difficultyTier: puzzle.difficultyTier,
    knobValues: knobs,
    status: 'pending_approval',
    clues: authoredClues.map((c, i) => ({ wordId: c.word, label: c.label, displayOrder: i })),
    guests: authoredGuests.map((g, i) => ({
      wordId: g.word,
      trueLabel: guestLabels[i],
      displayOrder: i,
      isTrap: false,
      trapType: null,
    })),
    liveDecoys: [],
  }

  const result = validateAndRepair(candidate, rules, buildRuleIndex(rules), wordBank)
  return result.status === 'valid' ? result.candidate : null
}

/**
 * Resolves a validated AI decision into a concrete plan. swap-word and
 * rewrite-puzzle both run the real uniqueness validator (via repairWord /
 * validateAuthoredPuzzle) and only survive if it passes — a failed attempt
 * falls back to a plain reject, so the reviewer's click always resolves. The
 * other three actions never change puzzle content: they reject this instance
 * and, for adjust-difficulty / retire-rule, carry a taxonomy-level override.
 */
export function planAiReviewDispatch(
  decision: AiReviewAction,
  puzzle: RepairWordInput,
  rules: Rule[],
  wordBank: Word[]
): AiReviewDispatchPlan {
  switch (decision.action) {
    case 'swap-word': {
      const result = repairWord(puzzle, decision.badWordId, rules, wordBank)
      if (!result.repaired) return reject()
      return {
        puzzleMutation: {
          kind: 'update-content',
          clues: result.candidate.clues,
          guests: result.candidate.guests,
          liveDecoys: result.candidate.liveDecoys,
        },
        ruleOverride: null,
        stillPending: true,
      }
    }
    case 'rewrite-puzzle': {
      // Option A: the AI authored the replacement words to address specific
      // content feedback; validateAuthoredPuzzle gates them hard, and a
      // failed rewrite falls back to a plain reject so the click resolves.
      const candidate = validateAuthoredPuzzle(puzzle, decision.clues, decision.guests, rules, wordBank)
      if (!candidate) return reject()
      return {
        puzzleMutation: {
          kind: 'update-content',
          clues: candidate.clues,
          guests: candidate.guests,
          liveDecoys: candidate.liveDecoys,
        },
        ruleOverride: null,
        stillPending: true,
      }
    }
    case 'adjust-difficulty':
      return reject({ ruleId: puzzle.ruleId, subtletyOverride: decision.newSubtlety })
    case 'agree-reject':
      return reject()
  }
}
