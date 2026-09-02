import { classifyCollision, pickRevealRule } from '../rules/ruleSimilarity'
import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { scanDecoys } from './decoyScan'
import { buildWordIndex, mustFind } from './lookup'
import type { CandidatePuzzle, ValidationResult } from './types'

const MAX_REPAIR_ATTEMPTS = 5

/**
 * Step 4 of planning.md §7.6, implementing §7.3's uniqueness validator: a
 * puzzle is only fair if the board can't be read as some *other* rule. On a
 * collision, repair by swapping the one guest word propping it up; only
 * reject the whole candidate if repair can't find a replacement.
 *
 * Narrowed from §7.3's literal "exactly one rule" to "exactly one *idea*".
 * §7.3 rejects any second rule that fits the board, on the grounds that the
 * reveal would name T to a player who inferred D and they'd "rightly feel
 * cheated." That holds for a coincidence and not for a near-synonym — being
 * told "ends with NG" after inferring "ends with G" is not a grievance. So a
 * collision is now classified against the whole word bank
 * (rules/ruleSimilarity.ts) and only *divergent* ones are repaired away;
 * equivalent and subsumption collisions ship, with the reveal switched to
 * whichever rule describes the board best. This is a deliberate relaxation of
 * a documented design decision, and it is the one part of the generator a
 * player can see, via the reveal screen.
 */
export function validateAndRepair(
  candidate: CandidatePuzzle,
  allRules: Rule[],
  ruleIndex: Map<string, Rule>,
  wordBank: Word[]
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

    // Only a collision that means something genuinely different is a defect.
    const divergent = collisions.filter(
      (rule) => classifyCollision(trueRule, rule, wordBank) === 'divergent'
    )

    if (divergent.length === 0) {
      candidate.liveDecoys = scanDecoys(trueRule, candidate.clues, wordBank, allRules)
      // Fold over the accepted collisions so the reveal names whichever rule
      // describes this board best, not just whichever one generated it.
      const reveal = collisions.reduce(
        (best, rule) =>
          pickRevealRule(best, rule, classifyCollision(best, rule, wordBank), wordBank),
        trueRule
      )
      // Cleared, not just left alone: a re-validated puzzle (an AI rewrite,
      // a repaired board) may no longer collide with whatever it did before,
      // and a stale reveal override would name a rule that no longer fits.
      if (reveal.id !== trueRule.id) candidate.revealRuleId = reveal.id
      else delete candidate.revealRuleId
      return { status: 'valid', candidate }
    }

    const usedIds = new Set([
      ...candidate.clues.map((c) => c.wordId),
      ...candidate.guests.map((g) => g.wordId),
    ])

    let repaired = false
    for (const collidingRule of divergent) {
      // Guests that agree with the colliding rule are what's propping up the
      // collision — prefer disturbing a non-trap guest first, so we don't
      // undo a trap that's disambiguating a DIFFERENT decoy.
      const collidingGuests = candidate.guests
        .filter(
          (g) =>
            collidingRule.evaluate(mustFind(wordIndex, g.wordId, 'word')) === (g.trueLabel === 'IN')
        )
        .slice()
        .sort((a, b) => Number(a.isTrap) - Number(b.isTrap))

      for (const guest of collidingGuests) {
        const replacements = wordBank
          .filter(
            (w) =>
              !usedIds.has(w.id) &&
              !w.safety.blocked &&
              trueRule.evaluate(w) === (guest.trueLabel === 'IN') &&
              collidingRule.evaluate(w) !== (guest.trueLabel === 'IN')
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
        collidingRuleIds: divergent.map((r) => r.id),
      }
    }

    attempt += 1
  }

  return { status: 'reject', reason: 'max-repair-attempts-exceeded' }
}
