import { useCallback, useEffect, useRef, useState } from 'react'
import type { CardState, GameState, Label, Puzzle } from './types'

const LIVES_START = 3
const SETTLE_DELAY_CORRECT = 420
const SETTLE_DELAY_WRONG = 900

function initialState(puzzle: Puzzle): GameState {
  return {
    cards: puzzle.pool.map((c, i) => ({
      id: i,
      word: c.word,
      isIn: c.isIn,
      place: 'pool',
      result: null,
    })),
    lives: LIVES_START,
    selected: null,
    phase: 'play',
  }
}

/**
 * Encodes planning.md §3.2-3.4 exactly: one swipe attempt per guest,
 * immediate correct/wrong feedback, wrong swipes auto-correct into the
 * true bin and cost a life, and the round ends the instant every guest
 * is resolved OR the 3rd wrong swipe lands — whichever comes first.
 * There is no manual submit.
 */
export function useGame(puzzle: Puzzle) {
  const [state, setState] = useState<GameState>(() => initialState(puzzle))
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    setState(initialState(puzzle))
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [puzzle])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  const commit = useCallback((id: number, side: Label) => {
    setState((s) => {
      if (s.phase !== 'play') return s
      const card = s.cards.find((c) => c.id === id)
      if (!card || card.place !== 'pool') return s

      const correct = (side === 'in') === card.isIn
      const nextCards = s.cards.map((c): CardState =>
        c.id === id ? { ...c, result: correct ? 'correct' : 'wrong' } : c,
      )
      const lives = correct ? s.lives : s.lives - 1

      const timer = setTimeout(
        () => settle(id),
        correct ? SETTLE_DELAY_CORRECT : SETTLE_DELAY_WRONG,
      )
      timers.current.push(timer)

      return { ...s, cards: nextCards, lives, selected: null }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const settle = useCallback((id: number) => {
    setState((s) => {
      const card = s.cards.find((c) => c.id === id)
      if (!card) return s
      const trueSide = card.isIn ? 'in' : 'out'
      let nextCards = s.cards.map((c): CardState =>
        c.id === id ? { ...c, place: trueSide } : c,
      )

      const remaining = nextCards.filter((c) => c.place === 'pool')
      const outOfLives = s.lives <= 0
      const finished = outOfLives || remaining.length === 0

      if (outOfLives) {
        nextCards = nextCards.map((c): CardState =>
          c.place === 'pool' ? { ...c, result: 'missed' } : c,
        )
      }

      return { ...s, cards: nextCards, phase: finished ? 'done' : 'play' }
    })
  }, [])

  const select = useCallback((id: number) => {
    setState((s) => ({ ...s, selected: s.selected === id ? null : id }))
  }, [])

  const fileSelected = useCallback(
    (side: Label) => {
      if (state.selected !== null) commit(state.selected, side)
    },
    [state.selected, commit],
  )

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setState(initialState(puzzle))
  }, [puzzle])

  const score = state.cards.filter((c) => c.result === 'correct').length

  return { state, commit, select, fileSelected, reset, score }
}
