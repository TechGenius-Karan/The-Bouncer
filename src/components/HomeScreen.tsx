import { useEffect, useState } from 'react'
import { getPuzzleMeta } from '../api/client'
import { DoorIn, DoorOut } from './DoorIllustration'

interface Props {
  onPlay: () => void
  onHowToPlay: () => void
  onShowStats: () => void
}

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export function HomeScreen({ onPlay, onHowToPlay, onShowStats }: Props) {
  const [puzzleNumber, setPuzzleNumber] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getPuzzleMeta()
      .then((meta) => {
        if (!cancelled) setPuzzleNumber(meta.number)
      })
      .catch(() => {
        // Home must never block on this — the date alone is enough to render.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-9 px-7 pb-10 pt-[34px]">
      <div className="flex flex-col items-start gap-3">
        <div className="mb-0.5 flex w-full items-center gap-2">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-bin-in text-[10px] text-white">
            ●
          </div>
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-bin-out text-[9px] text-white">
            ▲
          </div>
          <div className="h-[2px] flex-1 rounded-[1px] bg-line" />
        </div>
        <div className="font-display text-[68px] font-extrabold leading-[0.84] tracking-[-0.05em] max-[380px]:text-[54px]">
          The
          <br />
          Bouncer
        </div>
        <div className="mt-0.5 font-display text-[29px] font-bold leading-none tracking-[-0.02em] text-bin-in">
          6 words. 1 rule.
        </div>
        <div className="max-w-[296px] text-pretty text-[15px] leading-[1.4] text-ink-soft">
          Some belong in. Some don&rsquo;t. Figure out why &mdash; three bad calls end your shift.
        </div>
      </div>

      <div className="flex items-end justify-center gap-3">
        <div className="flex flex-1 flex-col items-center gap-[9px]">
          <DoorIn word="TOENAIL" />
          <div className="font-display text-[14px] font-extrabold tracking-[0.12em] text-bin-in-text">
            WALKS IN
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-[9px]">
          <DoorOut word="WALNUT" />
          <div className="font-display text-[14px] font-extrabold tracking-[0.12em] text-[#B9701C]">
            TURNED AWAY
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-baseline gap-[10px]">
          <div className="font-display text-[19px] font-bold">No. {puzzleNumber ?? '—'}</div>
          <div className="text-[15px] text-ink-soft">{todayLabel}</div>
        </div>
        <button
          onClick={onPlay}
          className="h-16 w-full rounded-bin bg-ink font-display text-xl font-bold text-screen shadow-pressed transition-colors hover:bg-[#332C23]"
        >
          Play today&rsquo;s puzzle
        </button>
        <div className="flex justify-center gap-5">
          <button
            onClick={onHowToPlay}
            className="border-b-[1.5px] border-skip pb-0.5 text-[15px] font-semibold text-ink-soft"
          >
            How to play
          </button>
          <button
            onClick={onShowStats}
            className="border-b-[1.5px] border-skip pb-0.5 text-[15px] font-semibold text-ink-soft"
          >
            Your stats
          </button>
        </div>
      </div>
    </div>
  )
}
