// Phase 11: minimal client-side crash visibility — no Sentry account/dependency,
// just forwards to a Netlify Function that console.errors the report so it shows
// up in Netlify's own Function log dashboard (already the ops surface for backend
// errors). Never throws itself — a broken error reporter must not mask the
// original error.
export function reportError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  console.error(`[${context}]`, error)

  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context, message, stack, url: window.location.href }),
  }).catch(() => {})
}
