import { buildLetterFeatures } from '../words/features'
import type { PartOfSpeech, Word } from '../words/types'

/** Builds a one-off Word for tests that need to hand-engineer specific feature combinations. */
export function makeWord(spelling: string, frequencyScore = 0.9, partOfSpeech: PartOfSpeech = 'other'): Word {
  return {
    id: spelling,
    spelling,
    length: spelling.length,
    features: buildLetterFeatures(spelling),
    frequencyScore,
    partOfSpeech,
    tags: [],
    safety: { blocked: false, needsReview: false },
  }
}
