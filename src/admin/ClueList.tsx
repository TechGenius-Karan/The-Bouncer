import { ItemFace } from '../components/ItemFace'
import type { AdminPuzzleDetail } from './types'

/** One side's clues on a review card: comma-separated words, or icons with captions for a visual puzzle. */
export function ClueList({ puzzle, label }: { puzzle: AdminPuzzleDetail; label: 'IN' | 'OUT' }) {
  const clues = puzzle.clues.filter((c) => c.label === label)
  if (puzzle.kind !== 'visual') return <div>{clues.map((c) => c.word).join(', ')}</div>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {clues.map((c) => (
        <ItemFace key={c.wordId} id={c.wordId} name={c.word} visual size={18} />
      ))}
    </div>
  )
}
