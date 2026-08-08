import { useState } from 'react'
import type { CardState, Puzzle } from '../game/types'

interface Props {
  puzzle: Puzzle
  cards: CardState[]
  score: number
  onClose: () => void
}

function squareFor(card: CardState) {
  if (card.result === 'correct') {
    return card.isIn
      ? { bg: 'bg-bin-in', emoji: '🟩' }
      : { bg: 'bg-bin-out', emoji: '🟧' }
  }
  if (card.result === 'wrong') return { bg: 'bg-miss', emoji: '🟥' }
  return { bg: 'bg-skip-chip', emoji: '⬜' }
}

export function ShareCardModal({ puzzle, cards, score, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const shareText = `THE BOUNCER No. ${puzzle.number} · ${score}/6\n${cards.map((c) => squareFor(c).emoji).join('')}`

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
              No. {puzzle.number} &nbsp;·&nbsp; {score}/6
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
            const mark =
              card.result === 'correct' ? (card.isIn ? '●' : '▲') : card.result === 'wrong' ? '✕' : '·'
            return (
              <div
                key={card.id}
                className={`flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-xl text-white ${sq.bg}`}
              >
                {mark}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-3.5 font-sans text-[13px] text-ink-soft">
          <Legend color="bg-bin-in" label="in, first try" />
          <Legend color="bg-bin-out" label="out, first try" />
          <Legend color="bg-miss" label="missed" />
          <Legend color="bg-skip-chip" label="not reached" />
        </div>

        <div className="h-px bg-skip-chip" />

        <div className="font-sans text-[13px] leading-relaxed text-skip-text">
          Squares only — the rule and the words never travel with the card, so nobody gets
          spoiled. Every colour is paired with a shape for colourblind readers.
        </div>

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
      <div className={`h-3.5 w-3.5 rounded ${color}`} />
      {label}
    </div>
  )
}
