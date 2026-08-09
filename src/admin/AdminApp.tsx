import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  approve,
  clearStoredCode,
  getBufferHealth,
  listPending,
  loadStoredCode,
  login,
  reject,
  storeCode,
} from './adminClient'
import { BufferHealthPanel } from './BufferHealthPanel'
import { LivePuzzleStats } from './LivePuzzleStats'
import { PuzzleReviewCard } from './PuzzleReviewCard'
import type { AdminBufferHealthResponse, AdminPuzzleDetail } from './types'

type Status = 'checking' | 'gate' | 'loading' | 'ready' | 'error'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export function AdminApp() {
  const [code, setCode] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState<string | null>(null)
  const [puzzles, setPuzzles] = useState<AdminPuzzleDetail[]>([])
  const [bufferHealth, setBufferHealth] = useState<AdminBufferHealthResponse | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const loadQueue = async (activeCode: string) => {
    setStatus('loading')
    try {
      const [pending, health] = await Promise.all([listPending(activeCode), getBufferHealth(activeCode)])
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
          <button onClick={handleLogout} className="font-sans text-sm text-ink-soft underline">
            Log out
          </button>
        </div>

        {status === 'loading' && <div className="font-sans text-ink-soft">Loading queue…</div>}
        {status === 'error' && <div className="font-sans text-miss-text">{error}</div>}

        {status === 'ready' && bufferHealth && <BufferHealthPanel health={bufferHealth} />}

        {status === 'ready' && puzzles.length === 0 && (
          <div className="font-sans text-ink-soft">Nothing waiting for review.</div>
        )}

        {puzzles.map((puzzle) => (
          <PuzzleReviewCard
            key={puzzle.puzzleId}
            puzzle={puzzle}
            onApprove={() => handleApprove(puzzle.puzzleId)}
            onReject={(reason) => handleReject(puzzle.puzzleId, reason)}
          />
        ))}

        {status === 'ready' && code && <LivePuzzleStats code={code} />}
      </div>
    </div>
  )
}
