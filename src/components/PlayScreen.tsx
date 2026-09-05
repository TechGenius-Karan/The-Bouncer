import { useEffect, useState } from 'react'
import { BarChart } from 'react-bootstrap-icons'
import { useGame } from '../game/useGame'
import { derivedEndedEarly, type RoundResult } from '../game/types'
import { recordResult } from '../game/playHistory'
import { ClueDeck } from './ClueDeck'
import { SharpGear } from './HomeScreen'
import { LivesDots } from './LivesDots'
import { LoadingDoor } from './LoadingDoor'
import { SlipCard } from './SlipCard'
import { TrayBin } from './TrayBin'

const TILT = [-1.5, 2, -2.5, 1.2, -1, 2.4]

interface Props {
  onDone: (result: RoundResult) => void
  onHowToPlay: () => void
  onShowStats: () => void
  onShowSettings: () => void
}

export function PlayScreen({ onDone, onHowToPlay, onShowStats, onShowSettings }: Props) {
  const { state, commit, select, fileSelected, score } = useGame()
  const [liveDragDx, setLiveDragDx] = useState<number | null>(null)
  const [showLoader, setShowLoader] = useState(true)

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

  if (showLoader) {
    return <LoadingDoor ready={state.phase !== 'loading'} onDone={() => setShowLoader(false)} />
  }

  const pool = state.cards.filter((c) => c.place === 'pool')
  const inStack = state.cards.filter((c) => c.place === 'in')
  const outStack = state.cards.filter((c) => c.place === 'out')
  const hasSelection = state.selected !== null
  const draggingIn = liveDragDx !== null && liveDragDx > 64
  const draggingOut = liveDragDx !== null && liveDragDx < -64

  return (
    // `h-screen sm:h-[820px]` (not h-full) deliberately mirrors the shell's
    // own `min-h-screen sm:min-h-[820px]` in App.tsx, rather than inheriting
    // from it: a percentage height (h-full) can't resolve reliably against
    // an ancestor sized by min-height (a well-known CSS gotcha — min-height
    // doesn't count as a "definite size" for percentage children), so it
    // silently fell back to shrinking/growing with this screen's own
    // content instead of actually filling the shell. That broke the whole
    // point of the queue box and trays below being fixed regardless of how
    // many pool cards remain.
    <div className="relative flex h-screen flex-col sm:h-[820px]">
      <div className="flex items-center justify-between px-5 pt-3">
        <button
          onClick={onHowToPlay}
          aria-label="How to play"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-skip-bg text-ink"
        >
          {/* Hand-built instead of react-bootstrap-icons' QuestionCircle —
              that icon's ring is a fixed-thickness vector path with no way
              to adjust its stroke weight, same reason SharpGear (below,
              HomeScreen.tsx) is hand-built rather than using a library gear. */}
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-[2.5px] border-current text-base font-bold leading-none">
            ?
          </span>
        </button>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onShowStats}
            aria-label="Your stats"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-skip-bg text-ink"
          >
            <BarChart size={24} />
          </button>
          <button
            onClick={onShowSettings}
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-skip-bg text-ink"
          >
            <SharpGear size={28} />
          </button>
        </div>
      </div>

      {/* Separates the icon row from the puzzle number/lives row below it —
          w-4/5 mx-auto instead of a full-bleed border-b so it doesn't run
          to the physical screen edges. */}
      <div className="mx-auto mt-3 w-4/5 border-b border-line" />

      <div className="flex items-center justify-between px-5 pt-2">
        <div className="font-display text-[17px] font-bold">No. {state.puzzleNumber}</div>
        <LivesDots lives={state.lives} />
      </div>

      <div className="mt-4">
        <ClueDeck clueIn={state.clues.in} clueOut={state.clues.out} />
      </div>

      {state.offlineNotice && (
        <div className="mx-5 mt-3 rounded-card border border-skip bg-skip-bg px-3 py-2 text-center font-sans text-[13px] text-skip-faint">
          {state.offlineNotice}
        </div>
      )}

      <div className="flex items-baseline justify-between px-5 pb-1.5 pt-4">
        <div className="font-sans text-[11px] font-semibold tracking-wider text-ink-soft">
          IN THE QUEUE
        </div>
        <div className="font-sans text-[13px] text-ink-soft">
          {hasSelection ? 'tap a tray to make the call' : `${pool.length} left · swipe ← out / in →`}
        </div>
      </div>

      {/* `pb-44` reserves exactly the space the absolutely-positioned tray
          block below takes up, so this box's own `h-full` fills the rest —
          fixed for the whole round, from 6 cards down to 1, never reflowing
          as the pool empties, and never fighting the trays for space. No
          horizontal padding/margin here either: it spans the exact same
          width as the app shell in App.tsx, so the edge accents inside can
          sit at literal left-0/right-0 and land on the physical screen edge,
          not just the card grid's own px-5. `mt-6` shifts just the card
          queue itself down, independent of the header/clue-deck above. */}
      <div className="relative mt-6 flex-1 pb-44">
        {/* No h-full here on purpose: this wrapper is left to size itself to
            its one in-flow child (the card grid) — SwipeHint below is
            absolutely positioned so it doesn't add to that height, and it
            extends its own top/bottom edges past this wrapper's bounds
            (see its -top/-bottom offsets) rather than stretching down
            through the empty space above the trays. */}
        <div className="relative">
          <div className="flex flex-wrap content-start gap-2.5 px-8">
            {pool.map((card, index) => (
              <div key={card.id} className="flex-[0_0_calc(50%-5px)] motion-safe:animate-slipIn">
                <SlipCard
                  card={card}
                  tilt={TILT[index % TILT.length]}
                  selected={state.selected === card.id}
                  interactive={card.result === null && !state.pendingIds.includes(card.id)}
                  onSelect={() => select(card.id)}
                  onCommit={(side) => commit(card.id, side)}
                  onDragChange={setLiveDragDx}
                />
              </div>
            ))}
          </div>
          {pool.length > 0 && (
            <>
              <SwipeHint side="out" />
              <SwipeHint side="in" />
            </>
          )}
        </div>
      </div>

      {/* Absolute and pinned to the very bottom of the screen, independent
          of the queue box above — the trays never move as the round plays
          out, regardless of how flex-1 above happens to resolve. */}
      <div className="absolute inset-x-0 bottom-0 flex gap-3 px-5 pb-8 pt-3">
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

function SwipeHint({ side }: { side: 'out' | 'in' }) {
  const isIn = side === 'in'
  return (
    <>
      {/* Purely decorative at this point — the IN/OUT tag below already
          carries the actual direction cue, so this is a quiet, static wash
          rather than something fighting for attention: no animation, low
          opacity throughout. rounded-md (down from rounded-xl, then
          rounded-3xl before that) keeps the corners just barely softened
          instead of reading as rounded at all. -bottom-8 is the main
          "past the last row" extension; -top-2 is a much smaller nudge on
          the top edge. Opacity uses bracketed /[18%], not bare /18 — bare
          numeric opacity modifiers only work for values in Tailwind's
          default opacity scale (0,5,10,20,25,30,40,50,60,70,75,80,90,95,100),
          so /18 (and the earlier /15) silently compiled to no CSS at all. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-2 -bottom-8 w-6 rounded-md ${
          isIn
            ? 'right-0 bg-gradient-to-l from-[#14b8a6]/[18%] to-transparent'
            : 'left-0 bg-gradient-to-r from-[#f59e0b]/[18%] to-transparent'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5 ${
          isIn ? 'right-1.5 text-bin-in-text' : 'left-1.5 text-bin-out-label'
        }`}
      >
        <span className="text-sm leading-none">{isIn ? '▶' : '◀'}</span>
        <span className="font-display text-[9px] font-extrabold tracking-wider">
          {isIn ? 'IN' : 'OUT'}
        </span>
      </div>
    </>
  )
}
