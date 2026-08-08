import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGame } from './useGame'
import { EvidenceScreen } from '../screens/EvidenceScreen'
import { SortingScreen } from '../screens/SortingScreen'
import { RevealScreen } from '../screens/RevealScreen'
import type { Puzzle, Label } from './types'

interface Props {
  puzzle: Puzzle
  onNextPuzzle?: () => void
}

export function GameController({ puzzle, onNextPuzzle }: Props) {
  const { state, startSorting, swipe, score, totalGuests, endedEarly } = useGame(puzzle)

  // Track which screen is "active" for AnimatePresence key
  const [animKey, setAnimKey] = useState(puzzle.id)

  // Re-key when puzzle changes so transitions fire
  if (animKey !== puzzle.id) setAnimKey(puzzle.id)

  function handleSwipe(guestId: string, direction: Label) {
    swipe(guestId, direction)
  }

  return (
    <AnimatePresence mode="wait">
      {state.phase === 'evidence' && (
        <EvidenceScreen key={`${animKey}-evidence`} puzzle={puzzle} onReady={startSorting} />
      )}
      {state.phase === 'sorting' && (
        <SortingScreen
          key={`${animKey}-sorting`}
          puzzle={puzzle}
          gameState={state}
          onSwipe={handleSwipe}
        />
      )}
      {state.phase === 'reveal' && (
        <RevealScreen
          key={`${animKey}-reveal`}
          puzzle={puzzle}
          gameState={state}
          score={score}
          totalGuests={totalGuests}
          endedEarly={endedEarly}
          onNextPuzzle={onNextPuzzle}
        />
      )}
    </AnimatePresence>
  )
}
