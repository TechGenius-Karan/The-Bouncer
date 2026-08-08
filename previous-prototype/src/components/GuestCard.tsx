import { useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { Label, GuestOutcome } from '../game/types'

interface Props {
  word: string
  resolved: false | { outcome: GuestOutcome; trueLabel: Label }
  onSwipe: (direction: Label) => void
}

const SWIPE_THRESHOLD = 80
const FLY_DISTANCE = 400

// The card's visual appearance once it has been resolved
function ResolvedCard({
  word,
  outcome,
  trueLabel,
}: {
  word: string
  outcome: GuestOutcome
  trueLabel: Label
}) {
  const isNotReached = outcome === 'not-reached'
  const isWrong = outcome === 'wrong-corrected'
  const isCorrect = outcome === 'correct'

  const bgClass = isNotReached
    ? 'bg-slate-100 border-slate-200'
    : trueLabel === 'IN'
    ? 'bg-bin-in-light border-bin-in'
    : 'bg-bin-out-light border-bin-out'

  const textClass = isNotReached ? 'text-slate-400' : trueLabel === 'IN' ? 'text-bin-in' : 'text-bin-out'

  // For wrong-corrected, card enters from the side that represents the CORRECT bin
  // (animating in as if it auto-slid into the right place)
  const initialX = isWrong ? (trueLabel === 'IN' ? 60 : -60) : 0
  const initialScale = isWrong ? 0.9 : 0.95

  return (
    <motion.div
      initial={{ x: initialX, scale: initialScale, opacity: 0 }}
      animate={{ x: 0, scale: 1, opacity: 1 }}
      transition={
        isWrong
          ? { type: 'spring', stiffness: 400, damping: 20, duration: 0.35 }
          : { type: 'spring', stiffness: 300, damping: 28, duration: 0.25 }
      }
      className={`relative rounded-card border-2 ${bgClass}`}
    >
      {/* Outcome badge */}
      <div className="absolute -top-2 -right-2 z-10">
        {isCorrect && (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] bg-bin-in text-white rounded-full font-bold shadow">
            ✓
          </span>
        )}
        {isWrong && (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] bg-red-500 text-white rounded-full font-bold shadow">
            ✗
          </span>
        )}
        {isNotReached && (
          <span className="w-5 h-5 flex items-center justify-center text-[10px] bg-slate-400 text-white rounded-full font-bold shadow">
            –
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        <span className={`font-bold tracking-wide text-sm ${textClass}`}>{word}</span>
        {isWrong && (
          <span className="ml-2 text-xs font-medium text-slate-400">
            → {trueLabel}
          </span>
        )}
      </div>
    </motion.div>
  )
}

export function GuestCard({ word, resolved, onSwipe }: Props) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-14, 14])
  const outOverlayOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [0.6, 0])
  const inOverlayOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 0.6])

  const [dragging, setDragging] = useState(false)
  const [flying, setFlying] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  if (resolved) {
    return (
      <ResolvedCard word={word} outcome={resolved.outcome} trueLabel={resolved.trueLabel} />
    )
  }

  function flyOut(direction: Label) {
    if (flying) return
    setFlying(true)
    const target = direction === 'IN' ? FLY_DISTANCE : -FLY_DISTANCE
    animate(x, target, {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
      onComplete: () => onSwipe(direction),
    })
  }

  function handleDragEnd() {
    setDragging(false)
    const currentX = x.get()
    if (Math.abs(currentX) > SWIPE_THRESHOLD) {
      const direction: Label = currentX > 0 ? 'IN' : 'OUT'
      flyOut(direction)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 350, damping: 28 })
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Colored overlays show while dragging to hint the direction */}
      <motion.div
        style={{ opacity: outOverlayOpacity }}
        className="absolute inset-0 rounded-card bg-bin-out border-2 border-bin-out pointer-events-none z-0"
      />
      <motion.div
        style={{ opacity: inOverlayOpacity }}
        className="absolute inset-0 rounded-card bg-bin-in border-2 border-bin-in pointer-events-none z-0"
      />

      <motion.div
        style={{ x, rotate, position: 'relative', zIndex: 1 }}
        drag={flying ? false : 'x'}
        dragConstraints={{ left: -300, right: 300 }}
        dragElastic={0.1}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleDragEnd}
        whileTap={flying ? undefined : { scale: 1.03 }}
        className={[
          'rounded-card border-2 bg-white select-none',
          'cursor-grab active:cursor-grabbing',
          'transition-shadow duration-150',
          dragging ? 'shadow-card-hover border-slate-300' : 'shadow-card border-slate-200',
        ].join(' ')}
      >
        {/* Word */}
        <div className="px-4 pt-3 pb-1">
          <span className="font-bold tracking-wide text-slate-700">{word}</span>
        </div>

        {/* Tap buttons — call onSwipe directly (no flyout delay) so taps are instant.
            stopPropagation on pointerDown prevents the parent drag from activating. */}
        <div className="flex border-t border-slate-100 mt-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { if (!flying) onSwipe('OUT') }}
            className="flex-1 py-2 text-xs font-bold text-bin-out hover:bg-bin-out-subtle rounded-bl-card transition-colors duration-100"
          >
            OUT
          </button>
          <div className="w-px bg-slate-100" />
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { if (!flying) onSwipe('IN') }}
            className="flex-1 py-2 text-xs font-bold text-bin-in hover:bg-bin-in-subtle rounded-bl-card rounded-br-card transition-colors duration-100"
          >
            IN
          </button>
        </div>
      </motion.div>
    </div>
  )
}
