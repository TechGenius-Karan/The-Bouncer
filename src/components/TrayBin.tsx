import { memo } from 'react'
import type { CardState, Label } from '../game/types'
import { ItemFace } from './ItemFace'
import { CARD_STEP, stackHeightFor, TOP_BASE } from './traySize'

// A visual caption can wrap to two lines. The next filed chip covers this one's
// bottom 8 px (CARD_HEIGHT - CARD_STEP), so pb-2 centres the text in what still shows.
const VISUAL_CHIP_TEXT = 'pb-2 text-center text-sm leading-none'

interface Props {
  side: Label
  cards: CardState[]
  active: boolean
  onClick: () => void
}

/** Memoized alongside SlipCard — see that component's comment. Needs
 * `cards` to stay referentially stable across drag-only re-renders (see
 * PlayScreen's useMemo) or this memo does nothing. */
export const TrayBin = memo(function TrayBin({ side, cards, active, onClick }: Props) {
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
            className={`absolute left-1/2 flex h-10 w-[92%] -translate-x-1/2 motion-safe:animate-settle items-center justify-center rounded-[11px] border font-display font-bold ${c.visual ? VISUAL_CHIP_TEXT : 'text-base tracking-wide'} ${isIn ? 'border-bin-in-chip text-bin-in-text' : 'border-bin-out-chip text-bin-out-text'} bg-slip`}
            style={{ top: `${TOP_BASE + n * CARD_STEP}px`, zIndex: n }}
          >
            <ItemFace id={c.id} name={c.word} visual={c.visual} size={18} />
          </div>
        ))}
      </div>
    </div>
  )
})
