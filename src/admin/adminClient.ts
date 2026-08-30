import type {
  AdminBatchStatsResponse,
  AdminBufferHealthResponse,
  AdminGenerateBatchResponse,
  AdminListApprovedResponse,
  AdminListPendingResponse,
  AdminListScheduledResponse,
  AdminPuzzleStatsResponse,
  AdminRepairWordResponse,
  AdminRuleRejectStatsResponse,
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

export async function repairWord(
  code: string,
  puzzleId: string,
  badWordId: string,
  reason: string,
): Promise<AdminRepairWordResponse> {
  const res = await adminFetch('/api/admin-repair-word', code, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ puzzleId, badWordId, reason }),
  })
  if (!res.ok) throw new Error(`Failed to repair word (${res.status})`)
  return res.json() as Promise<AdminRepairWordResponse>
}

export async function getRuleRejectStats(code: string): Promise<AdminRuleRejectStatsResponse> {
  const res = await adminFetch('/api/admin-rule-reject-stats', code)
  if (!res.ok) throw new Error(`Failed to load rule reject stats (${res.status})`)
  return res.json() as Promise<AdminRuleRejectStatsResponse>
}

export async function listScheduled(code: string): Promise<AdminListScheduledResponse> {
  const res = await adminFetch('/api/admin-list-scheduled', code)
  if (!res.ok) throw new Error(`Failed to load the schedule (${res.status})`)
  return res.json() as Promise<AdminListScheduledResponse>
}

export async function unschedule(code: string, puzzleId: string): Promise<void> {
  const res = await adminFetch('/api/admin-unschedule', code, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ puzzleId }),
  })
  if (!res.ok) throw new Error(`Failed to pull puzzle from schedule (${res.status})`)
}

export async function listApproved(code: string): Promise<AdminListApprovedResponse> {
  const res = await adminFetch('/api/admin-list-approved', code)
  if (!res.ok) throw new Error(`Failed to load the approved queue (${res.status})`)
  return res.json() as Promise<AdminListApprovedResponse>
}

export async function schedulePuzzle(code: string, puzzleId: string, date: string): Promise<void> {
  const res = await adminFetch('/api/admin-schedule-puzzle', code, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ puzzleId, date }),
  })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}))
    const message = (body as { error?: string }).error ?? `Failed to schedule puzzle (${res.status})`
    throw new Error(message)
  }
}

export async function unapprove(code: string, puzzleId: string): Promise<void> {
  const res = await adminFetch('/api/admin-unapprove', code, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ puzzleId }),
  })
  if (!res.ok) throw new Error(`Failed to send puzzle back to review (${res.status})`)
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

export async function generateBatch(
  code: string,
  count: number,
  tiers?: ('medium' | 'spicy')[],
): Promise<AdminGenerateBatchResponse> {
  const res = await adminFetch('/api/admin-generate-batch', code, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ count, tiers }),
  })
  if (!res.ok) throw new Error(`Failed to generate batch (${res.status})`)
  return res.json() as Promise<AdminGenerateBatchResponse>
}
