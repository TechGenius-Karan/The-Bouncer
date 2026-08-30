import { useState } from 'react'
import type { AdminRuleRejectStat } from './types'

interface Props {
  rules: AdminRuleRejectStat[]
  onOverride: (ruleId: string, changes: { disabled?: boolean; subtletyOverride?: number | null }) => Promise<void>
}

// ai-feedback-plan.md §8/§11 phase 1: was "recent rule rejections only" —
// widened to every rule in the taxonomy so a reviewer can retire/recalibrate
// any rule directly, not just ones that already hit the reject threshold.
export function RuleRejectStatsPanel({ rules, onOverride }: Props) {
  if (rules.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-bin border border-line bg-slip p-5">
      <div className="font-display text-lg font-bold">Rule taxonomy</div>
      <div className="flex flex-col gap-2 font-sans text-sm">
        {rules.map((r) => (
          <RuleRow key={r.ruleId} rule={r} onOverride={onOverride} />
        ))}
      </div>
    </div>
  )
}

function RuleRow({
  rule,
  onOverride,
}: {
  rule: AdminRuleRejectStat
  onOverride: Props['onOverride']
}) {
  const overridden = rule.disabled || rule.subtletyOverride !== null
  const [subtletyInput, setSubtletyInput] = useState(String(rule.subtletyOverride ?? rule.baseSubtlety))
  const [busy, setBusy] = useState(false)

  const handleToggleDisabled = async () => {
    setBusy(true)
    try {
      await onOverride(rule.ruleId, { disabled: !rule.disabled })
    } finally {
      setBusy(false)
    }
  }

  const handleSaveSubtlety = async () => {
    const parsed = Number(subtletyInput)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return
    setBusy(true)
    try {
      await onOverride(rule.ruleId, { subtletyOverride: parsed === rule.baseSubtlety ? null : parsed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-card border p-3 ${
        rule.flagged ? 'border-miss-border bg-miss-tint' : 'border-line bg-screen'
      }`}
    >
      <div>
        <div className="flex items-center gap-2 font-semibold">
          {rule.ruleName}
          {overridden && (
            <span className="rounded-card bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-screen">
              Overridden
            </span>
          )}
          {rule.flagged && (
            <span className="rounded-card bg-miss px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
              Review template
            </span>
          )}
        </div>
        <div className="text-xs text-ink-soft">
          {rule.ruleId} · {rule.rejectCount} recent reject{rule.rejectCount === 1 ? '' : 's'}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={5}
          value={subtletyInput}
          onChange={(e) => setSubtletyInput(e.target.value)}
          disabled={busy || rule.disabled}
          className="w-14 rounded-card border border-line bg-canvas px-2 py-1 text-sm disabled:opacity-50"
          title="Subtlety (1-5)"
        />
        <button
          onClick={handleSaveSubtlety}
          disabled={busy || rule.disabled || Number(subtletyInput) === (rule.subtletyOverride ?? rule.baseSubtlety)}
          className="rounded-card border border-line px-2 py-1 text-xs font-semibold disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={handleToggleDisabled}
          disabled={busy}
          className={`rounded-card px-3 py-1 text-xs font-bold text-white disabled:opacity-50 ${
            rule.disabled ? 'bg-bin-in' : 'bg-miss'
          }`}
        >
          {rule.disabled ? 'Reinstate' : 'Retire'}
        </button>
      </div>
    </div>
  )
}
