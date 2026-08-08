import { useState, useCallback } from 'react'
import type { Puzzle, GameState, GamePhase, GuestResult, Label } from './types'

const MAX_LIVES = 3

function buildInitialState(): GameState {
  return {
    phase: 'evidence',
    livesRemaining: MAX_LIVES,
    results: {},
  }
}

export function useGame(puzzle: Puzzle) {
  const [state, setState] = useState<GameState>(buildInitialState)

  const startSorting = useCallback(() => {
    setState((s) => ({ ...s, phase: 'sorting' }))
  }, [])

  // Returns whether the swipe was correct
  const swipe = useCallback(
    (guestId: string, attemptedLabel: Label): boolean => {
      const guest = puzzle.guests.find((g) => g.id === guestId)
      if (!guest) return false

      const correct = guest.trueLabel === attemptedLabel

      setState((prev) => {
        if (prev.phase !== 'sorting') return prev
        // Should not be possible to swipe an already-resolved guest, but guard anyway
        if (prev.results[guestId]) return prev

        const newResult: GuestResult = {
          guestId,
          outcome: correct ? 'correct' : 'wrong-corrected',
          trueLabel: guest.trueLabel,
        }

        const newResults = { ...prev.results, [guestId]: newResult }
        const newLives = correct ? prev.livesRemaining : prev.livesRemaining - 1
        const livesOut = newLives <= 0

        const resolvedCount = Object.keys(newResults).length
        const allDone = resolvedCount === puzzle.guests.length

        let newPhase: GamePhase = 'sorting'
        let finalResults = newResults

        if (livesOut || allDone) {
          newPhase = 'reveal'
          // Mark any un-reached guests
          if (livesOut && !allDone) {
            for (const g of puzzle.guests) {
              if (!finalResults[g.id]) {
                finalResults = {
                  ...finalResults,
                  [g.id]: {
                    guestId: g.id,
                    outcome: 'not-reached',
                    trueLabel: g.trueLabel,
                  },
                }
              }
            }
          }
        }

        return {
          phase: newPhase,
          livesRemaining: Math.max(0, newLives),
          results: finalResults,
        }
      })

      return correct
    },
    [puzzle.guests]
  )

  const score = Object.values(state.results).filter((r) => r.outcome === 'correct').length
  const totalGuests = puzzle.guests.length
  const endedEarly =
    state.phase === 'reveal' && state.livesRemaining === 0 &&
    Object.values(state.results).some((r) => r.outcome === 'not-reached')

  return { state, startSorting, swipe, score, totalGuests, endedEarly }
}
