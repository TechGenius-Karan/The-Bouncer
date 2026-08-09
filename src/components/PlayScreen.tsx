import { useEffect, useState } from 'react'
import { useGame } from '../game/useGame'
import { derivedEndedEarly, type RoundResult } from '../game/types'
import { recordResult } from '../game/playHistory'
import { ClueDeck } from './ClueDeck'
import { LivesDots } from './LivesDots'
import { SlipCard } from './SlipCard'
import { TrayBin } from './TrayBin'

const TILT = [-1.5, 2, -2.5, 1.2, -1, 2.4]

interface Props {
  onDone: (result: RoundResult) => void
}

export function PlayScreen({ onDone }: Props) {
  const { state, commit, select, fileSelected, score } = useGame()
  const [liveDragDx, setLiveDragDx] = useState<number | null>(null)

  useEffect(() => {
    if (state.phase === 'done' && state.ruleText) {
      recordResult({
        date: state.date,
        puzzleNumber: state.puzzleNumber,
        score,
        poolSize: state.cards.length,
        endedEarly: derivedEndedEarly(state.cards),
      })
      onDone({
        puzzleId: state.puzzleId,
        puzzleNumber: state.puzzleNumber,
        date: state.date,
        ruleText: state.ruleText,
        cards: state.cards,
        score,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  if (state.phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center font-sans text-ink-soft">
        Loading today&rsquo;s puzzle&hellip;
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="font-sans text-ink-soft">{state.error}</div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-bin bg-ink px-5 py-2.5 font-display text-sm font-bold text-screen"
        >
          Try again
        </button>
      </div>
    )
  }

  const pool = state.cards.filter((c) => c.place === 'pool')
  const inStack = state.cards.filter((c) => c.place === 'in')
  const outStack = state.cards.filter((c) => c.place === 'out')
  const hasSelection = state.selected !== null
  const draggingIn = liveDragDx !== null && liveDragDx > 64
  const draggingOut = liveDragDx !== null && liveDragDx < -64

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="font-display text-[17px] font-bold">No. {state.puzzleNumber}</div>
        <LivesDots lives={state.lives} />
      </div>

      <div className="mt-4">
        <ClueDeck clueIn={state.clues.in} clueOut={state.clues.out} />
      </div>

      <div className="flex items-baseline justify-between px-5 pb-1.5 pt-4">
        <div className="font-sans text-[11px] font-semibold tracking-wider text-ink-soft">
          TO FILE
        </div>
        <div className="font-sans text-[13px] text-ink-soft">
          {hasSelection ? 'tap a tray to file it' : `${pool.length} left · swipe ← out / in →`}
        </div>
      </div>

      <div className="flex flex-1 flex-wrap content-start gap-2.5 px-5">
        {pool.map((card, index) => (
          <SlipCard
            key={card.id}
            card={card}
            tilt={TILT[index % TILT.length]}
            selected={state.selected === card.id}
            interactive={card.result === null && !state.pendingIds.includes(card.id)}
            onSelect={() => select(card.id)}
            onCommit={(side) => commit(card.id, side)}
            onDragChange={setLiveDragDx}
          />
        ))}
      </div>

      <div className="flex gap-3 px-5 pb-8 pt-3">
        <TrayBin
          side="out"
          cards={outStack}
          active={draggingOut || hasSelection}
          onClick={() => fileSelected('out')}
        />
        <TrayBin
          side="in"
          cards={inStack}
          active={draggingIn || hasSelection}
          onClick={() => fileSelected('in')}
        />
      </div>
    </div>
  )
}
