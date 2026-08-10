import type {
  AdminBatchStatsResponse,
  AdminBufferHealthResponse,
  AdminListPendingResponse,
  AdminPuzzleStatsResponse,
} from './types'

const CODE_KEY = 'bouncer-admin-code'

export function loadStoredCode(): string | null {
  try {
    return sessionStorage.getItem(CODE_KEY)
  } catch {
    return null
  }
}

export function storeCode(code: string): void {
  try {
    sessionStorage.setItem(CODE_KEY, code)
  } catch {
    // Storage unavailable — the reviewer just has to re-enter the code next visit.
  }
}

export function clearStoredCode(): void {
  try {
    sessionStorage.removeItem(CODE_KEY)
  } catch {
    // ignore
  }
}

async function adminFetch(path: string, code: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), 'x-admin-token': code },
  })
}

export async function login(code: string): Promise<boolean> {
  const res = await adminFetch('/api/admin-login', code, { method: 'POST' })
  return res.ok
}

export async function listPending(code: string): Promise<AdminListPendingResponse> {
  const res = await adminFetch('/api/admin-list-pending', code)
  if (!res.ok) throw new Error(`Failed to load the queue (${res.status})`)
  return res.json() as Promise<AdminListPendingResponse>
}

export async function approve(code: string, puzzleId: string): Promise<void> {
  const res = await adminFetch('/api/admin-approve', code, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ puzzleId }),
  })
  if (!res.ok) throw new Error(`Failed to approve (${res.status})`)
}

export async function reject(code: string, puzzleId: string, reason: string): Promise<void> {
  const res = await adminFetch('/api/admin-reject', code, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ puzzleId, reason }),
  })
  if (!res.ok) throw new Error(`Failed to reject (${res.status})`)
}

export async function getBufferHealth(code: string): Promise<AdminBufferHealthResponse> {
  const res = await adminFetch('/api/admin-buffer-health', code)
  if (!res.ok) throw new Error(`Failed to load buffer health (${res.status})`)
  return res.json() as Promise<AdminBufferHealthResponse>
}

export async function getPuzzleStats(code: string, number: number): Promise<AdminPuzzleStatsResponse> {
  const res = await adminFetch(`/api/admin-puzzle-stats?number=${encodeURIComponent(number)}`, code)
  if (!res.ok) throw new Error(`Failed to load puzzle stats (${res.status})`)
  return res.json() as Promise<AdminPuzzleStatsResponse>
}

export async function getBatchStats(code: string, from: number, to: number): Promise<AdminBatchStatsResponse> {
  const res = await adminFetch(`/api/admin-batch-stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, code)
  if (!res.ok) throw new Error(`Failed to load batch stats (${res.status})`)
  return res.json() as Promise<AdminBatchStatsResponse>
}
