/**
 * Parent categories implied by a tag. Applied in wordBank.ts after the
 * seed/override tag merge, so a word tagged `category:bird` automatically
 * carries `category:animal` too.
 *
 * Why this exists: the category tags were reviewed one category at a time,
 * independently, so `category:bird` ended up NOT being a subset of
 * `category:animal` — of 22 birds only `parrot` was also tagged animal. That
 * makes "Is an Animal" puzzles actively wrong: a player shown an eagle and
 * told it's OUT of "names an animal" has been misinformed, not misdirected.
 *
 * Keep this as data rather than hand-editing tagOverrides.ts so the invariant
 * is enforced once and survives re-tagging.
 */
export const CATEGORY_PARENTS: Record<string, string[]> = {
  'category:bird': ['category:animal'],
}

/** Expands a tag list to include every implied parent category, transitively. */
export function withParentCategories(tags: string[]): string[] {
  const out = new Set(tags)
  const queue = [...tags]
  while (queue.length > 0) {
    for (const parent of CATEGORY_PARENTS[queue.pop()!] ?? []) {
      if (!out.has(parent)) {
        out.add(parent)
        queue.push(parent)
      }
    }
  }
  return [...out]
}
