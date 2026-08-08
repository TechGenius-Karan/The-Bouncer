import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { buildWordIndex, mustFind } from './lookup'
import type { ClueEntry, DecoyResult } from './types'

/**
 * Step 2 of planning.md §7.6 / §7.2's mechanism: which OTHER rules also fit
 * this clue set exactly as well as the true rule does? With only a few
 * examples, more than one rule is often equally well-supported by the
 * evidence — those are the "live decoys" a player might reasonably (but
 * wrongly) guess.
 */
export function scanDecoys(
  trueRule: Rule,
  clues: ClueEntry[],
  wordBank: Word[],
  allRules: Rule[],
): DecoyResult[] {
  const wordIndex = buildWordIndex(wordBank)
  const clueItems = clues.map((c) => ({
    word: mustFind(wordIndex, c.wordId, 'word'),
    isIn: c.label === 'IN',
  }))

  const results: DecoyResult[] = []
  for (const rule of allRules) {
    if (rule.id === trueRule.id) continue
    const matchesAll = clueItems.every((item) => rule.evaluate(item.word) === item.isIn)
    if (matchesAll) results.push({ ruleId: rule.id, subtlety: rule.subtlety })
  }

  // Most plausible (highest-subtlety) decoy first — trap selection targets these in priority order.
  return results.sort((a, b) => b.subtlety - a.subtlety)
}
