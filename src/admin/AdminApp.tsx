import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  aiReview,
  approve,
  clearStoredCode,
  getBufferHealth,
  listPending,
  reject,
  loadStoredCode,
  login,
  storeCode,
} from './adminClient'
import { BatchStats } from './BatchStats'
import { BufferHealthPanel } from './BufferHealthPanel'
import { GenerateBatchPanel } from './GenerateBatchPanel'
import { LivePuzzleStats } from './LivePuzzleStats'
import { PuzzleReviewCard } from './PuzzleReviewCard'
import type { AdminAiReviewResponse, AdminBufferHealthResponse, AdminPuzzleDetail } from './types'
// Dark mode is shelved for now — commented out, not removed, so it's a
// quick re-enable later (see src/theme.ts).
// import { getTheme, toggleTheme } from '../theme'

type Status = 'checking' | 'gate' | 'loading' | 'ready' | 'error'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

function aiBannerHeadline(result: AdminAiReviewResponse): string {
  switch (result.action) {
    case 'swap-word':
      return result.changed
        ? 'Swapped one word and re-validated — the puzzle is updated below.'
        : 'Could not swap that word; the puzzle is unchanged.'
    case 'rewrite-puzzle':
      return result.changed
        ? 'Rewrote the puzzle to address your notes — it is updated below.'
        : 'The rewrite did not pass validation, so the puzzle is unchanged.'
    case 'adjust-difficulty':
      return 'Recalibrated the rule’s difficulty for future puzzles. This puzzle is unchanged.'
    case 'agree-reject':
      return 'Could not act on that feedback — the puzzle is unchanged and still in the queue.'
  }
}

export function AdminApp() {
  // const [darkMode, setDarkMode] = useState(() => getTheme() === 'dark')
  const [code, setCode] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState<string | null>(null)
  const [puzzles, setPuzzles] = useState<AdminPuzzleDetail[]>([])
  const [bufferHealth, setBufferHealth] = useState<AdminBufferHealthResponse | null>(null)
  const [aiBanner, setAiBanner] = useState<AdminAiReviewResponse | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const loadQueue = async (activeCode: string) => {
    setStatus('loading')
    try {
      const [pending, health] = await Promise.all([
        listPending(activeCode),
        getBufferHealth(activeCode),
      ])
      setPuzzles(pending.puzzles)
      setBufferHealth(health)
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

  const handleRefine = async (puzzleId: string, reason: string) => {
    if (!code) return
    // The puzzle stays in the queue either way — refine can rewrite its words
    // but never discards it — so reload to pick up whatever changed.
    const result = await aiReview(code, puzzleId, reason)
    setAiBanner(result)
    await loadQueue(code)
  }

  const handleReject = async (puzzleId: string, reason: string) => {
    if (!code) return
    await reject(code, puzzleId, reason)
    setPuzzles((prev) => prev.filter((p) => p.puzzleId !== puzzleId))
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

        {aiBanner && (
          <div
            className={`flex items-start justify-between gap-3 rounded-bin border p-4 font-sans text-sm ${
              aiBanner.changed
                ? 'border-bin-in bg-bin-in-chip text-bin-in-text'
                : 'border-line bg-slip text-ink'
            }`}
          >
            <div>
              <div className="font-semibold">{aiBannerHeadline(aiBanner)}</div>
              <div className="mt-1 text-ink-soft">Rationale: {aiBanner.rationale}</div>
            </div>
            <button
              onClick={() => setAiBanner(null)}
              className="shrink-0 font-sans text-xs text-ink-soft underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {status === 'ready' && code && (
          <GenerateBatchPanel code={code} onGenerated={() => code && loadQueue(code)} />
        )}

        {status === 'ready' && bufferHealth && <BufferHealthPanel health={bufferHealth} />}

        {status === 'ready' && puzzles.length === 0 && (
          <div className="font-sans text-ink-soft">Nothing waiting for review.</div>
        )}

        {puzzles.map((puzzle) => (
          <PuzzleReviewCard
            key={puzzle.puzzleId}
            puzzle={puzzle}
            onApprove={() => handleApprove(puzzle.puzzleId)}
            onRefine={(reason) => handleRefine(puzzle.puzzleId, reason)}
            onReject={(reason) => handleReject(puzzle.puzzleId, reason)}
          />
        ))}

        {status === 'ready' && code && <LivePuzzleStats code={code} />}
        {status === 'ready' && code && <BatchStats code={code} />}
      </div>
    </div>
  )
}
