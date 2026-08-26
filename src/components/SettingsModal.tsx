import { useEffect, useState } from 'react'
import { version } from '../../package.json'
import { getPuzzleMeta } from '../api/client'
import { getTheme, toggleTheme } from '../theme'

interface Props {
  onClose: () => void
  onHowToPlay: () => void
  onShowStats: () => void
}

export function SettingsModal({ onClose, onHowToPlay, onShowStats }: Props) {
  const [darkMode, setDarkMode] = useState(() => getTheme() === 'dark')
  const [puzzleNumber, setPuzzleNumber] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getPuzzleMeta()
      .then((meta) => {
        if (!cancelled) setPuzzleNumber(meta.number)
      })
      .catch(() => {
        // Settings must never block on this — it's a tiny decorative detail.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-y-auto rounded-t-screen bg-screen sm:rounded-screen">
        <div className="flex items-center justify-between px-7 pt-6">
          <div className="font-display text-[31px] font-extrabold tracking-tight">Settings</div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-skip-bg text-lg text-ink-soft"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5 px-7 py-4">
          <div className="flex items-center justify-between rounded-bin border border-line bg-slip px-4 py-3">
            <div className="font-sans text-[15px] font-semibold">Dark mode</div>
            <button
              onClick={() => setDarkMode(toggleTheme() === 'dark')}
              aria-label="Toggle dark mode"
              aria-pressed={darkMode}
              className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
                darkMode ? 'bg-ink' : 'bg-skip'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-slip transition-transform ${
                  darkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => {
              onClose()
              onHowToPlay()
            }}
            className="flex items-center justify-between rounded-bin border border-line bg-slip px-4 py-3 text-left"
          >
            <span className="font-sans text-[15px] font-semibold">How to play</span>
            <span className="text-ink-soft">›</span>
          </button>

          <button
            onClick={() => {
              onClose()
              onShowStats()
            }}
            className="flex items-center justify-between rounded-bin border border-line bg-slip px-4 py-3 text-left"
          >
            <span className="font-sans text-[15px] font-semibold">Reset stats & history</span>
            <span className="text-ink-soft">›</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-1 px-7 pb-2 pt-1 text-center">
          <div className="font-sans text-sm font-semibold text-ink-soft">
            The Bouncer{' '}
            <span className="text-[11px] font-normal text-ink-faint">
              #{puzzleNumber ?? '—'}
            </span>
          </div>
          <div className="font-sans text-xs text-ink-faint">v{version}</div>
          <a
            href="mailto:karanmhetar595@gmail.com"
            className="mt-1 border-b-[1.5px] border-skip pb-0.5 text-[13px] font-semibold text-ink-soft"
          >
            Send feedback
          </a>
        </div>

        <div className="px-7 pb-7 pt-3">
          <button
            onClick={onClose}
            className="h-12 w-full rounded-bin bg-ink font-display text-lg font-bold text-screen shadow-pressed"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
