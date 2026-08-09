import type { AdminBufferHealthResponse } from './types'

// Phase 8 (planning.md §9.2): the 2-4 week target range this panel flags
// against, matching the plan's "healthy" bar for each tier.
const MEDIUM_TARGET_DAYS = 14
const SPICY_TARGET_WEEKS = 4

interface Props {
  health: AdminBufferHealthResponse
}

export function BufferHealthPanel({ health }: Props) {
  const mediumLow = health.mediumBufferDays < MEDIUM_TARGET_DAYS
  const spicyLow = health.spicyBufferWeeks < SPICY_TARGET_WEEKS

  return (
    <div className="flex flex-col gap-3 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Content buffer</div>

      <div className="grid grid-cols-2 gap-4 font-sans text-sm">
        <BufferTile label="Medium buffer" value={`${health.mediumBufferDays} days`} low={mediumLow} />
        <BufferTile label="Spicy buffer" value={`${health.spicyBufferWeeks} weeks`} low={spicyLow} />
      </div>

      {health.gapDates.length > 0 && (
        <div className="rounded-card border border-miss-border bg-miss-tint p-3 font-sans text-sm text-miss-text">
          <div className="mb-1 font-semibold">Unscheduled dates in the next 28 days:</div>
          <div>{health.gapDates.join(', ')}</div>
        </div>
      )}
    </div>
  )
}

function BufferTile({ label, value, low }: { label: string; value: string; low: boolean }) {
  return (
    <div
      className={`rounded-card border p-3 ${low ? 'border-miss-border bg-miss-tint' : 'border-line bg-screen'}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`font-display text-2xl font-bold ${low ? 'text-miss-text' : ''}`}>{value}</div>
    </div>
  )
}
