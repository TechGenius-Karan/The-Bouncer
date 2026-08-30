import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  approve,
  clearStoredCode,
  getBufferHealth,
  getRuleRejectStats,
  listPending,
  loadStoredCode,
  login,
  reject,
  repairWord,
  storeCode,
} from './adminClient'
import { BatchStats } from './BatchStats'
import { BufferHealthPanel } from './BufferHealthPanel'
import { GenerateBatchPanel } from './GenerateBatchPanel'
import { LivePuzzleStats } from './LivePuzzleStats'
import { PuzzleReviewCard } from './PuzzleReviewCard'
import { RuleRejectStatsPanel } from './RuleRejectStatsPanel'
import type { AdminBufferHealthResponse, AdminPuzzleDetail, AdminRuleRejectStat } from './types'
// Dark mode is shelved for now — commented out, not removed, so it's a
// quick re-enable later (see src/theme.ts).
// import { getTheme, toggleTheme } from '../theme'

type Status = 'checking' | 'gate' | 'loading' | 'ready' | 'error'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export function AdminApp() {
  // const [darkMode, setDarkMode] = useState(() => getTheme() === 'dark')
  const [code, setCode] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState<string | null>(null)
  const [puzzles, setPuzzles] = useState<AdminPuzzleDetail[]>([])
  const [bufferHealth, setBufferHealth] = useState<AdminBufferHealthResponse | null>(null)
  const [ruleRejectStats, setRuleRejectStats] = useState<AdminRuleRejectStat[]>([])
  const [codeInput, setCodeInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const loadQueue = async (activeCode: string) => {
    setStatus('loading')
    try {
      const [pending, health, rejectStats] = await Promise.all([
        listPending(activeCode),
        getBufferHealth(activeCode),
        getRuleRejectStats(activeCode),
      ])
      setPuzzles(pending.puzzles)
      setBufferHealth(health)
      setRuleRejectStats(rejectStats.rules)
      setStatus('ready')
    } catch (err) {
      setError(errorMessage(err))
      setStatus('error')
    }
  }

  useEffect(() => {
    const stored = loadStoredCode()
    if (!stored) {
      setStatus('gate')
      return
    }
    setCode(stored)
    void loadQueue(stored)
  }, [])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    const ok = await login(codeInput)
    if (!ok) {
      setLoginError('Wrong code.')
      return
    }
    storeCode(codeInput)
    setCode(codeInput)
    await loadQueue(codeInput)
  }

  const handleApprove = async (puzzleId: string) => {
    if (!code) return
    await approve(code, puzzleId)
    setPuzzles((prev) => prev.filter((p) => p.puzzleId !== puzzleId))
  }

  const handleReject = async (puzzleId: string, reason: string) => {
    if (!code) return
    await reject(code, puzzleId, reason)
    setPuzzles((prev) => prev.filter((p) => p.puzzleId !== puzzleId))
  }

  const handleRepairWord = async (puzzleId: string, badWordId: string, reason: string) => {
    if (!code) return { repaired: false }
    const result = await repairWord(code, puzzleId, badWordId, reason)
    // Either outcome changes this puzzle's content or status server-side —
    // simplest correct thing is to reload the queue rather than hand-patch
    // local state for a swapped word or a flip to rejected.
    await loadQueue(code)
    return result
  }

  const handleLogout = () => {
    clearStoredCode()
    setCode(null)
    setPuzzles([])
    setStatus('gate')
  }

  if (status === 'checking') {
    return <div className="p-8 font-sans text-ink-soft">Loading…</div>
  }

  if (status === 'gate') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <form
          onSubmit={handleLogin}
          className="flex w-full max-w-sm flex-col gap-3 rounded-bin border border-line bg-slip p-6"
        >
          <div className="font-display text-lg font-bold">Admin access</div>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Access code"
            className="rounded-card border border-line bg-screen px-3 py-2 font-sans text-sm"
            autoFocus
          />
          {loginError && <div className="font-sans text-sm text-miss-text">{loginError}</div>}
          <button
            type="submit"
            className="rounded-bin bg-ink px-4 py-2 font-display text-sm font-bold text-screen"
          >
            Enter
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl font-bold">Pending review ({puzzles.length})</div>
          <div className="flex items-center gap-4">
            {/* Dark mode toggle is hidden for now — not deleted, just
                commented out, so it's a quick re-enable later.
            <button
              onClick={() => setDarkMode(toggleTheme() === 'dark')}
              className="font-sans text-sm text-ink-soft underline"
            >
              {darkMode ? 'Light mode' : 'Dark mode'}
            </button>
            */}
            <a href="/admin/schedule" className="font-sans text-sm text-ink-soft underline">
              Schedule
            </a>
            <button onClick={handleLogout} className="font-sans text-sm text-ink-soft underline">
              Log out
            </button>
          </div>
        </div>

        {status === 'loading' && <div className="font-sans text-ink-soft">Loading queue…</div>}
        {status === 'error' && <div className="font-sans text-miss-text">{error}</div>}

        {status === 'ready' && code && (
          <GenerateBatchPanel code={code} onGenerated={() => code && loadQueue(code)} />
        )}

        {status === 'ready' && bufferHealth && <BufferHealthPanel health={bufferHealth} />}
        {status === 'ready' && <RuleRejectStatsPanel rules={ruleRejectStats} />}

        {status === 'ready' && puzzles.length === 0 && (
          <div className="font-sans text-ink-soft">Nothing waiting for review.</div>
        )}

        {puzzles.map((puzzle) => (
          <PuzzleReviewCard
            key={puzzle.puzzleId}
            puzzle={puzzle}
            onApprove={() => handleApprove(puzzle.puzzleId)}
            onReject={(reason) => handleReject(puzzle.puzzleId, reason)}
            onRepairWord={(badWordId, reason) => handleRepairWord(puzzle.puzzleId, badWordId, reason)}
          />
        ))}

        {status === 'ready' && code && <LivePuzzleStats code={code} />}
        {status === 'ready' && code && <BatchStats code={code} />}
      </div>
    </div>
  )
}
