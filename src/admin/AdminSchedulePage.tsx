import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  clearStoredCode,
  listApproved,
  listScheduled,
  loadStoredCode,
  login,
  schedulePuzzle,
  storeCode,
  unapprove,
  unschedule,
} from './adminClient'
import { ApprovedPanel } from './ApprovedPanel'
import { SchedulePanel } from './SchedulePanel'
import type { AdminListApprovedResponse, AdminListScheduledResponse } from './types'

type Status = 'checking' | 'gate' | 'loading' | 'ready' | 'error'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export function AdminSchedulePage() {
  const [code, setCode] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState<string | null>(null)
  const [approved, setApproved] = useState<AdminListApprovedResponse | null>(null)
  const [scheduled, setScheduled] = useState<AdminListScheduledResponse | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const loadSchedule = async (activeCode: string) => {
    setStatus('loading')
    try {
      const [approvedQueue, schedule] = await Promise.all([listApproved(activeCode), listScheduled(activeCode)])
      setApproved(approvedQueue)
      setScheduled(schedule)
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
    void loadSchedule(stored)
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
    await loadSchedule(codeInput)
  }

  const handleUnschedule = async (puzzleId: string) => {
    if (!code) return
    await unschedule(code, puzzleId)
    await loadSchedule(code)
  }

  const handleSchedulePuzzle = async (puzzleId: string, date: string) => {
    if (!code) return
    await schedulePuzzle(code, puzzleId, date)
    await loadSchedule(code)
  }

  const handleUnapprove = async (puzzleId: string) => {
    if (!code) return
    await unapprove(code, puzzleId)
    await loadSchedule(code)
  }

  const handleLogout = () => {
    clearStoredCode()
    setCode(null)
    setApproved(null)
    setScheduled(null)
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
          <div className="font-display text-2xl font-bold">Schedule</div>
          <div className="flex items-center gap-4">
            <a href="/admin" className="font-sans text-sm text-ink-soft underline">
              Back to review queue
            </a>
            <button onClick={handleLogout} className="font-sans text-sm text-ink-soft underline">
              Log out
            </button>
          </div>
        </div>

        {status === 'loading' && <div className="font-sans text-ink-soft">Loading schedule…</div>}
        {status === 'error' && <div className="font-sans text-miss-text">{error}</div>}

        {status === 'ready' && approved && (
          <ApprovedPanel data={approved} onSchedule={handleSchedulePuzzle} onUnapprove={handleUnapprove} />
        )}

        {status === 'ready' && scheduled && <SchedulePanel data={scheduled} onPull={handleUnschedule} />}
      </div>
    </div>
  )
}
