import { useState } from 'react'
import { PuzzleCardBody } from './PuzzleCardBody'
import type { AdminListApprovedResponse, AdminPuzzleDetail } from './types'

interface Props {
  data: AdminListApprovedResponse
  onSchedule: (puzzleId: string, date: string) => Promise<void>
  onUnapprove: (puzzleId: string) => Promise<void>
}

export function ApprovedPanel({ data, onSchedule, onUnapprove }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Approved, awaiting a date</div>

      {data.puzzles.length === 0 && (
        <div className="font-sans text-sm text-ink-soft">Nothing approved and unscheduled.</div>
      )}

      <div className="flex flex-col gap-3">
        {data.puzzles.map((puzzle) => (
          <ApprovedRow key={puzzle.puzzleId} puzzle={puzzle} onSchedule={onSchedule} onUnapprove={onUnapprove} />
        ))}
      </div>
    </div>
  )
}

// Duplicated from netlify/functions/_shared/puzzleDate.ts's isSaturday/
// resolvePuzzleDateString — same cross-boundary convention as the wire
// types in ./types.ts (src/ can't import from netlify/functions/).
function isSaturday(dateString: string): boolean {
  return new Date(`${dateString}T00:00:00.000Z`).getUTCDay() === 6
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function ApprovedRow({
  puzzle,
  onSchedule,
  onUnapprove,
}: {
  puzzle: AdminPuzzleDetail
  onSchedule: (puzzleId: string, date: string) => Promise<void>
  onUnapprove: (puzzleId: string) => Promise<void>
}) {
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tierMismatch = date !== '' && isSaturday(date) !== (puzzle.difficultyTier === 'spicy')

  const handleSchedule = async () => {
    if (!date) return
    setError(null)
    setBusy(true)
    try {
      await onSchedule(puzzle.puzzleId, date)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule.')
    } finally {
      setBusy(false)
    }
  }

  const handleUnapprove = async () => {
    if (!window.confirm('Send this puzzle back to the review queue?')) return
    setBusy(true)
    try {
      await onUnapprove(puzzle.puzzleId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-screen p-4">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-base font-bold capitalize">{puzzle.difficultyTier}</div>
        <span className="font-sans text-xs uppercase tracking-wide text-ink-soft">{puzzle.ruleId}</span>
      </div>

      <PuzzleCardBody puzzle={puzzle} />

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            min={todayDateString()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-card border border-line bg-slip px-3 py-1.5 font-sans text-sm"
          />
          <button
            onClick={handleSchedule}
            disabled={busy || !date}
            className="rounded-bin bg-ink px-4 py-2 font-display text-sm font-bold text-screen disabled:opacity-50"
          >
            Schedule
          </button>
          <button
            onClick={handleUnapprove}
            disabled={busy}
            className="rounded-bin bg-miss px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-50"
          >
            Send back to review
          </button>
        </div>
        {tierMismatch && (
          <div className="font-sans text-xs text-skip-faint">
            {isSaturday(date)
              ? `Saturdays are Spicy Saturday — this is a ${puzzle.difficultyTier} puzzle.`
              : `This is a spicy puzzle, but ${date} isn't a Saturday.`}
          </div>
        )}
        {error && <div className="font-sans text-xs text-miss-text">{error}</div>}
      </div>
    </div>
  )
}
