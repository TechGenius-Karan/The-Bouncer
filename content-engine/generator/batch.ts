import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { generateCandidate } from './orchestrator'
import type { CandidatePuzzle, DifficultyTier } from './types'

/**
 * Pure batch generation — no file I/O — so it's directly testable and
 * reusable by the CLI script in content-engine/scripts/generateBatch.ts.
 * Cycles through the requested tiers so a batch of N gets a mix rather
 * than N candidates of a single tier.
 *
 * Tracks every word used by an accepted candidate in `usedIds` and passes
 * it to the next `generateCandidate` call, so a batch doesn't repeatedly
 * lean on the same small handful of words for a rule with a thin eligible
 * pool. Soft fallback: if excluding those words starves a candidate
 * entirely, retry once without the exclusion before giving up on that
 * attempt — a full batch's worth of yield matters more than perfect
 * variety on a rule whose pool genuinely can't support both.
 */
export function generateBatchCore(
  n: number,
  tiers: DifficultyTier[] = ['medium', 'spicy'],
): CandidatePuzzle[] {
  const wordBank = buildWordBank()
  const batch: CandidatePuzzle[] = []
  const usedIds = new Set<string>()
  const maxAttempts = n * 10

  let tierIndex = 0
  let attempts = 0
  while (batch.length < n && attempts < maxAttempts) {
    const tier = tiers[tierIndex % tiers.length]
    tierIndex++
    attempts++
    const candidate = generateCandidate(tier, wordBank, RULES, usedIds) ?? generateCandidate(tier, wordBank, RULES)
    if (candidate) {
      batch.push(candidate)
      for (const clue of candidate.clues) usedIds.add(clue.wordId)
      for (const guest of candidate.guests) usedIds.add(guest.wordId)
    }
  }

  return batch
}
