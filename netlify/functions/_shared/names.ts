import { getCollections } from './db'
import type { PuzzleDoc } from './types'

/**
 * What a player or reviewer reads for each id on a puzzle: item names for a
 * visual puzzle, spellings for a word one (planning-visual-pivot.md §5.3). An
 * id with no document reads as itself, which for an item slug is still sensible.
 */
export async function resolveNames(
  puzzle: Pick<PuzzleDoc, 'kind'>,
  ids: string[]
): Promise<(id: string) => string> {
  const { words, visualItems } = await getCollections()
  const pairs: [string, string][] =
    puzzle.kind === 'visual'
      ? (await visualItems.find({ _id: { $in: ids } }).toArray()).map((d) => [d._id, d.name])
      : (await words.find({ _id: { $in: ids } }).toArray()).map((w) => [w._id, w.spelling])
  const nameOf = new Map(pairs)
  return (id) => nameOf.get(id) ?? id
}
