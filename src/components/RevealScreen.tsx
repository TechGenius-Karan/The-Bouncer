import { useState } from 'react'
import type { CardState, RoundResult } from '../game/types'
import { ShareCardModal } from './ShareCardModal'

interface Props {
  result: RoundResult
  onHome: () => void
}

function recapFor(card: CardState) {
  const status = card.result === 'correct' ? 'correct' : card.result === 'wrong' ? 'wrong' : 'missed'
  const isIn = card.trueLabel === 'in'
  const mark = status === 'correct' ? (isIn ? '●' : '▲') : status === 'wrong' ? '✕' : '·'
  const note =
    status === 'correct'
      ? `first try · ${isIn ? 'in' : 'out'}`
      : status === 'wrong'
        ? `missed · was ${isIn ? 'in' : 'out'}`
        : `not reached · was ${isIn ? 'in' : 'out'}`
  return { status, mark, note }
}

export function RevealScreen({ result, onHome }: Props) {
  const [sharing, setSharing] = useState(false)
  const { cards, score, puzzleNumber, ruleText } = result
  const endedEarly = cards.some((c) => c.result === 'missed')
  const verdict = endedEarly
    ? 'Out of guesses for today — here’s how it went.'
    : score === 6
      ? 'Perfect file.'
      : score >= 4
        ? 'Good read on the rule.'
        : 'Tricky one today.'

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-4 px-6 pt-7">
        <div className="font-sans text-xs font-semibold tracking-wider text-ink-soft">
          PUZZLE No. {puzzleNumber} — THE RULE WAS
        </div>
        <div className="rounded-[24px] border-[1.5px] border-ink bg-slip p-5 font-display text-[22px] font-bold leading-tight tracking-tight">
          {ruleText}
        </div>
        <div className="flex items-end gap-3">
          <div className="font-display text-5xl font-extrabold leading-none">
            {score}
            <span className="text-2xl font-normal text-ink-soft"> / 6</span>
          </div>
          <div className="pb-1.5 font-sans text-[15px] text-ink-soft">{verdict}</div>
        </div>

        <div className="flex flex-col gap-2">
          {cards.map((card) => {
            const { status, mark, note } = recapFor(card)
            const rowBg =
              status === 'wrong' ? 'bg-miss-tint border-miss-border' : status === 'missed' ? 'bg-skip-bg border-skip border-dashed' : 'bg-slip border-line'
            const markBg =
              status === 'correct' ? (card.trueLabel === 'in' ? 'bg-bin-in' : 'bg-bin-out') : status === 'wrong' ? 'bg-miss' : 'bg-skip'
            const textColor = status === 'wrong' ? 'text-miss-text' : status === 'missed' ? 'text-skip-faint' : 'text-ink'
            const noteColor = status === 'wrong' ? 'text-miss-text/80' : status === 'missed' ? 'text-skip-faint' : 'text-ink-soft'
            return (
              <div
                key={card.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${rowBg}`}
              >
                <div
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-[9px] font-sans text-sm ${markBg} ${status === 'missed' ? 'text-ink-soft' : 'text-white'}`}
                >
                  {mark}
                </div>
                <div className={`font-display text-lg font-bold tracking-wide ${textColor}`}>
                  {card.word}
                </div>
                <div className={`ml-auto font-sans text-[13px] ${noteColor}`}>{note}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-6 pb-8 pt-6">
        <button
          onClick={() => setSharing(true)}
          className="h-[56px] w-full rounded-bin bg-ink font-display text-lg font-bold text-screen shadow-pressed"
        >
          Share result
        </button>
        <div className="flex justify-center">
          <button onClick={onHome} className="font-sans text-sm text-ink-soft underline decoration-line underline-offset-2">
            Back to home
          </button>
        </div>
      </div>

      {sharing && (
        <ShareCardModal puzzleNumber={puzzleNumber} cards={cards} score={score} onClose={() => setSharing(false)} />
      )}
    </div>
  )
}
