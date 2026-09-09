import { useState } from 'react'
import type { AdminPuzzleDetail, Label } from './types'

// Hand-editing a puzzle, with no AI involved.
//
// Refine is a negotiation: you describe the change, a model interprets it, and
// it may still be refused. This is for when you already know the exact edit —
// you state the board and it is stored.
//
// The IN/OUT toggles are the point. Everywhere else in the game a guest's label
// is derived from the rule; here it is whatever the reviewer says it is, even
// where that contradicts the rule. That is deliberate: a category tag can be
// wrong and a rule can be a rough approximation of what a puzzle is really
// about, and the editor can see that where the evaluator cannot.

interface Props {
  puzzle: AdminPuzzleDetail
  onSave: (edit: {
    clues: { word: string; label: Label }[]
    guests: { word: string; label: Label }[]
    ruleText: string
  }) => Promise<void>
  onCancel: () => void
}

interface Row {
  word: string
  label: Label
}

export function ManualEditPanel({ puzzle, onSave, onCancel }: Props) {
  const [ruleText, setRuleText] = useState(puzzle.ruleDescription)
  const [clues, setClues] = useState<Row[]>(
    puzzle.clues.map((c) => ({ word: c.word, label: c.label }))
  )
  const [guests, setGuests] = useState<Row[]>(
    puzzle.guests.map((g) => ({ word: g.word, label: g.trueLabel }))
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (
    rows: Row[],
    setRows: (r: Row[]) => void,
    index: number,
    patch: Partial<Row>
  ) => {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSave({ clues, guests, ruleText: ruleText.trim() })
    } catch (err) {
      // The server names the exact problem; showing it is the whole point.
      setError(err instanceof Error ? err.message : 'Could not save the edit.')
    } finally {
      setBusy(false)
    }
  }

  const rowList = (
    title: string,
    hint: string,
    rows: Row[],
    setRows: (r: Row[]) => void
  ) => (
    <div className="mb-4">
      <div className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </div>
      <div className="mb-2 font-sans text-xs text-ink-soft">{hint}</div>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={row.word}
              onChange={(e) => update(rows, setRows, i, { word: e.target.value })}
              className="min-w-0 flex-1 rounded-bin border border-line bg-screen px-2.5 py-1.5 font-sans text-sm"
              aria-label={`${title} word ${i + 1}`}
            />
            <div className="flex shrink-0 overflow-hidden rounded-bin border border-line">
              {(['IN', 'OUT'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => update(rows, setRows, i, { label })}
                  className={`px-3 py-1.5 font-sans text-xs font-semibold ${
                    row.label === label
                      ? label === 'IN'
                        ? 'bg-bin-in-text text-screen'
                        : 'bg-bin-out-label text-screen'
                      : 'bg-screen text-ink-soft'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="mt-3 rounded-card border border-line bg-screen p-3">
      <div className="mb-3 font-display text-sm font-bold">Manual edit</div>

      <div className="mb-4">
        <div className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Rule shown at reveal
        </div>
        <div className="mb-2 font-sans text-xs text-ink-soft">
          If you move a word across IN/OUT, change this so it still describes the board.
        </div>
        <textarea
          value={ruleText}
          onChange={(e) => setRuleText(e.target.value)}
          rows={2}
          className="w-full rounded-bin border border-line bg-screen px-2.5 py-1.5 font-sans text-sm"
          aria-label="Rule shown at reveal"
        />
      </div>

      {rowList('Clues', 'The examples shown before sorting.', clues, setClues)}
      {rowList(
        'Guest pool',
        'IN/OUT here is the answer key — your call, not the rule’s.',
        guests,
        setGuests
      )}

      {error && (
        <div className="mb-3 rounded-bin border border-bin-out-label bg-screen px-2.5 py-2 font-sans text-xs text-bin-out-label">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-bin bg-ink px-4 py-2 font-display text-sm font-bold text-screen disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-bin border border-line px-4 py-2 font-display text-sm font-bold disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
