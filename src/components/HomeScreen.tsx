import type { ReactNode } from 'react'
import type { Puzzle } from '../game/types'

interface Props {
  puzzle: Puzzle
  onPlay: () => void
  onHowToPlay: () => void
}

export function HomeScreen({ puzzle, onPlay, onHowToPlay }: Props) {
  return (
    <div className="flex h-full flex-col justify-between px-7 pb-10 pt-11">
      <div className="flex flex-col items-start gap-2.5">
        <div className="font-display text-[15px] font-extrabold tracking-[0.22em] text-ink-soft">
          THE BOUNCER
        </div>
        <div className="font-display text-[52px] font-extrabold leading-[0.94] tracking-tight sm:text-[62px]">
          Six words.
          <br />
          One rule.
        </div>
        <div className="max-w-[280px] text-base leading-relaxed text-ink-soft">
          Some belong in. Some don&rsquo;t. Figure out why.
        </div>
      </div>

      <div className="relative flex h-[210px] items-center justify-center sm:h-[230px]">
        <Slip className="-translate-y-11 rotate-[-8deg]">CHINA</Slip>
        <Slip className="translate-y-5 rotate-[4deg]">WALNUT</Slip>
        <Slip className="translate-y-[84px] rotate-[-2deg]">BEARDS</Slip>
        <div className="absolute left-1.5 top-1.5 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-bin-in text-base text-white">
          ●
        </div>
        <div className="absolute bottom-2.5 right-1.5 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-bin-out text-sm text-white">
          ▲
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2.5">
          <div className="font-display text-lg font-bold">No. {puzzle.number}</div>
          <div className="text-[15px] text-ink-soft">{puzzle.dateLabel}</div>
        </div>
        <button
          onClick={onPlay}
          className="h-16 w-full rounded-bin bg-ink font-display text-xl font-bold text-screen shadow-pressed transition-colors hover:bg-[#332C23]"
        >
          Play today&rsquo;s puzzle
        </button>
        <div className="flex justify-center">
          <button
            onClick={onHowToPlay}
            className="border-b-[1.5px] border-line pb-0.5 text-[15px] font-semibold text-ink-soft"
          >
            How to play
          </button>
        </div>
      </div>
    </div>
  )
}

function Slip({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div
      className={`absolute flex h-16 w-[196px] items-center justify-center rounded-2xl border border-line bg-slip font-display text-2xl font-bold tracking-wide shadow-card ${className}`}
    >
      {children}
    </div>
  )
}
