import { BULK_SEED_WORDS } from './bulkSeedWords'
import { withParentCategories } from './categoryHierarchy'
import { buildLetterFeatures } from './features'
import { SEED_WORDS } from './seedWords'
import { TAG_OVERRIDES } from './tagOverrides'
import type { Word } from './types'

// SEED_WORDS is hand-curated (its words carry human-reviewed category tags,
// Phase 10.5 §2); BULK_SEED_WORDS is corpus-sourced (Phase 10.6, no tags of
// its own). Concatenated, not merged — expandWordBank.ts already dedupes
// bulk words against SEED_WORDS's spellings, so no id collisions. Reviewed
// tags for bulk (and any extra tags for seed) words live in the separate
// TAG_OVERRIDES overlay, unioned in here — kept separate so re-running the
// bulk-generation script can never clobber reviewed data.
export function buildWordBank(): Word[] {
  const words = [...SEED_WORDS, ...BULK_SEED_WORDS].map((seed) => ({
    id: seed.spelling,
    spelling: seed.spelling,
    length: seed.spelling.length,
    features: buildLetterFeatures(seed.spelling),
    frequencyScore: seed.frequencyScore,
    partOfSpeech: seed.partOfSpeech,
    properNoun: seed.properNoun ?? false,
    // Parent categories are applied here rather than being hand-written into
    // the tag files, so "every bird is an animal" holds by construction and
    // survives re-tagging — see categoryHierarchy.ts.
    tags: withParentCategories([
      ...new Set([...(seed.tags ?? []), ...(TAG_OVERRIDES[seed.spelling] ?? [])]),
    ]),
    safety: { blocked: false, needsReview: false },
  }))

  // Anagram partners can only be found bank-wide, not from a single spelling
  // (unlike the rest of `features`), so it's tagged here as a post-process
  // pass rather than living in buildLetterFeatures.
  const bySignature = new Map<string, number>()
  for (const w of words) {
    bySignature.set(w.features.anagramSignature, (bySignature.get(w.features.anagramSignature) ?? 0) + 1)
  }
  for (const w of words) {
    if ((bySignature.get(w.features.anagramSignature) ?? 0) > 1) w.tags.push('lexical:has-anagram')
  }

  return words
}
