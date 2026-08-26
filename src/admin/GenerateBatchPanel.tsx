import { useState } from 'react'
import type { FormEvent } from 'react'
import { generateBatch } from './adminClient'

type TierChoice = 'both' | 'medium' | 'spicy'

interface Props {
  code: string
  onGenerated: () => void
}

export function GenerateBatchPanel({ code, onGenerated }: Props) {
  const [countInput, setCountInput] = useState('8')
  const [tierChoice, setTierChoice] = useState<TierChoice>('both')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault()
    const count = Number(countInput)
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      setError('Enter a whole number between 1 and 20.')
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const tiers = tierChoice === 'both' ? undefined : [tierChoice]
      const result = await generateBatch(code, count, tiers)
      setMessage(`Generated ${result.generated}/${result.requested} candidates — added to the review queue below.`)
      onGenerated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Generate batch</div>

      <form onSubmit={handleGenerate} className="flex flex-wrap items-center gap-2">
        <input
          value={countInput}
          onChange={(e) => setCountInput(e.target.value)}
          placeholder="Count (e.g. 8)"
          className="w-28 rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
        />
        <select
          value={tierChoice}
          onChange={(e) => setTierChoice(e.target.value as TierChoice)}
          className="rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
        >
          <option value="both">Medium + Spicy</option>
          <option value="medium">Medium only</option>
          <option value="spicy">Spicy only</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="ml-auto rounded-bin bg-ink px-4 py-2 font-display text-sm font-bold text-screen disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate batch'}
        </button>
      </form>

      {error && <div className="font-sans text-sm text-miss-text">{error}</div>}
      {message && <div className="font-sans text-sm text-ink-soft">{message}</div>}
    </div>
  )
}
