import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'
import { generateCandidate } from './orchestrator'
import type { CandidatePuzzle, DifficultyTier } from './types'

/**
 * Pure batch generation — no file I/O — so it's directly testable and
 * reusable by the CLI script in content-engine/scripts/generateBatch.ts.
 * Cycles through the requested tiers so a batch of N gets a mix rather
 * than N candidates of a single tier.
 */
export function generateBatchCore(
  n: number,
  tiers: DifficultyTier[] = ['medium', 'spicy'],
): CandidatePuzzle[] {
  const wordBank = buildWordBank()
  const batch: CandidatePuzzle[] = []
  const maxAttempts = n * 10

  let tierIndex = 0
  let attempts = 0
  while (batch.length < n && attempts < maxAttempts) {
    const tier = tiers[tierIndex % tiers.length]
    tierIndex++
    attempts++
    const candidate = generateCandidate(tier, wordBank, RULES)
    if (candidate) batch.push(candidate)
  }

  return batch
}
