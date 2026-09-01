import { useState } from 'react'
import type { AdminPuzzleDetail } from './types'

interface Props {
  puzzle: AdminPuzzleDetail
  onApprove: () => Promise<void>
  /** Sends the reviewer's feedback to the AI, which must improve the puzzle — it is never thrown away by this path. */
  onRefine: (reason: string) => Promise<void>
  /** Plain reject, no AI — for when the rule/concept itself is bad. */
  onReject: (reason: string) => Promise<void>
}

// Two separate outcomes, deliberately: the reviewer decides whether a puzzle is
// worth saving, not the AI. Refine always tries to improve and never discards;
// Reject discards immediately with no AI call. Previously one button did both,
// so asking for a fix could silently lose the puzzle.
export function PuzzleReviewCard({ puzzle, onApprove, onRefine, onReject }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const clueIn = puzzle.clues.filter((c) => c.label === 'IN').map((c) => c.word)
  const clueOut = puzzle.clues.filter((c) => c.label === 'OUT').map((c) => c.word)

  const handleApprove = async () => {
    setBusy(true)
    try {
      await onApprove()
    } finally {
      setBusy(false)
    }
  }

  const handleRefine = async () => {
    if (!reason.trim()) return
    setBusy(true)
    try {
      await onRefine(reason.trim())
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!window.confirm(`Reject this ${puzzle.ruleName} puzzle? It will be discarded, not refined.`)) return
    setBusy(true)
    try {
      await onReject(reason.trim() || 'Rejected by reviewer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-bin border border-line bg-slip p-5">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-lg font-bold capitalize">{puzzle.difficultyTier}</div>
        <div className="font-sans text-xs uppercase tracking-wide text-ink-soft">{puzzle.ruleId}</div>
      </div>

      <div className="rounded-card border border-line bg-screen p-3 font-display text-base font-bold">
        {puzzle.ruleDescription}
      </div>

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

      <div>
        <div className="mb-1 font-sans text-sm font-semibold text-ink-soft">Pool</div>
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
      </div>

      <div className="font-sans text-sm text-ink-soft">
        Live decoys:{' '}
        {puzzle.liveDecoys.length > 0
          ? puzzle.liveDecoys.map((d) => `${d.ruleName} (subtlety ${d.subtlety})`).join(', ')
          : 'none'}
      </div>

      <div className="font-sans text-xs text-ink-soft">
        Knobs: {puzzle.knobValues.tier}, {puzzle.knobValues.clueCountIn}+{puzzle.knobValues.clueCountOut} clues,
        pool {puzzle.knobValues.poolSize}, {puzzle.knobValues.trapGuestCount} traps
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="rounded-bin bg-bin-in px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-50"
          >
            Approve
          </button>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What should change? The AI reads this and rewrites the puzzle…"
            className="min-w-[180px] flex-1 rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
          />
          <button
            onClick={handleRefine}
            disabled={busy || !reason.trim()}
            title="The AI improves this puzzle using your notes. It is never discarded."
            className="rounded-bin bg-ink px-4 py-2 font-display text-sm font-bold text-screen disabled:opacity-50"
          >
            Refine
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            title="Discard this puzzle entirely. No AI involved."
            className="rounded-bin bg-miss px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
