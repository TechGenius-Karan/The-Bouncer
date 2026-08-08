import { motion } from 'framer-motion'
import type { Puzzle, GameState } from '../game/types'

interface Props {
  puzzle: Puzzle
  gameState: GameState
  score: number
  totalGuests: number
  endedEarly: boolean
  onNextPuzzle?: () => void
}

const outcomeConfig = {
  correct: {
    bg: 'bg-bin-in-light border-bin-in',
    text: 'text-bin-in',
    badge: 'bg-bin-in text-white',
    icon: '✓',
    label: 'Correct',
  },
  'wrong-corrected': {
    bg: 'bg-red-50 border-red-300',
    text: 'text-red-600',
    badge: 'bg-red-500 text-white',
    icon: '✗',
    label: 'Wrong',
  },
  'not-reached': {
    bg: 'bg-slate-100 border-slate-200',
    text: 'text-slate-400',
    badge: 'bg-slate-400 text-white',
    icon: '–',
    label: 'Not reached',
  },
}

export function RevealScreen({
  puzzle,
  gameState,
  score,
  totalGuests,
  endedEarly,
  onNextPuzzle,
}: Props) {
  const headline = endedEarly
    ? 'Out of guesses for today'
    : score === totalGuests
    ? 'Perfect — not a single mistake!'
    : 'Here\'s how it went'

  const subtext = endedEarly
    ? "Here's how it shook out — come back tomorrow for a fresh puzzle."
    : score === totalGuests
    ? 'You cracked the rule without losing a single life.'
    : `You placed ${score} out of ${totalGuests} correctly.`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5 h-full"
    >
      {/* Headline */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">{headline}</h2>
        <p className="text-sm text-slate-500 mt-1">{subtext}</p>
      </div>

      {/* Score pill */}
      <div className="flex justify-center">
        <div className="bg-slate-100 rounded-full px-6 py-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-800">{score}</span>
          <span className="text-lg text-slate-400">/ {totalGuests}</span>
        </div>
      </div>

      {/* Rule reveal */}
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="rounded-bin bg-teal-50 border-2 border-bin-in px-4 py-4"
      >
        <p className="text-xs font-bold text-bin-in uppercase tracking-widest mb-1">The rule was</p>
        <p className="text-base font-semibold text-slate-800">{puzzle.ruleText}</p>
      </motion.div>

      {/* Guest-by-guest breakdown */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Guest breakdown
        </p>
        <div className="grid grid-cols-2 gap-2">
          {puzzle.guests.map((guest, i) => {
            const result = gameState.results[guest.id]
            if (!result) return null
            const cfg = outcomeConfig[result.outcome]
            return (
              <motion.div
                key={guest.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.2 }}
                className={`relative rounded-card border-2 px-3 py-2.5 ${cfg.bg}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold tracking-wide text-sm ${cfg.text}`}>{guest.word}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge} shrink-0`}>
                    {result.trueLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{cfg.label}</p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Next puzzle / share area */}
      {onNextPuzzle && (
        <button
          onClick={onNextPuzzle}
          className="mt-auto w-full py-3.5 rounded-bin font-bold text-white bg-bin-in hover:bg-teal-700 active:scale-95 transition-all duration-150 shadow-card"
        >
          Try the next puzzle
        </button>
      )}

      <p className="text-center text-xs text-slate-300 pb-2">
        Come back tomorrow for puzzle #2
      </p>
    </motion.div>
  )
}
