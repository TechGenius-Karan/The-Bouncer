import { useCallback, useEffect, useRef, useState } from 'react'
import { checkSwipe, getRound } from '../api/client'
import type { ApiLabel, PoolItem } from '../api/types'
import { loadResultId, saveResultId } from './resultStorage'
import type { CardResult, CardState, GameState, Label } from './types'

const LIVES_START = 3
const SETTLE_DELAY_CORRECT = 420
const SETTLE_DELAY_WRONG = 900

function toApiLabel(label: Label): ApiLabel {
  return label === 'in' ? 'IN' : 'OUT'
}

function toLabel(label: ApiLabel): Label {
  return label === 'IN' ? 'in' : 'out'
}

function opposite(label: ApiLabel): ApiLabel {
  return label === 'IN' ? 'OUT' : 'IN'
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

/** Reconstructs a card's state from the server's pool item — handles a fresh
 * guest, one already resolved (round resumed mid-play), and one revealed as
 * "not reached" once the round is over. */
function cardFromPoolItem(item: PoolItem): CardState {
  if (item.attempted) {
    const trueApiLabel = item.trueLabel ?? (item.attempted.correct ? item.attempted.label : opposite(item.attempted.label))
    const trueLabel = toLabel(trueApiLabel)
    return {
      id: item.wordId,
      word: item.word,
      place: trueLabel,
      result: item.attempted.correct ? 'correct' : 'wrong',
      trueLabel,
    }
  }
  if (item.trueLabel) {
    const trueLabel = toLabel(item.trueLabel)
    return { id: item.wordId, word: item.word, place: trueLabel, result: 'missed', trueLabel }
  }
  return { id: item.wordId, word: item.word, place: 'pool', result: null, trueLabel: null }
}

function initialState(): GameState {
  return {
    phase: 'loading',
    error: null,
    resultId: null,
    puzzleNumber: 0,
    ruleText: null,
    clues: { in: [], out: [] },
    cards: [],
    lives: LIVES_START,
    selected: null,
    pendingIds: [],
  }
}

/**
 * Encodes planning.md §3.2-3.4, now server-authoritative (Phase 4): the
 * server decides correct/wrong and tracks lives — this hook just fetches
 * the round, sends one swipe at a time, and renders whatever comes back.
 */
export function useGame() {
  const [state, setState] = useState<GameState>(initialState)
  const stateRef = useRef(state)
  stateRef.current = state
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    let cancelled = false

    getRound(loadResultId())
      .then((round) => {
        if (cancelled) return
        saveResultId(round.resultId)
        setState({
          phase: round.roundComplete ? 'done' : 'play',
          error: null,
          resultId: round.resultId,
          puzzleNumber: round.number,
          ruleText: round.ruleText,
          clues: round.clues,
          cards: round.pool.map(cardFromPoolItem),
          lives: round.livesRemaining,
          selected: null,
          pendingIds: [],
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState((s) => ({ ...s, phase: 'error', error: errorMessage(err) }))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const commit = useCallback((id: string, side: Label) => {
    const current = stateRef.current
    if (current.phase !== 'play' || !current.resultId || current.pendingIds.includes(id)) return
    const card = current.cards.find((c) => c.id === id)
    if (!card || card.place !== 'pool' || card.result !== null) return

    setState((s) => ({ ...s, pendingIds: [...s.pendingIds, id], selected: null }))

    checkSwipe(current.resultId, id, toApiLabel(side))
      .then((response) => {
        const trueLabel = toLabel(response.trueLabel)
        const result: CardResult = response.correct ? 'correct' : 'wrong'

        setState((s) => ({
          ...s,
          lives: response.livesRemaining,
          cards: s.cards.map((c) => (c.id === id ? { ...c, result, trueLabel } : c)),
        }))

        const timer = setTimeout(
          () => {
            setState((s) => {
              let cards = s.cards.map((c) => (c.id === id ? { ...c, place: trueLabel } : c))

              if (response.roundComplete && response.poolReveal) {
                const revealByWordId = new Map(response.poolReveal.map((item) => [item.wordId, item]))
                cards = cards.map((c) => {
                  if (c.result !== null) return c // already resolved — this swipe or an earlier one
                  const item = revealByWordId.get(c.id)
                  if (!item?.trueLabel) return c
                  const missedLabel = toLabel(item.trueLabel)
                  return { ...c, result: 'missed', trueLabel: missedLabel, place: missedLabel }
                })
              }

              return {
                ...s,
                cards,
                pendingIds: s.pendingIds.filter((pendingId) => pendingId !== id),
                phase: response.roundComplete ? 'done' : 'play',
                ruleText: response.roundComplete ? response.ruleText : s.ruleText,
              }
            })
          },
          response.correct ? SETTLE_DELAY_CORRECT : SETTLE_DELAY_WRONG,
        )
        timers.current.push(timer)
      })
      .catch((err: unknown) => {
        setState((s) => ({
          ...s,
          pendingIds: s.pendingIds.filter((pendingId) => pendingId !== id),
          error: errorMessage(err),
        }))
      })
  }, [])

  const select = useCallback((id: string) => {
    setState((s) => ({ ...s, selected: s.selected === id ? null : id }))
  }, [])

  const fileSelected = useCallback(
    (side: Label) => {
      if (state.selected !== null) commit(state.selected, side)
    },
    [state.selected, commit],
  )

  const score = state.cards.filter((c) => c.result === 'correct').length

  return { state, commit, select, fileSelected, score }
}
