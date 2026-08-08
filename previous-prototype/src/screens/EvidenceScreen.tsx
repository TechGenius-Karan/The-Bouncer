import { motion } from 'framer-motion'
import { ClueZone } from '../components/ClueZone'
import type { Puzzle } from '../game/types'

interface Props {
  puzzle: Puzzle
  onReady: () => void
}

export function EvidenceScreen({ puzzle, onReady }: Props) {
  const inClues = puzzle.clues.filter((c) => c.label === 'IN')
  const outClues = puzzle.clues.filter((c) => c.label === 'OUT')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6 h-full"
    >
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">Study the evidence</h2>
        <p className="text-sm text-slate-500 mt-1">
          These guests are already sorted. Figure out the rule, then sort the next batch.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ClueZone label="IN" clues={inClues} />
        <ClueZone label="OUT" clues={outClues} />
      </div>

      <div className="rounded-bin bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        <strong>Remember:</strong> you have 3 lives. A wrong swipe costs one —
        and 3 wrong swipes ends the round early.
      </div>

      <button
        onClick={onReady}
        className="mt-auto w-full py-3.5 rounded-bin font-bold text-white bg-bin-in hover:bg-teal-700 active:scale-95 transition-all duration-150 shadow-card"
      >
        I'm ready — show me the pool
      </button>
    </motion.div>
  )
}
