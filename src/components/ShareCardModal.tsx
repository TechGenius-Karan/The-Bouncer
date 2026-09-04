import { useState } from 'react'
import type { CardState } from '../game/types'

interface Props {
  puzzleNumber: number
  cards: CardState[]
  score: number
  onClose: () => void
}

function squareFor(card: CardState) {
  if (card.result === 'correct') {
    return card.trueLabel === 'in'
      ? { bg: 'bg-bin-in', text: 'text-white', emoji: '🟩' }
      : { bg: 'bg-bin-out', text: 'text-white', emoji: '🟩' }
  }
  return { bg: 'bg-miss', text: 'text-white', emoji: '🟥' }
}

export function ShareCardModal({ puzzleNumber, cards, score, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const shareText = `THE BOUNCER No. ${puzzleNumber} - ${score}/6\n${cards.map((c) => squareFor(c).emoji).join('')}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard API unavailable — nothing more to do in this prototype.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[390px] flex-col gap-5 rounded-screen border border-line bg-slip p-7"
      >
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="font-display text-[15px] font-extrabold tracking-[0.2em] text-ink-soft">
              THE BOUNCER
            </div>
            <div className="font-display text-3xl font-extrabold tracking-tight">
              No. {puzzleNumber}
              <span className="ml-2 mr-3 align-middle text-4xl text-ink-soft">-</span>
              <span className="tracking-wide text-ink-soft">{score}/6</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-skip-bg text-ink-soft"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2.5">
          {cards.map((card) => {
            const sq = squareFor(card)
            const mark = card.result === 'correct' ? (card.trueLabel === 'in' ? '●' : '▲') : '✕'
            return (
              <div
                key={card.id}
                className={`flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-xl ${sq.bg} ${sq.text}`}
              >
                {mark}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-4 font-sans text-base font-medium text-ink-soft">
          <Legend color="bg-bin-in" label="In" />
          <Legend color="bg-bin-out" label="Out" />
          <Legend color="bg-miss" label="Missed" />
        </div>

        <div className="h-px bg-skip-chip" />

        <button
          onClick={copy}
          className="h-[52px] w-full rounded-bin bg-ink font-display text-base font-bold text-screen shadow-pressed"
        >
          {copied ? 'Copied!' : 'Copy result'}
        </button>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-4 w-4 rounded ${color}`} />
      {label}
    </div>
  )
}
