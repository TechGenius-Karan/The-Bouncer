import type { Clue, Label } from '../game/types'

interface Props {
  label: Label
  clues: Clue[]
  compact?: boolean
}

const config = {
  IN: {
    bg: 'bg-bin-in-subtle',
    border: 'border-bin-in',
    badge: 'bg-bin-in text-white',
    text: 'text-bin-in',
    label: 'IN',
  },
  OUT: {
    bg: 'bg-bin-out-subtle',
    border: 'border-bin-out',
    badge: 'bg-bin-out text-white',
    text: 'text-bin-out',
    label: 'OUT',
  },
}

export function ClueZone({ label, clues, compact = false }: Props) {
  const c = config[label]
  return (
    <div className={`rounded-bin border-2 ${c.border} ${c.bg} p-3 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
        {!compact && (
          <span className="text-xs text-slate-400">(examples)</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {clues.map((clue) => (
          <div
            key={clue.id}
            className={`px-3 py-1.5 rounded-card bg-white shadow-card text-sm font-semibold tracking-wide ${c.text} select-none`}
          >
            {clue.word}
          </div>
        ))}
      </div>
    </div>
  )
}
