/**
 * Core matching logic for Step 3 (build-plan.md Phase 10.5 §2): given a
 * target category/property term and the word bank's spellings, decide
 * which words are *candidates* for that tag. Kept separate from
 * `scripts/tagWords.ts` (a thin CLI wrapper) so it's independently
 * unit-testable, mirroring how `generator/batch.ts` relates to
 * `scripts/generateBatch.ts`.
 *
 * Output is always a *suggestion* — see `dictionarySources.ts`'s Step 1
 * notes on why neither source is trustworthy enough to write directly into
 * the word bank without a human review pass (Step 4).
 */
import { fetchDatamuseRelations, fetchWordnetHyponymsDeep } from './dictionarySources'

export interface TagSuggestion {
  tag: string
  matchedWords: string[]
}

/**
 * Category-membership candidates for `term` (e.g. "fruit") against the
 * given seed spellings, via WordNet hyponyms — the reliable direction per
 * Step 1's findings (Datamuse's `rel_spc` blends in unrelated senses for
 * broad, polysemous category words). Uses the *deep* (multi-level) walk —
 * a single hyponym level misses almost everything for broad categories
 * like "animal" or "tool", per Step 3's first real run.
 */
export async function suggestCategoryTag(
  term: string,
  seedSpellings: string[]
): Promise<TagSuggestion> {
  const hyponyms = await fetchWordnetHyponymsDeep(term)
  const hyponymSet = new Set(hyponyms.map((h) => h.word.toLowerCase()))
  const matchedWords = seedSpellings.filter((spelling) => hyponymSet.has(spelling.toLowerCase()))
  return { tag: `category:${term.replace(/ /g, '-')}`, matchedWords }
}

/**
 * Property/association candidates for `term` (e.g. "cold") against the
 * given seed spellings, via Datamuse's `ml` (means-like) and `rel_trg`
 * (triggers) relations — both confirmed clean in Step 1's exploration.
 */
export async function suggestPropertyTag(
  term: string,
  seedSpellings: string[]
): Promise<TagSuggestion> {
  const [meansLike, triggers] = await Promise.all([
    fetchDatamuseRelations(term, 'ml'),
    fetchDatamuseRelations(term, 'rel_trg'),
  ])
  const associated = new Set([...meansLike, ...triggers].map((r) => r.word.toLowerCase()))
  const matchedWords = seedSpellings.filter((spelling) => associated.has(spelling.toLowerCase()))
  return { tag: `property:${term.replace(/ /g, '-')}`, matchedWords }
}
