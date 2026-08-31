import { RULES } from '../rules'
import type { Rule } from '../rules/types'
import { buildWordBank } from '../words/wordBank'
import { generateCandidate } from './orchestrator'
import type { CandidatePuzzle, DifficultyTier } from './types'

/**
 * Pure batch generation — no file I/O — so it's directly testable and
 * reusable by the CLI script in content-engine/scripts/generateBatch.ts.
 * Cycles through the requested tiers so a batch of N gets a mix rather
 * than N candidates of a single tier.
 *
 * Tracks every word used by an accepted candidate in `usedIds` (shared
 * across tiers) and every rule used in `usedRuleIdsByTier` (kept **per
 * tier**, not shared) — so a batch doesn't repeatedly lean on the same
 * small handful of words for a thin-pooled rule, and doesn't draft the
 * same rule twice within a tier while a fresh one is still available for
 * it. Rule exclusion has to be per-tier rather than global: medium's
 * [2,3] and spicy's [3,5] subtlety windows overlap at 3, so most of
 * spicy's eligible rules are also medium-eligible — sharing one exclusion
 * set meant medium's picks (generated first in the alternating cycle)
 * exhausted spicy's shared rules almost immediately, tipping spicy into
 * generateCandidate's "no fresh rule left" fallback (which allows
 * unrestricted reuse) far too early and making spicy's repeats *worse*
 * than having no rule exclusion at all.
 *
 * `rejectCounts` (build-plan.md Phase 10.6 item 2) is an optional recent
 * reject-count-per-rule-id map, passed straight through to every
 * generateCandidate call so a batch softly avoids rules a reviewer has
 * recently rejected candidates for. Callers with Mongo access resolve this
 * via netlify/functions/_shared/rejectStats.ts before calling in.
 *
 * `rules` (ai-feedback-plan.md §11 phase 1) defaults to the full static
 * taxonomy but lets a caller pass the effective rules after
 * applyRuleOverrides (live subtlety overrides) instead.
 */
export function generateBatchCore(
  n: number,
  tiers: DifficultyTier[] = ['medium', 'spicy'],
  rejectCounts: Map<string, number> = new Map(),
  rules: Rule[] = RULES,
): CandidatePuzzle[] {
  const wordBank = buildWordBank()
  const batch: CandidatePuzzle[] = []
  const usedIds = new Set<string>()
  const usedRuleIdsByTier = new Map<DifficultyTier, Set<string>>()
  const maxAttempts = n * 10

  let tierIndex = 0
  let attempts = 0
  while (batch.length < n && attempts < maxAttempts) {
    const tier = tiers[tierIndex % tiers.length]
    tierIndex++
    attempts++
    const usedRuleIds = usedRuleIdsByTier.get(tier) ?? new Set<string>()
    const candidate =
      generateCandidate(tier, wordBank, rules, usedIds, usedRuleIds, rejectCounts) ??
      generateCandidate(tier, wordBank, rules, new Set(), usedRuleIds, rejectCounts) ??
      generateCandidate(tier, wordBank, rules, new Set(), new Set(), rejectCounts)
    if (candidate) {
      batch.push(candidate)
      for (const clue of candidate.clues) usedIds.add(clue.wordId)
      for (const guest of candidate.guests) usedIds.add(guest.wordId)
      usedRuleIds.add(candidate.ruleId)
      usedRuleIdsByTier.set(tier, usedRuleIds)
    }
  }

  return batch
}
