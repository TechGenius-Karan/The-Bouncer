import type { ReactNode } from 'react'

interface Props {
  onClose: () => void
}

export function HowToPlayModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-y-auto rounded-t-screen bg-screen sm:rounded-screen">
        <div className="flex items-center justify-between px-7 pt-6">
          <div className="font-display text-[31px] font-extrabold tracking-tight">How to play</div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-skip-bg text-lg text-ink-soft"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5 px-7 py-4">
          <Step n={1} title="A hidden rule decides">
            One short rule decides which words are IN and which are OUT. You&rsquo;re never told
            it.
          </Step>
          <Step n={2} title="Six clues are already filed">
            Three per tray, pinned at the top. Read them for the pattern.
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip color="in">● CHARMS</Chip>
              <Chip color="in">● SHINE</Chip>
              <Chip color="out">▲ TANGO</Chip>
            </div>
          </Step>
          <Step n={3} title="File all six slips">
            Swipe a word left for OUT, right for IN, in any order. No submit button — the round
            ends when the last word lands.
          </Step>
          <Step n={4} title="You get three misses" danger>
            A wrong word corrects itself and costs a life. Lose all three and the round stops
            there.
            <div className="mt-1.5 flex gap-2">
              <div className="h-5 w-5 rounded-full bg-miss" />
              <div className="h-5 w-5 rounded-full bg-miss" />
              <div className="h-5 w-5 rounded-full bg-miss" />
            </div>
          </Step>
        </div>

        <div className="px-7 pb-7 pt-2">
          <button
            onClick={onClose}
            className="h-14 w-full rounded-bin bg-ink font-display text-lg font-bold text-screen shadow-pressed"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  danger,
  children,
}: {
  n: number
  title: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`flex gap-3.5 rounded-bin border p-4 ${danger ? 'border-[1.5px] border-miss-border bg-miss-tint' : 'border-line bg-slip'}`}
    >
      <div
        className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-display text-[17px] font-bold ${danger ? 'bg-miss text-white' : 'bg-ink text-screen'}`}
      >
        {n}
      </div>
      <div className="flex flex-col gap-1">
        <div className={`font-display text-lg font-bold ${danger ? 'text-miss-text' : ''}`}>
          {title}
        </div>
        <div className={`text-[15px] leading-relaxed ${danger ? 'text-miss-text/85' : 'text-ink-soft'}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Chip({ color, children }: { color: 'in' | 'out'; children: ReactNode }) {
  const cls = color === 'in' ? 'bg-bin-in-chip text-bin-in-text' : 'bg-bin-out-chip text-bin-out-text'
  return (
    <div className={`rounded-full px-2.5 py-1 font-display text-[13px] font-bold tracking-wide ${cls}`}>
      {children}
    </div>
  )
}
