import { useState } from 'react'
import type { FormEvent } from 'react'
import { getPuzzleStats } from './adminClient'
import type { AdminPuzzleStatsResponse } from './types'

interface Props {
  code: string
}

export function LivePuzzleStats({ code }: Props) {
  const [numberInput, setNumberInput] = useState('')
  const [stats, setStats] = useState<AdminPuzzleStatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault()
    const number = Number(numberInput)
    if (!Number.isInteger(number) || number < 1) {
      setError('Enter a valid puzzle number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getPuzzleStats(code, number)
      setStats(data)
    } catch (err) {
      setStats(null)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Live puzzle stats</div>

      <form onSubmit={handleLookup} className="flex gap-2">
        <input
          value={numberInput}
          onChange={(e) => setNumberInput(e.target.value)}
          placeholder="Puzzle number (e.g. 42)"
          className="flex-1 rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-bin bg-ink px-4 py-2 font-display text-sm font-bold text-screen disabled:opacity-50"
        >
          Look up
        </button>
      </form>

      {error && <div className="font-sans text-sm text-miss-text">{error}</div>}

      {stats && (
        <div className="flex flex-col gap-3">
          <div className="font-display text-base font-bold">
            #{stats.number} · {stats.difficultyTier} · {stats.status}
          </div>

          <div className="grid grid-cols-2 gap-4 font-sans text-sm">
            <div className="rounded-card border border-line bg-screen p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Completed rounds</div>
              <div className="font-display text-2xl font-bold">{stats.completedCount}</div>
            </div>
            <div className="rounded-card border border-line bg-screen p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Avg. score</div>
              <div className="font-display text-2xl font-bold">
                {stats.avgScore !== null ? stats.avgScore.toFixed(1) : '—'}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 font-sans text-sm font-semibold text-ink-soft">Guest miss rate</div>
            <div className="flex flex-col gap-1">
              {stats.guestMissRates.map((g) => (
                <div
                  key={g.wordId}
                  className="flex items-center justify-between rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
                >
                  <div>
                    {g.word}
                    {g.isTrap && <span className="ml-1 text-xs opacity-70">({g.trapType})</span>}
                  </div>
                  <div className="font-display font-bold">
                    {g.misses}/{g.attempts} ({Math.round(g.missRate * 100)}%)
                  </div>
                </div>
              ))}
              {stats.guestMissRates.every((g) => g.attempts === 0) && (
                <div className="font-sans text-sm text-ink-soft">No plays recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
