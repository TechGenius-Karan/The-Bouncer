import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// ~3.5s is a target/minimum pace, not a hard duration — see onDone below.
const MIN_DURATION_MS = 3500
const HOLD_PROGRESS = 96

type Phase = 'loading' | 'open' | 'through' | 'handoff'

interface Props {
  /** True once the real get-round fetch has resolved. */
  ready: boolean
  /** Fires once the door has opened and the card has walked through — safe to swap in real content. */
  onDone: () => void
}

// near-linear, monotone: the number and the card advance at the same steady rate
function curve(e: number) {
  const s = e * e * (3 - 2 * e)
  return 100 * (0.82 * e + 0.18 * s)
}

export function LoadingDoor({ ready, onDone }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const readyRef = useRef(ready)
  readyRef.current = ready
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Progress climbs on a fixed ~3.5s pace but is capped just short of 100
  // until the real fetch resolves — the door can't open on fake data.
  useEffect(() => {
    if (prefersReducedMotion) return
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      const e = Math.min(1, (performance.now() - t0) / MIN_DURATION_MS)
      const p = readyRef.current ? curve(e) : Math.min(curve(e), HOLD_PROGRESS)
      setProgress(p)
      if (p >= 100) setPhase('open')
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [prefersReducedMotion])

  useEffect(() => {
    if (prefersReducedMotion || phase !== 'open') return
    const throughTimer = setTimeout(() => setPhase('through'), 320)
    const handoffTimer = setTimeout(() => {
      setPhase('handoff')
      onDoneRef.current()
    }, 1120)
    return () => {
      clearTimeout(throughTimer)
      clearTimeout(handoffTimer)
    }
  }, [phase, prefersReducedMotion])

  useEffect(() => {
    if (!prefersReducedMotion || !ready) return
    const t = setTimeout(() => onDoneRef.current(), 150)
    return () => clearTimeout(t)
  }, [prefersReducedMotion, ready])

  if (prefersReducedMotion) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="font-display text-[22px] font-extrabold tracking-[-0.03em]">
          The Bouncer
        </div>
        <div className="font-sans text-[13.5px] text-ink-soft">
          Setting up today&rsquo;s puzzle&hellip;
        </div>
      </div>
    )
  }

  const p = progress / 100
  const inside = phase === 'through' || phase === 'handoff'
  const open = phase !== 'loading'
  const travel = 130 * p
  const gait = Math.sin(p * Math.PI * 5)
  const bob = -Math.abs(gait) * 3.2
  const rock = -2.6 + gait * 2.2
  const step = progress < 36 ? 0 : progress < 72 ? 1 : 2
  const fade = (i: number) => (step === i ? 1 : 0)
  const slide = (i: number) =>
    step === i ? 'translateY(0px)' : step > i ? 'translateY(-16px)' : 'translateY(16px)'

  const cardTransform = inside
    ? 'translateX(229px) translateY(30px) rotate(0deg) scale(0.56)'
    : `translateX(${travel.toFixed(1)}px) translateY(${bob.toFixed(1)}px) rotate(${rock.toFixed(2)}deg) scale(1)`
  const cardTransition = inside
    ? 'transform 640ms cubic-bezier(.2,1.32,.4,1)'
    : 'transform 90ms linear'

  const words = ['TUXEDO', 'VELVET', 'SNEAKER']
  const captions = ['Checking the guest list', 'Polishing the velvet rope', "Learning today's rule"]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[52px] px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-[9px]">
          <span className="h-5 w-[14px] rounded-t border border-b-0 border-ink bg-bin-in-chip" />
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.26em] text-ink-soft">
            Six words · one rule
          </span>
        </div>
        <div className="font-display text-[34px] font-extrabold leading-none tracking-[-0.03em]">
          The Bouncer
        </div>
      </div>

      <div className="relative h-[206px] w-[340px]">
        <div className="absolute bottom-7 left-6 right-[100px] h-[3px] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(90deg,rgb(var(--color-door-track)) 0 5px,rgba(0,0,0,0) 5px 12px)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 top-0"
            style={{
              width: `${(progress * 0.98).toFixed(1)}%`,
              background:
                'repeating-linear-gradient(90deg,rgb(var(--color-bin-in)) 0 5px,rgba(0,0,0,0) 5px 12px)',
              transition: 'width 90ms linear',
            }}
          />
        </div>

        <div
          className="absolute bottom-5 right-0 h-[172px] w-[104px]"
          style={{ perspective: '760px' }}
        >
          <div
            className="absolute -bottom-1.5 -left-[26px] right-4 h-[26px] rounded-full"
            style={{
              background:
                'radial-gradient(50% 60% at 62% 50%, rgb(var(--color-bin-in) / 0.4), rgb(var(--color-bin-in) / 0) 70%)',
              opacity: open ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          />
          <div
            className="absolute inset-0 rounded-t-[10px] border-2 border-b-0 border-ink bg-screen"
            style={{ boxShadow: '5px 5px 0 rgb(var(--color-ink) / 0.13)' }}
          />
          <div
            className="absolute bottom-0 left-[9px] right-[9px] top-[11px] rounded-t-[6px]"
            style={{
              background: 'linear-gradient(rgb(var(--color-door-in-frame)),rgb(var(--color-door-in-threshold)))',
              boxShadow: 'inset 0 3px 0 rgb(var(--color-ink) / 0.16)',
              opacity: open ? 1 : 0,
              transition: 'opacity 240ms ease',
            }}
          />
          <div
            className="absolute -right-2.5 -top-[15px] z-[5] rounded-full border-[1.5px] border-ink bg-bin-in-chip px-2.5 pb-[5px] pt-1 font-display text-xs font-extrabold tracking-[0.16em] text-bin-in-text"
            style={{
              boxShadow: '2px 2px 0 rgb(var(--color-ink) / 0.16)',
              opacity: inside ? 1 : 0,
              transform: inside ? 'scale(1) rotate(-6deg)' : 'scale(0.55) rotate(-6deg)',
              transition: 'opacity 220ms ease, transform 420ms cubic-bezier(.2,1.6,.4,1)',
            }}
          >
            IN
          </div>
          <div
            className="absolute bottom-0 left-[9px] right-[9px] top-[11px] z-[3] rounded-t-[6px] border-2 border-b-0 border-ink bg-slip"
            style={{
              transformOrigin: 'left center',
              transform: open ? 'rotateY(-76deg)' : 'rotateY(0deg)',
              transition: 'transform 560ms cubic-bezier(.3,1.16,.45,1)',
            }}
          >
            <div className="absolute left-2 right-2 top-2.5 h-11 rounded-[3px] border-[1.5px] border-line" />
            <div className="absolute right-2 top-1/2 -mt-1 h-2 w-2 rounded-full bg-bin-in" />
          </div>
        </div>

        <div
          className="absolute bottom-8 left-[14px] z-[4] h-[112px] w-[90px]"
          style={{ transform: cardTransform, transition: cardTransition }}
        >
          <div
            className="absolute -bottom-2.5 left-1.5 right-1.5 h-2 rounded-full"
            style={{
              background: 'rgb(var(--color-ink) / 0.12)',
              filter: 'blur(1px)',
              opacity: inside ? 0 : 1,
              transition: 'opacity 260ms ease',
            }}
          />
          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[13px] border-[1.5px] border-line bg-screen"
            style={{ boxShadow: '6px 6px 0 rgb(var(--color-ink) / 0.15)' }}
          >
            {words.map((word, i) => (
              <span
                key={word}
                className="absolute font-display text-[19px] font-bold tracking-[-0.01em]"
                style={{
                  opacity: fade(i),
                  transform: slide(i),
                  transition: 'opacity 220ms ease, transform 320ms cubic-bezier(.3,1.2,.4,1)',
                }}
              >
                {word}
              </span>
            ))}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-bin-in-chip" />
          </div>
        </div>
      </div>

      <div className="flex w-[304px] flex-col gap-3">
        <div className="flex h-[34px] items-end justify-between">
          <div className="relative h-[19px] flex-1 text-[13.5px] text-ink-soft">
            {captions.map((caption, i) => (
              <span
                key={caption}
                className="absolute left-0 top-0"
                style={{ opacity: fade(i), transition: 'opacity 300ms ease' }}
              >
                {caption}
              </span>
            ))}
          </div>
          <span className="font-display text-[30px] font-extrabold leading-[0.9] tracking-[-0.03em] tabular-nums text-bin-in-text">
            {Math.round(progress)}
            <span className="text-[15px] text-ink-soft">%</span>
          </span>
        </div>
        <div
          className="relative h-4 overflow-hidden rounded-full border-[1.5px] border-ink bg-slip"
          style={{ boxShadow: '3px 3px 0 rgb(var(--color-ink) / 0.13)' }}
        >
          <div
            className="h-full animate-bncStripe bg-bin-in"
            style={{
              width: `${progress.toFixed(1)}%`,
              backgroundImage:
                'repeating-linear-gradient(115deg, rgb(var(--color-slip) / 0.22) 0 8px, rgba(0,0,0,0) 8px 24px)',
              backgroundSize: '48px 100%',
              transition: 'width 90ms linear',
            }}
          />
        </div>
      </div>
    </div>
  )
}
