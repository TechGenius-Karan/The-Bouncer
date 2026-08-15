import { useState } from 'react'
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

  const clueIn = puzzle.clues.filter((c) => c.label === 'IN').map((c) => c.word)
  const clueOut = puzzle.clues.filter((c) => c.label === 'OUT').map((c) => c.word)

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

      <div className="font-sans text-sm">{puzzle.ruleDescription}</div>

      <div className="grid grid-cols-2 gap-4 font-sans text-sm">
        <div>
          <div className="mb-1 font-semibold text-bin-in-text">IN clues</div>
          <div>{clueIn.join(', ')}</div>
        </div>
        <div>
          <div className="mb-1 font-semibold text-bin-out-label">OUT clues</div>
          <div>{clueOut.join(', ')}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {puzzle.guests.map((g) => (
          <div
            key={g.wordId}
            className={`rounded-card border px-2 py-1 font-sans text-xs ${
              g.trueLabel === 'IN'
                ? 'border-bin-in bg-bin-in-chip text-bin-in-text'
                : 'border-bin-out bg-bin-out-chip text-bin-out-text'
            }`}
          >
            {g.word}
            {g.isTrap && <span className="ml-1 opacity-70">({g.trapType})</span>}
          </div>
        ))}
      </div>

      <div className="font-sans text-xs text-ink-soft">
        Live decoys:{' '}
        {puzzle.liveDecoys.length > 0
          ? puzzle.liveDecoys.map((d) => `${d.ruleName} (subtlety ${d.subtlety})`).join(', ')
          : 'none'}
      </div>

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
