import type { ApiLabel, CheckSwipeResponse, GetRoundResponse } from './types'

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}))
    const message = (body as { error?: string }).error ?? `Request failed (${res.status})`
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export function getRound(resultId: string | null): Promise<GetRoundResponse> {
  const query = resultId ? `?resultId=${encodeURIComponent(resultId)}` : ''
  return fetch(`/api/get-round${query}`).then(parseOrThrow<GetRoundResponse>)
}

export function checkSwipe(
  resultId: string,
  wordId: string,
  attemptedLabel: ApiLabel,
): Promise<CheckSwipeResponse> {
  return fetch('/api/check-swipe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resultId, wordId, attemptedLabel }),
  }).then(parseOrThrow<CheckSwipeResponse>)
}
