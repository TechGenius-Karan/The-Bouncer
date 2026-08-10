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

const OFFLINE_MESSAGE = "You're offline — reconnect to keep playing."

/** fetch() throws a bare TypeError specifically for network-level failures (no connection, DNS, CORS) — a reliable signal distinct from a real HTTP error response. */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError
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
    puzzleId: '',
    puzzleNumber: 0,
    date: '',
    ruleText: null,
    clues: { in: [], out: [] },
    cards: [],
    lives: LIVES_START,
    selected: null,
    pendingIds: [],
    offlineNotice: null,
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
          puzzleId: round.puzzleId,
          puzzleNumber: round.number,
          date: round.date,
          ruleText: round.ruleText,
          clues: round.clues,
          cards: round.pool.map(cardFromPoolItem),
          lives: round.livesRemaining,
          selected: null,
          pendingIds: [],
          offlineNotice: null,
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

  // A returning connection can arrive mid-round with a stale cached
  // get-round response still sitting in the service worker's cache (its
  // NetworkFirst strategy falls back to that cache if the network doesn't
  // answer within a few seconds) — re-fetch immediately so lives/attempted
  // state can't stay stale for a full round-trip once we're back online.
  useEffect(() => {
    const onOnline = () => {
      const current = stateRef.current
      if (!current.resultId) return
      setState((s) => ({ ...s, offlineNotice: null }))
      getRound(current.resultId)
        .then((round) => {
          setState((s) => ({
            ...s,
            phase: round.roundComplete ? 'done' : 'play',
            ruleText: round.ruleText,
            cards: round.pool.map(cardFromPoolItem),
            lives: round.livesRemaining,
          }))
        })
        .catch(() => {
          // Best-effort refresh — the player can keep going with whatever
          // state they already had, and the next swipe attempt will surface
          // any real problem on its own.
        })
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const commit = useCallback((id: string, side: Label) => {
    const current = stateRef.current
    if (current.phase !== 'play' || !current.resultId || current.pendingIds.includes(id)) return
    const card = current.cards.find((c) => c.id === id)
    if (!card || card.place !== 'pool' || card.result !== null) return

    if (!navigator.onLine) {
      setState((s) => ({ ...s, selected: null, offlineNotice: OFFLINE_MESSAGE }))
      return
    }

    setState((s) => ({ ...s, pendingIds: [...s.pendingIds, id], selected: null, offlineNotice: null }))

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
          error: isNetworkError(err) ? null : errorMessage(err),
          offlineNotice: isNetworkError(err) ? OFFLINE_MESSAGE : s.offlineNotice,
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
