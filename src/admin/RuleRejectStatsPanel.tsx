import type { AdminRuleRejectStat } from './types'

interface Props {
  rules: AdminRuleRejectStat[]
}

// Phase 10.6 item 2: nothing to show once no rule has a recent reject —
// the panel just doesn't render, rather than showing an empty table.
export function RuleRejectStatsPanel({ rules }: Props) {
  if (rules.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Recent rule rejections (30d)</div>
      <div className="flex flex-col gap-2 font-sans text-sm">
        {rules.map((r) => (
          <div
            key={r.ruleId}
            className={`flex items-center justify-between rounded-card border p-3 ${
              r.flagged ? 'border-miss-border bg-miss-tint' : 'border-line bg-screen'
            }`}
          >
            <div>
              <div className="font-semibold">{r.ruleName}</div>
              <div className="text-xs text-ink-soft">{r.ruleId}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.flagged && (
                <span className="rounded-card bg-miss px-2 py-0.5 text-xs font-bold uppercase text-white">
                  Review template
                </span>
              )}
              <span className="font-display text-xl font-bold">{r.rejectCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
