import { RULES } from '../rules'
import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { resolveKnobs, subtletyRangeFor } from './difficulty'
import { draftClueSet } from './draftClueSet'
import { scanDecoys } from './decoyScan'
import { buildRuleIndex } from './lookup'
import { pickRandom } from './random'
import { eligibleRulesByFamily, pickFamily } from './ruleSelection'
import { selectGuestPool } from './trapSelection'
import type { CandidatePuzzle, DifficultyTier } from './types'
import { validateAndRepair } from './validator'

const MAX_CLUE_ADJUST_ATTEMPTS = 8
const MAX_RULE_ATTEMPTS = 10
// Out of MAX_RULE_ATTEMPTS, how many stay committed to the family
// pickFamily chose before falling back to the other family. Re-rolling the
// family fresh on every failed attempt (the old behavior) meant a
// scarce-word-pool semantic rule failing once would just as often be
// "replaced" by a lexical retry as another semantic one, silently
// suppressing the realized semantic share below knobs.semanticRuleWeight —
// see the approved plan doc.
const PRIMARY_FAMILY_ATTEMPTS = 6

/**
 * planning.md §7.6 end to end: pick a rule, draft clues, scan for decoys
 * (re-drafting the clue set if the surviving-decoy count misses the tier's
 * target), select a trap-aware guest pool, then validate-and-repair. Falls
 * back to a different rule if a candidate can't be built or can't pass
 * validation — see §7.3's reject-vs-repair guidance.
 *
 * `priorUsedIds` lets a caller (batch.ts) exclude words already used by
 * earlier candidates in the same batch run, so a batch doesn't repeatedly
 * lean on the same handful of words for a given rule.
 */
export function generateCandidate(
  tier: DifficultyTier,
  wordBank: Word[],
  rules: Rule[] = RULES,
  priorUsedIds: Set<string> = new Set()
): CandidatePuzzle | null {
  const knobs = resolveKnobs(tier)
  const [minSubtlety, maxSubtlety] = subtletyRangeFor(tier)
  const ruleIndex = buildRuleIndex(rules)

  const eligibleLexical = eligibleRulesByFamily(
    rules,
    'lexical-structural',
    minSubtlety,
    maxSubtlety
  )
  const eligibleSemantic = eligibleRulesByFamily(
    rules,
    'semantic-knowledge',
    minSubtlety,
    maxSubtlety
  )

  const family = pickFamily(eligibleLexical, eligibleSemantic, knobs.semanticRuleWeight)
  const primaryPool = family === 'semantic-knowledge' ? eligibleSemantic : family === 'lexical-structural' ? eligibleLexical : rules
  const fallbackPool = family === 'semantic-knowledge' ? eligibleLexical : family === 'lexical-structural' ? eligibleSemantic : rules

  for (let ruleAttempt = 0; ruleAttempt < MAX_RULE_ATTEMPTS; ruleAttempt++) {
    const wantPrimary = ruleAttempt < PRIMARY_FAMILY_ATTEMPTS
    // primaryPool/fallbackPool are never both empty (pickFamily's own
    // contract), so whichever branch this lands on is guaranteed non-empty.
    const pool = wantPrimary && primaryPool.length > 0 ? primaryPool : fallbackPool.length > 0 ? fallbackPool : primaryPool
    const trueRule = pickRandom(pool)

    let clues
    try {
      clues = draftClueSet(trueRule, wordBank, knobs, priorUsedIds)
    } catch {
      continue // this rule can't even get a clue set from this word bank — try another
    }
    let liveDecoys = scanDecoys(trueRule, clues, wordBank, rules)

    // Each redraw is an independent random sample, so simply overwriting
    // clues/liveDecoys on every attempt doesn't converge toward the target
    // range — it just replaces one coin flip with another. Track whichever
    // attempt lands closest to (or inside) the target range instead, so the
    // bounded retries actually make progress.
    const [minDecoys, maxDecoys] = knobs.targetSurvivingDecoyRange
    const distanceFromTarget = (count: number) =>
      count < minDecoys ? minDecoys - count : count > maxDecoys ? count - maxDecoys : 0

    let bestClues = clues
    let bestDecoys = liveDecoys
    let bestDistance = distanceFromTarget(liveDecoys.length)

    let clueAttempt = 0
    while (bestDistance > 0 && clueAttempt < MAX_CLUE_ADJUST_ATTEMPTS) {
      const attemptClues = draftClueSet(trueRule, wordBank, knobs, priorUsedIds)
      const attemptDecoys = scanDecoys(trueRule, attemptClues, wordBank, rules)
      const distance = distanceFromTarget(attemptDecoys.length)
      if (distance < bestDistance) {
        bestClues = attemptClues
        bestDecoys = attemptDecoys
        bestDistance = distance
      }
      clueAttempt++
    }

    clues = bestClues
    liveDecoys = bestDecoys

    const usedIds = new Set([...priorUsedIds, ...clues.map((c) => c.wordId)])
    const guests = selectGuestPool(trueRule, liveDecoys, wordBank, knobs, ruleIndex, usedIds)
    if (guests.length < knobs.poolSize) continue // couldn't fill the pool — try a different rule

    const candidate: CandidatePuzzle = {
      ruleId: trueRule.id,
      difficultyTier: tier,
      knobValues: knobs,
      status: 'pending_approval',
      clues,
      guests,
      liveDecoys: [],
    }

    const result = validateAndRepair(candidate, rules, ruleIndex, wordBank)
    if (result.status === 'valid') return result.candidate
    // reject -> a fresh rule/clue-set combination is a full retry, not a patch (§7.3)
  }

  return null
}
