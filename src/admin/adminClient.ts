import type { AdminListPendingResponse } from './types'

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
