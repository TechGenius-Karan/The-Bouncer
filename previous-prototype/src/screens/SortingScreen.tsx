import { motion } from 'framer-motion'
import { ClueZone } from '../components/ClueZone'
import { GuestCard } from '../components/GuestCard'
import { LivesIndicator } from '../components/LivesIndicator'
import type { Puzzle, GameState, Label } from '../game/types'

interface Props {
  puzzle: Puzzle
  gameState: GameState
  onSwipe: (guestId: string, direction: Label) => void
}

export function SortingScreen({ puzzle, gameState, onSwipe }: Props) {
  const inClues = puzzle.clues.filter((c) => c.label === 'IN')
  const outClues = puzzle.clues.filter((c) => c.label === 'OUT')

  const resolvedCount = Object.keys(gameState.results).length
  const totalGuests = puzzle.guests.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4 h-full"
    >
      {/* Evidence — pinned at top, compact */}
      <div className="grid grid-cols-2 gap-2">
        <ClueZone label="IN" clues={inClues} compact />
        <ClueZone label="OUT" clues={outClues} compact />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <LivesIndicator lives={gameState.livesRemaining} />
        <span className="text-sm text-slate-400 font-medium">
          {resolvedCount}/{totalGuests} sorted
        </span>
      </div>

      {/* Guest pool — all visible at once */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">
          Sort each guest — swipe or tap
        </p>
        <div className="grid grid-cols-2 gap-3">
          {puzzle.guests.map((guest) => {
            const result = gameState.results[guest.id]
            return (
              <GuestCard
                key={guest.id}
                word={guest.word}
                resolved={result ? { outcome: result.outcome, trueLabel: result.trueLabel } : false}
                onSwipe={(direction) => onSwipe(guest.id, direction)}
              />
            )
          })}
        </div>
      </div>

      {/* Swipe hint */}
      <p className="text-center text-xs text-slate-300 mt-auto">
        Drag left for OUT &nbsp;·&nbsp; drag right for IN
      </p>
    </motion.div>
  )
}
