import { memo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { CardState } from '../game/types'

const DRAG_THRESHOLD = 64
const TAP_THRESHOLD = 8

type DragSide = 'in' | 'out' | null

interface Props {
  card: CardState
  tilt: number
  selected: boolean
  interactive: boolean
  onSelect: (id: string) => void
  onCommit: (id: string, side: 'in' | 'out') => void
  onDragChange: (side: DragSide) => void
}

function sideFor(dx: number): DragSide {
  if (dx > DRAG_THRESHOLD) return 'in'
  if (dx < -DRAG_THRESHOLD) return 'out'
  return null
}

/**
 * Memoized: PlayScreen re-renders whenever onDragChange fires (it tracks the
 * live side for the tray-highlight glow), which would otherwise reconcile
 * all ~6 pool cards per event. Needs onSelect/onCommit/onDragChange to stay
 * referentially stable across renders (see PlayScreen).
 */
export const SlipCard = memo(function SlipCard({
  card,
  tilt,
  selected,
  interactive,
  onSelect,
  onCommit,
  onDragChange,
}: Props) {
  const [drag, setDrag] = useState<{ x0: number; y0: number; dx: number; dy: number } | null>(
    null,
  )
  // Tracks the side already reported to PlayScreen so onDragChange (and the
  // parent re-render it causes) only fires on a threshold crossing, not on
  // every pixel of pointermove — a plain ref, not state, since it shouldn't
  // itself trigger a render.
  const lastSideRef = useRef<DragSide>(null)
  const prefersReducedMotion = useReducedMotion()

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDrag({ x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.x0
    const dy = e.clientY - drag.y0
    setDrag({ ...drag, dx, dy })
    const side = sideFor(dx)
    if (side !== lastSideRef.current) {
      lastSideRef.current = side
      onDragChange(side)
    }
  }

  const onPointerUp = () => {
    if (!drag) return
    const { dx, dy } = drag
    setDrag(null)
    if (lastSideRef.current !== null) {
      lastSideRef.current = null
      onDragChange(null)
    }
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      onCommit(card.id, dx > 0 ? 'in' : 'out')
      return
    }
    if (Math.abs(dx) < TAP_THRESHOLD && Math.abs(dy) < TAP_THRESHOLD) onSelect(card.id)
  }

  const dragging = drag !== null
  const draggingIn = dragging && drag.dx > DRAG_THRESHOLD
  const draggingOut = dragging && drag.dx < -DRAG_THRESHOLD

  let border = 'border-2 border-line'
  let bg = 'bg-slip'
  let color = 'text-ink'
  let shadow = 'shadow-card'
  let extraAnim = ''
  let transform = `rotate(${tilt}deg)`

  if (dragging) {
    transform = `translate(${drag.dx}px, ${drag.dy * 0.35}px) rotate(${drag.dx * 0.05}deg)`
    shadow = 'shadow-card-hover'
  }
  if (selected) {
    border = 'border-2 border-ink'
    shadow = 'shadow-[0_5px_0_-1px_rgb(var(--color-ink))]'
  }
  if (draggingIn) {
    border = 'border-2 border-bin-in'
    bg = 'bg-bin-in-tint'
  }
  if (draggingOut) {
    border = 'border-2 border-bin-out'
    bg = 'bg-bin-out-tint'
  }
  if (card.result === 'correct') {
    border = 'border-2 border-bin-in'
    bg = 'bg-bin-in-tint'
    transform = 'rotate(0deg) scale(1.03)'
  }
  if (card.result === 'wrong') {
    border = 'border-2 border-miss'
    bg = 'bg-miss-tint'
    color = 'text-miss-text'
    transform = 'rotate(-4deg)'
    extraAnim = 'motion-safe:animate-nudge'
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`relative flex h-[66px] w-full cursor-grab items-center justify-center rounded-card px-1 font-display text-[22px] font-bold tracking-wide max-[380px]:text-[18px] ${border} ${bg} ${color} ${shadow} ${extraAnim} select-none touch-none`}
      style={{
        transform,
        transition: dragging || prefersReducedMotion ? 'none' : 'transform .28s cubic-bezier(.2,1.5,.4,1), box-shadow .2s',
        zIndex: dragging ? 30 : 1,
      }}
    >
      {card.word}
      {card.result === 'correct' && (
        <div className="absolute -right-2 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-bin-in font-sans text-xs text-white">
          ✓
        </div>
      )}
      {card.result === 'wrong' && (
        <div className="absolute -left-1.5 -top-2.5 rounded-full bg-miss px-2 py-0.5 font-sans text-[10px] font-semibold tracking-wider text-white">
          ✕ WRONG
        </div>
      )}
    </div>
  )
})
