import type { Rule } from '../rules/types.js'
import type { Word } from '../words/types.js'
import type { AiAuthoredWord, AiReviewAction } from './aiReviewAction.js'
import { buildRuleIndex } from './lookup.js'
import { repairWord, type RepairWordInput } from './repairWord.js'
import type { CandidatePuzzle } from './types.js'
import { validateAndRepair } from './validator.js'

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
      /**
       * Undefined means "no override" and must be written as an unset, not
       * skipped — a rewritten board may no longer collide with whatever
       * produced the puzzle's previous reveal override.
       */
      revealRuleId?: string
      /**
       * The validator swapped a word the AI had chosen. Rare (~1-3% of
       * authored boards) but invisible without this: the reviewer asks for a
       * change, the AI complies, the board is then quietly adjusted to stay
       * solvable, and the result reads as the AI having ignored them.
       */
      alteredByValidator?: boolean
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
  /**
   * Why the puzzle was left untouched, when it was. Shown to the reviewer:
   * without it a rejected edit is indistinguishable from a successful one that
   * happened to change nothing, and the model's rationale — which describes
   * what it intended — actively misleads.
   */
  failureReason?: string
  /** True when the puzzle survives (content updated) and stays in pending_approval for a second human look. */
  stillPending: boolean
}

function reject(
  ruleOverride: AiReviewRuleOverride | null = null,
  failureReason?: string
): AiReviewDispatchPlan {
  return {
    puzzleMutation: { kind: 'reject' },
    ruleOverride,
    stillPending: false,
    ...(failureReason ? { failureReason } : {}),
  }
}

/**
 * The AI proposes words; the server disposes. Every word must exist in the
 * bank, every clue must sit on the side the AI claims (checked against the real
 * rule, never the AI's label), counts must match the tier's knobs, guest labels
 * are recomputed from the rule, the pool must be a genuine mix, and the board
 * must pass the same uniqueness validator every generated puzzle passes.
 */
/**
 * The outcome of checking an AI-authored board, with a reason when it fails.
 *
 * Every rejection used to be a bare `null`, and that was the single worst thing
 * about the refine flow: nine different failures collapsed into "nothing
 * happened", while the reviewer was still shown the model's rationale saying
 * what it had meant to do. 40% of real refines ended that way. The AI had often
 * proposed exactly the right edit and the server binned it without a word.
 */
export type AuthoredPuzzleResult =
  | { ok: true; candidate: CandidatePuzzle }
  | { ok: false; reason: string }

function fail(reason: string): AuthoredPuzzleResult {
  return { ok: false, reason }
}

function validateAuthoredPuzzle(
  puzzle: RepairWordInput,
  authoredClues: AiAuthoredWord[],
  authoredGuests: AiAuthoredWord[],
  rules: Rule[],
  wordBank: Word[]
): AuthoredPuzzleResult {
  const rule = rules.find((r) => r.id === puzzle.ruleId)
  if (!rule) return fail(`the rule "${puzzle.ruleId}" is no longer in the taxonomy`)

  const wordById = new Map(wordBank.map((w) => [w.id, w]))
  const knobs = puzzle.knobValues

  const inClues = authoredClues.filter((c) => c.label === 'IN')
  const outClues = authoredClues.filter((c) => c.label === 'OUT')
  if (inClues.length !== knobs.clueCountIn || outClues.length !== knobs.clueCountOut) {
    return fail(
      `wrong clue counts — got ${inClues.length} IN and ${outClues.length} OUT, need ${knobs.clueCountIn} and ${knobs.clueCountOut}`
    )
  }
  if (authoredGuests.length !== knobs.poolSize) {
    return fail(`wrong pool size — got ${authoredGuests.length} guests, need ${knobs.poolSize}`)
  }

  const allSpellings = [...authoredClues.map((c) => c.word), ...authoredGuests.map((g) => g.word)]
  const duplicate = allSpellings.find((w, i) => allSpellings.indexOf(w) !== i)
  if (duplicate) return fail(`"${duplicate}" appears twice — every word must be distinct`)

  for (const clue of authoredClues) {
    const word = wordById.get(clue.word)
    if (!word) return fail(`"${clue.word}" is not in the word bank`)
    if (word.safety.blocked) return fail(`"${clue.word}" is blocked and can't be used`)
    if (rule.evaluate(word) !== (clue.label === 'IN')) {
      return fail(
        `"${clue.word}" was labelled ${clue.label}, but the rule says it is ${rule.evaluate(word) ? 'IN' : 'OUT'}`
      )
    }
  }

  const guestWords: Word[] = []
  for (const guest of authoredGuests) {
    const word = wordById.get(guest.word)
    if (!word) return fail(`"${guest.word}" is not in the word bank`)
    if (word.safety.blocked) return fail(`"${guest.word}" is blocked and can't be used`)
    guestWords.push(word)
  }
  // Guest labels are recomputed from the rule, never trusted from the AI.
  const guestLabels = guestWords.map((w) => (rule.evaluate(w) ? 'IN' : 'OUT'))
  if (!guestLabels.includes('IN') || !guestLabels.includes('OUT')) {
    return fail(
      `every guest would be ${guestLabels[0]} — the pool needs a mix or the puzzle gives itself away`
    )
  }

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
  if (result.status === 'valid') return { ok: true, candidate: result.candidate }
  return fail(
    result.reason === 'unrepairable-collision'
      ? `another rule (${(result.collidingRuleIds ?? []).join(', ')}) fits that board just as well, so the answer would be ambiguous`
      : 'the board could not be made unambiguous within the repair budget'
  )
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
      if (!result.repaired) {
        return reject(
          null,
          `no replacement for "${decision.badWordId}" keeps the puzzle solvable — the bank has no word that fits the rule the same way without making the board ambiguous`
        )
      }
      return {
        puzzleMutation: {
          kind: 'update-content',
          clues: result.candidate.clues,
          guests: result.candidate.guests,
          liveDecoys: result.candidate.liveDecoys,
          revealRuleId: result.candidate.revealRuleId,
        },
        ruleOverride: null,
        stillPending: true,
      }
    }
    case 'rewrite-puzzle': {
      // Option A: the AI authored the replacement words to address specific
      // content feedback; validateAuthoredPuzzle gates them hard, and a
      // failed rewrite falls back to a plain reject so the click resolves.
      const authoredGuests = decision.guests.map((g) => g.word).join()
      const outcome = validateAuthoredPuzzle(
        puzzle,
        decision.clues,
        decision.guests,
        rules,
        wordBank
      )
      if (!outcome.ok) return reject(null, outcome.reason)
      const candidate = outcome.candidate
      return {
        puzzleMutation: {
          kind: 'update-content',
          clues: candidate.clues,
          guests: candidate.guests,
          liveDecoys: candidate.liveDecoys,
          revealRuleId: candidate.revealRuleId,
          alteredByValidator: candidate.guests.map((g) => g.wordId).join() !== authoredGuests,
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
