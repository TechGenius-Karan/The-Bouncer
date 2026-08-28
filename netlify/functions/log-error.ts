// Phase 11: receives client-side crash reports (see src/reportError.ts) and
// console.errors them — Netlify's Function log dashboard is the whole
// "monitoring" surface here, deliberately not a new DB collection/service.
// ponytail: no persistence or alerting, upgrade to a real sink (Sentry, a
// `errorReports` collection) if volume/triage needs ever outgrow log-reading.

import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const body: unknown = await req.json().catch(() => null)
  console.error('[client-error]', body)

  return new Response(null, { status: 204 })
}
