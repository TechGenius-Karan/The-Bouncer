import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { scanDecoys } from './decoyScan'
import { buildWordIndex, mustFind } from './lookup'
import type { CandidatePuzzle, ValidationResult } from './types'

const MAX_REPAIR_ATTEMPTS = 5

/**
 * Step 4 of planning.md §7.6, implementing §7.3's uniqueness validator
 * exactly: a puzzle is only fair if EXACTLY ONE rule in the whole taxonomy
 * cleanly separates IN from OUT across clues + pool combined. On a
 * collision, repair by swapping the one guest word propping it up; only
 * reject the whole candidate if repair can't find a replacement.
 */
export function validateAndRepair(
  candidate: CandidatePuzzle,
  allRules: Rule[],
  ruleIndex: Map<string, Rule>,
  wordBank: Word[],
): ValidationResult {
  const trueRule = mustFind(ruleIndex, candidate.ruleId, 'rule')
  let attempt = 0

  while (attempt <= MAX_REPAIR_ATTEMPTS) {
    const wordIndex = buildWordIndex(wordBank)
    const items = [
      ...candidate.clues.map((c) => ({
        word: mustFind(wordIndex, c.wordId, 'word'),
        isIn: c.label === 'IN',
      })),
      ...candidate.guests.map((g) => ({
        word: mustFind(wordIndex, g.wordId, 'word'),
        isIn: g.trueLabel === 'IN',
      })),
    ]

    const collisions = allRules.filter((rule) => {
      if (rule.id === trueRule.id) return false
      return items.every((item) => rule.evaluate(item.word) === item.isIn)
    })

    if (collisions.length === 0) {
      candidate.liveDecoys = scanDecoys(trueRule, candidate.clues, wordBank, allRules)
      return { status: 'valid', candidate }
    }

    const usedIds = new Set([
      ...candidate.clues.map((c) => c.wordId),
      ...candidate.guests.map((g) => g.wordId),
    ])

    let repaired = false
    for (const collidingRule of collisions) {
      // Guests that agree with the colliding rule are what's propping up the
      // collision — prefer disturbing a non-trap guest first, so we don't
      // undo a trap that's disambiguating a DIFFERENT decoy.
      const collidingGuests = candidate.guests
        .filter((g) => collidingRule.evaluate(mustFind(wordIndex, g.wordId, 'word')) === (g.trueLabel === 'IN'))
        .slice()
        .sort((a, b) => Number(a.isTrap) - Number(b.isTrap))

      for (const guest of collidingGuests) {
        const replacements = wordBank
          .filter(
            (w) =>
              !usedIds.has(w.id) &&
              !w.safety.blocked &&
              trueRule.evaluate(w) === (guest.trueLabel === 'IN') &&
              collidingRule.evaluate(w) !== (guest.trueLabel === 'IN'),
          )
          .sort((a, b) => b.frequencyScore - a.frequencyScore)

        if (replacements.length > 0) {
          const pick = replacements[0]
          guest.wordId = pick.id
          guest.isTrap = true
          guest.trapType = collidingRule.evaluate(pick) ? 'decoy' : 't-but-looks-wrong'
          repaired = true
          break
        }
      }
      if (repaired) break
    }

    if (!repaired) {
      return {
        status: 'reject',
        reason: 'unrepairable-collision',
        collidingRuleIds: collisions.map((r) => r.id),
      }
    }

    attempt += 1
  }

  return { status: 'reject', reason: 'max-repair-attempts-exceeded' }
}
