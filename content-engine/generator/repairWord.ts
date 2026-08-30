import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { buildRuleIndex, mustFind } from './lookup'
import type { CandidatePuzzle } from './types'
import { validateAndRepair } from './validator'

export interface RepairWordInput {
  ruleId: string
  difficultyTier: CandidatePuzzle['difficultyTier']
  knobValues: CandidatePuzzle['knobValues']
  clues: CandidatePuzzle['clues']
  guests: CandidatePuzzle['guests']
}

export type RepairWordResult = { repaired: true; candidate: CandidatePuzzle } | { repaired: false }

/**
 * Phase 10.6 item 2's "cheap word-level repair path": the minority case
 * where a reviewer's objection is genuinely about one specific word, not
 * the whole rule/concept. Swaps `badWordId` for a different word satisfying
 * the same rule/label, re-runs the full uniqueness validator, and returns
 * the repaired candidate on success — or `{ repaired: false }` if no
 * replacement kept the puzzle valid (caller falls back to a normal reject).
 *
 * ponytail: a replaced trap guest loses its trap role (isTrap/trapType
 * reset) rather than searching for a replacement that preserves it —
 * PuzzleGuestDoc doesn't persist which rule made a guest a decoy, so
 * reconstructing that role here isn't cheap. Upgrade path: thread the
 * originating decoy ruleId onto PuzzleGuestDoc at generation time.
 */
export function repairWord(
  input: RepairWordInput,
  badWordId: string,
  rules: Rule[],
  wordBank: Word[]
): RepairWordResult {
  const ruleIndex = buildRuleIndex(rules)
  const trueRule = mustFind(ruleIndex, input.ruleId, 'rule')

  const clueSlot = input.clues.find((c) => c.wordId === badWordId)
  const guestSlot = input.guests.find((g) => g.wordId === badWordId)
  if (!clueSlot && !guestSlot) return { repaired: false }

  const wantIn = clueSlot ? clueSlot.label === 'IN' : guestSlot!.trueLabel === 'IN'
  const usedIds = new Set([...input.clues.map((c) => c.wordId), ...input.guests.map((g) => g.wordId)])

  const replacements = wordBank
    .filter((w) => !usedIds.has(w.id) && !w.safety.blocked && trueRule.evaluate(w) === wantIn)
    .sort((a, b) => b.frequencyScore - a.frequencyScore)

  for (const replacement of replacements) {
    const attempt: CandidatePuzzle = {
      ruleId: input.ruleId,
      difficultyTier: input.difficultyTier,
      knobValues: input.knobValues,
      status: 'pending_approval',
      clues: input.clues.map((c) => (c.wordId === badWordId ? { ...c, wordId: replacement.id } : c)),
      guests: input.guests.map((g) =>
        g.wordId === badWordId ? { ...g, wordId: replacement.id, isTrap: false, trapType: null } : g
      ),
      liveDecoys: [],
    }
    const result = validateAndRepair(attempt, rules, ruleIndex, wordBank)
    if (result.status === 'valid') return { repaired: true, candidate: result.candidate }
  }

  return { repaired: false }
}
