import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import type { AiReviewAction } from './aiReviewAction'
import { generateCandidate } from './orchestrator'
import { repairWord, type RepairWordInput } from './repairWord'
import type { CandidatePuzzle } from './types'

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

/** A live rule-taxonomy change to apply (retire / recalibrate), or null. */
export interface AiReviewRuleOverride {
  ruleId: string
  disabled?: boolean
  subtletyOverride?: number
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
 * Resolves a validated AI decision into a concrete plan. swap-word and
 * redraft-puzzle both re-run the real validator (via repairWord /
 * generateCandidate) and only survive if it passes — a failed attempt falls
 * back to a plain reject, so the reviewer's click always resolves. The other
 * three actions never rewrite puzzle content: they reject this instance and,
 * for adjust-difficulty / retire-rule, carry a taxonomy-level override.
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
    case 'redraft-puzzle': {
      const rule = rules.find((r) => r.id === puzzle.ruleId)
      // A singleton [rule] array forces generateCandidate onto that one rule
      // with no new forceRuleId parameter — see ai-feedback-plan.md §7.3.
      const candidate = rule ? generateCandidate(puzzle.difficultyTier, wordBank, [rule]) : null
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
    case 'retire-rule':
      return reject({ ruleId: puzzle.ruleId, disabled: true })
    case 'agree-reject':
      return reject()
  }
}
