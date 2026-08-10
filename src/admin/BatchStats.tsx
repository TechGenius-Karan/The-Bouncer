import { useState } from 'react'
import type { FormEvent } from 'react'
import { getBatchStats } from './adminClient'
import type { AdminBatchStatsResponse } from './types'

interface Props {
  code: string
}

export function BatchStats({ code }: Props) {
  const [fromInput, setFromInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [batch, setBatch] = useState<AdminBatchStatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault()
    const from = Number(fromInput)
    const to = Number(toInput)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      setError('Enter a valid from/to range.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getBatchStats(code, from, to)
      setBatch(data)
    } catch (err) {
      setBatch(null)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Playtest batch stats</div>

      <form onSubmit={handleLookup} className="flex items-center gap-2">
        <input
          value={fromInput}
          onChange={(e) => setFromInput(e.target.value)}
          placeholder="From (e.g. 20)"
          className="w-28 rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
        />
        <span className="font-sans text-sm text-ink-soft">to</span>
        <input
          value={toInput}
          onChange={(e) => setToInput(e.target.value)}
          placeholder="To (e.g. 35)"
          className="w-28 rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="ml-auto rounded-bin bg-ink px-4 py-2 font-display text-sm font-bold text-screen disabled:opacity-50"
        >
          Look up
        </button>
      </form>

      {error && <div className="font-sans text-sm text-miss-text">{error}</div>}

      {batch && (
        <div className="flex flex-col gap-3">
          <div className="rounded-card border border-line bg-screen p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Pooled avg. score (#{batch.from}–{batch.to})
            </div>
            <div className="font-display text-2xl font-bold">
              {batch.pooledAvgScore !== null ? `${batch.pooledAvgScore.toFixed(2)} / 6` : '—'}
              <span className="ml-2 font-sans text-sm font-normal text-ink-soft">
                across {batch.pooledCompletedCount} completed attempt{batch.pooledCompletedCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {batch.missingNumbers.length > 0 && (
            <div className="rounded-card border border-skip bg-skip-bg p-3 font-sans text-sm text-skip-faint">
              No puzzle found for: {batch.missingNumbers.join(', ')}
            </div>
          )}

          <div className="flex flex-col gap-1">
            {batch.puzzles.map((p) => (
              <div
                key={p.number}
                className={`flex items-center justify-between rounded-card border px-3 py-2 font-sans text-sm ${
                  p.inTargetBand === false ? 'border-miss-border bg-miss-tint' : 'border-line bg-screen'
                }`}
              >
                <div className="font-display font-bold">
                  #{p.number} · {p.difficultyTier}
                </div>
                <div className={p.inTargetBand === false ? 'text-miss-text' : 'text-ink-soft'}>
                  {p.avgScore !== null ? `${p.avgScore.toFixed(1)}/6` : 'no attempts yet'} · {p.completedCount} played
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
