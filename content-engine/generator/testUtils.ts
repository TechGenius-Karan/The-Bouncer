import { buildLetterFeatures } from '../words/features.js'
import { PHONETICS } from '../words/phonetics.js'
import type { PartOfSpeech, Word } from '../words/types.js'

/** Builds a one-off Word for tests that need to hand-engineer specific feature combinations. */
export function makeWord(
  spelling: string,
  frequencyScore = 0.9,
  partOfSpeech: PartOfSpeech = 'other'
): Word {
  return {
    id: spelling,
    spelling,
    length: spelling.length,
    features: buildLetterFeatures(spelling),
    phonetics: PHONETICS[spelling] ?? null,
    frequencyScore,
    partOfSpeech,
    properNoun: false,
    tags: [],
    safety: { blocked: false, needsReview: false },
  }
}
