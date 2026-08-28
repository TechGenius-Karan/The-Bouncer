import { useState } from 'react'
import { PuzzleCardBody } from './PuzzleCardBody'
import type { AdminListScheduledResponse, AdminScheduledPuzzle } from './types'

interface Props {
  data: AdminListScheduledResponse
  onPull: (puzzleId: string) => Promise<void>
}

export function SchedulePanel({ data, onPull }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Upcoming schedule</div>

      {data.puzzles.length === 0 && (
        <div className="font-sans text-sm text-ink-soft">Nothing scheduled yet.</div>
      )}

      <div className="flex flex-col gap-3">
        {data.puzzles.map((puzzle) => (
          <ScheduleRow
            key={puzzle.puzzleId}
            puzzle={puzzle}
            isToday={puzzle.date === data.today}
            onPull={onPull}
          />
        ))}
      </div>
    </div>
  )
}

function ScheduleRow({
  puzzle,
  isToday,
  onPull,
}: {
  puzzle: AdminScheduledPuzzle
  isToday: boolean
  onPull: (puzzleId: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  const handlePull = async () => {
    if (!window.confirm(`Pull #${puzzle.number} (${puzzle.date}) from the schedule and send it back for review?`)) {
      return
    }
    setBusy(true)
    try {
      await onPull(puzzle.puzzleId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-card border p-4 ${
        isToday ? 'border-line bg-canvas opacity-70' : 'border-line bg-screen'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-display text-base font-bold">
          {puzzle.date} · #{puzzle.number} · {puzzle.difficultyTier}
        </div>
        {isToday ? (
          <span className="rounded-card bg-ink px-2 py-0.5 font-sans text-xs font-semibold text-screen">
            Today — live
          </span>
        ) : (
          <span className="font-sans text-xs uppercase tracking-wide text-ink-soft">{puzzle.ruleId}</span>
        )}
      </div>

      <PuzzleCardBody puzzle={puzzle} />

      {!isToday && (
        <div className="border-t border-line pt-3">
          <button
            onClick={handlePull}
            disabled={busy}
            className="rounded-bin bg-miss px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-50"
          >
            Pull from schedule
          </button>
        </div>
      )}
    </div>
  )
}
