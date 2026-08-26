import { useEffect, useState } from 'react'
import { BarChart } from 'react-bootstrap-icons'
import { getPuzzleMeta } from '../api/client'
import { DoorIn, DoorOut } from './DoorIllustration'

interface Props {
  onPlay: () => void
  onHowToPlay: () => void
  onShowStats: () => void
  onShowSettings: () => void
}

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export function HomeScreen({ onPlay, onHowToPlay, onShowStats, onShowSettings }: Props) {
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
        <div className="mb-0.5 flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-bin-in text-[10px] text-white">
              ●
            </div>
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-bin-out text-[9px] text-white">
              ▲
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onShowStats}
              aria-label="Your stats"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-skip-bg text-ink"
            >
              <BarChart size={28} />
            </button>
            <button
              onClick={onShowSettings}
              aria-label="Settings"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-skip-bg text-ink"
            >
              <SharpGear size={32} />
            </button>
          </div>
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
          <div className="font-display text-[14px] font-extrabold tracking-[0.12em] text-door-warn">
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
          className="h-16 w-full rounded-bin bg-ink font-display text-xl font-bold text-screen shadow-pressed transition-opacity hover:opacity-90"
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
          {/* "Your stats" moved to the header avatar chip — kept here commented
              out in case we want a second entry point back.
          <button
            onClick={onShowStats}
            className="border-b-[1.5px] border-skip pb-0.5 text-[15px] font-semibold text-ink-soft"
          >
            Your stats
          </button>
          */}
        </div>
      </div>
    </div>
  )
}

// Bootstrap Icons' whole gear family shares one rounded-fillet house style —
// there's no "sharp teeth" variant to swap to. Built by hand instead: a
// straight-edged polygon (no arcs on the teeth, unlike bi-gear/-fill/-wide*)
// so the spikes read as a mechanical gear rather than a sun/flower.
const GEAR_TEETH = 6
const GEAR_OUTER_R = 10
const GEAR_INNER_R = 7
const GEAR_HOLE_R = 3
const GEAR_CENTER = 12
const GEAR_SLOT = 360 / GEAR_TEETH
// Shifts the whole gear so a tooth centers on 180° (straight down) instead
// of sitting in the default gap there.
const GEAR_ROTATION = 30

function polarPoint(radius: number, degrees: number): string {
  const rad = ((degrees - 90) * Math.PI) / 180
  const x = GEAR_CENTER + radius * Math.cos(rad)
  const y = GEAR_CENTER + radius * Math.sin(rad)
  return `${x.toFixed(2)},${y.toFixed(2)}`
}

const SHARP_GEAR_PATH = (() => {
  const teeth: string[] = []
  for (let i = 0; i < GEAR_TEETH; i++) {
    const start = i * GEAR_SLOT + GEAR_ROTATION
    teeth.push(polarPoint(GEAR_INNER_R, start + GEAR_SLOT * 0.12))
    teeth.push(polarPoint(GEAR_OUTER_R, start + GEAR_SLOT * 0.28))
    teeth.push(polarPoint(GEAR_OUTER_R, start + GEAR_SLOT * 0.72))
    teeth.push(polarPoint(GEAR_INNER_R, start + GEAR_SLOT * 0.88))
  }
  const outline = `M${teeth.join('L')}Z`
  const hole = `M${GEAR_CENTER + GEAR_HOLE_R},${GEAR_CENTER}A${GEAR_HOLE_R},${GEAR_HOLE_R} 0 1 0 ${GEAR_CENTER - GEAR_HOLE_R},${GEAR_CENTER}A${GEAR_HOLE_R},${GEAR_HOLE_R} 0 1 0 ${GEAR_CENTER + GEAR_HOLE_R},${GEAR_CENTER}Z`
  return `${outline} ${hole}`
})()

function SharpGear({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd">
      <path d={SHARP_GEAR_PATH} />
    </svg>
  )
}
