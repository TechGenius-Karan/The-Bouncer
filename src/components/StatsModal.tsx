import { loadHistory } from '../game/playHistory'

interface Props {
  onClose: () => void
}

export function StatsModal({ onClose }: Props) {
  const history = loadHistory()
  const played = history.length
  const averageScore = played > 0 ? history.reduce((sum, e) => sum + e.score, 0) / played : 0
  const cracked = history.filter((e) => e.score === e.poolSize).length
  const crackedPercent = played > 0 ? Math.round((cracked / played) * 100) : 0
  const recent = [...history].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-y-auto rounded-t-screen bg-screen sm:rounded-screen">
        <div className="flex items-center justify-between px-7 pt-6">
          <div className="font-display text-[31px] font-extrabold tracking-tight">Your stats</div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-skip-bg text-lg text-ink-soft"
          >
            ✕
          </button>
        </div>

        {played === 0 ? (
          <div className="px-7 py-6 font-sans text-[15px] text-ink-soft">
            Play your first puzzle and your stats will show up here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5 px-7 py-4">
              <StatTile label="Played" value={String(played)} />
              <StatTile label="Avg. score" value={averageScore.toFixed(1)} />
              <StatTile label="Cracked" value={`${crackedPercent}%`} />
            </div>

            <div className="flex flex-col gap-2 px-7 pb-4">
              <div className="font-sans text-[11px] font-semibold tracking-wider text-ink-soft">
                RECENT DAYS
              </div>
              {recent.map((entry) => (
                <div
                  key={entry.date}
                  className="flex items-center justify-between rounded-card border border-line bg-slip px-3 py-2"
                >
                  <div className="font-sans text-sm text-ink-soft">{entry.date}</div>
                  <div className="font-display text-sm font-bold">
                    {entry.score}/{entry.poolSize}
                    {entry.endedEarly && <span className="ml-1.5 text-xs text-miss-text">out of lives</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="px-7 pb-7 pt-2">
          <button
            onClick={onClose}
            className="h-14 w-full rounded-bin bg-ink font-display text-lg font-bold text-screen shadow-pressed"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-bin border border-line bg-slip py-3">
      <div className="font-display text-2xl font-extrabold">{value}</div>
      <div className="font-sans text-[11px] font-semibold tracking-wider text-ink-soft">{label}</div>
    </div>
  )
}
