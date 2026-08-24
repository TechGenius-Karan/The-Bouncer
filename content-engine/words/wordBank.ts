import { buildLetterFeatures } from './features'
import { SEED_WORDS } from './seedWords'
import type { Word } from './types'

export function buildWordBank(): Word[] {
  return SEED_WORDS.map((seed) => ({
    id: seed.spelling,
    spelling: seed.spelling,
    length: seed.spelling.length,
    features: buildLetterFeatures(seed.spelling),
    frequencyScore: seed.frequencyScore,
    partOfSpeech: seed.partOfSpeech,
    tags: seed.tags ?? [],
    safety: { blocked: false, needsReview: false },
  }))
}
