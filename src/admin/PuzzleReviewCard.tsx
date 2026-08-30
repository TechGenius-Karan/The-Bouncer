import { useState } from 'react'
import type { AdminPuzzleDetail } from './types'

interface Props {
  puzzle: AdminPuzzleDetail
  onApprove: () => Promise<void>
  onReject: (reason: string) => Promise<void>
  onRepairWord: (badWordId: string, reason: string) => Promise<{ repaired: boolean }>
}

// '' means "whole puzzle / rule concept" — a normal reject. Any other value
// is a wordId, meaning the reviewer thinks only that one word is the
// problem — Phase 10.6 item 2's cheap word-level repair path.
const WHOLE_PUZZLE = ''

export function PuzzleReviewCard({ puzzle, onApprove, onReject, onRepairWord }: Props) {
  const [reason, setReason] = useState('')
  const [badWordId, setBadWordId] = useState(WHOLE_PUZZLE)
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

  const handleReject = async () => {
    if (!reason.trim()) return
    setBusy(true)
    try {
      if (badWordId === WHOLE_PUZZLE) {
        await onReject(reason.trim())
        return
      }
      await onRepairWord(badWordId, reason.trim())
      // On success the puzzle stays in the queue with the word swapped —
      // reset so the form doesn't keep pointing at a wordId that may no
      // longer exist in the (now-updated) puzzle.
      setReason('')
      setBadWordId(WHOLE_PUZZLE)
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
          <select
            value={badWordId}
            onChange={(e) => setBadWordId(e.target.value)}
            className="rounded-card border border-line bg-screen px-2 py-2 font-sans text-sm"
          >
            <option value={WHOLE_PUZZLE}>Whole puzzle / rule concept</option>
            {puzzle.clues.map((c) => (
              <option key={c.wordId} value={c.wordId}>
                Just "{c.word}" ({c.label} clue)
              </option>
            ))}
            {puzzle.guests.map((g) => (
              <option key={g.wordId} value={g.wordId}>
                Just "{g.word}" (pool, {g.trueLabel})
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason…"
            className="min-w-[180px] flex-1 rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
          />
          <button
            onClick={handleReject}
            disabled={busy || !reason.trim()}
            className="rounded-bin bg-miss px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-50"
          >
            {badWordId === WHOLE_PUZZLE ? 'Reject' : 'Fix word & requeue'}
          </button>
        </div>
      </div>
    </div>
  )
}
