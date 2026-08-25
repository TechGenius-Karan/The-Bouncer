import type {
  ApiLabel,
  CheckSwipeResponse,
  GetCrackRateResponse,
  GetPuzzleMetaResponse,
  GetRoundResponse,
} from './types'

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}))
    const message = (body as { error?: string }).error ?? `Request failed (${res.status})`
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export function getRound(resultId: string | null): Promise<GetRoundResponse> {
  const params = new URLSearchParams()
  if (resultId) params.set('resultId', resultId)
  // Forwards a manually-appended ?asOf= on the page's own URL, so a
  // simulated day (Phase 5's dev/preview-only override, see get-round.ts)
  // can actually be played through the real UI, not just queried directly.
  // Inert anywhere the server doesn't honor it, including production.
  const asOf = new URLSearchParams(window.location.search).get('asOf')
  if (asOf) params.set('asOf', asOf)
  const query = params.size > 0 ? `?${params.toString()}` : ''
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

export function getCrackRate(puzzleId: string): Promise<GetCrackRateResponse> {
  return fetch(`/api/get-crack-rate?puzzleId=${encodeURIComponent(puzzleId)}`).then(
    parseOrThrow<GetCrackRateResponse>,
  )
}

export function getPuzzleMeta(): Promise<GetPuzzleMetaResponse> {
  return fetch('/api/get-puzzle-meta').then(parseOrThrow<GetPuzzleMetaResponse>)
}
