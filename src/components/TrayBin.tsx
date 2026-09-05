import type { CardState, Label } from '../game/types'
import { CARD_STEP, stackHeightFor, TOP_BASE } from './traySize'

interface Props {
  side: Label
  cards: CardState[]
  active: boolean
  onClick: () => void
}

export function TrayBin({ side, cards, active, onClick }: Props) {
  const isIn = side === 'in'
  const label = isIn ? '● IN' : '▲ OUT'
  const labelColor = isIn ? 'text-bin-in-text' : 'text-bin-out-label'
  const activeBg = isIn ? 'bg-bin-in-active' : 'bg-bin-out-active'
  const borderColor = isIn ? 'border-bin-in' : 'border-bin-out'

  return (
    <div
      onClick={onClick}
      className={`flex flex-1 cursor-pointer flex-col items-center gap-2.5 rounded-bin border-[1.5px] border-dashed p-3.5 transition-colors duration-150 ${borderColor} ${active ? activeBg : 'bg-skip-bg'}`}
    >
      <div
        className={`flex items-center gap-1.5 font-display text-base font-extrabold tracking-wider ${labelColor}`}
      >
        {label}
      </div>
      <div
        className="relative w-full transition-[height] duration-200 ease-out"
        style={{ height: stackHeightFor(cards.length) }}
      >
        {cards.map((c, n) => (
          <div
            key={c.id}
            className={`absolute left-1/2 flex h-10 w-[92%] -translate-x-1/2 motion-safe:animate-settle items-center justify-center rounded-[11px] border font-display text-base font-bold tracking-wide ${isIn ? 'border-bin-in-chip text-bin-in-text' : 'border-bin-out-chip text-bin-out-text'} bg-slip`}
            style={{ top: `${TOP_BASE + n * CARD_STEP}px`, zIndex: n }}
          >
            {c.word}
          </div>
        ))}
      </div>
    </div>
  )
}
