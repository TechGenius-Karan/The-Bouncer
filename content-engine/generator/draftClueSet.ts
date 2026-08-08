import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { shuffle } from './random'
import type { ClueEntry, KnobValues } from './types'

// Clues are the evidence a player anchors on hardest — hold them to a
// higher commonness bar than trap guests (planning.md §7.5).
const CLUE_FREQUENCY_FLOOR = 0.6

function pickClueWords(pool: Word[], count: number): Word[] {
  const preferred = pool.filter((w) => w.frequencyScore >= CLUE_FREQUENCY_FLOOR)
  const source = preferred.length >= count ? preferred : pool
  return shuffle(source).slice(0, count)
}

/**
 * Step 1 of planning.md §7.6: pick IN/OUT example words for a rule, with no
 * decoy-awareness yet. Randomized within a commonness floor so repeated
 * calls for the same rule produce varied clue sets across a batch.
 */
export function draftClueSet(
  rule: Rule,
  wordBank: Word[],
  knobs: KnobValues,
  excludeIds: Set<string> = new Set(),
): ClueEntry[] {
  const inCandidates = wordBank.filter((w) => !excludeIds.has(w.id) && !w.safety.blocked && rule.evaluate(w))
  const outCandidates = wordBank.filter((w) => !excludeIds.has(w.id) && !w.safety.blocked && !rule.evaluate(w))

  if (inCandidates.length < knobs.clueCountIn || outCandidates.length < knobs.clueCountOut) {
    throw new Error(`Not enough words in the bank to draft a clue set for rule "${rule.id}"`)
  }

  const inWords = pickClueWords(inCandidates, knobs.clueCountIn)
  const outWords = pickClueWords(outCandidates, knobs.clueCountOut)

  let order = 0
  const clues: ClueEntry[] = []
  for (const word of inWords) clues.push({ wordId: word.id, label: 'IN', displayOrder: order++ })
  for (const word of outWords) clues.push({ wordId: word.id, label: 'OUT', displayOrder: order++ })
  return clues
}
