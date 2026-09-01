import { AI_TAGS } from './aiTags'
import { BLOCKED_WORDS } from './blockedWords'
import { BULK_SEED_WORDS } from './bulkSeedWords'
import { withParentCategories } from './categories'
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
    // Three tag sources, in precedence order: the hand-curated seed word's own
    // tags, the human-reviewed TAG_OVERRIDES, and machine-assigned AI_TAGS —
    // the AI ones apply only where a human hasn't already ruled on the word,
    // so re-running the tagger can never overwrite a reviewed decision.
    // Parent categories are then applied by construction ("every bird is an
    // animal") rather than being hand-written into the tag files.
    tags: withParentCategories([
      ...new Set([
        ...(seed.tags ?? []),
        ...(TAG_OVERRIDES[seed.spelling] ?? AI_TAGS[seed.spelling] ?? []),
      ]),
    ]),
    safety: { blocked: BLOCKED_WORDS.has(seed.spelling), needsReview: false },
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
